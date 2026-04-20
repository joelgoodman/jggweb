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
 * Shared SEO overrides — nested `seo` object on Letters and Pages.
 * Every field is optional; the head.njk cascade falls back to
 * excerpt/summary/first-paragraph/site-defaults when blank. Defined
 * once and reused so the two collections don't drift.
 */
const seoFields = () =>
  fields.object('seo', {
    label: 'SEO',
    fields: [
      fields.text('description', {
        label: 'Meta description',
        multiline: true,
        hint: 'Falls back to excerpt / summary / first paragraph if blank. ~160 chars.',
      }),
      fields.image('image', {
        directory: 'assets/img',
        label: 'Social image',
        hint: 'Overrides the cover image for social cards only.',
      }),
      fields.text('image_alt', {
        label: 'Social image alt',
      }),
      fields.text('canonical', {
        label: 'Canonical URL',
        hint: 'Only set if this content is republished from elsewhere.',
      }),
      fields.text('robots', {
        label: 'Robots',
        hint: 'e.g. "noindex" for drafts. Uses the site default when blank.',
      }),
    ],
  });

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
    seoFields(),
  ],
});

/**
 * Pages — long-form static pages rendered through layouts/page.njk.
 * Filename = slug, permalink = /{slug}/ (resolved by pages.11tydata.js
 * in the site root, not this CMS config). Body uses the same blocks
 * as Letters so the slash menu, callouts, pullquotes, and media embeds
 * are all available.
 */
export const pages = defineCollection({
  name: 'pages',
  label: 'Pages',
  description: 'Long-form pages published at /{slug}/.',
  folder: 'pages',
  slug: ({ fields }) => String(fields.slug ?? 'untitled'),
  titleField: 'title',
  body: new MarkdownField('body', { blocks: siteBlocks }),
  blocks: siteBlocks,
  frontmatter: [
    fields.text('title', {
      label: 'Title',
      required: true,
      hint: 'Browser tab / social-share title.',
    }),
    fields.slug('slug', { label: 'Slug', required: true, hint: 'Becomes /{slug}/.' }),
    fields.text('eyebrow', {
      label: 'Eyebrow',
      hint: 'Small uppercase kicker above the headline.',
    }),
    fields.text('headline', {
      label: 'Headline',
      hint: 'The page\'s visible H1. Defaults to the title if left blank.',
    }),
    fields.text('summary', {
      label: 'Summary',
      multiline: true,
      hint: 'One-paragraph intro rendered under the headline.',
    }),
    fields.object('cover', {
      label: 'Cover image',
      fields: [
        fields.image('image', { directory: 'assets/img', label: 'Image' }),
        fields.text('alt', { label: 'Alt text', hint: 'Describe what is shown, for screen readers.' }),
      ],
    }),
    seoFields(),
  ],
});

/**
 * Speaking events — one file per talk. They don't emit their own pages
 * (see speaking_events/speaking_events.11tydata.json); the speaking.njk
 * template loops `collections.speaking_event` and groups them by year.
 * Filename `YYYY-MM-slug.md` keeps directory listings chronological.
 */
export const speakingEvents = defineCollection({
  name: 'speaking_events',
  label: 'Speaking',
  description: 'Talks, workshops, and panels rendered into /speaking/.',
  folder: 'speaking_events',
  slug: ({ fields, date }) => {
    const slug = String(fields.slug ?? fields.title ?? 'event');
    return `${date.slice(0, 7)}-${slug}`;
  },
  titleField: 'title',
  // An optional notes body — most events leave this empty, but it's
  // there if you want a paragraph about the talk on a future detail
  // page.
  body: new MarkdownField('body', { blocks: siteBlocks }),
  blocks: siteBlocks,
  frontmatter: [
    fields.text('title', { label: 'Talk title', required: true }),
    fields.datetime('date', { label: 'Date', required: true }),
    fields.text('event_name', {
      label: 'Event',
      required: true,
      hint: 'Conference or venue, e.g. "HighEdWeb Buffalo, NY".',
    }),
    fields.text('event_url', {
      label: 'Event URL',
      hint: 'Link wrapped around the event name.',
    }),
    fields.text('role', {
      label: 'Role',
      hint: 'Optional — "Keynote", "Workshop", etc., appended after the event name.',
    }),
    fields.slug('slug', {
      label: 'Slug',
      hint: 'Used in the filename only — events don\'t have their own pages.',
    }),
  ],
});

export const collections: Collection[] = [letters, pages, speakingEvents];
