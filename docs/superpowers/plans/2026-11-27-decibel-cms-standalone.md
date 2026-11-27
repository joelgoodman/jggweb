# Decibel CMS Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the CMS damaging content, then publish it as a white-label template repo a friend's agent can set up.

**Architecture:** Tasks 1–5 fix `jggweb/admin/` on a branch: saves splice only changed front matter into the original file, and bodies the editor can't keep open as plain text. Tasks 6–12 copy that code into a new repo, replace everything site-specific with one `site.config.ts`, add theming, an Eleventy starter and `CLAUDE.md`, then publish.

**Tech Stack:** Svelte 5, Vite 6, TypeScript, Milkdown 7.20, `yaml` 2.8, vitest, Eleventy 3.

**Spec:** `docs/superpowers/specs/2026-11-27-decibel-cms-standalone-design.md`

## Global Constraints

- Node 22.
- jggweb work happens on branch `fix/cms-content-safety`. Never push it; a push to `main` deploys the site. Stage explicit paths only: the uncommitted changes in `_data/site.js`, `_includes/components/slide-panels.njk` and `scripts/edge/newsletter-signup.js` stay untouched.
- New repo: `~/Sites/11ty/decibel-cms`, fresh history, later public `joelgoodman/decibel-cms`. Created on GitHub only after the user confirms (Task 12).
- Nothing personal to joelgoodman.co in the new repo, except the copyright name in `LICENSE`.
- MIT covers code only; icons (Nucleo) and font (SIL OFL) are excluded. Icons are never browsable or pickable by users.
- No agent asks for, reads or stores a real GitHub token. Browser checks use a fake token against a stubbed `fetch`.
- Non-goals: npm package, logo/favicon settings, theme editor, non-GitHub storage, TOML/JSON front matter, nested or root-level content folders, new blocks, hosting setup, migrating joelgoodman.co.
- Paths in Tasks 1–5 are relative to jggweb; in Tasks 6–12 to the new repo.

## Review Focus

1. Files saved by VS Code on Windows (CRLF, UTF-8 BOM): front matter is recognised and both survive a save. (Task 1)
2. A file with no front matter that opens with a `---` divider: the whole file is body. (Task 1)
3. Invalid YAML front matter: the entry shows an error and cannot be saved over. (Tasks 1, 2)
4. Editing a body and undoing back: no spurious change is saved. (Task 4)
5. Uploading an image whose name already exists: nothing is overwritten and the message says to rename it. (Task 6)

---

### Task 1: Targeted front matter writes

**Files:**
- Modify: `admin/package.json` (script `"test": "vitest run"`; dev deps `vitest@^3`, `jsdom@^26`)
- Modify: `admin/src/core/frontmatter.ts`
- Test: `admin/tests/frontmatter.test.ts`

**Interfaces produced:**
- `parseEntry(raw: string): ParsedEntry` (shape unchanged; throws `InvalidFrontMatterError`; non-mapping YAML means no front matter)
- `interface FieldChange { path: string[]; value: unknown }` (`undefined` removes)
- `updateEntry(raw: string, changes: FieldChange[], body?: string): string`
- `stringifyEntry(frontmatter, body): string` (unchanged, new files only)

- [ ] **Step 1:** `git switch -c fix/cms-content-safety`; commit the spec and this plan. Install the dev deps.
- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseEntry, updateEntry, InvalidFrontMatterError } from '../src/core/frontmatter';

const raw = `---
title: Old   # keep me
date: 2024-02-22
excerpt: >-
  two
  lines
cover:
  image: a.jpg
  focus:
    x: 0.5
published: false
note: ""
---

Body *here*.
`;
const set = (path: string[], value: unknown) => [{ path, value }];

