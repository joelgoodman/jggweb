# Block Live-Site Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five CMS content blocks added in commit `d113d04` (Callout note/warning/tip, PullQuote with citation, Stat, Resource card) render correctly — and distinctly from each other — on the published site (joelgoodman.co), instead of the current state where `stat`/`resource` render as literal `::: stat {...}` text and Callout/PullQuote render with no kind differentiation or citation styling at all.

**Architecture:** Two independent layers, done in order:
1. **Directive registration** (`eleventy.config.js`) — teach the site's `markdown-it` instance about the `stat` and `resource` container directives, mirroring the existing `callout`/`pullquote` registrations. This is purely mechanical; there's no ambiguity in it.
2. **Live-site CSS** (new `_includes/assets/scss/_blocks.scss` partial) — style all five block treatments using the site's existing design tokens. The CSS below is a **proposed starting point**, not a locked decision: it's a direct token-translated port of the already-built, already-tested admin editor CSS (`admin/src/ui/styles.css`), included so this plan produces a working, visually-differentiated result out of the box. Swap any of it before or during execution if the frontend design pass calls for something different — the code is real and buildable either way, and changing a CSS value doesn't invalidate the surrounding task structure.

**Tech Stack:** Eleventy v3, `markdown-it` + `markdown-it-container`, Sass (`@use` module syntax), CSS custom properties (design tokens defined in `_includes/assets/scss/_config.scss`).

**Spec:** No separate spec file — this plan's "Architecture" section above and the per-task rationale serve as the spec. Prior design discussion and the block definitions themselves live in commit `d113d04` and its message.

## Global Constraints

- Match existing code style: 2-space indentation, `@use` module syntax (not `@import`), BEM-ish flat class names (`.stat-callout`, not `.stat__callout`).
- No new SCSS partial may introduce new design tokens — reuse what's already in `_includes/assets/scss/_config.scss` (`--g-color--accent`, `--g-color--accent-alt`, `--state-error`, `--state-success`, `--accent-wash-*`, `--text-*` scale, `--space-*` scale, `--font-heading`).
- `color-mix(in srgb, ...)` is an established pattern in this codebase (see `_includes/assets/scss/_footer.scss`) — safe to use for opacity washes that need to track a token's dark-mode value automatically.
- This is a static site build with no unit test suite. "Testing" a task means: run the dev build, open the rendered page in a browser, and visually confirm against the description in that task — there is no `npm test`.
- Do not touch `admin/` in this plan — the editor-side implementation is already done and committed (`d113d04`). This plan is live-site-only.

---

## File Structure

- **Modify:** `eleventy.config.js` — register two new `markdown-it-container` directives (`stat`, `resource`) alongside the existing `callout`/`pullquote` registrations (currently around lines 34–54).
- **Create:** `_includes/assets/scss/_blocks.scss` — new partial holding all CMS content-block styling: the Callout kind-differentiation fix, PullQuote's citation styling, and the two brand-new blocks (Stat, Resource card). Kept separate from `_posts.scss` (which owns the unrelated subscribe-box `.callout` and stays untouched) so each file keeps one clear responsibility.
- **Modify:** `assets/css/jgg.scss` — add `@use "blocks";` to load the new partial.
- **Modify (temporary, reverted at the end):** one letter under `_drafts/` — scratch content used to visually verify all five blocks together, removed once verification passes.

---

## Task 1: Register `stat` and `resource` directives

**Files:**
- Modify: `eleventy.config.js:34-54`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `<div class="stat-callout">…</div>` for `::: stat` blocks, `<div class="resource-card">…</div>` for `::: resource` blocks — Task 3 and Task 4's CSS targets these exact class names.

- [ ] **Step 1: Read the current registration block to confirm line numbers haven't drifted**

Run: `sed -n '28,56p' eleventy.config.js`
Expected: see the `const md = markdownIt(...)` line, then the `callout` and `pullquote` `md.use(markdownItContainer, ...)` calls, ending with the `markdownItAnchor` registration.

- [ ] **Step 2: Add the two new registrations immediately after the existing `pullquote` block**

Find this exact block:

```js
  md.use(markdownItContainer, "pullquote", {
    render: (tokens, idx) =>
      tokens[idx].nesting === 1
        ? `<blockquote class="pullquote">\n`
        : `</blockquote>\n`,
  });
```

