import { Editor, rootCtx, defaultValueCtx, editorViewCtx, parserCtx, serializerCtx, remarkStringifyOptionsCtx } from '@milkdown/core';
import { commonmark, bulletListSchema, listItemSchema, linkSchema, linkAttr, sanitizeLinkHref } from '@milkdown/preset-commonmark';
import type { Ctx } from '@milkdown/ctx';
import { EditorState } from '@milkdown/prose/state';
import type { Options } from 'remark-stringify';
import type { BlockDefinition } from '../core/blocks';
import { directivesRemark } from './directives';

type Handlers = NonNullable<Options['handlers']>;
type TextHandler = NonNullable<Handlers['text']>;
type MarkHandler = NonNullable<Handlers['emphasis']>;
type State = Parameters<TextHandler>[2];

// Brackets, backticks, asterisks and backslashes end a URL here, so they are
// escaped like any other text. So is a final `!`, which would make an image of a
// link that follows.
const URL_SPAN = /(https?:\/\/(?:[^\s<>[\]`*\\!]|!+(?=[^\s<>[\]`*\\!]))+)/;
// What a bare URL could still be read as: a character reference, or underscores
// around emphasis, opened and closed within one URL or across two.
const REFERENCE = /&#?[a-z0-9]+;/i;
const PAIR = /(?<![\p{L}\p{N}])_.*_(?![\p{L}\p{N}])/u;
const OPENER = /(?<![\p{L}\p{N}])_/u;
const CLOSER = /_(?![\p{L}\p{N}])/u;
// A line of text that would open a container block if written bare.
const FENCE = /(^|[\r\n])\s*:::/;

// How many `_` emphasis or strong marks surround what is being written.
const underscores = new WeakMap<State, number>();

/** Counts the `_` marks around a text, where any `_` in a URL could end one. */
function countingUnderscores(handle: MarkHandler, mark: 'emphasis' | 'strong'): MarkHandler {
  return (node, parent, state, info) => {
    if ((node.marker || state.options[mark]) !== '_') return handle(node, parent, state, info);
    const outer = underscores.get(state) ?? 0;
    underscores.set(state, outer + 1);
    try {
      return handle(node, parent, state, info);
    } finally {
      underscores.set(state, outer);
    }
  };
}

/**
 * Writes URLs as typed. Escaping their `_` and `&` would break the bare URLs
 * that the site turns into embeds.
 */
const text: TextHandler = (node, _parent, state, info) => {
  const value: string = node.value;
  // Milkdown's own shortcut: keeps trailing spaces from becoming `&#x20;`.
  if (/^[^*_\\]*\s+$/.test(value) && !FENCE.test(value)) return value;

  // Trailing spaces are kept here too. URLs land on the odd indexes.
  const body = value.trimEnd();
  const parts = body.split(URL_SPAN);
  const urls = parts.filter((_, i) => i % 2);
  const enclosed = Boolean(underscores.get(state));
  const mustEscape = (url: string, i: number) =>
    REFERENCE.test(url) ||
    (enclosed && url.includes('_')) ||
    PAIR.test(url) ||
    (OPENER.test(url) && urls.slice((i + 1) / 2).some((later) => CLOSER.test(later))) ||
    (CLOSER.test(url) && urls.slice(0, (i - 1) / 2).some((earlier) => OPENER.test(earlier)));
  const written = parts
    .map((part, i) => {
      if (!part || (i % 2 && !mustEscape(part, i))) return part;
      return state.safe(part, {
        ...info,
        encode: [],
        before: i ? parts[i - 1].slice(-1) : info.before,
        after: parts[i + 1]?.[0] || value[body.length] || info.after,
      });
    })
    .join('');
  return written + value.slice(body.length);
};

/**
 * Milkdown keeps a list's `spread` as the string "false" or "true" and hands
 * it to remark as is, where any string reads as a loose list. Ordered lists
 * convert it already; these do the same for bullet lists and their items.
 */
const listSpread = (spread: unknown) => spread === true || spread === 'true';

