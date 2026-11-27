import YAML, { isMap, isPair, isScalar, isSeq, type Pair, type YAMLMap } from 'yaml';

export interface ParsedEntry {
  frontmatter: Record<string, unknown>;
  body: string;
}

/** One front matter edit. An `undefined` value removes the key. */
export interface FieldChange {
  path: string[];
  value: unknown;
}

export class InvalidFrontMatterError extends Error {
  override name = 'InvalidFrontMatterError';
}

// Opening line, YAML (with its final newline), closing line, everything after.
const FRONTMATTER_RE = /^(---[ \t]*\r?\n)((?:[\s\S]*?\n)??)(---[ \t]*(?:\r?\n|$))([\s\S]*)$/;
const BOM = '\uFEFF';
const LEADING_BLANK_LINES = /^(?:[ \t]*\r?\n)*/;

function loadYaml(source: string) {
  const doc = YAML.parseDocument(source);
  if (doc.errors.length) throw new InvalidFrontMatterError(doc.errors[0].message);
  try {
    return { contents: doc.contents, data: doc.toJS() as unknown };
  } catch (err) {
    // e.g. an alias with no matching anchor
    throw new InvalidFrontMatterError(err instanceof Error ? err.message : String(err));
  }
}

/** Splits a file into its parts. Only a YAML mapping (or nothing) counts as front matter. */
function split(raw: string) {
  const bom = raw.startsWith(BOM) ? BOM : '';
  const text = raw.slice(bom.length);
  const m = text.match(FRONTMATTER_RE);
  if (m) {
    const [, open, yaml, close, body] = m;
    const { contents, data } = loadYaml(yaml);
    if (contents === null || isMap(contents)) {
      const frontmatter = (data ?? {}) as Record<string, unknown>;
      return { bom, block: { open, yaml, close }, frontmatter, body };
    }
  }
  return { bom, block: null, frontmatter: {} as Record<string, unknown>, body: text };
}

export function parseEntry(raw: string): ParsedEntry {
  const { frontmatter, body } = split(raw);
  return { frontmatter, body };
}

/** Serializes a new file. Existing files go through `updateEntry`. */
export function stringifyEntry(frontmatter: Record<string, unknown>, body: string): string {
  const fm = YAML.stringify(frontmatter, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  }).trimEnd();
  const bodyTrimmed = body.replace(/^\s+/, '');
  return `---\n${fm}\n---\n\n${bodyTrimmed}\n`;
}

/**
 * Applies edits to an existing file, leaving every byte outside the changed
 * keys (and the body, when `body` is given) as it was. Throws
 * `InvalidFrontMatterError` for an edit it can't make without losing data.
 */
export function updateEntry(raw: string, changes: FieldChange[], body?: string): string {
  const entry = split(raw);
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const nextBody =
    body === undefined ? entry.body : replaceBody(entry.body, body, eol, entry.block ? eol : '');

  // What the front matter should say afterwards, worked out on the data alone.
  const expected = changes.reduce(
    (data, { path, value }) => setIn(data, path, value),
    entry.frontmatter,
  );
  const oldYaml = entry.block?.yaml ?? '';
  const yaml = changes.reduce((source, change) => applyChange(source, change, eol), oldYaml);
  // Splicing text can disturb neighbouring YAML, so check what it now says.
  if (changes.length && !isSameData(loadYaml(yaml).data ?? {}, expected)) {
    throw new InvalidFrontMatterError(
      'This change can\'t be saved without altering other front matter.',
    );
  }

  if (entry.block) {
    const { open, close } = entry.block;
    const gap = nextBody && !close.endsWith('\n') ? eol : '';
    return entry.bom + open + yaml + close + gap + nextBody;
  }
  if (!yaml) return entry.bom + nextBody;
  const text = nextBody.replace(LEADING_BLANK_LINES, '');
  return `${entry.bom}---${eol}${yaml}---${eol}${text ? eol + text : ''}`;
}

/** Swaps the body text, keeping the blank lines around the old one. */
function replaceBody(old: string, next: string, eol: string, gap: string): string {
  if (next === old) return old;
  const text = next.replace(LEADING_BLANK_LINES, '').trimEnd().replace(/\r?\n/g, eol);
  if (!text) return '';
  if (!old.trim()) return gap + text + eol;
  return old.match(LEADING_BLANK_LINES)![0] + text + old.match(/\s*$/)![0];
}

