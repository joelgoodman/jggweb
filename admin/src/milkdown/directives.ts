import { $nodeSchema, $remark } from '@milkdown/utils';
import remarkDirective from 'remark-directive';

/**
 * Registers remark-directive in Milkdown's unified pipeline. This is
 * the upstream piece that teaches remark to parse `::: name … :::`
 * into `containerDirective` AST nodes (and serialize back). Every
 * custom container block depends on it.
 */
export const directivesRemark = $remark('remarkDirective', () => remarkDirective);

export interface DirectiveContainerOptions {
  /** Directive name (matches `::: name`). */
  name: string;
  /** Prose node content expression (default: "block+"). */
  content?: string;
  /** Prose node group (default: "block"). */
  group?: string;
  /** CSS class rendered on the outer element. */
  className: string;
  /** If true, an `{.kind}` attribute shorthand is read + written as a `kind` attr. */
  withKind?: boolean;
  /** Schema name (defaults to the directive name). */
  schemaName?: string;
}

/**
 * Factory: produces a Milkdown `$nodeSchema` that parses remark
 * `containerDirective` nodes with a given `name` into a native
 * ProseMirror node, and serializes back. Blocks render as styled cards
 * with editable content — the `:::` syntax never appears in the
 * editor UI, only in the saved markdown.
 */
export function directiveContainer({
  name,
  content = 'block+',
  group = 'block',
  className,
  withKind = false,
  schemaName,
}: DirectiveContainerOptions) {
  const nodeName = schemaName ?? name;

  return $nodeSchema(nodeName, () => ({
    content,
    group,
    defining: true,
    attrs: withKind ? { kind: { default: 'note' } } : {},
    parseDOM: [
      {
        tag: `div[data-directive="${name}"]`,
        getAttrs: (dom) =>
          withKind
            ? { kind: (dom as HTMLElement).getAttribute('data-kind') ?? 'note' }
            : {},
      },
    ],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        'data-directive': name,
        class: className,
      };
      if (withKind) {
        attrs['data-kind'] = String(node.attrs.kind ?? 'note');
      }
      return ['div', attrs, 0];
    },
    parseMarkdown: {
      match: (mdast) =>
        mdast.type === 'containerDirective' &&
        (mdast as unknown as { name: string }).name === name,
      runner: (state, mdast, type) => {
        const attrs: Record<string, unknown> = {};
        if (withKind) {
          const raw = (mdast as unknown as { attributes?: Record<string, string> }).attributes ?? {};
          attrs.kind = raw.class ?? raw.id ?? 'note';
        }
        state.openNode(type, attrs).next((mdast as unknown as { children: unknown[] }).children).closeNode();
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === nodeName,
      runner: (state, node) => {
        const attributes: Record<string, string> = {};
        if (withKind) {
          attributes.class = String(node.attrs.kind ?? 'note');
        }
        state
          .openNode('containerDirective', undefined, { name, attributes })
          .next(node.content)
          .closeNode();
      },
    },
  }));
}
