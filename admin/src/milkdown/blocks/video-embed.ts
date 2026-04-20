import type { BlockDefinition } from '../../core/blocks';
import { replaceRangeWithText } from '../blockHelpers';

/**
 * Video embed block. Prompts for a URL and inserts it on its own
 * paragraph. `eleventy-plugin-embed-everything` (already loaded in
 * eleventy.config.js) detects bare URLs to YouTube, Vimeo, TikTok,
 * Twitch, etc. during the build and swaps them for privacy-friendly
 * iframe embeds automatically.
 */
export const VideoEmbedBlock: BlockDefinition = {
  name: 'video',
  label: 'Video embed',
  description: 'Paste a YouTube, Vimeo, or other video URL — embedded on publish.',
  icon: 'media-library',
  insert: (ctx) => {
    const url = ctx.promptInput('Video URL', '');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      ctx.showToast('Enter a full URL (including https://)', 'error');
      return;
    }
    replaceRangeWithText(ctx.view, ctx.from, ctx.to, url);
  },
};
