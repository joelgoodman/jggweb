<script lang="ts" module>
  function stripExt(name: string, ext: string): string {
    return name.endsWith(`.${ext}`) ? name.slice(0, -ext.length - 1) : name;
  }
  function humanize(name: string, ext: string): string {
    return stripExt(name, ext);
  }
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<script lang="ts">
  import type { Collection } from '../core/Collection';
  import type { FileRef } from '../core/storage';
  import { store, navigate, showToast } from '../state.svelte';

  interface Props { collection: Collection }
  let { collection }: Props = $props();

  let entries = $state<FileRef[]>([]);
  let loading = $state(true);

  async function load() {
    if (!store.storage) return;
    loading = true;
    try {
      entries = await store.storage.list(collection.folder, { extensions: [collection.extension] });
      entries.sort((a, b) => b.name.localeCompare(a.name));
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      loading = false;
    }
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
    New {collection.label.toLowerCase().replace(/s$/, '')}
  </button>
</header>

{#if loading}
  <p class="empty">Loading…</p>
{:else if entries.length === 0}
  <p class="empty">No entries yet.</p>
{:else}
  <ul class="entries">
    {#each entries as e (e.path)}
      <li>
        <button
          class="entry"
          onclick={() => navigate({ name: 'editor', collection: collection.name, entry: stripExt(e.name, collection.extension) })}
        >
          <span class="entry__name">{humanize(e.name, collection.extension)}</span>
          <span class="entry__size">{formatSize(e.size)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
