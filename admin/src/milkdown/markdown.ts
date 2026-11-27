import { Editor, rootCtx, defaultValueCtx, parserCtx, serializerCtx, remarkStringifyOptionsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import type { Options } from 'remark-stringify';
import type { BlockDefinition } from '../core/blocks';
import { directivesRemark } from './directives';

type TextHandler = NonNullable<NonNullable<Options['handlers']>['text']>;

// Brackets, backticks, asterisks and backslashes end a URL here, so they are
// escaped like any other text.
const URL_SPAN = /(https?:\/\/[^\s<>[\]`*\\]+)/;
// What a bare URL could still be read as: a character reference, or a pair of
// underscores around emphasis.
const READ_AS_MARKUP = /&#?[a-z0-9]+;|(?<![\p{L}\p{N}])_(?!\s).*_(?![\p{L}\p{N}])/iu;

/**
 * Writes URLs as typed. Escaping their `_` and `&` would break the bare URLs
 * that the site turns into embeds.
 */
const text: TextHandler = (node, _parent, state, info) => {
  const value: string = node.value;
  // Milkdown's own shortcut: keeps trailing spaces from becoming `&#x20;`.
  if (/^[^*_\\]*\s+$/.test(value)) return value;

  // Trailing spaces are kept here too. URLs land on the odd indexes.
  const body = value.trimEnd();
  const parts = body.split(URL_SPAN);
  const urls = parts.filter((_, i) => i % 2);
  if (!urls.length || READ_AS_MARKUP.test(urls.join(' '))) {
    return state.safe(value, { ...info, encode: [] });
  }
  const written = parts
    .map((part, i) => {
      if (i % 2 || !part) return part;
      return state.safe(part, {
        ...info,
        encode: [],
        before: i ? parts[i - 1].slice(-1) : info.before,
        after: parts[i + 1]?.[0] ?? info.after,
      });
    })
    .join('');
  return written + value.slice(body.length);
};

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
        handlers: { ...options.handlers, text },
      }));
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
  const editor = createMarkdownEditor({ root: document.createElement('div'), value: '', blocks });
  await editor.create();
  try {
    return editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(parserCtx)(md)));
  } finally {
    await editor.destroy();
  }
}
