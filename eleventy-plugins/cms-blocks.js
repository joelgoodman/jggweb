/* Renderers for the CMS's block containers, hand-written or editor-inserted.
   The name may be followed by `{.x}` with or without a space: the editor
   writes `:::callout{.note}`.

   :::callout{.note}   →  <aside class="callout" data-kind="note">…</aside>
   :::pullquote        →  <blockquote class="pullquote">…</blockquote>
   :::stat             →  <div class="stat-callout">…</div>
   :::resource         →  <div class="resource-card">…</div> */
import markdownItContainer from "markdown-it-container";

const blocks = {
  callout: {
    tag: "aside",
    attrs: (params) =>
      `class="callout" data-kind="${params.match(/\{\.([a-z0-9_-]+)\}/i)?.[1] ?? "note"}"`,
  },
  pullquote: { tag: "blockquote", attrs: () => `class="pullquote"` },
  stat: { tag: "div", attrs: () => `class="stat-callout"` },
  resource: { tag: "div", attrs: () => `class="resource-card"` },
};

export default function registerCmsBlocks(md) {
  for (const [name, { tag, attrs }] of Object.entries(blocks)) {
    const opener = new RegExp(`^${name}(?=\\s|\\{|$)`);
    md.use(markdownItContainer, name, {
      validate: (params) => opener.test(params.trim()),
      render: (tokens, idx) =>
        tokens[idx].nesting === 1
          ? `<${tag} ${attrs(tokens[idx].info)}>\n`
          : `</${tag}>\n`,
    });
  }
}
