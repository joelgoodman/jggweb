import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import YAML, { isMap, isScalar } from 'yaml';
import { collections } from '../src/config/schema';
import { diffFields } from '../src/core/changes';
import { parseEntry, updateEntry } from '../src/core/frontmatter';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** First and last line (zero-based) of the `title` pair in a file. */
function titleLines(raw: string): [number, number] {
  const open = raw.indexOf('\n') + 1;
  const yaml = raw.slice(open, raw.indexOf('\n---', open) + 1);
  const map = YAML.parseDocument(yaml).contents;
  if (!isMap(map)) throw new Error('no front matter mapping');
  const pair = map.items.find((p) => isScalar(p.key) && p.key.value === 'title')!;
  const start = (pair.key as { range: number[] }).range[0];
  const end = (pair.value as { range: number[] }).range[1];
  const line = (at: number) => raw.slice(0, open + at).split('\n').length - 1;
  return [line(start), line(start + yaml.slice(start, end).trimEnd().length)];
}

for (const collection of collections) {
  const dir = `${root}${collection.folder}`;
  const files = readdirSync(dir).filter((name) => name.endsWith(`.${collection.extension}`));
  const load = (fm: Record<string, unknown>) =>
    Object.fromEntries(collection.frontmatter.map((f) => [f.name, f.deserialize(fm[f.name])]));

  describe(collection.folder, () => {
    it('has entries to check', () => expect(files.length).toBeGreaterThan(0));

    describe.each(files)('%s', (name) => {
      const raw = readFileSync(`${dir}/${name}`, 'utf8');
      const { frontmatter, body } = parseEntry(raw);

      it('is identical after an untouched save', () => {
        const changes = diffFields(collection.frontmatter, load(frontmatter), load(frontmatter), frontmatter);
        expect(changes).toEqual([]);
        expect(updateEntry(raw, changes)).toBe(raw);
        expect(updateEntry(raw, changes, body)).toBe(raw);
      });

      it.runIf('title' in frontmatter)('changes only the title lines for a new title', () => {
        const current = { ...load(frontmatter), title: 'Changed title' };
        const out = updateEntry(raw, diffFields(collection.frontmatter, load(frontmatter), current, frontmatter));
        const lines = raw.split('\n');
        const [first, last] = titleLines(raw);
        expect(out.split('\n')).toEqual([...lines.slice(0, first), 'title: Changed title', ...lines.slice(last + 1)]);
      });
    });
  });
}