function tightLists(ctx: Ctx) {
  ctx.update(bulletListSchema.key, (prev) => (c) => ({
    ...prev(c),
    toMarkdown: {
      match: (node) => node.type.name === 'bullet_list',
      runner: (state, node) => {
        state.openNode('list', undefined, { ordered: false, spread: listSpread(node.attrs.spread) });
        state.next(node.content);
        state.closeNode();
      },
    },
  }));
  ctx.update(listItemSchema.key, (prev) => (c) => ({
    ...prev(c),
    toMarkdown: {
      match: (node) => node.type.name === 'list_item',
      runner: (state, node) => {
        state.openNode('listItem', undefined, { spread: listSpread(node.attrs.spread) });
        state.next(node.content);
        state.closeNode();
      },
    },
  }));
}

// Schemes that run code when a link is followed. Characters a browser ignores
// while reading a scheme, e.g. a tab in `java\tscript:`, are ignored here too.
const DANGEROUS = /^(javascript|vbscript|data):/i;
const IGNORED_IN_SCHEME = /[\u0000-\u0020\u007f-\u00a0\u200b-\u200d\u2028\u2029\ufeff]/g;

/**
 * Links keep any address through copy and paste. Milkdown shows only http(s),
 * mailto, tel and ftp addresses as live links and writes an empty `href` for
 * the rest, which a paste then reads as no address at all: `obsidian://`,
 * `zotero://`, `sms:` and `file:` links lost theirs. Here the address also goes
 * in `data-href`, which is never followed, and is read back from it. A pasted
 * link to a scheme that runs code is kept as text only.
 */
function linksKeepAddresses(ctx: Ctx) {
  ctx.update(linkSchema.key, (prev) => (c) => {
    const spec = prev(c);
    return {
      ...spec,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom: HTMLElement | string) => {
            if (!(dom instanceof HTMLElement)) return false;
            const href = dom.getAttribute('data-href') ?? dom.getAttribute('href') ?? '';
            if (DANGEROUS.test(href.replace(IGNORED_IN_SCHEME, ''))) return false;
            return { href, title: dom.getAttribute('title') };
          },
        },
      ],
      toDOM: (mark) => {
        const href = String(mark.attrs.href ?? '');
        const live = sanitizeLinkHref(href);
        return [
          'a',
          {
            ...c.get(linkAttr.key)(mark),
            ...mark.attrs,
            href: live,
            ...(live === href ? {} : { 'data-href': href }),
          },
        ];
      },
    };
  });
}

/**
 * The editor's schema, parser and serializer: everything that decides how a
 * body is read and written. Add any interface plugins, then call `create()`.
 */
export function createMarkdownEditor(o: { root: HTMLElement; value: string; blocks: BlockDefinition[] }): Editor {
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, o.root);
      ctx.set(defaultValueCtx, o.value);
      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        handlers: {
          ...options.handlers,
          text,
          emphasis: countingUnderscores(options.handlers!.emphasis!, 'emphasis'),
          strong: countingUnderscores(options.handlers!.strong!, 'strong'),
        },
      }));
      tightLists(ctx);
      linksKeepAddresses(ctx);
    })
    .use(commonmark)
    .use(directivesRemark)
    .use(o.blocks.flatMap((b) => b.plugins ?? []));
}

/**
 * What the editor would save for `md` after loading it. Rejects when the editor
 * can't parse it, e.g. a container with no matching block.
 */
export async function roundTripMarkdown(md: string, blocks: BlockDefinition[]): Promise<string> {
  // Loading `md` as the editor's value would never finish for a body it can't
  // parse, so it is parsed here and then put on screen: some of what the editor
  // writes depends on the document being the one shown, e.g. a last empty paragraph.
  const editor = createMarkdownEditor({ root: document.createElement('div'), value: '', blocks });
  await editor.create();
  try {
    return editor.action((ctx) => {
      const doc = ctx.get(parserCtx)(md);
      const view = ctx.get(editorViewCtx);
      view.updateState(EditorState.create({ doc, plugins: view.state.plugins }));
      return ctx.get(serializerCtx)(view.state.doc);
    });
  } finally {
    await editor.destroy();
  }
}
