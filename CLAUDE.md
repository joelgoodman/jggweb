# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal site for Joel G Goodman (joelgoodman.co) — a blog/portfolio built with Eleventy v3, hosted on Netlify, with images served via Cloudinary CDN.

Content is "letters" (newsletter posts) in `letters/` as Markdown. Static pages are root-level `.njk` files.

## Commands

- **Dev server:** `npm start` (runs Sass + PostCSS + Rollup + Eleventy in parallel with live reload)
- **Production build:** `npm run build` (sets `ELEVENTY_ENV=production`, enables CSS purging/inlining and HTML minification)
- **Debug:** `npm run debug:start` (dev with Eleventy debug logging)

Individual watchers: `npm run watch:sass`, `npm run watch:js`, `npm run watch:eleventy`

## Architecture

### Build Pipeline

1. **SCSS** (`_includes/assets/scss/`) → compiled to `_includes/assets/css/jgg.css`
2. **PostCSS** adds autoprefixer + cssnano minification
3. **Rollup** bundles `_includes/assets/js/jgg.js` → `_site/assets/js/jgg.bundle.js` (IIFE format)
4. **Eleventy** builds templates → `_site/`
5. **Production transforms** in `eleventy.config.js`:
   - `purge-and-inline-css`: PurgeCSS strips unused CSS, then inlines it into `<head>` (replaces `<!-- INLINE CSS-->` comment in `components/head.njk`)
   - `htmlmin`: minifies all HTML output
   - JS is inlined via the `jsmin` async Nunjucks filter (Terser)

In development, CSS loads as an external stylesheet; in production, all CSS and JS are inlined for zero render-blocking requests.

### Eleventy Configuration

- **Input:** `.` / **Output:** `_site/` / **Includes:** `_includes/` / **Data:** `_data/`
- **Layout alias:** `letter` → `layouts/letter.njk`
- **Collection:** `letter` — all files matching `./letters/`
- **Plugins:** `eleventy-plugin-embed-everything`, `@11ty/eleventy-plugin-rss`
- **Filters:** `readableDate`, `yearDate`, `htmlDateString`, `readingTime`, `cssmin`, `jsmin`
- **Shortcode:** `yt` — YouTube privacy-enhanced embed from URL
- **Passthrough copy:** CSS, fonts, icons, media from `_includes/assets/`; data from `assets/data/`

### Templates & Layouts

- `layouts/base.njk` — main layout (includes nav, menu, social, now-playing widget, inline JS)
- `layouts/letter.njk` — extends base for newsletter posts
- `components/` — reusable Nunjucks partials (head, nav, menu, social, now-playing, webmentions, callout)

### Styling

SCSS uses `@use` module syntax. Design tokens are CSS custom properties defined in `_includes/assets/scss/_config.scss`:
- 8px grid unit (`--grid-unit`)
- Color scheme with dark mode via `prefers-color-scheme: dark`
- Fonts: Gantari (body, variable weight), Instrument (headings, serif)
- Media query mixin: `@include mq(md)` etc. (defined in `_helpers.scss`)

### Data

- `_data/metadata.json` — site metadata, author info, Cloudinary config, feed config
- `_data/site.js` — exports `environment` (production/development)
- `jgg.config.js` — directory path definitions

### External Integrations

- **Cloudinary** — image CDN with auto format/DPI/quality (`metadata.cloudinary.prefix` + `metadata.cloudinary.ops`)
- **Webmention.io** — receiving webmentions/pingbacks
- **Netlify** — hosting, deploys from `_site/`, Node 22 (`.nvmrc`)

## Content

- Letters (posts) go in `letters/` as `.md` files with frontmatter
- Drafts go in `_drafts/` (excluded via `.eleventyignore`)
- Files ending in `.draft` are also excluded from builds
- Code is MIT licensed; content is CC BY-NC-SA 4.0

## Node Version

Node 22 (pinned in `.nvmrc` and `netlify.toml`)
