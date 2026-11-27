# Decibel CMS as a standalone, white-label repo

Date: 2026-11-27

Entries marked **(my call)** are proposals made while writing this. Everything under "Asked for and decided" came from you.

## Asked for and decided

- Package the CMS so it can be shared with a friend, in its own git repo.
- White-labelling: colors, fonts and CMS name.
- A `CLAUDE.md` so the friend's agent can set it up for him.
- Packaging: a template repo.
- Content protection: save only the front matter fields that changed, fix the colon and URL bugs, and open any entry the rich editor can't reproduce as plain Markdown.
- Fix this in the current `jggweb/admin/` first, then build the new repo from it.
- Icons: keep Nucleo if its license allows. If not, use something like [Iconoir](https://iconoir.com), not Lucide.
- The friend has no site generator, only Markdown files and VS Code. He is open to adding Eleventy, which would mean mapping his content and building the site.

## Current state

The CMS lives only in `jggweb/admin/` (Svelte 5, Vite 6, Milkdown, TypeScript). It commits Markdown with YAML front matter to GitHub, saves to `draft/<collection>/<slug>` branches, and publishes by merging into the main branch.

### Tied to joelgoodman.co

| Where | Coupling |
|---|---|
| `src/config/schema.ts` | Four collections and their fields |
| `src/state.svelte.ts` | Entry index typed to those four names; fetches `/admin/entries.json` |
| `src/ui/EntryList.svelte` | Index key map; hardcoded date and subtitle keys |
| `src/ui/EntryEditor.svelte` | Filename date from `date_published`; index key map |
| `../admin-entries.11ty.js` | Builds the entry index; lives outside `admin/` |
| `src/ui/Login.svelte` | Owner and repo pre-filled |
| `src/milkdown/blocks/image.ts` | Uploads to `assets/img/` |
| `vite.config.ts` | `base: '/admin/'`; dev proxy to the site's fonts |
| `src/ui/styles.css` | Font paths; white text hardcoded on accent buttons |
| `index.html`, `App.svelte` | Name |

Baseline: `svelte-check` reports one error, at `EntryEditor.svelte:379`.

### Damages content

Found with parser and serializer tests and by reading the code, not in the running editor.

- Undeclared keys inside a declared object are dropped. `cover.focus`, which the site's social image crop uses, would be lost.
- Every save rewrites all front matter: key order, quoting, comments, empty strings, and date-only values (which gain a time).
- A declared checkbox set to `false` is deleted.
- Re-saved bare URLs gain backslashes before `_` and `&`, and publish as broken links.
- `word:word` in text is parsed as a directive the editor has no handler for, so the entry should fail to open. One letter contains this.
- Task lists and template shortcodes are altered when the body is re-saved.

## Goals

1. Saving from the CMS never changes content the writer did not change, except cosmetic Markdown formatting in an edited body.
2. A new repo that builds with nothing from jggweb.
3. Everything specific to a site lives in one file, `site.config.ts` (plus font files).
4. Name, colors (light and dark) and fonts are set in that file.
5. His agent can set it up by following `CLAUDE.md`, with or without building a website.
6. Pulling updates does not conflict with his configuration.

## Non-goals

- npm package or prebuilt drop-in build.
- Logo or favicon settings, or an in-app theme editor.
- Storage other than GitHub; TOML or JSON front matter; entries in nested folders, the repo root or page bundles.
- Editing tables, task lists or shortcodes in the rich editor.
- Image previews in a deployed CMS for a private repo.
- New content blocks.
- Choosing or configuring a web host for him.
- Moving joelgoodman.co onto the new repo. That is a follow-up once the repo works. **(my call)**

## What would make this a failure

- A save rewrites or drops his writing or data without anyone noticing.
- Anything personal to joelgoodman.co ships in the new repo (repo defaults, collection text, content, history, the `embed_host=jggweb` value in the slides plugin).
- His agent asks for, reads or stores his GitHub token.
- His files are moved or rewritten during setup without his approval.
- Setup requires editing upstream files.

## Constraints

### Icons: Nucleo stays

The icon count (45 or fewer) is within the limit. Conditions, from Nucleo's [license](https://nucleoapp.com/license), [open-source answer](https://nucleoapp.com/qa/include-icons-in-open-source-projects) and [copyright notice](https://nucleoapp.com/copyright-notice):

- The repo is public. Up to 100 icons are allowed in an open-source project's publicly accessible source.
- The Nucleo copyright notice ships with the icons: a notice file in the icons folder and a comment in each SVG **(my call)**. `jggweb` is public and lacks it today, so it is added there too.
- The MIT license excludes the icons.
- Icons are used only inside the CMS. `CLAUDE.md` says not to reuse them elsewhere.
- The CMS never lets users browse or pick icons.

The published text does not mention what someone who copies an open-source project may do. My reading is that the notice ("restricted for use only within the product they are bundled with") covers him running the CMS. This is not legal advice. Iconoir (MIT according to its site) is the fallback if you want no ambiguity.

### Other

- Default font Plus Jakarta Sans is under the SIL Open Font License; its license text ships beside the files.
- Node 22.

## Approaches considered

| Packaging | Trade-off | Outcome |
|---|---|---|
| Prebuilt drop-in app with a YAML config | No build step, but the TypeScript schema becomes plain data and new blocks need a rebuild | Not chosen |
| Template repo with one config file | Least work and most flexible; needs Node | **Chosen** |
| npm package | Cleanest updates; needs a build wrapper and releases | Not chosen |

| Content protection | Trade-off | Outcome |
|---|---|---|
| Targeted saves, bug fixes and a plain-Markdown fallback | More work; protects content nobody has tested yet | **Chosen** |
| Fix the known bugs and document the rest | Quick; relies on people noticing damage | Not chosen |

## Design

### Order of work

1. Content protection in `jggweb/admin/`, on a branch.
2. New repo from the fixed code, made generic and white-label.
3. `CLAUDE.md` and the Eleventy starter.
4. Verification, then publishing.

### Content protection

- **Front matter:** edit the parsed YAML document in place and write only the keys the writer changed. Order, comments, quoting, date formats, empty values and undeclared keys at any depth survive.
- **No change:** saving an untouched entry leaves the file identical. An untouched body is written back exactly.
- **Checkboxes:** unchecking an existing key writes `false`. **(my call)**
- **Dates:** an edited date-only value stays date-only. **(my call)**
- **Lists:** a new `list` field edits a YAML array as comma-separated text, so tags don't become a string. **(my call)**
- **Colons:** only block containers (`:::`) are read as directives.
- **URLs:** bare URLs are saved without added backslashes.
- **Plain-Markdown fallback:** an entry opens as plain text, with a short explanation, when the editor can't reproduce it. "Can't reproduce" means it contains template tags (`{% %}`, `{{ }}`), or re-saving it through the editor would change its structure or text as read by a parser that understands tables, task lists and footnotes. List markers, emphasis characters and wrapping don't count. **(my call)**
- **Required fields:** enforced on new entries and on fields that already had a value, so older files can still be saved. **(my call)**
- **Files without front matter:** they open and save without gaining any, unless a field is filled in. The list shows the filename. **(my call)**

### Also in jggweb **(my call)**

- Register the four block renderers in `eleventy.config.js`. Today the callout rule rejects what the CMS writes, and `stat` and `resource` have none, so all three publish as raw text. No content uses them. Styling stays with `docs/superpowers/plans/2026-08-23-block-live-site-rendering.md`.
- Nothing is committed or pushed without your go-ahead; a push to main deploys the site. The uncommitted newsletter changes in the working tree stay untouched.

### New repo

Public `joelgoodman/decibel-cms`, fresh history, local copy at `~/Sites/11ty/decibel-cms` **(my call)**.

```
decibel-cms/
  CLAUDE.md
  README.md                  includes a one-line prompt to hand his agent
  LICENSE                    MIT, © Joel G Goodman; icons and font excluded
  site.config.example.ts     ours; a generic Posts + Pages blog
  site.config.ts             his; never added upstream, not gitignored
  src/
  public/fonts/              default font and its license
  integrations/eleventy/     starter site, block renderers, embeds, block CSS
```

### Install, run and update **(my call)**

He adds the repo to his content repo as `admin/` with `git subtree add --squash`, and updates with `git subtree pull --squash`. GitHub's "Use this template" button is not used: it creates unrelated history, which makes later pulls conflict.

Without a website, he runs the CMS on his own computer with one command from `admin/`. Local runs show images from his local copy. Publish merges the draft into main.

The CMS writes to GitHub while VS Code edits local files, so `CLAUDE.md` tells him to push before using the CMS and pull before editing locally.

### Configuration

The build uses `site.config.ts` when present and the example otherwise.

```ts
export default defineSite({
  brand: {
    name: 'Decibel CMS',
    colors: { light: { accent: '#966012' }, dark: { accent: '#d4a04a' } },
    fonts: { body: {...}, heading: {...}, mono: {...} },
  },
  repo: { owner: '', name: '', branch: 'main' },
  contentRoot: '..',
  media: { folder: 'assets/img', publicPath: '/assets/img' },
  collections: [ defineCollection({ ... }) ],
});
```

- **Name** appears in the browser tab, sidebar and sign-in screen.
- **Colors:** every token is optional and defaults to today's palette. Setting only `accent` is enough: hover and soft shades derive from it. Dark mode uses the dark accent, else the light accent he set, else the default. Other tokens fall back to the default for their mode. A new `onAccent` token replaces the hardcoded white and falls back the same way the accent does, so button text stays readable **(my call)**.
- **Fonts:** `body`, `heading` (defaults to body) and `mono`. Each takes either files in `public/fonts/` or a stylesheet URL.
- **Repo** values pre-fill sign-in.
- **Collections** keep today's `defineCollection` and `fields` API, adding optional `dateField` and `subtitleField` for the list view and filenames. Each declares a title field so new files can be named.
- A config that can't work (duplicate collection names, a `titleField` that isn't declared) fails the build with a readable message.

