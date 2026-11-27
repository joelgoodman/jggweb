import type { EditorView } from '@milkdown/prose/view';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { BlockDefinition } from '../../core/blocks';
import { UPLOAD_IMAGE_TYPES, safeFilename } from '../../core/media';

/**
 * Inline image block. Opens a native file picker, uploads the chosen
 * file to assets/img/ via the configured storage adapter, then
 * inserts the image as a real ProseMirror image node so it renders
 * in-editor and serializes to `![alt](/assets/img/filename.jpg)` on
 * save. Eleventy-img handles the responsive `<picture>` transform at
 * build time.
 *
 * The upload takes a while and the writer may keep typing, so the image goes
 * into the block the slash command was typed in, found again after the upload,
 * or else below the block the caret is in.
 */
export const ImageBlock: BlockDefinition = {
  name: 'image',
  label: 'Image',
  description: 'Upload an image and insert it into the post.',
  icon: 'photo-plus',
  insert: async (ctx) => {
    if (!ctx.storage) {
      ctx.showToast('Not signed in', 'error');
      return;
    }
    const file = await ctx.pickFile(UPLOAD_IMAGE_TYPES.join(','));
    if (!file) return;
    if (!UPLOAD_IMAGE_TYPES.includes(file.type)) {
      ctx.showToast('Only JPEG, PNG, WebP, AVIF and GIF images can be uploaded.', 'error');
      return;
    }
    const { view } = ctx;
    // The slash command's text goes now; its block is where the image will go.
    view.dispatch(view.state.tr.delete(ctx.from, ctx.to));
    const target = view.state.doc.resolve(ctx.from).parent;

    const filename = safeFilename(file.name);
    const path = `assets/img/${filename}`;
    ctx.showToast('Uploading image…');
    try {
      const buf = await file.arrayBuffer();
      await ctx.storage.uploadBinary(path, buf, {
        message: `content: upload ${path}`,
      });
    } catch (err) {
      ctx.showToast(err instanceof Error ? err.message : String(err), 'error');
      return;
    }
    if (view.isDestroyed) {
      ctx.showToast(`The image was uploaded as ${path}, but the entry was closed before it could be inserted.`, 'error');
      return;
    }
    insertImage(view, target, `/${path}`);
    ctx.showToast('Image inserted');
  },
};

/**
 * Puts an image in `target`, the block the command was typed in, if it is
 * still in the document: in place of it when it is empty, else after it. If it
 * is gone, the image goes after the block holding the caret.
 */
function insertImage(view: EditorView, target: ProseNode, src: string): void {
  const { schema, doc } = view.state;
  const imageType = schema.nodes.image;
  if (!imageType) return;
  const paragraph = schema.nodes.paragraph.create(null, imageType.create({ src, alt: '' }));
  let at: number | undefined;
  doc.descendants((node, pos) => {
    if (at !== undefined) return false;
    if (node === target) at = pos;
    return node.isBlock && !node.isTextblock;
  });
  const tr = view.state.tr;
  if (at !== undefined && target.content.size === 0) {
    tr.replaceWith(at, at + target.nodeSize, paragraph);
  } else {
    const $pos = at !== undefined ? doc.resolve(at + 1) : view.state.selection.$from;
    const depth = $pos.parent.isTextblock ? $pos.depth : $pos.depth + 1;
    tr.insert(depth > 0 ? $pos.after(depth) : doc.content.size, paragraph);
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
}
