<script lang="ts">
  import type { Collection } from '../core/Collection';
  import { TextField } from '../core/fields';
  import { parseEntry, stringifyEntry } from '../core/frontmatter';
  import { slugify } from '../core/fields';
  import { store, navigate, showToast } from '../state.svelte';
  import FieldRenderer from './FieldRenderer.svelte';
  import MarkdownInput from './fields/MarkdownInput.svelte';
  import Icon from './Icon.svelte';

  interface Props { collection: Collection; entryKey: string }
  let { collection, entryKey }: Props = $props();

  const isNew = $derived(entryKey === 'new');

  let values = $state<Record<string, unknown>>({});
  let body = $state<string>('');
  let sha = $state<string | undefined>(undefined);
  let loadedPath = $state<string | undefined>(undefined);
  let loading = $state(true);
  let saving = $state(false);

  const titleField = $derived(collection.findField(collection.titleField));
  const sidebarFields = $derived(
    collection.frontmatter.filter((f) => f.name !== collection.titleField),
  );

  async function load() {
    loading = true;
    const init: Record<string, unknown> = {};
    for (const f of collection.frontmatter) init[f.name] = f.defaultValue();
    values = init;
    body = collection.body.defaultValue();

    if (isNew || !store.storage) {
      sha = undefined;
      loadedPath = undefined;
      loading = false;
      return;
    }

    const path = `${collection.folder}/${entryKey}.${collection.extension}`;
    try {
      const file = await store.storage.read(path);
      const parsed = parseEntry(file.content);
      const next: Record<string, unknown> = {};
      for (const f of collection.frontmatter) next[f.name] = f.deserialize(parsed.frontmatter[f.name]);
      values = next;
      body = parsed.body;
      sha = file.sha;
      loadedPath = path;
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    entryKey; collection.name;
    load();
  });

  function buildFilename(): string {
    const titleValue = String(values[collection.titleField] ?? '');
    const slugValue = String(values['slug'] ?? slugify(titleValue));
    const dateValue = String(values['date_published'] ?? new Date().toISOString());
    const date = dateValue.slice(0, 10);
    return collection.slug({ fields: { ...values, slug: slugValue }, date });
  }

  async function save() {
    if (!store.storage) return;
    for (const f of collection.frontmatter) {
      const err = f.validate(values[f.name]);
      if (err) { showToast(err, 'error'); return; }
    }
    saving = true;
    try {
      const fm: Record<string, unknown> = {};
      for (const f of collection.frontmatter) {
        const serialized = f.serialize(values[f.name]);
        if (serialized !== '' && serialized !== null && serialized !== undefined) {
          fm[f.name] = serialized;
        }
      }
      const raw = stringifyEntry(fm, body);
      const filename = isNew ? `${buildFilename()}.${collection.extension}` : entryKey + `.${collection.extension}`;
      const path = `${collection.folder}/${filename}`;
      const commit = await store.storage.write(path, raw, {
        message: isNew
          ? `content: add ${collection.name} "${filename}"`
          : `content: update ${collection.name} "${filename}"`,
        sha,
      });
      sha = commit.sha;
      loadedPath = commit.path;
      showToast(isNew ? 'Published' : 'Saved');
      if (isNew) {
        navigate({ name: 'editor', collection: collection.name, entry: filename.replace(/\.[^.]+$/, '') });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      saving = false;
    }
  }

  function updateField(name: string, v: unknown) {
    values = { ...values, [name]: v };
  }

  function handleTitleInput(e: Event) {
    if (!titleField) return;
    const t = (e.target as HTMLInputElement).value;
    const prevTitle = String(values[titleField.name] ?? '');
    const prevSlug = String(values['slug'] ?? '');
    updateField(titleField.name, t);
    // On new entries, keep the slug synced with the title until the user
    // types a custom slug in the sidebar — once it diverges, hands off.
    if (isNew && (!prevSlug || prevSlug === slugify(prevTitle))) {
      updateField('slug', slugify(t));
    }
  }
</script>

{#if loading}
  <p class="empty">Loading…</p>
{:else}
  <div class="editor-shell">
    <header class="editor-bar">
      <button class="btn btn--ghost" onclick={() => navigate({ name: 'list', collection: collection.name })}>
        <Icon name="chevron-left" size="0.95rem" />
        {collection.label}
      </button>
      <div class="editor-bar__meta">
        {#if loadedPath}<span class="editor-bar__path">{loadedPath}</span>{/if}
        <button class="btn btn--primary" onclick={save} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Publish' : 'Save'}
        </button>
      </div>
    </header>

    <div class="editor-grid">
      <main class="editor-main">
        {#if titleField && titleField instanceof TextField}
          <input
            class="editor-title"
            type="text"
            value={values[titleField.name] ?? ''}
            placeholder="Add title"
            oninput={handleTitleInput}
          />
        {/if}

        <MarkdownInput
          field={collection.body}
          value={body}
          blocks={collection.blocks}
          onChange={(v) => (body = v)}
        />
      </main>

      <aside class="editor-sidebar">
        <div class="editor-sidebar__group">
          <h3 class="editor-sidebar__heading">Post</h3>
          {#each sidebarFields as field (field.name)}
            <FieldRenderer
              {field}
              value={values[field.name]}
              onChange={(v) => updateField(field.name, v)}
            />
          {/each}
        </div>
      </aside>
    </div>
  </div>
{/if}
