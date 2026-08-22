# Appearances section — design

Status: approved for planning
Date: 2026-08-22

## Goal

Add an "Appearances" section to joelgoodman.co: an archive of external
media Joel appears in — podcast/interview/conference-talk videos to
start, with books-featured-in, quotes-in-articles, and podcast-audio as
clearly-planned follow-ons. It should match the existing site design, be
reachable from the nav rail, and use the site's existing split-pane
shell (`.image-panel`) to show the actual media, not just a static
cover image.

Seed content: the YouTube playlist
`https://youtube.com/playlist?list=PLOOaP1YuFx0gYq85i1NPF8youu8bTJwaY` — 22
videos spanning 2012–2026 across a dozen different channels (long-form
interviews, conference talks, short highlight clips, one trailer).

Naming note: the working name during design was "Clippings." It was
changed to "Appearances" — a plainer, more literal noun that matches
likely search/prompt phrasing ("Joel Goodman podcast appearances")
better for SEO/GEO, while still fitting the site's existing plain-noun
nav convention (Letters, Speaking, Highlights).

## Non-goals (v1)

- No live YouTube Data API integration — appearances are hand-authored
  data files, not fetched at build time. (User decision: static/manual
  data, no API-key dependency.)
- No individual permalink/detail page per appearance.
- No admin CMS (`admin/`) support yet — entries are hand-edited
  Markdown files, consistent with how `speaking_events/` works today.
  Can be added later without changing the underlying data shape.
- No podcast/book/quote content in the initial ship — but the schema
  and rendering approach must not need rework to add them.

## Content model

Mirror the existing `speaking_events/` pattern (a directory of one
Markdown file per entry, each with `permalink: false` — not the
`letters/` pattern, since appearances don't need individual pages or
body copy):

```
appearances/
  appearances.11tydata.json   # { "permalink": false, "eleventyExcludeFromCollections": false }
  2026-03-gradcomm-website-search-ai.md
  2025-...-beyond-the-cms-dotfusion.md
  ...
```

Frontmatter schema (no body content required):

```yaml
title: "Ep 73: Quick Take: Why Your College Website Search Isn't Working and How AI Can Fix It"
date: 2026-03-01
type: video            # video | podcast | book | quote — extensible
source_name: GradComm  # channel / publication / publisher name
source_url: https://www.youtube.com/watch?v=JIBQ3V9nQME
```

Optional fields, used only by non-`video` types when they're added:

- `cover_image` — filename in `assets/img/` (book cover, article social image)
- `excerpt` — the pull-quote text itself, for `type: quote`

`type` is the only field that changes what gets rendered. Nothing in
the schema assumes YouTube/video, so adding `podcast`/`book`/`quote`
later is additive (new frontmatter values + one new Nunjucks branch),
not a redesign.

`eleventy.config.js` gets one new collection, next to `speaking_event`:

```js
eleventyConfig.addCollection("appearance", function(collection) {
  return collection.getAllSorted().filter(item =>
    item.inputPath.match(/^\.\/appearances\//) !== null);
});
```

## Page & template

New root file `appearances.njk`, modeled directly on `speaking.njk`:

- Frontmatter: `layout: layouts/base.njk`, `pageType: feature`,
  `section: appearances` (same mechanism `speaking.njk` uses to get
  `base.njk`'s `shell--media` class and the `.content-column` /
  `.image-panel` split for free — no `base.njk` changes needed).
- `.detail__content` renders `collections.appearance` grouped by year
  (reusing the existing `groupByYear` filter), as a list of
  `<button class="appearance__trigger" data-appearance="{{ id }}"
  aria-pressed="false">` rows showing title, `source_name`, a small
  type icon/label, and the date. Buttons, not links — this is an
  in-page state toggle, not navigation.
