# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal site for Joel G Goodman (joelgoodman.co) — a blog/portfolio built with Eleventy v3, hosted on Bunny CDN (Object Storage), with build-time image optimization via `@11ty/eleventy-img`.

Content is "letters" (newsletter posts) in `letters/` as Markdown. Static pages are root-level `.njk` files. `timeline.html` is a standalone data visualization page with its own inline styles/scripts.

## Commands

- **Dev server:** `npm start` (runs Sass + PostCSS + Rollup + Eleventy in parallel with live reload)
- **Production build:** `npm run build` (sets `ELEVENTY_ENV=production`, enables CSS purging/inlining, HTML minification, and image optimization)
- **Deploy:** `npm run deploy` (builds then uploads `_site/` to Bunny Object Storage)
- **Debug:** `npm run debug:start` (dev with Eleventy debug logging)

Individual watchers: `npm run watch:sass`, `npm run watch:js`, `npm run watch:eleventy`

## Architecture

### Build Pipeline

1. **SCSS** (`_includes/assets/scss/`) → compiled to `_includes/assets/css/jgg.css`
2. **PostCSS** adds autoprefixer + cssnano minification
3. **Rollup** bundles `_includes/assets/js/jgg.js` → `_site/assets/js/jgg.bundle.js` (IIFE format)
4. **Eleventy** builds templates → `_site/`
   - `@11ty/eleventy-img` transforms `<img>` tags into `<picture>` elements with AVIF/WebP/JPEG at 300/600/900/auto widths
5. **Production transforms** in `eleventy.config.js`:
   - `purge-and-inline-css`: PurgeCSS strips unused CSS, then inlines it into `<head>` (replaces `<!-- INLINE CSS-->` comment in `components/head.njk`)
   - `htmlmin`: minifies all HTML output
   - JS is inlined via the `jsmin` async Nunjucks filter (Terser)
6. **Deploy** uploads `_site/` to Bunny Object Storage via `scripts/upload-to-bunny.js`

In development, CSS loads as an external stylesheet; in production, all CSS and JS are inlined for zero render-blocking requests.

### Eleventy Configuration

- **Input:** `.` / **Output:** `_site/` / **Includes:** `_includes/` / **Data:** `_data/`
- **Layout alias:** `letter` → `layouts/letter.njk`
- **Collection:** `letter` — all files matching `./letters/`
- **Plugins:** `eleventy-plugin-embed-everything`, `@11ty/eleventy-plugin-rss`, `@11ty/eleventy-img` (transform plugin)
- **Filters:** `readableDate`, `yearDate`, `htmlDateString`, `readingTime`, `cssmin`, `jsmin`
- **Shortcode:** `yt` — YouTube privacy-enhanced embed from URL
- **Passthrough copy:** CSS, fonts, icons, media from `_includes/assets/`; images from `assets/img/`; data from `assets/data/`

### Images

- Source images live in `assets/img/` (flat structure, no subdirectories)
- Templates use plain `<img src="/assets/img/filename.jpg">` — eleventy-img automatically generates responsive `<picture>` elements with AVIF, WebP, and JPEG variants
- OG/Twitter card images reference source paths directly (social crawlers don't support `<picture>`)
- Letter cover images are set in frontmatter: `cover: { image: filename.jpg, alt: description }`

### Templates & Layouts

- `layouts/base.njk` — main layout (includes nav, menu, social, now-playing widget, inline JS)
- `layouts/letter.njk` — extends base for newsletter posts
- `components/` — reusable Nunjucks partials (head, nav, menu, social, now-playing, webmentions, callout)
- `timeline.html` — standalone listening autobiography page (own CSS/JS, uses D3.js, fetches live Last.fm stats)

### Styling

SCSS uses `@use` module syntax. Design tokens are CSS custom properties defined in `_includes/assets/scss/_config.scss`:

**Spacing** (8px grid-aligned): `--space-xs` (8px) through `--space-3xl` (80px), plus fluid `--space-section-h` and `--space-section-v` using `clamp()`. Legacy `--gutter-sm/md/lg` aliases remain.

**Typography**: Fluid sizing via `clamp()` on body and all headings — no breakpoint steps. Fonts: Plus Jakarta Sans (body, variable weight 200–800, upright + italic) — matches the Higher Ed Hot Takes brand for cross-site consistency; Instrument Serif (headings). All self-hosted in `_includes/assets/fonts/` as subsetted variable woff2. No external font requests.

**Colors**: Light default with dark mode via `prefers-color-scheme: dark`. Dark mode uses charcoal-blue palette (`#1c1e26` bg, `#f0ead8` text, `#c8c0b0` body text).

**Transitions**: `--t-fast` (0.2s), `--t-base` (0.3s), `--t-slow` (0.6s), plus `--t-timing` (275ms) and `--t-effect` (cubic-bezier).

**Media queries**: Mobile-first via `@include mq(sm/md/lg/xl/huge)` mixin in `_helpers.scss`.

**Timeline page** has its own design system (dark-only, amber accent, uses Bunny.net font mirror for Instrument Serif and JetBrains Mono, self-hosted Gantari).

### Data

- `_data/metadata.json` — site metadata, author info, feed config
- `_data/site.js` — exports `environment` (production/development)
- `jgg.config.js` — directory path definitions

### Hosting & CDN

- **Bunny Object Storage** — entire built site uploaded via `scripts/upload-to-bunny.js`
- **Configuration:** `.env` with `BUNNY_STORAGE_ZONE` (zone name) and `BUNNY_API_KEY` (storage zone password from FTP & API Access)
- **Webmention.io** — receiving webmentions/pingbacks
- **Bunny.net font mirror** — used by `timeline.html` for privacy-friendly Google Fonts alternative

## Content

- Letters (posts) go in `letters/` as `.md` files with frontmatter
- Drafts go in `_drafts/` (excluded via `.eleventyignore`)
- Files ending in `.draft` are also excluded from builds
- Code is MIT licensed; content is CC BY-NC-SA 4.0

## Node Version

Node 22 (pinned in `.nvmrc`)
