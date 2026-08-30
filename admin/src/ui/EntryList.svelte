<script lang="ts" module>
  function stripExt(name: string, ext: string): string {
    return name.endsWith(`.${ext}`) ? name.slice(0, -ext.length - 1) : name;
  }
  function formatDate(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function toSortKey(meta: EntryMeta | undefined, fallback: string): string {
    return meta?.date ?? fallback;
  }

  interface EntryMeta {
    title?: string;
    date?: string;
    subtitle?: string;
    draft?: boolean;
  }
</script>

<script lang="ts">
  import type { Collection } from '../core/Collection';
  import type { FileRef } from '../core/storage';
  import { parseEntry } from '../core/frontmatter';
  import {
    store,
    navigate,
    showToast,
    getEntriesIndex,
    listDraftSlugs,
    draftBranchName,
    type IndexEntry,
  } from '../state.svelte';
  import Icon from './Icon.svelte';

  interface Props { collection: Collection }
  let { collection }: Props = $props();

  let entries = $state<FileRef[]>([]);
  let metas = $state<Record<string, EntryMeta>>({});
  // Paths with unpublished changes on a draft branch — a separate
  // signal from meta.draft (the frontmatter "Save as draft" checkbox,
  // which hides an already-merged entry from production).
  let draftPaths = $state<Set<string>>(new Set());
  let loading = $state(true);

  // Map collection names onto index keys. Anything unmapped (a
  // collection without an index bucket) falls back to per-file reads.
  const INDEX_KEY: Record<string, 'letters' | 'pages' | 'speaking_events' | 'appearances'> = {
    letters: 'letters',
    pages: 'pages',
    speaking_events: 'speaking_events',
    appearances: 'appearances',
  };

  // Derive a display-sorted order. Once metadata starts arriving,
  // items re-sort by date (newest first); until then we fall back to
  // the filename, which is already chronological for letters and
  // speaking_events because their filenames are prefixed with dates.
  const sortedEntries = $derived.by(() => {
    return [...entries].sort((a, b) =>
      toSortKey(metas[b.path], b.name).localeCompare(toSortKey(metas[a.path], a.name)),
    );
  });

  /**
   * Fetch and parse a single entry's frontmatter so the list can show
   * the real title and publish date instead of a cryptic filename.
   * Each collection exposes different frontmatter shapes, so the
   * picker tries a few common keys — date_published (letters), date
   * (speaking events, appearances) — and treats event_name/source_name
   * as a subtitle when present (speaking events, appearances).
   */
  async function hydrate(entry: FileRef, branch?: string) {
    if (!store.storage) return;
    try {
      const file = await store.storage.read(entry.path, branch ? { branch } : undefined);
      const parsed = parseEntry(file.content);
      const fm = parsed.frontmatter;
      const next: EntryMeta = {
        title: typeof fm.title === 'string' ? fm.title : undefined,
        date:
          (typeof fm.date_published === 'string' && fm.date_published) ||
          (typeof fm.date === 'string' && fm.date) ||
          undefined,
        subtitle:
          (typeof fm.event_name === 'string' && fm.event_name) ||
          (typeof fm.source_name === 'string' && fm.source_name) ||
          undefined,
        draft: fm.draft === true,
      };
      metas = { ...metas, [entry.path]: next };
    } catch {
      // Leave fallback in place — better to show a filename than a
      // broken row.
    }
  }

  async function load() {
    if (!store.storage) return;
    loading = true;
    metas = {};
    draftPaths = new Set();
    try {
      entries = await store.storage.list(collection.folder, { extensions: [collection.extension] });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      loading = false;
    }

    // Draft branches for this collection — entries with unpublished
    // changes. A slug already present in `entries` (from main) is a
    // published entry with edits in progress; a slug that ISN'T is a
    // brand-new entry that's never been published, so it only exists on
    // its draft branch — synthesize a row for it or it'd be invisible.
    let draftSlugs: string[] = [];
    try {
      draftSlugs = await listDraftSlugs(collection.name);
    } catch {
      // Non-GitHub storage or a transient API error — drafts just won't
      // show a badge; the published list above still works.
    }
    const newDraftEntries: FileRef[] = [];
    const paths = new Set<string>();
    for (const slug of draftSlugs) {
      const name = `${slug}.${collection.extension}`;
      const path = `${collection.folder}/${name}`;
      paths.add(path);
      if (!entries.some((e) => e.path === path)) {
        newDraftEntries.push({ path, name, sha: '', size: 0 });
      }
    }
    draftPaths = paths;
    entries = [...entries, ...newDraftEntries];

    // Seed metadata from the build-time index (one fetch), then only
    // hit the Contents API for entries the index doesn't know about —
    // i.e. entries created or renamed after the last deploy.
    const index = await getEntriesIndex();
    const bucket = index ? index[INDEX_KEY[collection.name]] ?? [] : [];
    const seeded: Record<string, EntryMeta> = {};
    for (const item of bucket as IndexEntry[]) {
      seeded[item.path] = {
        title: item.title || undefined,
        date: item.date ?? undefined,
        subtitle: item.subtitle || undefined,
        draft: item.draft === true,
      };
    }
    metas = seeded;

    // Brand-new draft-only entries never made the build-time index and
    // don't exist on main, so they must be read from their draft branch
    // specifically rather than falling through to the default-branch
    // read the rest of the "stale" batch below uses.
    await Promise.all(
      newDraftEntries.map((e) =>
        hydrate(e, draftBranchName(collection.name, stripExt(e.name, collection.extension))),
      ),
    );

    const stale = entries.filter((e) => !seeded[e.path] && !newDraftEntries.includes(e));
    await Promise.all(stale.map((e) => hydrate(e)));
  }

  $effect(() => {
    collection.name; // re-run when collection changes
    load();
  });
</script>

<header class="page-header">
  <div>
    <h2>{collection.label}</h2>
    {#if collection.description}<p class="page-header__description">{collection.description}</p>{/if}
  </div>
  <button class="btn btn--primary" onclick={() => navigate({ name: 'editor', collection: collection.name, entry: 'new' })}>
    <Icon name="plus" size="0.9rem" />
    New {collection.label.toLowerCase().replace(/s$/, '')}
  </button>
</header>

{#if loading}
  <p class="empty">Loading…</p>
{:else if entries.length === 0}
  <p class="empty">No entries yet.</p>
{:else}
  <ul class="entries">
    {#each sortedEntries as e (e.path)}
      {@const meta = metas[e.path]}
      <li>
        <button
          class="entry"
          onclick={() => navigate({ name: 'editor', collection: collection.name, entry: stripExt(e.name, collection.extension) })}
        >
          <span class="entry__body">
            <span class="entry__title">
              {meta?.title ?? stripExt(e.name, collection.extension)}
              {#if meta?.draft}<span class="entry__badge">Draft</span>{/if}
              {#if draftPaths.has(e.path)}<span class="entry__badge entry__badge--unpublished">Unpublished</span>{/if}
            </span>
            {#if meta?.subtitle}<span class="entry__subtitle">{meta.subtitle}</span>{/if}
          </span>
          {#if meta?.date}
            <time class="entry__date" datetime={meta.date}>{formatDate(meta.date)}</time>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
{/if}