describe('updateEntry', () => {
  it('returns the file untouched with no changes', () => expect(updateEntry(raw, [])).toBe(raw));
  it('rewrites one key and keeps its comment', () =>
    expect(updateEntry(raw, set(['title'], 'New'))).toBe(raw.replace('title: Old', 'title: New')));
  it('replaces a block scalar only', () =>
    expect(updateEntry(raw, set(['excerpt'], 'one'))).toBe(raw.replace('excerpt: >-\n  two\n  lines', 'excerpt: one')));
  it('adds a nested key without dropping siblings', () =>
    expect(updateEntry(raw, set(['cover', 'alt'], 'Alt'))).toBe(raw.replace('    x: 0.5\n', '    x: 0.5\n  alt: Alt\n')));
  it('removes a key', () =>
    expect(updateEntry(raw, set(['note'], undefined))).toBe(raw.replace('note: ""\n', '')));
  it('creates a missing parent at the end of the front matter', () =>
    expect(updateEntry(raw, set(['seo', 'title'], 'S'))).toBe(raw.replace('note: ""\n', 'note: ""\nseo:\n  title: S\n')));
  it('removes a parent left empty', () =>
    expect(updateEntry('---\na: 1\nseo:\n  title: X\n---\n\nB\n', set(['seo', 'title'], undefined))).toBe('---\na: 1\n---\n\nB\n'));
  it('writes arrays as block lists', () =>
    expect(updateEntry('---\ntags:\n  - x\n---\n', set(['tags'], ['a', 'b']))).toBe('---\ntags:\n  - a\n  - b\n---\n'));
  it('replaces only the body', () =>
    expect(updateEntry(raw, [], 'New body')).toBe(raw.replace('Body *here*.', 'New body')));
  it('leaves a file without front matter alone', () => expect(updateEntry('Just text\n', [])).toBe('Just text\n'));
  it('adds front matter only when a field is filled', () =>
    expect(updateEntry('Just text\n', set(['title'], 'T'))).toBe('---\ntitle: T\n---\n\nJust text\n'));
  it('keeps CRLF, including in a new body', () => {
    const crlf = raw.replace(/\n/g, '\r\n');
    expect(updateEntry(crlf, set(['title'], 'New'), 'a\nb')).toBe(
      crlf.replace('title: Old', 'title: New').replace('Body *here*.', 'a\r\nb'));
  });
  it('reads and keeps a BOM', () => {
    expect(parseEntry('﻿' + raw).frontmatter.title).toBe('Old');
    expect(updateEntry('﻿' + raw, set(['title'], 'New'))).toBe('﻿' + raw.replace('title: Old', 'title: New'));
  });
});

describe('parseEntry', () => {
  it('treats a leading divider as body', () => {
    const text = '---\nsome text\n---\nmore\n';
    expect(parseEntry(text)).toEqual({ frontmatter: {}, body: text });
  });
  it('throws on invalid YAML', () =>
    expect(() => parseEntry('---\ntitle: "x\n---\n')).toThrow(InvalidFrontMatterError));
});
```

- [ ] **Step 3:** `cd admin && npm test` — expect FAIL (`updateEntry` is not exported).
- [ ] **Step 4:** Implement. Use `YAML.parseDocument` only for node ranges, and splice the changed pair's lines in the original string; never re-stringify the document. Render a changed pair with `YAML.stringify({ [key]: value }, { lineWidth: 0 })`, indented to its column, keeping a same-line comment and the file's line endings.
- [ ] **Step 5:** `npm test` — PASS. Commit `fix(admin): write only changed front matter`.

### Task 2: Field change rules and save wiring

**Files:**
- Create: `admin/src/core/changes.ts`, `admin/src/core/fields/ListField.ts`
- Modify: `admin/src/core/fields/index.ts`, `DateTimeField.ts`, `admin/src/ui/FieldRenderer.svelte`, `ui/fields/DateTimeInput.svelte`, `ui/EntryEditor.svelte`
- Test: `admin/tests/changes.test.ts`, `admin/tests/content-identity.test.ts`

**Interfaces:**
- Consumes: `FieldChange`, `updateEntry`, `InvalidFrontMatterError`.
- Produces: `diffFields(fields: AnyField[], loaded: Record<string, unknown>, current: Record<string, unknown>, raw: Record<string, unknown>): FieldChange[]` (`loaded`/`current` are deserialized editor values; `raw` is parsed front matter); `validateEntry(fields, current, raw, isNew: boolean): string | null`; `fields.list(name, options?)` (type `'list'`, editor value is comma-separated text, rendered with the text input).

- [ ] **Step 1: Failing tests**

```ts
const schema = [
  fields.text('title', { required: true }), fields.datetime('date'), fields.boolean('draft'), fields.list('tags'),
  fields.object('cover', { fields: [fields.text('image'), fields.text('alt')] }),
];
const raw = { title: 'T', date: '2024-02-22', draft: true, tags: ['a', 'b'], cover: { image: 'a.jpg', focus: { x: 0.5 } } };
const load = (fm: Record<string, unknown>) => Object.fromEntries(schema.map((f) => [f.name, f.deserialize(fm[f.name])]));
const diff = (edit: object, fm: Record<string, unknown> = raw) => diffFields(schema, load(fm), { ...load(fm), ...edit }, fm);

