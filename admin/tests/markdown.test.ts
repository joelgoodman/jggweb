// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { serializerCtx, schemaCtx, editorViewCtx } from '@milkdown/core';
import { DOMParser, DOMSerializer } from '@milkdown/prose/model';
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
// As a loaded editor writes them: an empty last paragraph is no `<br />`.
it.each([['', ''], ['\n', ''], ['* a\n* b\n', '* a\n* b']])('round-trips %j as the editor saves it', async (md, out) =>
  expect(await roundTrip(md)).toBe(out));
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

/** What the editor writes for paragraphs of typed text, one array item per line. */
async function write(...lines: string[]) {
  const editor = createMarkdownEditor({ root: document.createElement('div'), value: '', blocks });
  await editor.create();
  const written = editor.action((ctx) => {
    const schema = ctx.get(schemaCtx);
    const content = lines.flatMap((line, i) => [
      ...(i ? [schema.node('hardbreak', { isInline: true })] : []),
      schema.text(line),
    ]);
    return ctx.get(serializerCtx)(schema.node('doc', null, schema.node('paragraph', null, content)));
  });
  await editor.destroy();
  return written;
}

it('keeps a space typed after a URL as a space', async () =>
  expect(await write('https://example.com/a_b ')).toBe('https://example.com/a_b \n'));

describe('a URL before a link', () => {
  it.each([
    'Watch https://e.com/now\\![here](https://l.com)',
    'https://example.com/a\\![x](https://e.com/y)',
    'https://example.com/a!!\\![x](https://e.com/y)',
  ])('does not turn it into an image: %s', async (md) => expect(await roundTrip(md)).toBe(md));

  it.each(['https://e.com/now! Go', 'https://e.com/a!b', 'Watch https://e.com/now!'])(
    'leaves the exclamation mark alone in %s',
    async (md) => expect(await roundTrip(md)).toBe(md),
  );
});

describe('a URL inside underscore emphasis', () => {
  it.each([
    '_see https://e.com/page\\_ today_',
    '_https://e.com/a/\\_b_',
    '__see https://e.com/page\\_ today__',
    '__https://e.com/a/\\_b__',
    '_**see https://e.com/page\\_ today**_',
    '*__see https://e.com/page\\_ today__*',
    '_[see https://e.com/page\\_ today](https://l.com)_',
  ])('cannot close or reopen it: %s', async (md) => expect(await roundTrip(md)).toBe(md));

  it('is written bare again once the emphasis has ended', async () => {
    const md = '_a_ https://e.com/page_ and **https://e.com/c_d?x=1&y=2**';
    expect(await roundTrip(md)).toBe(md);
  });
});

describe('typed text starting with three colons', () => {
  it.each([
    [':::stat ', '\\:::stat \n'],
    [':::tip ', '\\:::tip \n'],
    ['  :::tip ', '&#x20; \\:::tip \n'],
  ])('stays text: "%s"', async (line, expected) => {
    const written = await write(line);
    expect(written).toBe(expected);
    await expect(roundTrip(written)).resolves.toBe(written.trim());
  });

  it('stays text after a line break', async () =>
    expect(await write('one', ':::tip ')).toBe('one\n\\:::tip \n'));

  it('stays text on a later line of one run of text', async () =>
    expect(await write('one\n:::tip ')).toBe('one\n\\:::tip \n'));
});

it('escapes only the URL that needs it', async () => {
  for (const md of [
    'https://example.com/\\_draft\\_ and https://example.com/a_b?x=1&y=2',
    'https://example.com/a_b then https://example.com/?q=\\&amp;',
  ]) expect(await roundTrip(md)).toBe(md);
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

describe('links copied and pasted inside the editor', () => {
  // ProseMirror copies through the document's HTML and pastes by reading it back.
  async function copyPaste(md: string) {
    const editor = createMarkdownEditor({ root: document.createElement('div'), value: md, blocks: [] });
    await editor.create();
    try {
      return editor.action((ctx) => {
        const schema = ctx.get(schemaCtx);
        const doc = ctx.get(editorViewCtx).state.doc;
        const html = document.createElement('div');
        html.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content));
        const pasted = DOMParser.fromSchema(schema).parse(html);
        return { html, md: ctx.get(serializerCtx)(pasted).trim() };
      });
    } finally {
      await editor.destroy();
    }
  }

  it.each([
    '[note](obsidian://open?vault=a\\&file=b)', '[ref](zotero://select/items/1)', '[text](sms:+15551234)',
    '[file](file:///Users/a/b.pdf)', '[web](https://example.com/a)', '[rel](../other.md)', '[mail](mailto:a@b.c)',
  ])('keeps the address of %s', async (md) => {
    expect((await copyPaste(md)).md).toBe(md);
  });

  it('never makes a javascript: address a live link, and drops it when pasted', async () => {
    const { html, md } = await copyPaste('[bad](javascript:alert\\(1\\))');
    for (const a of html.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toMatch(/script/i);
    expect(md).toBe('bad');
  });

  it('drops a pasted link whose address hides its scheme', async () => {
    const editor = createMarkdownEditor({ root: document.createElement('div'), value: '', blocks: [] });
    await editor.create();
    const md = editor.action((ctx) => {
      const html = document.createElement('div');
      html.innerHTML = '<p><a href="java&#9;script:x">a</a> <a href=" data:text/html,x">b</a> <a href="vbscript:x">c</a></p>';
      return ctx.get(serializerCtx)(DOMParser.fromSchema(ctx.get(schemaCtx)).parse(html)).trim();
    });
    await editor.destroy();
    expect(md).toBe('a b c');
  });
});
