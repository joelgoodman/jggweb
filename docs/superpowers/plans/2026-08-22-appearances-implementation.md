# Appearances Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Appearances" archive page to joelgoodman.co listing external media (starting with YouTube video appearances) Joel is featured in, reachable from the nav rail, with click-to-reveal embeds in the existing `.image-panel` shell.

**Architecture:** Mirror the existing `speaking_events/` pattern exactly — a directory of permalink-less Markdown files feeding a new `appearance` Eleventy collection, rendered by a root `appearances.njk` template (modeled on `speaking.njk`) that groups entries by year. Unlike Speaking's scroll-linked photo crossfade, each entry's media is a real, `hidden`-by-default `<iframe>` inside `.image-panel`; a small vanilla-JS click handler toggles which one is visible.

**Tech Stack:** Eleventy v3 (Nunjucks templates), Sass (`@use` modules), vanilla ES5-style JS (no build/transpile step for `jgg.js`), no test framework — verification is "build the site, inspect `_site/` output, check in a browser."

**Spec:** [docs/superpowers/specs/2026-08-22-appearances-design.md](../specs/2026-08-22-appearances-design.md)

## Global Constraints

- No live YouTube Data API integration — all appearance entries are hand-authored Markdown files (per spec's non-goals).
- No individual permalink/detail page per appearance (`permalink: false`, same as `speaking_events/`).
- No admin CMS (`admin/`) changes — hand-edited files only, per user decision.
- `type` field must stay generic (`video` today; `podcast`/`book`/`quote` are future values) — no YouTube-specific assumptions baked into the collection or directory-data layer.
- Reuse existing filters/shortcodes exactly as they exist (`groupByYear`, `monthYearDate`, the `yt` shortcode) rather than writing parallel implementations.

## Implementation notes discovered during planning

- **Two of the 22 playlist videos are already catalogued.** `speaking_events/2018-07-engaging-accepted-students-through-wordpress.md` (`event_url: https://www.youtube.com/watch?v=CDcrVwK8oso`) and `speaking_events/2019-07-redesigning-a-university-website.md` (`event_url: https://www.youtube.com/watch?v=vwZNGUE_pvE`) are recordings of talks already listed on `/speaking/`. They're excluded from the Appearances seed set below (20 of the 22 videos) to avoid listing the same video twice across two nav sections.
- **`<button>` can only contain phrasing content** — `<h3>`/`<p>` are not valid children of `<button>` per the HTML spec. Each list row therefore uses `<span>` elements (`.appearance__title`, `.appearance__meta`) inside the button, not the `.event` article/`<h3>`/`<p>` markup `speaking.njk` uses. This needs its own small CSS (Task 3), not a reuse of `_events.scss`'s `.event` rules.
- **An `id` field is added to the appearance frontmatter schema** (not in the original spec) — a short, unique string (the YouTube video ID works well) used to match each list button to its panel via `data-appearance`/`data-appearance-panel`, since Eleventy doesn't otherwise expose a stable per-item slug for `permalink: false` collection items.
- **The shared `yt` shortcode (`eleventy.config.js:263`) needs `loading="lazy"` added to its iframe output.** This is what makes the "20 real iframes, only the active one hidden" strategy actually cheap: a `hidden` (`display:none`) element never becomes an intersection target, so a `loading="lazy"` iframe inside one never fetches until the JS un-hides it. Confirmed safe: nothing else in the codebase currently calls `{% yt %}` (grep found zero content usages), and `video-schema.js`'s regex (`<iframe[^>]*src="..."`) matches regardless of extra attributes, so this doesn't break its JSON-LD generation.

---

### Task 1: `appearance` collection, seed content, and archive template

**Files:**
- Modify: `eleventy.config.js` (add collection, ~after line 357; tweak `yt` shortcode, lines 263-269)
- Create: `appearances/appearances.11tydata.json`
- Create: 20 files under `appearances/` (listed in Step 3)
- Create: `appearances.njk`
- Test: manual build + grep (no test framework in this repo)

**Interfaces:**
- Produces: `collections.appearance` — array of Eleventy collection items, each `item.data` having `{ title, date, type, source_name, source_url, id }`. Consumed by `appearances.njk` (this task) and available to any later template.
- Produces: page at `/appearances/` once the template exists.

- [ ] **Step 1: Add the `appearance` collection to `eleventy.config.js`**

Find the existing `speaking_event` collection (around line 350-357):

```js
  // Speaking events — per-file entries in speaking_events/ that don't
  // emit their own pages (permalink: false via dir data) and only show
  // up inside speaking.njk, grouped by year.
  eleventyConfig.addCollection("speaking_event", function(collection) {
    return collection.getAll().filter(function(item) {
      return item.inputPath.match(/^\.\/speaking_events\//) !== null;
    });
  });
```

Add immediately after it:

```js
  // Appearances — external media (video/podcast/etc.) Joel is featured
  // in. Per-file entries in appearances/ that don't emit their own
  // pages (permalink: false via dir data) and only show up inside
  // appearances.njk, grouped by year.
  eleventyConfig.addCollection("appearance", function(collection) {
    return collection.getAll().filter(function(item) {
      return item.inputPath.match(/^\.\/appearances\//) !== null;
    });
  });
```

- [ ] **Step 2: Add `loading="lazy"` to the `yt` shortcode**

Find (around line 263-269):

```js
  eleventyConfig.addShortcode("yt", (videoURL, title) => {
		const url = new URL(videoURL);
		const id = url.searchParams.get("v");
		return `<iframe class="yt-embed" src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video player${
			title ? ` for ${title}` : ""
		}" frameborder="0" allowfullscreen></iframe>`;
	});
