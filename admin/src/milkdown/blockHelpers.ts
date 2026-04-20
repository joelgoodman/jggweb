import type { EditorView } from '@milkdown/prose/view';

/**
 * Open a transient native file picker and resolve with the chosen
 * File. Resolving with null means the user cancelled (either via the
 * dialog's cancel button or by reopening it without picking). The
 * focus-then-timeout pattern covers the gap in browsers that don't
 * fire `change` on cancel.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    let settled = false;
    const done = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      resolve(file);
    };
    input.onchange = () => done(input.files?.[0] ?? null);
    const onFocus = () => {
      setTimeout(() => done(null), 400);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

/**
 * Reduce a user-provided filename to a safe, lowercase, hyphenated
 * slug while preserving the extension. Matches the existing
 * convention in assets/img/ (e.g., `kiev-12.jpg`).
 */
export function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : '';
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (safe || 'upload') + ext.toLowerCase();
}

/**
 * Replace the given document range with text content. Paragraphs get
 * split where newlines appear so bare URLs (for embeds) land on their
 * own paragraph — that's the shape embed-everything needs to detect
 * them during the 11ty build.
 */
export function replaceRangeWithText(view: EditorView, from: number, to: number, text: string): void {
  const { schema } = view.state;
  const paragraphs = text.split(/\n{2,}/);
  const nodes = paragraphs.map((p) =>
    p ? schema.nodes.paragraph.create(null, schema.text(p)) : schema.nodes.paragraph.create(),
  );
  const fragment = nodes.length === 1 ? nodes[0] : nodes;
  const tr = Array.isArray(fragment)
    ? view.state.tr.replaceWith(from, to, fragment)
    : view.state.tr.replaceRangeWith(from, to, fragment);
  view.dispatch(tr);
  view.focus();
}

/**
 * Insert an image node at the given range. Uses the schema's `image`
 * node directly so the editor shows the image immediately and
 * Milkdown's serializer writes it back as `![alt](src)` on save.
 */
export function replaceRangeWithImage(
  view: EditorView,
  from: number,
  to: number,
  src: string,
  alt = '',
): void {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return;
  const imageNode = imageType.create({ src, alt });
  const paragraph = view.state.schema.nodes.paragraph.create(null, imageNode);
  const resolved = view.state.doc.resolve(from);
  const rangeFrom = resolved.before(resolved.depth);
  const rangeTo = Math.min(to + 1, view.state.doc.content.size);
  const tr = view.state.tr.replaceRangeWith(rangeFrom, rangeTo, paragraph);
  view.dispatch(tr);
  view.focus();
}