- `.image-panel` renders one `.image-panel__item` per appearance, each
  `hidden` by default except the first (most recent), containing
  type-specific markup:
  - `video` → `{% yt item.source_url, item.title %}` — reuses the
    existing `yt` shortcode (`eleventy.config.js:263`), which already
    outputs `youtube-nocookie.com/embed/ID` markup.
  - `podcast` (future) → equivalent embed shortcode/markup for the
    audio provider in use at the time.
  - `book` (future) → `<img>` of `cover_image` (goes through the
    existing `eleventy-img` transform automatically) plus a link to
    `source_url`.
  - `quote` (future) → a styled pull-quote card rendering `excerpt`
    with a link to `source_url`.

## Interaction

Small new vanilla-JS module (own file or a new section in `jgg.js`,
to be decided during implementation) — not a reuse of the letters'
AJAX "slot machine" navigation, since appearances is a single page
with in-page state, not cross-page navigation:

- Click an `.appearance__trigger` → un-hide its matching
  `.image-panel__item`, hide the previously-active one, update
  `aria-pressed` on both buttons, move focus sensibly.
- First/most-recent appearance is active by default on load (panel is
  never empty), matching how `letter.njk`/`speaking.njk` always show
  something in the image panel.

**Why real-but-hidden iframes instead of heht's build-on-click
facade:** heht's `.media-facade` pattern (the closest thing to
"loaded in the image panel like heht" in that codebase) only builds
native `<audio>`/`<video>` elements from a `src` URL — it has no
support for iframe embeds (YouTube, Spotify, etc.) at all, so there's
no existing code to literally reuse. The concept — click a thing, see
real media appear in that side panel — is what's being ported, not
the implementation.

Keeping real `<iframe loading="lazy">` elements in the DOM (just
`hidden`) rather than constructing them via JS on click gets two
things heht's approach doesn't:

1. `video-schema.js`'s build-time transform regex-scans final
   rendered HTML for YouTube embed iframes and auto-generates
   `VideoObject` JSON-LD per video — this only works if the iframes
   exist in the HTML at build time, not if they're injected by JS
   after a click.
2. `loading="lazy"` iframes that are hidden/non-intersecting don't
   fetch until actually shown, so there's no perf or privacy cost
   to having 22 iframes in the DOM — only the one made visible ever
   loads.

## Styling

Reuses `.shell--media` / `.image-panel` wholesale (`_structure.scss`)
— no structural CSS changes needed for desktop. One scoped override
needed: the existing mobile `.image-panel` collapses to a `4:3`
banner (built for photos); a `16:9` video letterboxes oddly at `4:3`,
so the appearances page gets its own aspect-ratio rule on mobile,
scoped to this page only.

## Nav

Add "Appearances" to `_includes/components/rail.njk` as a plain link
(same pattern as Speaking/Highlights — `aria-current` check against
`page.url`, not a `data-action` slide-panel trigger like Letters),
placed right after Speaking and before Highlights, since Speaking and
Appearances are both "external appearances" while Highlights is a
personal-narrative page.

## SEO

`VideoObject` JSON-LD comes for free from the existing
`video-schema.js` transform, as described above — no new schema code
needed for the `video` type. Future types can add their own JSON-LD
(e.g. `Book`/quote-adjacent schema) if desired, but that's out of
scope for v1.

## Initial content

Seed `appearances/` with all 22 videos from the playlist above (title,
channel/source name, date derived from the "N months/years ago"
relative labels, `type: video`, `source_url` as a clean
`https://www.youtube.com/watch?v=<id>` link with playlist/tracking
params stripped). Exact ID-to-title mapping will be re-verified during
implementation (via YouTube oEmbed per video ID) rather than relying
on the rough scrape done during this design pass.

## Open items deferred, not blocking

- Per-appearance deep link (`#appearance-<id>` hash on load) — cheap
  follow-up, not needed for v1.
- CMS (`admin/`) support — deferred per user decision; the file-based
  schema above is CMS-compatible later without changes.
