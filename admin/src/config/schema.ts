import { defineCollection, type Collection } from '../core/Collection';
import { fields, MarkdownField } from '../core/fields';
import { Callout, PullQuote, ImageBlock, VideoEmbedBlock, AudioEmbedBlock } from '../milkdown/blocks';
import type { BlockDefinition } from '../core/blocks';

export interface SiteConfig {
  collections: Collection[];
}

// Slash-menu order: media first (most common inserts), then the
// custom container blocks. Adding a new block is a one-line import.
const siteBlocks: BlockDefinition[] = [
  ImageBlock,
  VideoEmbedBlock,
  AudioEmbedBlock,
  Callout,
  PullQuote,
];

/**
 * Letters — the main newsletter collection. Frontmatter shape mirrors
 * what already ships on joelgoodman.co: title, slug, date_published,
 * date_updated, cover (image + alt), tags, excerpt.
 */
export const letters = defineCollection({
  name: 'letters',
  label: 'Letters',
  description: 'Newsletter posts published at /letters/{slug}/.',
  folder: 'letters',
  slug: ({ fields, date }) => `${date}-${fields.slug ?? 'untitled'}`,
  titleField: 'title',
  body: new MarkdownField('body', { blocks: siteBlocks }),
  blocks: siteBlocks,
  frontmatter: [
    fields.text('title', { label: 'Title', required: true }),
    fields.slug('slug', { label: 'Slug', required: true, hint: 'Used in the filename and URL.' }),
    fields.datetime('date_published', { label: 'Published', required: true }),
    fields.datetime('date_updated', { label: 'Updated' }),
    fields.object('cover', {
      label: 'Cover image',
      fields: [
        fields.image('image', { directory: 'assets/img', label: 'Image' }),
        fields.text('alt', { label: 'Alt text', hint: 'Describe what is shown, for screen readers.' }),
      ],
    }),
    fields.text('tags', { label: 'Tags', default: 'newsletter' }),
    fields.text('excerpt', {
      label: 'Excerpt',
      multiline: true,
      hint: 'One-sentence summary shown in feed and social cards.',
    }),
  ],
});

export const collections: Collection[] = [letters];