it('reports nothing for an untouched entry', () => expect(diff({})).toEqual([]));
it('reports a changed field', () => expect(diff({ title: 'U' })).toEqual([{ path: ['title'], value: 'U' }]));
it('reports only the changed child', () =>
  expect(diff({ cover: { image: 'a.jpg', alt: 'A' } })).toEqual([{ path: ['cover', 'alt'], value: 'A' }]));
it('writes false over an existing checkbox', () => expect(diff({ draft: false })).toEqual([{ path: ['draft'], value: false }]));
it('adds no false for an absent checkbox', () => expect(diff({ draft: false }, { title: 'T' })).toEqual([]));
it('removes a cleared field', () => expect(diff({ title: '' })).toEqual([{ path: ['title'], value: undefined }]));
it('writes lists as arrays', () => expect(diff({ tags: 'a, b, c' })).toEqual([{ path: ['tags'], value: ['a', 'b', 'c'] }]));
it('keeps a date-only value date-only', () => expect(diff({ date: '2024-03-01' })).toEqual([{ path: ['date'], value: '2024-03-01' }]));
it('requires a field that had a value', () => expect(validateEntry(schema, { ...load(raw), title: '' }, raw, false)).toBe('title is required'));
it('lets an older file without it save', () => expect(validateEntry(schema, load({}), {}, false)).toBeNull());
it('requires it on new entries', () => expect(validateEntry(schema, load({}), {}, true)).toBe('title is required'));
```

`content-identity.test.ts`: for every `.md` in `../letters`, `../pages`, `../speaking_events`, `../appearances`, using that collection from `config/schema.ts`: (a) `updateEntry(raw, diffFields(...unchanged))` equals `raw`; (b) where the file has a title, changing it leaves every line outside the `title` pair identical.

- [ ] **Step 2:** `npm test` — FAIL. **Step 3:** Implement the interfaces. A date-only original renders `<input type="date">` and `DateTimeField.serialize` returns `YYYY-MM-DD` unchanged. **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Wire `EntryEditor`: keep `loadedRaw`, `loadedValues`, `loadedBody` (replacing `extraFrontmatter`). New entries use `stringifyEntry`. Existing entries with no changes and an unchanged body toast `No changes to save` and create no draft branch. Otherwise `updateEntry(loadedRaw, changes, body === loadedBody ? undefined : body)`, then update the loaded state without remounting the editor. On load failure show `This entry's front matter can't be read: <reason>. Fix the file, then reopen it.` with no Save or Publish.
- [ ] **Step 6:** `npm test && npm run build`; commit `fix(admin): preserve untouched content on save`.

### Task 3: Keep URLs and colons intact

**Files:**
- Create: `admin/src/milkdown/containerDirectives.ts`, `admin/src/milkdown/markdown.ts`
- Modify: `admin/src/milkdown/directives.ts`, `ui/fields/MarkdownInput.svelte`, `package.json` (add `micromark-extension-directive@^4`, `mdast-util-directive@^3`)
- Test: `admin/tests/markdown.test.ts` (`// @vitest-environment jsdom`)

**Interfaces produced:** `remarkContainerDirective()` (remark plugin: container directives only, without the phrasing-colon escape); `createMarkdownEditor(o: { root: HTMLElement; value: string; blocks: BlockDefinition[] }): Editor` (schema, parser and serializer; the caller adds UI plugins and calls `create()`); `roundTripMarkdown(md: string, blocks: BlockDefinition[]): Promise<string>`.

- [ ] **Step 1: Failing tests**

