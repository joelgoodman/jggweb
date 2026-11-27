// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkEditable, sameMarkdown, bodyOrOriginal, type PlainReason } from '../src/core/editability';
import { roundTripMarkdown } from '../src/milkdown/markdown';
import { CalloutNote, PullQuote, Stat, Resource } from '../src/milkdown/blocks';
import { parseEntry } from '../src/core/frontmatter';
import { collections } from '../src/config/schema';

const check = (md: string) => checkEditable(md, (s) => roundTripMarkdown(s, [CalloutNote, PullQuote, Stat, Resource]));

it.each([
  ['{% yt "x" %}', 'template'], ['{{ site.name }}', 'template'],
  ['| a |\n|---|\n| 1 |', 'extended'], ['- [ ] x', 'extended'], ['a[^1]\n\n[^1]: n', 'extended'],
  [':::tip\nx\n:::', 'unsupported'],
  ['Plain *text*.\n\n* a\n* b\n', null], ['Plain _text_.\n\n- a\n- b\n', null],
])('%s -> %s', async (md, reason) => expect(await check(md)).toBe(reason));
// The site's markdown-it also reads `::: name` with a space, which the editor would escape.
it.each([
  '::: callout {.warning}\nhi\n:::', '::: pullquote\nx\n:::', 'Text.\n::: callout\nhi\n:::',
  '> ::: callout\n> hi\n> :::', '- ::: callout\n  hi\n  :::', '1. ::: stat\n   x\n   :::',
  // Not read as a directive here, but a container to the site all the same.
  ':::callout {.warning}\nhi\n:::', ':::pullquote Title here\nx\n:::', '::::callout {.note}\nhi\n::::',
  '::: callout\nhi\n:::', 'Line  \n::: callout\nhi\n:::', 'Line\\\n::: callout\nhi\n:::',
  '::: pullquote\n---\n:::',
])('%j -> unsupported', async (md) => expect(await check(md)).toBe('unsupported'));
it.each([':::pullquote\nx\n:::', ':::callout{.note}\nhi\n:::', 'hi\n:::', 'a :::b'])('%j -> null', async (md) =>
  expect(await check(md)).toBe(null));
it.each(['```\n::: callout\n```', '~~~md\n::: pullquote x\n~~~', '    ::: callout'])('%j in code -> null', async (md) =>
  expect(await check(md)).toBe(null));
// Emphasis across a link comes back whole; link text with a trailing space or emphasis inside it doesn't.
it.each(['*a [b](c) d*', '_see [x](y)._', '**a [b](c) d**'])('%j -> null', async (md) => {
  expect(await check(md)).toBe(null);
  expect((await roundTripMarkdown(md, [])).trim()).toBe(md);
});
// Syntax other tools read, which the editor would escape as plain text.
it.each([
  'See [[Wiki Page]].', '[[Page|shown]] and more', 'Euler: $e^{i\\pi}+1=0$.', '$x$', 'Sum $\\{a\\}$ done',
  '$$\nx^2\n$$', 'Display $$x$$ inline', '*[HTML]: Hyper Text Markup Language', 'Text.\n*[CSS]: Cascading',
])('%j -> syntax', async (md) => expect(await check(md)).toBe('syntax'));
it.each([
  'Costs $5 and $10.', 'From $5-$10.', 'Pay $5, or $ 10 $ later.', 'One [link] in [brackets].', '`[[code]]` and `$x$`',
  '```\n$$\n[[a]]\n```', 'Not *[an abbreviation] here',
])('%j -> null', async (md) => expect(await check(md)).toBe(null));
it.each(['[a ](b)', '[*a*](b)'])('%j -> would-change', async (md) => expect(await check(md)).toBe('would-change'));
it('keeps a non-breaking space apart', () => expect(sameMarkdown('a b', 'a b')).toBe(false));
it('ignores wrapping', () => expect(sameMarkdown('one two', 'one\ntwo')).toBe(true));
it.each([['`a  b`', '`a b`'], ['# A', '## A'], ['- a\n- b', '- a\n\n- b']])('differs: %s', (a, b) =>
  expect(sameMarkdown(a, b)).toBe(false));

// What the round trip changes without failing: labels, attributes, and some URLs.
it.each([
  [':::stat[Label]\nx\n:::', ':::stat\nx\n:::'],
  [':::pullquote{#x}\nx\n:::', ':::pullquote\nx\n:::'],
  [':::callout{.warning foo="1"}\nx\n:::', ':::callout{.warning}\nx\n:::'],
])('differs: %s', (a, b) => expect(sameMarkdown(a, b)).toBe(false));

describe('bodyOrOriginal', () => {
  it('keeps the original while the document is as loaded', () =>
    expect(bodyOrOriginal('* a\n', '* a\n', '- a\n')).toBe('- a\n'));
  it('takes the edit once it differs', () => expect(bodyOrOriginal('* b\n', '* a\n', '- a\n')).toBe('* b\n'));
});

describe("jggweb's content", () => {
  it('opens rich only what the editor keeps intact', async () => {
    const counts: Record<string, number> = {};
    const kept: string[] = [];
    for (const collection of collections) {
      const dir = resolve(__dirname, '../..', collection.folder);
      const roundTrip = (s: string) => roundTripMarkdown(s, collection.blocks);
      for (const name of readdirSync(dir).filter((n) => n.endsWith(`.${collection.extension}`))) {
        const { body } = parseEntry(readFileSync(resolve(dir, name), 'utf8'));
        const reason: PlainReason | null = await checkEditable(body, roundTrip);
        const key = `${collection.folder}: ${reason ?? 'rich'}`;
        counts[key] = (counts[key] ?? 0) + 1;
        if (reason === null && !sameMarkdown(body, await roundTrip(body))) kept.push(name);
      }
    }
    console.log(counts);
    expect(kept).toEqual([]);
  }, 120_000);
});