/** Applies one change to YAML source by splicing the lines of the affected pair. */
function applyChange(source: string, { path, value }: FieldChange, eol: string): string {
  const { contents, data } = loadYaml(source);
  let map = contents as YAMLMap | null;
  let current = data as Record<string, unknown> | undefined;
  const parents: { map: YAMLMap; pair: Pair }[] = [];

  for (let depth = 0; ; depth++) {
    // A `{ ... }` document has no lines of its own to splice.
    if (map?.flow) throw new InvalidFrontMatterError('Front matter written as { ... } can\'t be edited.');
    const key = path[depth];
    const rest = path.slice(depth + 1);
    const pair = map?.items.find((p) => isScalar(p.key) && String(p.key.value) === key);

    if (!pair) {
      if (value === undefined) return source;
      return insertPair(source, map, key, nest(rest, value), eol);
    }

    if (!rest.length) {
      if (value !== undefined) return replacePair(source, pair, key, value, eol);
      // Removing the only key of a parent removes the parent too.
      let target = pair;
      let owner = map!;
      while (owner.items.length === 1 && parents.length) {
        ({ map: owner, pair: target } = parents.pop()!);
      }
      return removePair(source, target);
    }

    current = current?.[key] as Record<string, unknown> | undefined;
    const child = pair.value;
    if (isMap(child) && !child.flow) {
      parents.push({ map: map!, pair });
      map = child;
      continue;
    }

    // The parent is empty or inline (anything else only gets here on a removal
    // with nothing to remove, or was refused above): rewrite it as a whole.
    if (value === undefined && !isPlainObject(current)) return source;
    const parent = asParent(current);
    const object = setIn(parent, rest, value);
    if (object === parent) return source;
    if (!Object.keys(object).length) {
      return applyChange(source, { path: path.slice(0, depth + 1), value: undefined }, eol);
    }
    return replacePair(source, pair, key, object, eol);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** The mapping to write a child key into. Refuses to replace existing content. */
function asParent(value: unknown): Record<string, unknown> {
  if (isPlainObject(value)) return value;
  if (value === undefined || value === null || value === '') return {};
  throw new InvalidFrontMatterError('Can\'t add a field inside a value that is text or a list.');
}

function nest(path: string[], value: unknown): unknown {
  return path.reduceRight((inner, key) => ({ [key]: inner }), value);
}

/**
 * Returns a copy of `object` with a nested key set or deleted, dropping parents
 * a deletion empties. Returns `object` itself when there was nothing to delete.
 */
function setIn(
  object: Record<string, unknown>,
  [key, ...rest]: string[],
  value: unknown,
): Record<string, unknown> {
  const has = Object.hasOwn(object, key);
  let next = value;
  if (rest.length) {
    const child = has ? object[key] : undefined;
    if (value === undefined && !isPlainObject(child)) return object;
    const parent = asParent(child);
    const updated = setIn(parent, rest, value);
    if (updated === parent) return object;
    next = value === undefined && !Object.keys(updated).length ? undefined : updated;
  } else if (value === undefined && !has) {
    return object;
  }
  const copy = { ...object };
  if (next === undefined) delete copy[key];
  else copy[key] = next;
  return copy;
}

/** Deep equality for parsed YAML. Key order and `undefined` members don't count. */
function isSameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && a.length !== (b as unknown[]).length) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return Object.keys({ ...left, ...right }).every((key) => isSameData(left[key], right[key]));
}

type Ranged = { range?: [number, number, number] | null };

const keyStart = (pair: Pair) => (pair.key as Ranged).range![0];
const lineStart = (source: string, at: number) => source.lastIndexOf('\n', at - 1) + 1;
const column = (source: string, pair: Pair) => keyStart(pair) - lineStart(source, keyStart(pair));

/** Index of the line break (or end of source) that finishes the line holding `at`. */
function lineEnd(source: string, at: number): number {
  const newline = source.indexOf('\n', at);
  if (newline === -1) return source.length;
  return source[newline - 1] === '\r' ? newline - 1 : newline;
}

/**
 * Offset just past a node's last visible character. Block collections are
 * followed to their last leaf so that comments below them are left alone.
 */
function endOf(source: string, node: unknown): number {
  if (isPair(node)) return endOf(source, node.value ?? node.key);
  if ((isMap(node) || isSeq(node)) && !node.flow && node.items.length) {
    return endOf(source, node.items[node.items.length - 1]);
  }
  let end = (node as Ranged).range![1];
  while (end > 0 && /\s/.test(source[end - 1])) end--;
  return end;
}

function renderPair(key: string, value: unknown): string[] {
  return YAML.stringify({ [key]: value }, { lineWidth: 0 }).replace(/\n$/, '').split('\n');
}

function indent(lines: string[], width: number, eol: string): string {
  return lines.map((line, i) => (i && line ? ' '.repeat(width) + line : line)).join(eol);
}

function replacePair(source: string, pair: Pair, key: string, value: unknown, eol: string): string {
  const start = keyStart(pair);
  const end = endOf(source, pair);
  const stop = lineEnd(source, end);
  const width = column(source, pair);

  // Comments sharing the key's line, or trailing the old value's last line.
  let comment = '';
  const node = pair.value as (Ranged & { type?: string }) | null;
  const keyEnd = (pair.key as Ranged).range![1];
  const firstStop = lineEnd(source, keyEnd);
  const isBlockScalar = node?.type === 'BLOCK_LITERAL' || node?.type === 'BLOCK_FOLDED';
  if (node?.range && (isBlockScalar || node.range[0] > firstStop)) {
    comment = source.slice(keyEnd, firstStop).match(/[ \t]+#.*$/)?.[0] ?? '';
  }
  comment += source.slice(end, stop).match(/^[ \t]+#.*$/)?.[0] ?? '';

  const lines = renderPair(key, value);
  if (comment) {
    // After a multi-line quoted scalar's first line, `#` would be text.
    if (lines.length === 1 || /^[^"']*:( [|>][-+0-9]*)?$/.test(lines[0])) lines[0] += comment;
    else lines.unshift(comment.trimStart());
  }
  return source.slice(0, start) + indent(lines, width, eol) + source.slice(stop);
}

function removePair(source: string, pair: Pair): string {
  const stop = source.indexOf('\n', endOf(source, pair));
  return source.slice(0, lineStart(source, keyStart(pair))) + (stop === -1 ? '' : source.slice(stop + 1));
}

/** Adds a key after the last one in `map`, or at the end of the front matter. */
function insertPair(source: string, map: YAMLMap | null, key: string, value: unknown, eol: string): string {
  const first = map?.items[0];
  const width = first ? column(source, first) : 0;
  // The top-level map has no indent and runs to the end of the source.
  const at = width ? source.indexOf('\n', endOf(source, map)) + 1 : source.length;
  const text = ' '.repeat(width) + indent(renderPair(key, value), width, eol) + eol;
  return source.slice(0, at) + text + source.slice(at);
}