```ts
const blocks = [CalloutNote, PullQuote, Stat, Resource];
it.each([
  'https://www.youtube.com/watch?v=ab_Cd&t=1',
  'destination:beautiful at 3:30pm',
  '[destination:beautiful](https://example.com/a_b)',
  ':::callout{.warning}\nhi\n:::',
])('round-trips %s', async (md) => expect((await roundTripMarkdown(md, blocks)).trim()).toBe(md));
it('rejects a container it has no block for', async () =>
  await expect(roundTripMarkdown(':::tip\nx\n:::', blocks)).rejects.toThrow());
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement. Override the `text` handler through `remarkStringifyOptionsCtx` so URL spans are emitted raw and the rest goes through `state.safe`; keep Milkdown's existing trailing-space shortcut. `MarkdownInput` builds on `createMarkdownEditor`. **Step 4:** `npm test` — PASS. Commit `fix(admin): keep URLs and colons intact`.

### Task 4: Plain-Markdown fallback

**Files:**
- Create: `admin/src/core/editability.ts`
- Modify: `ui/fields/MarkdownInput.svelte`, `ui/styles.css`, `package.json` (add `mdast-util-from-markdown`, `micromark-extension-gfm@^3`, `mdast-util-gfm@^3`)
- Test: `admin/tests/editability.test.ts` (jsdom)

**Interfaces:** Consumes `roundTripMarkdown`. Produces `type PlainReason = 'template' | 'extended' | 'unsupported' | 'would-change'`; `sameMarkdown(a: string, b: string): boolean`; `checkEditable(original: string, roundTrip: (md: string) => Promise<string>): Promise<PlainReason | null>`.

- [ ] **Step 1: Failing tests**

```ts
const check = (md: string) => checkEditable(md, (s) => roundTripMarkdown(s, [CalloutNote, PullQuote, Stat, Resource]));
it.each([
  ['{% yt "x" %}', 'template'], ['{{ site.name }}', 'template'],
  ['| a |\n|---|\n| 1 |', 'extended'], ['- [ ] x', 'extended'], ['a[^1]\n\n[^1]: n', 'extended'],
  [':::tip\nx\n:::', 'unsupported'],
  ['Plain *text*.\n\n* a\n* b\n', null], ['Plain _text_.\n\n- a\n- b\n', null],
])('%s -> %s', async (md, reason) => expect(await check(md)).toBe(reason));
it('ignores wrapping', () => expect(sameMarkdown('one two', 'one\ntwo')).toBe(true));
it.each([['`a  b`', '`a b`'], ['# A', '## A'], ['- a\n- b', '- a\n\n- b']])('differs: %s', (a, b) =>
  expect(sameMarkdown(a, b)).toBe(false));
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement: template tags first; then a GFM parse (plus container directives) for tables, footnotes and task items; then round-trip (a throw is `unsupported`); then compare trees without positions, collapsing whitespace in text nodes only. If a tight list fails, fix the serializer, not the comparison. **Step 4:** PASS.
- [ ] **Step 5:** In `MarkdownInput`, run `checkEditable` before mounting. On a reason, show a textarea (`.markdown-plain`) under the notice `This entry uses Markdown the visual editor can't keep intact, so it's open as plain text. Nothing is changed until you edit it.` In the rich editor, `onChange` passes the original `value` whenever the serialized document equals the load-time baseline. Test: `bodyOrOriginal(serialized: string, baseline: string, original: string): string` in `editability.ts` returns `original` when `serialized === baseline`, else `serialized`.
- [ ] **Step 6:** Add to the test file a report over jggweb's four folders that prints the count per reason and asserts every `null` body satisfies `sameMarkdown(body, roundTrip(body))`. Record the counts for the user.
- [ ] **Step 7:** Browser check on the dev server with a fake token and stubbed GitHub `fetch`: a colon entry opens rich; a shortcode entry opens plain; edit-then-undo and Save shows `No changes to save`; invalid front matter shows the error. Commit `feat(admin): plain-Markdown fallback`.

### Task 5: Site block renderers and icon notice

**Files:**
- Create: `eleventy-plugins/cms-blocks.js`, `eleventy-plugins/cms-blocks.test.js`, `admin/src/ui/icons/COPYRIGHT.txt`
- Modify: `eleventy.config.js:38-55`, every `admin/src/ui/icons/*.svg`
- Test: also `admin/tests/icon-notice.test.ts`

**Interfaces produced:** `export default function registerCmsBlocks(md): void`.

