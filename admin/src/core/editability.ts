import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { directiveFromMarkdown } from 'mdast-util-directive';
import type { Nodes } from 'mdast';
import { containerDirectiveSyntax } from '../milkdown/containerDirectives';

/**
 * Why a body opens as plain text rather than in the visual editor:
 * - `template`: it has template tags, which the editor would treat as text.
 * - `extended`: it has tables, footnotes or task items, which the editor lacks.
 * - `unsupported`: the editor can't read it, e.g. a container with no block or
 *   one the site reads but the editor doesn't, e.g. `::: name`, which it would escape.
 * - `would-change`: the editor reads it, but would save something different.
 */
export type PlainReason = 'template' | 'extended' | 'unsupported' | 'would-change';

// Nunjucks or Liquid tags and output, and Nunjucks comments. `{#id}` alone is
// a directive attribute.
const TEMPLATE = /\{[{%]|\{#[\s\S]*?#\}/;

function parse(md: string): Nodes {
  return fromMarkdown(md, {
    extensions: [gfm(), containerDirectiveSyntax()],
    mdastExtensions: [gfmFromMarkdown(), directiveFromMarkdown()],
  });
}

function some(node: Nodes, test: (node: Nodes) => boolean): boolean {
  return test(node) || ('children' in node && node.children.some((child) => some(child, test)));
}

const extended = (node: Nodes) =>
  node.type === 'table' ||
  node.type === 'footnoteDefinition' ||
  node.type === 'footnoteReference' ||
  (node.type === 'listItem' && typeof node.checked === 'boolean');

// A line of text that opens a container, e.g. `::: callout` or `:::callout {.x}`.
// A container read as one is never text, so any such line is one the site reads
// as a container and the editor as text, which it would escape. Code is a node
// of its own, so only text is tested. A bare `:::` opens nothing.
const OPENER = /^[^\S\n]*:::+[^\S\n]*[^\s:]/;
const OPENER_AFTER_NEWLINE = /\n[^\S\n]*:::+[^\S\n]*[^\s:]/;

/** Whether a line of text, wherever it is nested, would open a container on the site. */
function containerAsText(node: Nodes): boolean {
  if (!('children' in node)) return false;
  return node.children.some((child, i) => {
    if (child.type !== 'text') return containerAsText(child);
    // A line starts at the start of a paragraph or heading, after a hard break,
    // and after a newline within the text.
    const lineStart =
      (i === 0 && (node.type === 'paragraph' || node.type === 'heading')) ||
      (i > 0 && node.children[i - 1].type === 'break');
    return OPENER_AFTER_NEWLINE.test(child.value) || (lineStart && OPENER.test(child.value));
  });
}

/** A node as compared: no positions, and runs of ASCII whitespace in text as one space. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  const node = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'position') continue;
    out[k] = node.type === 'text' && k === 'value' && typeof v === 'string' ? v.replace(/[ \t\r\n]+/g, ' ') : normalize(v);
  }
  return out;
}

/**
 * Whether two bodies are the same document, read as the site reads Markdown
 * with container blocks. Line wrapping in text doesn't count; anything else
 * that reaches the tree does, including directive labels and attributes.
 */
export function sameMarkdown(a: string, b: string): boolean {
  return JSON.stringify(normalize(parse(a))) === JSON.stringify(normalize(parse(b)));
}

/**
 * Why `original` can't be edited visually, or null if the editor keeps it
 * intact. `roundTrip` is what the editor would save for a body it loaded.
 */
export async function checkEditable(
  original: string,
  roundTrip: (md: string) => Promise<string>,
): Promise<PlainReason | null> {
  if (TEMPLATE.test(original)) return 'template';
  const tree = parse(original);
  if (some(tree, extended)) return 'extended';
  if (containerAsText(tree)) return 'unsupported';
  let saved: string;
  try {
    saved = await roundTrip(original);
  } catch {
    return 'unsupported';
  }
  return sameMarkdown(original, saved) ? null : 'would-change';
}

/**
 * What the editor reports for its document: the body as loaded while the
 * document is as it was loaded (`baseline`), so an edit undone saves nothing.
 */
export function bodyOrOriginal(serialized: string, baseline: string, original: string): string {
  return serialized === baseline ? original : serialized;
}
