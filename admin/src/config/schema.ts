import { defineCollection, type Collection } from '../core/Collection';
import { fields, MarkdownField } from '../core/fields';
import {
  CalloutNote,
  CalloutWarning,
  CalloutTip,
  PullQuote,
  Stat,
  Resource,
  ImageBlock,
  VideoEmbedBlock,
  AudioEmbedBlock,
  SlidesEmbedBlock,
  HorizontalRuleBlock,
} from '../milkdown/blocks';
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
  SlidesEmbedBlock,
  CalloutNote,
  CalloutWarning,
  CalloutTip,
  PullQuote,
  Stat,
  Resource,
  HorizontalRuleBlock,
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
      fields.text('title', {
        label: 'Social title',
        hint: 'Overrides the page title in browser tabs and share cards. Leave blank to use the main title.',
      }),
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
  // Sidebar ordering (Content tab): editorial fields you touch every
  // time (excerpt, cover) sit on top, publishing dates follow,
  // technical/housekeeping fields (tags default, slug) drop to the
  // bottom where they can be glanced at and skipped.
  frontmatter: [
    fields.text('title', { label: 'Title', required: true }),
    fields.text('excerpt', {
      label: 'Excerpt',
      multiline: true,
      hint: 'One-sentence summary shown in feed and social cards.',
      group: 'Content',
    }),
    fields.text('tldr', {
      label: 'TL;DR',
      multiline: true,
      hint: 'Short abstract rendered above the body and emitted as JSON-LD `abstract`. Leave blank to skip.',
      group: 'Content',
    }),
    fields.object('cover', {
      label: 'Cover image',
      fields: [
        fields.image('image', { directory: 'assets/img', label: 'Image' }),
        fields.text('alt', { label: 'Alt text', hint: 'Describe what is shown, for screen readers.' }),
      ],
    }),
    fields.datetime('date_published', { label: 'Published', required: true }),
    fields.text('tags', {
      label: 'Tags',
      default: 'newsletter',
      hint: 'Comma-separated.',
      group: 'More options',
      groupCollapsed: true,
    }),
    fields.datetime('date_updated', {
      label: 'Updated',
      hint: 'Only set when revising a published letter.',
      group: 'More options',
      groupCollapsed: true,
    }),
    fields.slug('slug', {
      label: 'Slug',
      required: true,
      hint: 'Auto-filled from the title. Used in the filename and URL.',
      group: 'More options',
      groupCollapsed: true,
    }),
    fields.boolean('draft', {
      label: 'Draft',
      checkboxLabel: 'Save as draft',
      hint: 'Excluded from production builds (feed, sitemap, listings). Still visible in dev previews.',
      group: 'More options',
      groupCollapsed: true,
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
  // Sidebar order mirrors the visible header stack — eyebrow,
  // headline, summary — then cover art, then slug. That way the
  // sidebar reads top-down the same way the rendered page does.
  frontmatter: [
    fields.text('title', {
      label: 'Title',
      required: true,
      hint: 'Browser tab / social-share title.',
    }),
    fields.text('eyebrow', {
      label: 'Eyebrow',
      hint: 'Small uppercase kicker above the headline.',
      group: 'Content',
    }),
    fields.text('headline', {
      label: 'Headline',
      hint: "The page's visible H1. Falls back to the title if blank.",
      group: 'Content',
    }),
    fields.text('summary', {
      label: 'Summary',
      multiline: true,
      hint: 'One-paragraph intro rendered under the headline.',
      group: 'Content',
    }),
    fields.object('cover', {
      label: 'Cover image',
      fields: [
        fields.image('image', { directory: 'assets/img', label: 'Image' }),
        fields.text('alt', { label: 'Alt text', hint: 'Describe what is shown, for screen readers.' }),
      ],
    }),
    fields.slug('slug', {
      label: 'Slug',
      required: true,
      hint: 'Auto-filled from the title. Becomes /{slug}/.',
      group: 'More options',
      groupCollapsed: true,
    }),
    fields.boolean('draft', {
      label: 'Draft',
      checkboxLabel: 'Save as draft',
      hint: 'Excluded from production builds. Still visible in dev previews.',
      group: 'More options',
      groupCollapsed: true,
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
  // Use the event's `date`, not the default `date` param — which is
  // EntryEditor's `values['date_published'] ?? now` and doesn't exist
  // on this schema, so it was always landing as today's YYYY-MM.
  slug: ({ fields }) => {
    const rawDate = String(fields.date ?? '').slice(0, 7) || new Date().toISOString().slice(0, 7);
    const slug = String(fields.slug ?? fields.title ?? 'event');
    return `${rawDate}-${slug}`;
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

/**
 * Appearances — external media (video/podcast/etc.) Joel is featured
 * in. One file per appearance, frontmatter-only (no body — see
 * appearances.njk, which reads straight from `collections.appearance`
 * and doesn't render templateContent). Filename `YYYY-MM-slug` mirrors
 * speaking_events so directory listings stay chronological.
 */
export const appearances = defineCollection({
  name: 'appearances',
  label: 'Appearances',
  description: 'Podcasts, interviews, and features rendered into /appearances/.',
  folder: 'appearances',
  slug: ({ fields }) => {
    const rawDate = String(fields.date ?? '').slice(0, 7) || new Date().toISOString().slice(0, 7);
    const slug = String(fields.slug ?? fields.title ?? 'appearance');
    return `${rawDate}-${slug}`;
  },
  titleField: 'title',
  frontmatter: [
    fields.text('title', { label: 'Title', required: true }),
    fields.datetime('date', { label: 'Date', required: true }),
    fields.text('type', {
      label: 'Type',
      default: 'video',
      hint: 'video, podcast, book, or quote — drives the CTA label and cover-panel behavior on /appearances/.',
    }),
    fields.text('source_name', {
      label: 'Source',
      required: true,
      hint: 'Publisher or show name, e.g. "Higher Ed Storytelling".',
    }),
    fields.text('source_url', {
      label: 'Source URL',
      required: true,
      hint: 'Link used by the CTA button (Watch on YouTube, Listen on Apple Podcasts, etc.).',
    }),
    fields.text('id', {
      label: 'ID',
      required: true,
      hint: 'Source identifier — the YouTube video ID for video appearances.',
    }),
    fields.image('cover_image', {
      directory: 'assets/img',
      label: 'Cover image',
      hint: 'Thumbnail shown in the hover/click preview panel.',
    }),
    fields.slug('slug', {
      label: 'Slug',
      hint: 'Used in the filename only — appearances don\'t have their own pages.',
    }),
  ],
});

export const collections: Collection[] = [letters, pages, speakingEvents, appearances];