- [ ] **Step 1:** `node:test` cases asserting rendered output: `:::callout{.warning}` → `<aside class="callout" data-kind="warning">`; `::: callout {.tip}` → `data-kind="tip"`; `::: callout` → `data-kind="note"`; `:::pullquote` → `<blockquote class="pullquote">`; `:::stat` → `<div class="stat-callout">`; `:::resource` → `<div class="resource-card">`; `:::calloutx` matches none. Icon test: every SVG contains `Copyright © Nucleo`.
- [ ] **Step 2:** `node --test eleventy-plugins/cms-blocks.test.js` and `cd admin && npm test` — FAIL.
- [ ] **Step 3:** Implement and replace the inline registrations. Notice, in `COPYRIGHT.txt` and as a comment inside each `<svg>`: `Copyright © Nucleo — https://nucleoapp.com/ — Redistribution of icons is prohibited. Icons are restricted for use only within the product they are bundled with.`
- [ ] **Step 4:** Tests PASS; `npm run build` succeeds. Commit `fix: render CMS blocks; add Nucleo notice`.
- [ ] **Step 5: Checkpoint.** Tell the user the branch is ready to review, with Task 4's counts. Do not merge or push. Continue; Task 6 copies from this branch.

### Task 6: New repo, generic configuration

**Files:**
- Create (copy from `jggweb/admin/`): `src/`, `tests/`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `svelte.config.js`, `vite.config.ts`, `.gitignore`; and `.nvmrc` from the jggweb root. Omit `content-identity.test.ts`, the jggweb report and `src/config/schema.ts`.
- Create: `src/config/types.ts`, `src/config/defineSite.ts`, `src/api.ts`, `site.config.example.ts`, `src/core/entryMeta.ts`, `src/core/entryIndex.ts`, `src/core/media.ts`, `scripts/site-config-path.ts`
- Modify: `Collection.ts`, `ImageField.ts`, `milkdown/blocks/image.ts`, `blocks/Block.ts`, `MarkdownInput`, `ImageInput`, `EntryList`, `EntryEditor`, `state.svelte.ts`, `Login.svelte`, `App.svelte`, `vite.config.ts`, `tsconfig.json`
- Test: `tests/defineSite.test.ts`, `entryMeta.test.ts`, `media.test.ts`, `site-config-path.test.ts`

**Interfaces produced:**

```ts
type ColorToken = 'bg'|'surface'|'surfaceAlt'|'surfaceHover'|'border'|'borderStrong'|'text'|'textMuted'|'textFaint'
  |'accent'|'accentHover'|'accentSoft'|'accentSoftStrong'|'onAccent'|'danger'|'success';
interface FontSpec { family: string; files?: { src: string; weight?: string; style?: 'normal'|'italic' }[]; stylesheet?: string }
interface BrandConfig { name: string; colors?: { light?: Partial<Record<ColorToken,string>>; dark?: Partial<Record<ColorToken,string>> };
  fonts?: { body?: FontSpec; heading?: FontSpec; mono?: FontSpec } }
interface MediaConfig { folder: string; publicPath: string }
interface SiteConfig { brand: BrandConfig; repo?: { owner?: string; name?: string; branch?: string }; contentRoot?: string;
  media: MediaConfig; collections: Collection[] }
interface IndexEntry { path: string; slug: string; title: string; date: string|null; subtitle?: string; draft?: boolean }
interface EntriesIndex { generated_at: string; collections: Record<string, IndexEntry[]> }
```

- `validateSite(c: SiteConfig): string[]`; `defineSite(c: SiteConfig): SiteConfig` throws the joined list.
- `Collection` gains `dateField?: string` (default: first declared of `date_published`, `date`) and `subtitleField?: string`.
- `entryMeta(collection, frontmatter): { title?: string; date?: string; subtitle?: string; draft: boolean }`, used by list, save and (Task 8) index.
- `src/core/media.ts`: `imageDirectory(field, media): string`, `imageValue(field, filename): string`, `repoPathFor(field, value, media): string`, `uploadErrorMessage(err: unknown, filename: string): string`.
- `ImageFieldOptions.directory` becomes optional; `InsertContext` gains `media: MediaConfig`.
- `siteConfigPath(root: string): string` → `site.config.ts` if present, else `site.config.example.ts`; aliased as `$site-config` in Vite and `tsconfig` paths.
- `src/api.ts` exports `defineSite`, `defineCollection`, `fields`, every block, and the types.