### Making the app generic

- A website build writes `entries.json` by reading the content folders, keyed by collection name. It is optional: without it, as in local runs, the list reads each file from GitHub.
- Asset and index URLs are relative, so the app works from any folder.
- The image block uses `media`. Image fields default to it, and a field with `publicPath` stores the prefixed path instead of the bare filename.

### Eleventy starter **(my call)**

A small working site in `integrations/eleventy/` that his agent copies to the repo root and adapts: config, a base layout, list and entry templates for the example collections, renderers for `callout`, `pullquote`, `stat` and `resource` (both `:::callout{.note}` and `::: callout {.note}`), video, audio and slide embeds, block CSS, and publishing the CMS at `/admin/`. It keeps Eleventy from processing `admin/` as content.

### CLAUDE.md

1. Check the content is Markdown in a GitHub repo, creating one with him if needed. Front matter is optional.
2. Add the subtree.
3. Take inventory: folders, front matter, images, special syntax. Ask him which folders to manage, for the name, colors and fonts, and whether he wants a website now.
4. Where folders are nested or at the root, or titles are missing, propose changes and apply them only after he approves, on a branch.
5. Write `site.config.ts`. Declare only supported field types.
6. Run the CMS.
7. He creates a fine-grained token (this repo only, Contents read and write) and types it into the sign-in screen himself.
8. Check: for a few entries per folder he makes a small edit and saves; the agent compares the draft branch with main and reports every other change.
9. If he wants a website: map collections to pages, adapt the starter, preview locally, then ask where he wants to host it.

It also covers daily use (publish, pull, push), updating, known limits, commands, the icon rule and not editing upstream files.

## Verification

- Every content file in jggweb, opened and saved without edits, comes out identical. Changing one field changes only that field's lines.
- A regression test for each item under "Damages content", plus real editor checks in a browser against mocked GitHub responses.
- With no `site.config.ts`: check passes with zero errors and the build succeeds.
- With a visibly different test brand: sign-in, list and editor screens in light and dark.
- A fresh agent follows `CLAUDE.md` on a throwaway folder of plain Markdown, once without a website and once building one.
- A search for personal strings before publishing.
- Not possible without a token: one real sign-in, save and publish, by you or him.

The GitHub repo is created only after you confirm at that step.

## Left to the builder

How the config is loaded, how theme CSS is applied, how the fallback check and index are implemented, test tooling, and the starter's markup and CSS.
