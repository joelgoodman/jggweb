// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { serializerCtx, schemaCtx } from '@milkdown/core';
import { roundTripMarkdown, createMarkdownEditor } from '../src/milkdown/markdown';
import { CalloutNote, CalloutWarning, CalloutTip, PullQuote, Stat, Resource } from '../src/milkdown/blocks';

const blocks = [CalloutNote, PullQuote, Stat, Resource];
const roundTrip = async (md: string) => (await roundTripMarkdown(md, blocks)).trim();

it.each([
  'https://www.youtube.com/watch?v=ab_Cd&t=1',
  'destination:beautiful at 3:30pm',
  '[destination:beautiful](https://example.com/a_b)',
  ':::callout{.warning}\nhi\n:::',
])('round-trips %s', async (md) => expect((await roundTripMarkdown(md, blocks)).trim()).toBe(md));
it('rejects a container it has no block for', async () =>
  await expect(roundTripMarkdown(':::tip\nx\n:::', blocks)).rejects.toThrow());

describe('URLs among other text', () => {
  it.each([
    'See https://example.com/a_b?x=1&y=2 and https://example.com/c_d for more.',
    'https://example.com/a_b then \\*not emphasis\\* and snake_case',
    '*https://example.com/a_b*',
    '(https://en.wikipedia.org/wiki/Foo_(bar))',
    '# About https://example.com/a_b',
    '- https://example.com/a_b',
  ])('round-trips %s', async (md) => expect(await roundTrip(md)).toBe(md.replace(/^- /, '* ')));

  // Written bare, these would be read as something other than the same text.
  it.each([
    'https://example.com/\\_draft\\_',
    'https://example.com/\\_a and https://example.com/b\\_',
    'https://example.com/?q=\\&amp;',
    'https://example.com/\\*a\\*',
    'https://example.com/\\[a]\\(b)',
    'https://example.com/\\`a\\`',
  ])('keeps the escapes that matter in %s', async (md) => expect(await roundTrip(md)).toBe(md));
});

it('keeps a space typed after a URL as a space', async () => {
  const editor = createMarkdownEditor({ root: document.createElement('div'), value: '', blocks });
  await editor.create();
  const written = editor.action((ctx) => {
    const schema = ctx.get(schemaCtx);
    const paragraph = schema.node('paragraph', null, schema.text('https://example.com/a_b '));
    return ctx.get(serializerCtx)(schema.node('doc', null, paragraph));
  });
  await editor.destroy();
  expect(written).toBe('https://example.com/a_b \n');
});

describe('colons', () => {
  it.each([':smile: and a:b', '::name', 'one\n::two', '\\:::tip', 'one\n\\:::tip'])(
    'round-trips %s',
    async (md) => expect(await roundTrip(md)).toBe(md),
  );
});

describe('container blocks', () => {
  it.each([
    ':::pullquote\nquoted at 3:30pm\n:::',
    ':::stat\n42%\n:::',
    ':::resource\n[A:b](https://example.com/a_b)\n:::',
  ])('round-trips %s', async (md) => expect(await roundTrip(md)).toBe(md));

  it('accepts the callout blocks the site configures together', async () => {
    const md = ':::callout{.tip}\nhi\n:::';
    expect((await roundTripMarkdown(md, [CalloutNote, CalloutWarning, CalloutTip])).trim()).toBe(md);
  });

  it('rejects an unknown container nested in a known one', async () =>
    await expect(roundTrip('::::callout\n:::tip\nx\n:::\n::::')).rejects.toThrow());
});