- [ ] **Step 1: Failing tests.** `validateSite` returns exactly: `Duplicate collection name "posts"`; `Collection "posts": titleField "headline" is not a declared field` (same wording for `dateField`, `subtitleField`); `Collection "posts": folder must be a sub-folder, not the repository root`. `entryMeta` maps the three configured fields and `draft`. `imageValue` gives `a.jpg` without `publicPath`, `/images/a.jpg` with `/images`; `repoPathFor` maps both to `images/a.jpg`; `uploadErrorMessage` for a GitHub 422 gives `An image named "a.jpg" already exists. Rename the file and try again.` `siteConfigPath` picks each case in a temp dir.
- [ ] **Step 2:** `git init -b main`, copy, `npm install`; `npm test` — FAIL.
- [ ] **Step 3:** Implement. The example config: collections `posts` (`posts/`: title, `date`, `description`, `draft`, `tags` list) and `pages` (`pages/`: title, slug), all blocks, `media: { folder: 'images', publicPath: '/images' }`, `contentRoot: '..'`, brand name `Decibel CMS`. Sign-in pre-fills from `repo`. Vite `base: './'`; remove the font proxy and warning filter. Fix the `svelte-check` error at `EntryEditor.svelte`'s title field. `vite.config.ts` evaluates the site config, so `defineSite` errors fail the build. Both upload paths report failures through `uploadErrorMessage`.
- [ ] **Step 4:** `npm test`, `npm run check` (0 errors), `npm run build` with no `site.config.ts`. `grep -rniE "joelgoodman|jggweb|joel|speaking_events|appearances|letters" --exclude-dir=node_modules --exclude-dir=dist .` returns nothing. A temporary config with two `posts` collections makes the build fail with that message. Commit `feat: generic site configuration`.

### Task 7: White-label branding

**Files:**
- Create: `src/config/defaultBrand.ts`, `src/theme.ts`, `public/fonts/` (the two Plus Jakarta woff2 files from jggweb, `OFL.txt` from `https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt`)
- Modify: `main.ts`, `App.svelte`, `Login.svelte`, `index.html`, `ui/styles.css` (color tokens and `@font-face` move to the theme; both `#fff` become `var(--on-accent)`; headings use `var(--font-heading)`)
- Test: `tests/theme.test.ts`

**Interfaces:** Consumes `BrandConfig`. Produces `themeCss(brand): string`, `fontStylesheets(brand): string[]`, `applyBrand(brand, doc?: Document): void`. CSS variables are the kebab-case token names, plus `--font-sans`, `--font-heading`, `--font-mono`.

- [ ] **Step 1: Failing tests,** asserting on declarations (`--name: value;`) split into the light `:root` and the dark media block:
  - no overrides: light `--accent: #966012;`, dark `--accent: #d4a04a;`, `--on-accent: #ffffff;` in both;
  - light `accent: '#2f6f62'` only: both modes use it; hover is `color-mix(in srgb, #2f6f62 82%, black)` light, `color-mix(in srgb, #2f6f62 85%, white)` dark; soft is 8% / 10% and softStrong 15% / 20% `color-mix(in srgb, #2f6f62 N%, transparent)`;
  - with both accents set, dark uses the dark one; light `onAccent` reaches dark unless dark sets its own; a light `bg` never reaches dark;
  - body family `Inter` gives `--font-sans: "Inter", …`, and heading defaults to `var(--font-sans)`; `files` produce `@font-face` with `url("fonts/x.woff2")`; `stylesheet` appears in `fontStylesheets`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement with today's palette as defaults. Name sets `document.title`, the sidebar heading and the sign-in card. **Step 4:** `npm test && npm run check && npm run build` — PASS.
- [ ] **Step 5:** With a temporary `site.config.ts` (name `Quill`, accent `#2f6f62`, a different font), screenshot sign-in, list and editor in light and dark; delete it. Commit `feat: white-label branding`.

### Task 8: Entry index and local running

**Files:** Create `scripts/build-index.ts`; modify `vite.config.ts`, `package.json` (`"start": "vite --open"`), `state.svelte.ts`, `ImageInput.svelte`. Test `tests/build-index.test.ts`.

**Interfaces:** Consumes `entryMeta`, `EntriesIndex`. Produces `buildEntriesIndex(site: SiteConfig, contentRoot: string): Promise<EntriesIndex>` and `localMediaPath(url: string, media: MediaConfig, contentRoot: string): string | null`.