```

Replace with:

```js
  eleventyConfig.addShortcode("yt", (videoURL, title) => {
		const url = new URL(videoURL);
		const id = url.searchParams.get("v");
		return `<iframe class="yt-embed" src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video player${
			title ? ` for ${title}` : ""
		}" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
	});
```

- [ ] **Step 3: Create the directory data file and 20 seed content files**

Run:

```bash
mkdir -p appearances

cat > appearances/appearances.11tydata.json << 'EOF'
{
  "permalink": false,
  "eleventyExcludeFromCollections": false
}
EOF

cat > appearances/2026-03-gradcomm-website-search-ai.md << 'EOF'
---
id: JIBQ3V9nQME
title: "Ep 73: Quick Take: Why Your College Website Search Isn't Working and How AI Can Fix It"
date: 2026-03-01
type: video
source_name: "GradComm"
source_url: "https://www.youtube.com/watch?v=JIBQ3V9nQME"
---
EOF

cat > appearances/2026-02-beyond-the-cms-dotfusion.md << 'EOF'
---
id: r0gjZyK0riE
title: "Beyond The CMS #39 - Chris Bryce (Dotfusion) with Joel Goodman (Squiz)"
date: 2026-02-01
type: video
source_name: "Dotfusion Digital Agency"
source_url: "https://www.youtube.com/watch?v=r0gjZyK0riE"
---
EOF

cat > appearances/2025-11-why-an-ai-critic-joined-a-tech-company.md << 'EOF'
---
id: tKQZ1xOSI-A
title: "Why an AI Critic Joined a Tech Company"
date: 2025-11-01
type: video
source_name: "Higher Ed Pulse"
source_url: "https://www.youtube.com/watch?v=tKQZ1xOSI-A"
---
EOF

cat > appearances/2025-08-optimizing-higher-ed-website-to-convert.md << 'EOF'
---
id: e1KD6fk9HQk
title: "Ep.50: Optimizing Higher Ed Website To Convert, Simple and Effective Tips with Joel Goodman"
date: 2025-08-01
type: video
source_name: "Concept3D"
source_url: "https://www.youtube.com/watch?v=e1KD6fk9HQk"
---
EOF

cat > "appearances/2025-08-imposter-syndrome-lessons-in-leadership.md" << 'EOF'
---
id: O_-LzF-YVP8
title: "Joel Goodman on Imposter Syndrome [Lessons in Leadership]"
date: 2025-08-01
type: video
source_name: "Enrollify"
source_url: "https://www.youtube.com/watch?v=O_-LzF-YVP8"
---
EOF

cat > appearances/2025-08-handling-criticism-lessons-in-leadership.md << 'EOF'
---
id: mtcp88U_kts
title: "Joel Goodman on Handling Criticism [Lessons in Leadership]"
date: 2025-08-01
type: video
source_name: "Enrollify"
source_url: "https://www.youtube.com/watch?v=mtcp88U_kts"
---
EOF

cat > appearances/2025-08-navigating-uncertainty-lessons-in-leadership.md << 'EOF'
---
id: FHcpaDpl-I4
title: "Joel Goodman on Navigating Uncertainty [Lessons in Leadership]"
date: 2025-08-01
type: video
source_name: "Enrollify"
source_url: "https://www.youtube.com/watch?v=FHcpaDpl-I4"
---
EOF

cat > appearances/2025-08-in-house-marcom-vs-external-partners.md << 'EOF'
---
id: 5_X0ZBva2Pg
title: "#64 - In-house Marcom Staff vs. External Partners w/ Joel Goodman of Bravery Media"
date: 2025-08-01
type: video
source_name: "Higher Ed Storytelling"
source_url: "https://www.youtube.com/watch?v=5_X0ZBva2Pg"
---
EOF

cat > "appearances/2025-08-how-good-web-redesign-breaks-silos.md" << 'EOF'
---
id: zmu_VA5-Ins
title: "Ep. 20: How Good Web (Re) Design Breaks Silos"
date: 2025-08-01
type: video
source_name: "Enrollify"
source_url: "https://www.youtube.com/watch?v=zmu_VA5-Ins"
---
EOF

cat > appearances/2024-08-external-partners-vs-in-house-videographers.md << 'EOF'
---
id: dpyMN15KTA4
title: "External partners for video production or in-house videographers?"
date: 2024-08-01
type: video
source_name: "Higher Ed Storytelling"
source_url: "https://www.youtube.com/watch?v=dpyMN15KTA4"
---
EOF

cat > appearances/2024-08-ep-64-trailer-in-house-marcom-vs-external-partners.md << 'EOF'
---
id: dWW_tGxfPng
title: "Ep 64 Trailer // In-house Marcom Staff vs. External Partners w/ Joel Goodman of Bravery Media"
date: 2024-08-01
type: video
source_name: "Higher Ed Storytelling"
source_url: "https://www.youtube.com/watch?v=dWW_tGxfPng"
---
EOF

cat > appearances/2024-08-the-limits-of-ai-in-marketing.md << 'EOF'
---
id: DciM8jDS9MY
title: "Keep it real: The limits of AI in marketing"
date: 2024-08-01
type: video
source_name: "Higher Ed Storytelling"
source_url: "https://www.youtube.com/watch?v=DciM8jDS9MY"
---
EOF

cat > appearances/2023-08-for-our-edification-part-2.md << 'EOF'
---
id: a5pAdTQTUFE
title: "For Our Edification | The Grind of Higher Ed Marketing Part 2"
date: 2023-08-01
type: video
source_name: "Eddie Francis"
source_url: "https://www.youtube.com/watch?v=a5pAdTQTUFE"
---
EOF

cat > appearances/2023-08-for-our-edification-part-1.md << 'EOF'
---
id: oYdkAz0G_iQ
title: "For Our Edification | The Grind of Higher Ed Marketing, Part 1"
date: 2023-08-01
type: video
source_name: "Eddie Francis"
source_url: "https://www.youtube.com/watch?v=oYdkAz0G_iQ"
---
EOF

cat > appearances/2024-08-create-a-great-user-experience.md << 'EOF'
---
id: CzcmnhzUWcg
title: "Create a Great User Experience on your Higher-Ed Website - An Interview with Joel Goodman"
date: 2024-08-01
type: video
source_name: "Education Marketing Leader"
source_url: "https://www.youtube.com/watch?v=CzcmnhzUWcg"
---
EOF

cat > appearances/2014-08-sololive-working-with-contractors.md << 'EOF'
---
id: qeVzGQvDzDw
title: "SoloLive: Working with Contractors"
date: 2014-08-01
type: video
source_name: "HigherEdLive"
source_url: "https://www.youtube.com/watch?v=qeVzGQvDzDw"
---
EOF

cat > appearances/2013-08-work-hacks-and-getting-stuff-done.md << 'EOF'
---
id: VRy-8NQXPjo
title: "Higher Ed Live: Work Hacks & Getting Stuff Done"
date: 2013-08-01
type: video
source_name: "HigherEdLive"
source_url: "https://www.youtube.com/watch?v=VRy-8NQXPjo"
---
EOF

cat > appearances/2013-08-joel-goodman-quick5.md << 'EOF'
---
id: J0HkDruzEyo
title: "Joel Goodman Quick5"
date: 2013-08-01
type: video
source_name: "UALRBowenlaw"
source_url: "https://www.youtube.com/watch?v=J0HkDruzEyo"
---
EOF

cat > appearances/2013-01-marketing-and-web-predictions-for-2013.md << 'EOF'
---
id: 07HCQiBwcjE
title: "Higher Ed Live: Looking Ahead - Marketing & Web Predictions for 2013"
date: 2013-01-01
type: video
source_name: "HigherEdLive"
source_url: "https://www.youtube.com/watch?v=07HCQiBwcjE"
---
EOF

cat > appearances/2012-08-rethinking-social-media-in-higher-education.md << 'EOF'
---
id: DbpbjkZzVgQ
title: "Higher Ed Live: Rethinking Social Media in Higher Education"
date: 2012-08-01
type: video
source_name: "HigherEdLive"
source_url: "https://www.youtube.com/watch?v=DbpbjkZzVgQ"
---
EOF

ls appearances/*.md | wc -l
```

Expected: `20`

- [ ] **Step 4: Create `appearances.njk`**

```njk
---
title: Appearances
layout: layouts/base.njk
pageType: feature
section: appearances
slug: appearances
seo:
  description: Podcasts, interviews, and conference talks featuring Joel Goodman on higher ed marketing, web design, and digital strategy.
---

<div class="content-column">
  <nav class="rail" id="rail-content" aria-label="Site navigation">
    {% include "components/rail.njk" %}
  </nav>

  <main class="detail" id="main" tabindex="-1">
    <button class="detail__tab" id="detail-tab" aria-expanded="true" aria-controls="detail-content" aria-label="Toggle details"></button>
    {% include "components/slide-panels.njk" %}

    <div class="detail__content" id="detail-content">
      <div class="detail__slide">
        <header>
          <p class="detail__eyebrow">Appearances</p>
          <h1 class="detail__title">Appearances</h1>
          <p class="detail__summary">Podcasts, interviews, and panels where I've talked shop about higher ed marketing, web design, and the occasional AI hot take.</p>
        </header>

        <section class="events-list detail__body">
          {% set yearGroups = collections.appearance | groupByYear %}
          {% for group in yearGroups %}
            <section class="year-group">
              <h2 class="year-group__heading">{{ group.year }}</h2>
              <ul class="appearance-list" role="list">
                {% for item in group.items %}
                  <li class="appearance">
                    <button type="button" class="appearance__trigger" data-appearance="{{ item.data.id }}" aria-pressed="false" aria-controls="appearance-panel-{{ item.data.id }}">
                      <span class="appearance__type">{{ item.data.type }}</span>
                      <span class="appearance__title">{{ item.data.title }}</span>
                      <span class="appearance__meta"><time>{{ item.data.date | monthYearDate }}</time> &mdash; {{ item.data.source_name }}</span>
                    </button>
                  </li>
                {% endfor %}
              </ul>
            </section>
          {% endfor %}
        </section>
      </div>
    </div>
  </main>
</div>

{# ── Image Panel — one hidden item per appearance; JS reveals the
   clicked one. First item is unhidden on load by jgg.js. ── #}
<section class="image-panel" id="image-panel" aria-label="Appearance media">
  <div class="image-panel__slide" id="image-slide">
    {% for item in collections.appearance %}
      <div class="image-panel__item" id="appearance-panel-{{ item.data.id }}" data-appearance-panel="{{ item.data.id }}" hidden>
        {% if item.data.type == "video" %}
          {% yt item.data.source_url, item.data.title %}
        {% endif %}
      </div>
    {% endfor %}
  </div>
</section>
```

- [ ] **Step 5: Build and verify**

```bash
npm run build:eleventy
test -f _site/appearances/index.html && echo "PAGE OK"
grep -c 'class="appearance__trigger"' _site/appearances/index.html
grep -c 'class="image-panel__item"' _site/appearances/index.html
grep -c 'youtube-nocookie.com/embed' _site/appearances/index.html
```

Expected: `PAGE OK`, then `20`, `20`, `20`.

- [ ] **Step 6: Commit**

```bash
git add eleventy.config.js appearances/ appearances.njk
git commit -m "$(cat <<'EOF'
feat: add appearance collection and archive page

Adds a permalink-less appearances/ content type (mirroring
speaking_events/) and the appearances.njk archive template, seeded
with 20 YouTube appearances. Two videos from the source playlist were
already catalogued under speaking_events/ and are intentionally
excluded to avoid duplicate listings.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Nav rail link

**Files:**
- Modify: `_includes/components/rail.njk:22-35` (insert new `<li>` between Speaking and Highlights)

**Interfaces:**
- Consumes: `page.url` (Nunjucks global, already used by the Speaking/Highlights links for `aria-current`).
- Produces: a rail nav entry linking to `/appearances/`, present on every page (rail is included site-wide).

- [ ] **Step 1: Insert the new nav item**

Find (in `_includes/components/rail.njk`, right after the Speaking `<li>` closes and before the Highlights `<li>` opens):

```njk
      <span>Speaking</span>
    </a>
  </li>
  <li>
    <a href="{{ '/highlights/' | url }}" data-tooltip="Highlights" aria-label="Highlights"{% if page.url == "/highlights/" %} aria-current="page"{% endif %}>
```

Replace with:

```njk
      <span>Speaking</span>
    </a>
  </li>
  <li>
    <a href="{{ '/appearances/' | url }}" data-tooltip="Appearances" aria-label="Appearances"{% if page.url == "/appearances/" %} aria-current="page"{% endif %}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true">
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" stroke="currentColor">
          <rect x="1.75" y="3.75" width="14.5" height="10.5" rx="1.5"></rect>
          <path d="M7.25 6.75 L11.25 9 L7.25 11.25 Z"></path>
        </g>
      </svg>
      <span>Appearances</span>
    </a>
  </li>
  <li>
    <a href="{{ '/highlights/' | url }}" data-tooltip="Highlights" aria-label="Highlights"{% if page.url == "/highlights/" %} aria-current="page"{% endif %}>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build:eleventy
grep -c 'data-tooltip="Appearances"' _site/appearances/index.html
grep 'aria-current="page"' _site/appearances/index.html | grep -c 'Appearances'
```

Expected: both greater than `0` — the link is present, and `aria-current="page"` is set on the Appearances page's own copy of the link.

- [ ] **Step 3: Commit**

```bash
git add _includes/components/rail.njk
git commit -m "$(cat <<'EOF'
feat: add Appearances link to nav rail

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Styling

**Files:**
- Create: `_includes/assets/scss/_appearances.scss`
- Modify: `assets/css/jgg.scss` (register the new partial)

**Interfaces:**
- Consumes: design tokens from `_config.scss` (`--space-xs`, `--text-xs/sm/base`, `--accent-wash-2/3`, `--t-fast`, `--g-color--accent/base/body`), the `mobile` mixin from `_helpers.scss`. Reuses `.year-group`/`.year-group__heading` from `_events.scss` as-is (no changes there).
- Produces: `.appearance-list`, `.appearance`, `.appearance__trigger`, `.appearance__type`, `.appearance__title`, `.appearance__meta`, `.image-panel__item` — consumed by `appearances.njk` (Task 1) and the JS in Task 4 (`.appearance__trigger[aria-pressed]`, `.image-panel__item[hidden]`).

- [ ] **Step 1: Create `_includes/assets/scss/_appearances.scss`**

```scss
@use 'config' as *;

// ==========================================================================
// Appearances page — clickable list rows + click-to-reveal image panel
// ==========================================================================
//
// Rows are <button> elements (so the whole row is one click target and
// keyboard-focusable), which means their content must be phrasing-only —
// no <h3>/<p> allowed inside a <button>. Title/meta are styled <span>s
// instead of reusing .event's h3/p rules from _events.scss.

.appearance-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.appearance {
  margin-block-end: var(--space-xs);
}

.appearance__trigger {
  appearance: none;
  display: block;
  width: 100%;
  text-align: start;
  background: none;
  border: none;
  padding: 0.5rem 0.75rem;
  margin-inline: -0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color var(--t-fast);

  &:hover {
    background: var(--accent-wash-2);
  }
  &:focus-visible {
    outline: 2px solid var(--g-color--accent);
    outline-offset: 2px;
  }
  &[aria-pressed="true"] {
    background: var(--accent-wash-3);
  }
}

.appearance__type {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--g-color--accent);
  margin-block-end: 0.25em;
}

.appearance__title {
  display: block;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--g-color--base);
  line-height: 1.3;
  margin-block-end: 0.25em;
}

.appearance__meta {
  display: block;
  font-size: var(--text-sm);
  color: var(--g-color--body);
  line-height: 1.4;
}

// One full-size panel per appearance, stacked in .image-panel__slide
// (which is already position:absolute/inset:0 via _letter-nav.scss).
// Only the un-hidden one is ever visible — a hard swap, no crossfade.
.image-panel__item {
  width: 100%;
  height: 100%;

  iframe {
    width: 100%;
    height: 100%;
    display: block;
    border: 0;
  }
}

@include mobile {
  // Video wants 16:9, not the 4:3 banner ratio _structure.scss built
  // for photo cover images.
  [data-type="appearances"] .image-panel {
    aspect-ratio: 16 / 9;
  }
}
```

- [ ] **Step 2: Register the partial**

Find (in `assets/css/jgg.scss`):

```scss
@use "events";
@use "now-playing";
```

Replace with:

```scss
@use "events";
@use "appearances";
@use "now-playing";
```

- [ ] **Step 3: Build and verify**

```bash
npm run build:css
grep -c '\.appearance__trigger' _site/assets/css/jgg.css
```

Expected: greater than `0` (compiled/minified CSS still contains the class name as a literal selector string).

- [ ] **Step 4: Visual check in the browser**

```bash
npm start
```

Open `/appearances/` in a browser at desktop width: confirm the list renders grouped by year, rows highlight on hover, and the image panel fills the right-hand column. Resize to a mobile width (< 1024px): confirm the image panel becomes a 16:9 banner above the list, not the 4:3 used on Speaking/Letters.

- [ ] **Step 5: Commit**

```bash
git add _includes/assets/scss/_appearances.scss assets/css/jgg.scss
git commit -m "$(cat <<'EOF'
style: add Appearances page styles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Click-to-reveal interaction

**Files:**
- Modify: `_includes/assets/js/jgg.js` (append new IIFE at end of file)

**Interfaces:**
- Consumes: `.appearance__trigger[data-appearance]` buttons and `.image-panel__item[data-appearance-panel]` divs from Task 1's template, `[aria-pressed]`/`[hidden]` CSS hooks from Task 3.
- Produces: no new exports — this is a self-contained page-load IIFE, matching every other block in `jgg.js`.

- [ ] **Step 1: Append the interaction module to `jgg.js`**

Add at the end of `_includes/assets/js/jgg.js` (after the existing letters-navigation IIFE closes):

```js

// Appearances — click a list entry to reveal its media in the image
// panel. All panels are real, hidden-by-default <iframe>s (see
// eleventy.config.js's `yt` shortcode + appearances.njk) so
// video-schema.js can still index every video at build time; only the
// un-hidden one ever loads, since a `loading="lazy"` iframe inside a
// `hidden` (display:none) ancestor never becomes an intersection
// target until it's shown.
(function() {
  var triggers = document.querySelectorAll('.appearance__trigger');
  if (!triggers.length) return;

  var panels = document.querySelectorAll('.image-panel__item[data-appearance-panel]');
  if (!panels.length) return;

  function activate(id) {
    triggers.forEach(function(btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.appearance === id));
    });
    panels.forEach(function(panel) {
      panel.hidden = panel.dataset.appearancePanel !== id;
    });
  }

  triggers.forEach(function(btn) {
    btn.addEventListener('click', function() {
      activate(btn.dataset.appearance);
    });
  });

  activate(triggers[0].dataset.appearance);
})();
```

- [ ] **Step 2: Manual verification in the browser**

```bash
npm start
```

Open `/appearances/`:
1. Confirm the first (most recent) appearance's video is visible in the image panel on load, with no other panel visible.
2. Click a different list row: confirm its embed appears, the previous one disappears, and the clicked button now looks pressed/highlighted (from Task 3's `[aria-pressed="true"]` style).
3. Tab through the list with the keyboard: confirm each row is focusable and Enter/Space activates it the same as a click.
4. Open browser DevTools → Network, filter by "youtube": confirm only one `youtube-nocookie.com/embed/...` request fires per click, not 20 at page load.

- [ ] **Step 3: Commit**

```bash
git add _includes/assets/js/jgg.js
git commit -m "$(cat <<'EOF'
feat: wire up click-to-reveal media in Appearances image panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Production build smoke test

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-4.

- [ ] **Step 1: Run the full production build**

```bash
npm run build
```

Expected: exits `0`, no errors from Eleventy, PurgeCSS, HTML minification, or the admin build.

- [ ] **Step 2: Verify JSON-LD and inlined CSS survive minification**

```bash
grep -c '"@type":"VideoObject"' _site/appearances/index.html
grep -c 'appearance__trigger' _site/appearances/index.html
```

Expected: first command returns `20` (one `VideoObject` per unique video, from `video-schema.js`); second returns greater than `0` (PurgeCSS keeps classes that appear in that page's own rendered HTML, so `.appearance__trigger`'s inlined `<style>` should still be present).

- [ ] **Step 3: Spot-check a couple of individual video pages weren't affected**

```bash
grep -o '<iframe[^>]*yt-embed[^>]*>' _site/letters/*/index.html 2>/dev/null | head -5
```

If this returns any results, confirm each still has `loading="lazy"` and a valid `youtube-nocookie.com/embed/` src — the shortcode change from Task 1 should apply uniformly with no breakage. (An empty result is also fine — it just means no existing letter currently uses the `yt` shortcode directly.)

- [ ] **Step 4: No commit needed** — this task is verification-only. If any check fails, fix the underlying task and re-run this one.
