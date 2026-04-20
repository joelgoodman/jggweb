import type { BlockDefinition } from '../../core/blocks';
import { pickFile, sanitizeFilename, replaceRangeWithImage } from '../blockHelpers';

/**
 * Inline image block. Opens a native file picker, uploads the chosen
 * file to assets/img/ via the configured storage adapter, then
 * inserts the image as a real ProseMirror image node so it renders
 * in-editor and serializes to `![alt](/assets/img/filename.jpg)` on
 * save. Eleventy-img handles the responsive `<picture>` transform at
 * build time.
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
    const file = await pickFile('image/*');
    if (!file) return;
    const filename = sanitizeFilename(file.name);
    const path = `assets/img/${filename}`;
    ctx.showToast('Uploading image…');
    try {
      const buf = await file.arrayBuffer();
      await ctx.storage.uploadBinary(path, buf, {
        message: `content: upload ${path}`,
      });
      replaceRangeWithImage(ctx.view, ctx.from, ctx.to, `/${path}`, '');
      ctx.showToast('Image inserted');
    } catch (err) {
      ctx.showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  },
};