Insert immediately after it:

```js
  md.use(markdownItContainer, "stat", {
    render: (tokens, idx) =>
      tokens[idx].nesting === 1
        ? `<div class="stat-callout">\n`
        : `</div>\n`,
  });
  md.use(markdownItContainer, "resource", {
    render: (tokens, idx) =>
      tokens[idx].nesting === 1
        ? `<div class="resource-card">\n`
        : `</div>\n`,
  });
```

Also update the doc comment directly above the `const md = markdownIt(...)` line (currently documents only `callout`/`pullquote`) to add:

```
     ::: stat {value="400%"}   (or any first line) →  <div class="stat-callout">…</div>
     ::: resource               →  <div class="resource-card">…</div>
```

(Note: the admin editor doesn't use a `{value="..."}` attribute — the "stat" and "resource" blocks both use a first-line content convention, not directive attributes. Match the comment to what Tasks 3–4 actually rely on: first paragraph = the stat/title, rest = caption/description. Don't invent an attribute-parsing render function — there isn't one to write.)

- [ ] **Step 3: Verify the site builds without errors**

Run: `npm run build`
Expected: build completes with no errors mentioning `eleventy.config.js` or markdown-it.

- [ ] **Step 4: Commit**

```bash
git add eleventy.config.js
git commit -m "feat: register stat and resource container directives"
```

---

## Task 2: Isolate the directive Callout from the subscribe-box `.callout`, add kind colors

**Files:**
- Create: `_includes/assets/scss/_blocks.scss`
- Modify: `assets/css/jgg.scss`

**Interfaces:**
- Consumes: `<aside class="callout" data-kind="note|warning|tip">` markup from Task 1's (already-existing) callout registration.
- Produces: the `_blocks.scss` partial file that Tasks 3–5 continue adding to.

**Context:** `_includes/assets/scss/_posts.scss:13-35` has a `.callout` rule built for the *unrelated* "Thanks for reading" subscribe box (`_includes/components/callout.njk`, `<aside class="callout">`, no `data-kind` attribute). The markdown-directive Callout reuses the same class name and currently inherits that heavy full-inverse-color treatment, which was never designed for an inline note/warning/tip aside. Every directive-based callout always carries a `data-kind` attribute (defaults to `"note"` — see `eleventy.config.js`'s callout `render` function), so `[data-kind]` cleanly selects only the directive callout without touching the subscribe box. Do not modify `_posts.scss`.

- [ ] **Step 1: Create the new partial with the Callout fix**

Create `_includes/assets/scss/_blocks.scss`:

```scss
@use 'config' as *;

// ==========================================================================
// CMS content blocks — Callout, PullQuote, Stat, Resource card.
// Inserted via the admin editor's slash menu (admin/src/milkdown/blocks/);
// this file is the live-site rendering half of each block. Keep class
// names in sync with eleventy.config.js's markdown-it-container render
// functions and with admin/src/ui/styles.css's editor-preview versions.
// ==========================================================================

// Scoped to [data-kind] so this never touches the unrelated subscribe-box
// `.callout` in _posts.scss (that one carries no data-kind attribute).
.callout[data-kind] {
  position: relative;
  border-inline-start: 3px solid var(--g-color--accent-alt);
  background: var(--accent-wash-3);
  color: var(--g-color--base);
  padding: var(--space-md);
  border-radius: 0 8px 8px 0;
  margin-block: var(--space-lg);

  &::before {
    content: attr(data-kind);
    display: block;
    font-family: var(--font-heading);
    font-size: var(--text-3xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--g-color--accent-alt);
    margin-block-end: var(--space-xs);
  }

  > * + * {
    margin-block-start: 0.75em;
  }

  p {
    margin: 0;
  }

  &[data-kind="warning"] {
    border-inline-start-color: var(--state-error);
    background: color-mix(in srgb, var(--state-error) 10%, transparent);
    &::before {
      color: var(--state-error);
    }
  }

  &[data-kind="tip"] {
    border-inline-start-color: var(--state-success);
    background: color-mix(in srgb, var(--state-success) 10%, transparent);
    &::before {
      color: var(--state-success);
    }
  }
}
```

- [ ] **Step 2: Wire the new partial into the build**

In `assets/css/jgg.scss`, add `@use "blocks";` after `@use "posts";`:

```scss
@use "posts";
@use "blocks";
```

- [ ] **Step 3: Build and verify no Sass errors**

Run: `npm run build`
Expected: build completes with no Sass compilation errors.

- [ ] **Step 4: Commit**

```bash
git add _includes/assets/scss/_blocks.scss assets/css/jgg.scss
git commit -m "feat: isolate directive Callout styling, add kind colors"
```

---

## Task 3: Style PullQuote (size + citation line)

**Files:**
- Modify: `_includes/assets/scss/_blocks.scss` (append)

**Interfaces:**
- Consumes: `<blockquote class="pullquote"><p>…quote…</p><p>— Source</p></blockquote>` markup — the second `<p>` is only a citation by convention (starts with an em dash) when the writer added one; there's no attribute marking it, so the CSS below styles *any* non-first, non-only paragraph inside `.pullquote` as the citation line. This matches the admin editor's identical convention (`admin/src/ui/styles.css`, `.milkdown-host .ProseMirror .pullquote p:last-child:not(:only-child)`).
- Produces: nothing consumed by later tasks — independent of Tasks 4–5.

**Context:** The site's default `blockquote` rule (`_includes/assets/scss/_type.scss:59-68`) already applies to `.pullquote` (it's a `<blockquote>`), giving it the base accent-alt left border and italic styling. This task overrides size/weight to make it visually bigger than a body blockquote (matching `admin/src/ui/styles.css`'s `.pullquote` at `font-size: 1.35em` relative to the editor's body text) and adds the citation treatment, which the base `blockquote` rule doesn't have.

- [ ] **Step 1: Append the PullQuote rule to `_blocks.scss`**

```scss
.pullquote {
  font-family: var(--font-heading);
  font-style: italic;
  font-size: var(--text-2xl);
  line-height: 1.3;
  color: var(--g-color--base);
  border-inline-start-color: var(--g-color--accent);
  margin-block: var(--space-lg);

  p {
    margin: 0;
  }

  p + p {
    margin-block-start: 0.5em;
  }

  // The citation line, when present — a second paragraph the writer
  // added starting with "— Source". Styled distinctly any time there's
  // more than one paragraph, since there's no attribute to key off.
  p:last-child:not(:only-child) {
    font-style: normal;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--g-color--body);
  }
}
```

- [ ] **Step 2: Build and verify no Sass errors**

Run: `npm run build`
Expected: build completes with no Sass compilation errors.

- [ ] **Step 3: Commit**

```bash
git add _includes/assets/scss/_blocks.scss
git commit -m "feat: style PullQuote size and citation line on live site"
```

---

## Task 4: Style Stat block

**Files:**
- Modify: `_includes/assets/scss/_blocks.scss` (append)

**Interfaces:**
- Consumes: `<div class="stat-callout"><p>400%</p><p>Increase in conversions…</p></div>` — first paragraph is the big number/phrase, remaining paragraphs are the caption (same convention as the admin editor, `admin/src/ui/styles.css` `.stat-callout`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append the Stat rule to `_blocks.scss`**

```scss
.stat-callout {
  margin-block: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  border-radius: 8px;
  background: var(--surface-raised);
  text-align: center;

  p:first-child {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: var(--text-4xl);
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--g-color--accent);
    margin: 0;
  }

  p:not(:first-child) {
    font-size: var(--text-sm);
    color: var(--g-color--body);
    margin-block-start: 0.35em;
  }
}
```

- [ ] **Step 2: Build and verify no Sass errors**

Run: `npm run build`
Expected: build completes with no Sass compilation errors.

- [ ] **Step 3: Commit**

```bash
git add _includes/assets/scss/_blocks.scss
git commit -m "feat: style Stat block on live site"
```

---

## Task 5: Style Resource card

**Files:**
- Modify: `_includes/assets/scss/_blocks.scss` (append)

**Interfaces:**
- Consumes: `<div class="resource-card"><p><a href="...">Title</a></p><p>Description…</p></div>` — first paragraph is the linked title, remaining paragraphs are the description (same convention as `admin/src/ui/styles.css` `.resource-card`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append the Resource card rule to `_blocks.scss`**

```scss
.resource-card {
  margin-block: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--g-color--base-40);
  border-radius: 8px;
  background: var(--g-color--bg);

  p:first-child {
    font-weight: 600;
    font-size: 1.05em;
    margin: 0;

    a {
      color: var(--g-color--base);
      text-decoration: none;

      &:hover {
        color: var(--g-color--accent);
      }
    }
  }

  p:not(:first-child) {
    font-size: var(--text-sm);
    color: var(--g-color--body);
    margin-block-start: 0.35em;
  }
}
```

- [ ] **Step 2: Build and verify no Sass errors**

Run: `npm run build`
Expected: build completes with no Sass compilation errors.

- [ ] **Step 3: Commit**

```bash
git add _includes/assets/scss/_blocks.scss
git commit -m "feat: style Resource card on live site"
```

---

## Task 6: End-to-end visual verification

**Files:**
- Create (temporary): `_drafts/block-verification-scratch.md`

**Interfaces:**
- Consumes: all five block treatments from Tasks 1–5.
- Produces: nothing — this task only verifies and then cleans up after itself.

- [ ] **Step 1: Create a scratch draft exercising every block**

Create `_drafts/block-verification-scratch.md` (excluded from the build via `.eleventyignore` — safe to leave mid-verification without publishing):

```markdown
---
title: Block verification scratch
date_published: 2026-08-23
slug: block-verification-scratch
draft: true
---

::: callout {.note}
This is a note callout.
:::

::: callout {.warning}
This is a warning callout.
:::

::: callout {.tip}
This is a tip callout.
:::

::: pullquote
A college marketing office might think SEO is the problem, but maybe it's a governance issue.

— Concept3D Podcast, Ep. 50
:::

::: stat
400%

Increase in conversions after adding whitespace.
:::

::: resource
[Hospitable Design](https://bravery.co/hospitable-design)

The nine-principle framework for treating website visitors like guests, not traffic.
:::
```

- [ ] **Step 2: Start the dev server and open the scratch entry**

Run: `npm start` (if not already running)
Navigate to the local dev URL for `/letters/block-verification-scratch/` (drafts render in dev per `CLAUDE.md`'s "Drafts... excluded via `.eleventyignore`" — confirm the dev server config actually serves `_drafts/`; if it doesn't, temporarily move the file to `letters/` with `draft: true` instead, and remove it in Step 4 either way).

- [ ] **Step 3: Visually confirm each block**

Check, in order:
- Note callout: teal-ish left border and wash, "NOTE" label.
- Warning callout: rust/red left border and wash, "WARNING" label.
- Tip callout: green left border and wash, "TIP" label.
- Pull quote: larger italic text with accent-colored left border; citation line below it in smaller, non-italic, muted text.
- Stat: large bold accent-colored "400%" centered, caption below in smaller muted text.
- Resource card: bordered card, linked bold title, description below in smaller muted text. Confirm the link is a real clickable `<a>` (not literal `[text](url)` — the render function wraps content through markdown-it, so a real markdown link written in the scratch file above always produces a real `<a>`, unlike the admin editor's `window.prompt`-based link flow tested in the previous session).

If any block doesn't match, fix the corresponding CSS in `_blocks.scss` and re-build before proceeding.

- [ ] **Step 4: Remove the scratch content**

```bash
rm _drafts/block-verification-scratch.md
```

(Or `git rm` if it was ever committed — it shouldn't be, since Step 1 through Step 3 happen before any commit of this file.)

- [ ] **Step 5: Final full build check**

Run: `npm run build`
Expected: production build completes cleanly with the scratch file gone.

No commit for this task — it produced no lasting file changes.

---

## Self-Review Notes

- **Spec coverage:** all five blocks named in commit `d113d04`'s message (Callout ×3 kinds, PullQuote, Stat, Resource) have a task. The pre-existing `.callout`/subscribe-box collision flagged during the original design discussion is fixed in Task 2.
- **Class-name consistency check:** `stat-callout` and `resource-card` match exactly between `eleventy.config.js` (Task 1), `_blocks.scss` (Tasks 4–5), and the already-shipped `admin/src/ui/styles.css` (`.stat-callout`, `.resource-card`) — verified by re-reading `admin/src/milkdown/blocks/stat.ts` and `resource.ts`'s `className` fields (`stat-callout`, `resource-card`) against this plan's Task 1 render output.
- **Out of scope, deliberately:** the broader "frontend post design" refresh (typography/layout beyond these five blocks) that came up earlier as a separate candidate thread is not part of this plan — pick it up as its own brainstorming pass if wanted.
