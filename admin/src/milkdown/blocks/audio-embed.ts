import type { BlockDefinition } from '../../core/blocks';
import { replaceRangeWithText } from '../blockHelpers';

/**
 * Audio embed block. Same shape as the video block — bare URL on its
 * own paragraph, embed-everything handles the rest. Supported at
 * build time: Spotify, SoundCloud, Apple Music, and the other
 * services embed-everything ships with.
 */
export const AudioEmbedBlock: BlockDefinition = {
  name: 'audio',
  label: 'Audio embed',
  description: 'Paste a Spotify, SoundCloud, or Apple Music URL — embedded on publish.',
  icon: 'waveform-lines',
  insert: (ctx) => {
    const url = ctx.promptInput('Audio URL', '');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      ctx.showToast('Enter a full URL (including https://)', 'error');
      return;
    }
    replaceRangeWithText(ctx.view, ctx.from, ctx.to, url);
  },
};
