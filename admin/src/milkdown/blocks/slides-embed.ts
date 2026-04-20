import type { BlockDefinition } from '../../core/blocks';
import { replaceRangeWithText } from '../blockHelpers';

/**
 * Slides / presentation embed block. Same shape as the video/audio
 * embed blocks — prompts for a URL, drops it on its own paragraph,
 * and the site's `slide-embeds` Eleventy plugin swaps it for an
 * iframe (or the oEmbed HTML for Speakerdeck/SlideShare) at build
 * time.
 *
 * The provider list is mirrored from eleventy-plugins/slide-embeds.js
 * so the CMS can pre-validate before a user commits a bad URL —
 * otherwise a typo wouldn't surface until build time. Keep the two
 * lists in sync when adding new services.
 */
const PROVIDERS = [
  { name: 'Speakerdeck', match: /^https:\/\/speakerdeck\.com\/[^/]+\/[^/?#]+/ },
  { name: 'SlideShare', match: /^https:\/\/(?:www\.)?slideshare\.net\/[^/]+\/[^/?#]+/ },
  { name: 'Figma', match: /^https:\/\/(?:www\.)?figma\.com\/(?:file|proto|design|slides|board)\// },
  { name: 'Canva', match: /^https:\/\/(?:www\.)?canva\.com\/design\/[^/]+\/[^/?#]+\/view/ },
];

export const SlidesEmbedBlock: BlockDefinition = {
  name: 'slides',
  label: 'Slides / Presentation',
  description: 'Paste a Speakerdeck, SlideShare, Figma, or Canva URL — embedded on publish.',
  icon: 'drop-cap',
  insert: (ctx) => {
    const url = ctx.promptInput('Slides / presentation URL', '');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      ctx.showToast('Enter a full URL (including https://)', 'error');
      return;
    }
    const matched = PROVIDERS.find((p) => p.match.test(url));
    if (!matched) {
      ctx.showToast(
        'URL doesn\'t match a supported provider (Speakerdeck, SlideShare, Figma, Canva).',
        'error',
      );
      return;
    }
    replaceRangeWithText(ctx.view, ctx.from, ctx.to, url);
    ctx.showToast(`${matched.name} embed inserted — will render on publish.`);
  },
};