- [ ] **Step 1: Failing test** on a temp folder: a file with front matter and one without are listed (title `''` for the latter); invalid YAML is skipped with a warning; nested folders are ignored; a missing folder yields `[]`. `localMediaPath` resolves a file under `publicPath` and returns `null` for `/images/../secret` (plain or percent-encoded) and for other prefixes.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; a Vite build plugin emits `dist/entries.json`; the app fetches relative `entries.json` and falls back when it is absent or not JSON. In dev, serve `media.publicPath` from `contentRoot/media.folder` (refusing paths outside it), and previews use that URL.
- [ ] **Step 4:** `npm test && npm run build`; `dist/entries.json` exists; a local image previews under `npm start`. Commit `feat: entry index and local media`.

### Task 9: Eleventy starter

**Files:** Create `integrations/eleventy/`: `package.json`, `eleventy.config.js`, `blocks.js` (from `cms-blocks.js`), `slide-embeds.js` (from jggweb, `embed_host=jggweb` removed), `_includes/base.njk`, `_includes/entry.njk`, `index.njk`, `posts/posts.11tydata.js`, `pages/pages.11tydata.js`, `assets/blocks.css`; `blocks.test.js` (Task 5's cases).

**Interfaces:** Consumes the example config's folders and fields. Layout once copied: starter files at the content repo root, CMS in `admin/`.

- [ ] **Step 1:** Copy the tests; run — FAIL. **Step 2:** Implement: block renderers, `eleventy-plugin-embed-everything` and slide embeds, `admin/**` ignored by Eleventy, passthrough of `images/` and `admin/dist` → `admin`, drafts excluded from production.
- [ ] **Step 3:** In a scratch folder, assemble starter + sample posts and pages (one callout, one YouTube URL, one draft) + this repo as `admin/`; install and build both. Expect `_site/admin/index.html`; the post contains `class="callout"` and a YouTube embed; no draft page; nothing from `admin/*.md`.
- [ ] **Step 4:** Commit `feat: Eleventy starter`.

### Task 10: README, CLAUDE.md, LICENSE

**Files:** Create `README.md`, `CLAUDE.md`, `LICENSE`.

- [ ] **Step 1:** `CLAUDE.md` follows the spec's nine steps in order, then daily use (push before using the CMS, pull before editing locally; Publish merges to main), updating, known limits, commands, icon rule, "never edit upstream files; only `site.config.ts` and added font files are yours". Exact commands:
  - `git subtree add --prefix=admin https://github.com/joelgoodman/decibel-cms.git main --squash`
  - `git subtree pull --prefix=admin https://github.com/joelgoodman/decibel-cms.git main --squash`
  - `cd admin && npm install && npm start`

  Token step: he creates a fine-grained token limited to that repository with Contents read and write, and types it into sign-in himself; the agent never asks for it.
- [ ] **Step 2:** `README.md`: what it is, the line to hand an agent (`Set up Decibel CMS for my writing by following https://github.com/joelgoodman/decibel-cms/blob/main/CLAUDE.md`), manual quick start, config reference. `LICENSE`: MIT, © 2026 Joel G Goodman, excluding `src/ui/icons/` (Nucleo) and `public/fonts/` (SIL OFL).
- [ ] **Step 3:** Check every command and config key named exists. Commit `docs: setup guide and license`.

### Task 11: Verification

- [ ] `npm test && npm run check && npm run build` from a clean clone with no `site.config.ts`.
- [ ] A joelgoodman.co config kept in the scratch folder: the same entries list, and no-edit saves are identical for every jggweb content file. Remove it afterwards.
- [ ] A fresh agent follows `CLAUDE.md` on a throwaway folder of plain Markdown (nested, some without front matter), once without a website and once building one, using the local repo path in place of the GitHub URL and stubbing the token steps. It must ask before moving or rewriting files. Fix what it trips on.
- [ ] Task 6's personal-string search, allowing only the `LICENSE` name and the `joelgoodman/decibel-cms` URLs; confirm every SVG carries the notice.
- [ ] Report results, including what needs a real token: one sign-in, save and publish by the user or the friend.

### Task 12: Publish

- [ ] **Stop and ask the user to confirm** creating the public repo.
- [ ] `gh repo create joelgoodman/decibel-cms --public --source=. --remote=origin --push --description "A white-label, Git-based Markdown CMS"`
- [ ] Clone it into a scratch folder; `npm ci && npm run build`; run the documented `git subtree add` into an empty test repo.
