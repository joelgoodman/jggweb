<script lang="ts">
  import { untrack } from 'svelte';
  import type { Collection } from '../core/Collection';
  import { TextField, ObjectField, type AnyField } from '../core/fields';
  import { parseEntry, stringifyEntry } from '../core/frontmatter';
  import { slugify } from '../core/fields';
  import {
    store,
    navigate,
    showToast,
    upsertIndexEntry,
    hasDraftBranch,
    ensureDraftBranch,
    publishDraft,
    draftBranchName,
    setUnsavedGuard,
  } from '../state.svelte';
  import { MergeConflict } from '../core/storage';
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
  let publishing = $state(false);
  // The draft branch this entry's edits are committed to, once one
  // exists (either found on load, or created by the first save). No
  // branch yet means "clean" — reading/writing main directly.
  let activeBranch = $state<string | undefined>(undefined);
  // Frontmatter keys the collection schema doesn't know about — things
  // like a page's `permalink`, `section`, or `home` flag. Preserved
  // verbatim through the save round-trip so the CMS doesn't silently
  // strip template-critical metadata it wasn't asked to edit.
  let extraFrontmatter = $state<Record<string, unknown>>({});
  // JSON snapshot of {values, body} as of the last load/save, so `dirty`
  // can compare against it instead of tracking edits by hand across every
  // input handler.
  let savedSnapshot = $state('');
  const dirty = $derived(JSON.stringify({ values, body }) !== savedSnapshot);

  $effect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    setUnsavedGuard(() => dirty);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setUnsavedGuard(null);
    };
  });

  const titleField = $derived(collection.findField(collection.titleField));
  let titleEl: HTMLTextAreaElement | undefined = $state();

  function resizeTitle() {
    if (!titleEl) return;
    titleEl.style.height = 'auto';
    titleEl.style.height = `${titleEl.scrollHeight}px`;
  }

  // Resize on load and whenever the title value changes programmatically
  // (switching entries, undo, etc.) — typed input is handled directly in
  // handleTitleInput so it doesn't wait on the effect's microtask.
  $effect(() => {
    void (titleField && values[titleField.name]);
    resizeTitle();
  });

  // Pull the SEO object field aside so its children can live in a
  // dedicated tab. Collections without one (Speaking events) just get
  // a flat sidebar with no tab strip.
  const seoField = $derived.by(() => {
    const f = collection.findField('seo');
    return f instanceof ObjectField ? f : null;
  });
  const contentFields = $derived(
    collection.frontmatter.filter(
      (f) => f.name !== collection.titleField && f.name !== 'seo',
    ),
  );

  interface FieldCluster { key: string; label?: string; collapsed: boolean; items: AnyField[] }

  // Fields with no `group` render standalone, exactly as before. Fields
  // sharing a `group` cluster under one heading; if any of them marks
  // `collapsed`, the whole cluster renders inside a closed-by-default
  // disclosure instead of a static heading.
  function groupFields(list: AnyField[]): FieldCluster[] {
    const clusters: FieldCluster[] = [];
    for (const f of list) {
      const last = clusters[clusters.length - 1];
      if (f.group && last?.label === f.group) {
        last.items.push(f);
        if (f.groupCollapsed) last.collapsed = true;
      } else {
        clusters.push({ key: f.name, label: f.group, collapsed: f.groupCollapsed, items: [f] });
      }
    }
    return clusters;
  }

  const contentClusters = $derived(groupFields(contentFields));

  let activeTab = $state<'content' | 'seo'>('content');

  function updateSeoChild(name: string, v: unknown) {
    const current = (values.seo as Record<string, unknown> | undefined) ?? {};
    values = { ...values, seo: { ...current, [name]: v } };
  }

  // Word count + reading time for the body. Strip markdown syntax and
  // HTML tags so the count roughly matches what a reader sees rather
  // than what's in the source — e.g. a Speakerdeck <script defer …>
  // block inflates a raw-source count dramatically. 238 wpm mirrors
  // the reading-time filter used on the published page so the numbers
  // stay aligned.
  function countWords(source: string): number {
    if (!source) return 0;
    const text = source
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_~#>\-=|]/g, ' ')
      .trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }
  const wordCount = $derived(countWords(body));
  const readingMinutes = $derived(wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 238)) : 0);

  async function load() {
    loading = true;
    const init: Record<string, unknown> = {};
    for (const f of collection.frontmatter) init[f.name] = f.defaultValue();
    values = init;
    body = collection.body.defaultValue();
    extraFrontmatter = {};
    activeBranch = undefined;
    // untrack: this runs inside the entryKey/collection.name $effect, which
    // must not also start depending on values/body — load() reassigns both
    // on every run, so a tracked read here would make the effect retrigger
    // itself forever (effect_update_depth_exceeded).
    savedSnapshot = untrack(() => JSON.stringify({ values, body }));

    if (isNew || !store.storage) {
      sha = undefined;
      loadedPath = undefined;
      loading = false;
      return;
    }

    const path = `${collection.folder}/${entryKey}.${collection.extension}`;
    try {
      const branch = (await hasDraftBranch(collection.name, entryKey))
        ? draftBranchName(collection.name, entryKey)
        : undefined;
      activeBranch = branch;
      const file = await store.storage.read(path, branch ? { branch } : undefined);
      const parsed = parseEntry(file.content);
      const next: Record<string, unknown> = {};
      const declared = new Set(collection.frontmatter.map((f) => f.name));
      for (const f of collection.frontmatter) next[f.name] = f.deserialize(parsed.frontmatter[f.name]);
      // Stash everything the schema didn't claim so we can merge it
      // back on save.
      const extras: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(parsed.frontmatter)) {
        if (!declared.has(key)) extras[key] = val;
      }
      values = next;
      body = parsed.body;
      extraFrontmatter = extras;
      sha = file.sha;
      loadedPath = path;
      savedSnapshot = untrack(() => JSON.stringify({ values, body }));
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
      // Declared fields first (schema order), preserved extras after —
      // so edited content leads the file and template-critical fields
      // like permalink or section sit at the bottom instead of hiding
      // the title under undeclared metadata.
      const fm: Record<string, unknown> = {};
      for (const f of collection.frontmatter) {
        const serialized = f.serialize(values[f.name]);
        if (serialized !== '' && serialized !== null && serialized !== undefined) {
          fm[f.name] = serialized;
        }
      }
      for (const [key, val] of Object.entries(extraFrontmatter)) {
        if (!(key in fm)) fm[key] = val;
      }
      const raw = stringifyEntry(fm, body);
      const slugStem = isNew ? buildFilename() : entryKey;
      const filename = `${slugStem}.${collection.extension}`;
      const path = `${collection.folder}/${filename}`;
      // Every save lands on this entry's draft branch, never main —
      // publishing (merging that branch into main) is a separate,
      // explicit step below.
      const branch = await ensureDraftBranch(collection.name, slugStem);
      activeBranch = branch;
      const commit = await store.storage.write(path, raw, {
        message: isNew
          ? `content: add ${collection.name} "${filename}"`
          : `content: update ${collection.name} "${filename}"`,
        sha,
        branch,
      });
      sha = commit.sha;
      loadedPath = commit.path;
      savedSnapshot = untrack(() => JSON.stringify({ values, body }));
      // Patch the in-memory index so the list view reflects the save
      // without waiting for the next site build. The index emits one
      // bucket per collection; we only touch collections that actually
      // have a bucket (letters, pages, speaking_events).
      const indexBucket = (
        { letters: 'letters', pages: 'pages', speaking_events: 'speaking_events' } as const
      )[collection.name as 'letters' | 'pages' | 'speaking_events'];
      if (indexBucket) {
        upsertIndexEntry(indexBucket, {
          path,
          slug: filename.replace(/\.[^.]+$/, ''),
          title: String(values[collection.titleField] ?? ''),
          date:
            (typeof values.date_published === 'string' && values.date_published) ||
            (typeof values.date === 'string' && values.date) ||
            null,
          subtitle:
            typeof values.event_name === 'string' ? values.event_name : undefined,
          draft: values.draft === true,
        });
      }
      showToast('Saved');
      if (isNew) {
        navigate({ name: 'editor', collection: collection.name, entry: filename.replace(/\.[^.]+$/, '') });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      saving = false;
    }
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(body);
      showToast('Copied markdown to clipboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function publish() {
    if (!activeBranch) return;
    publishing = true;
    try {
      const result = await publishDraft(collection.name, entryKey);
      activeBranch = undefined;
      showToast(result === 'merged' ? 'Published' : 'Already up to date');
    } catch (err) {
      if (err instanceof MergeConflict) {
        showToast('Merge conflict — resolve manually via git before publishing.', 'error');
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      publishing = false;
    }
  }

  function updateField(name: string, v: unknown) {
    values = { ...values, [name]: v };
  }

  function handleTitleInput(e: Event) {
    if (!titleField) return;
    // Enter is blocked at the keydown level, but a paste can still carry
    // real newlines in — strip them so the stored title stays one line;
    // wrapping here is purely visual (soft-wrap in the textarea).
    const t = (e.target as HTMLTextAreaElement).value.replace(/\r?\n/g, ' ');
    const prevTitle = String(values[titleField.name] ?? '');
    const prevSlug = String(values['slug'] ?? '');
    updateField(titleField.name, t);
    resizeTitle();
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
        {#if wordCount > 0}
          <span class="editor-bar__stats" aria-label="Word count">
            {wordCount.toLocaleString()} words · {readingMinutes} min read
          </span>
        {/if}
        {#if activeBranch}<span class="entry__badge">Unpublished</span>{/if}
        <button class="btn btn--ghost" onclick={copyMarkdown} title="Copy as Markdown">
          <Icon name="copy" size="0.95rem" />
        </button>
        <button class="btn btn--ghost" onclick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          class="btn btn--primary"
          onclick={publish}
          disabled={!activeBranch || publishing || saving}
          title={activeBranch ? undefined : 'No unpublished changes'}
        >
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </header>

    <div class="editor-grid">
      <main class="editor-main">
        {#if titleField && titleField instanceof TextField}
          <textarea
            class="editor-title"
            rows="1"
            bind:this={titleEl}
            value={values[titleField.name] ?? ''}
            placeholder="Add title"
            oninput={handleTitleInput}
            onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          ></textarea>
        {/if}

        <MarkdownInput
          field={collection.body}
          value={body}
          blocks={collection.blocks}
          onChange={(v) => (body = v)}
        />
      </main>

      <aside class="editor-sidebar">
        {#if seoField}
          <div class="editor-tabs" role="tablist" aria-label="Sidebar sections">
            <button
              type="button"
              class="editor-tabs__tab"
              class:is-active={activeTab === 'content'}
              role="tab"
              aria-selected={activeTab === 'content'}
              aria-controls="sidebar-panel"
              onclick={() => (activeTab = 'content')}
            >Content</button>
            <button
              type="button"
              class="editor-tabs__tab"
              class:is-active={activeTab === 'seo'}
              role="tab"
              aria-selected={activeTab === 'seo'}
              aria-controls="sidebar-panel"
              onclick={() => (activeTab = 'seo')}
            >SEO</button>
          </div>
        {/if}

        <div
          id="sidebar-panel"
          class="editor-sidebar__group"
          role={seoField ? 'tabpanel' : undefined}
        >
          {#if activeTab === 'content' || !seoField}
            {#each contentClusters as cluster (cluster.key)}
              {#if !cluster.label}
                {#each cluster.items as field (field.name)}
                  <FieldRenderer
                    {field}
                    value={values[field.name]}
                    onChange={(v) => updateField(field.name, v)}
                  />
                {/each}
              {:else if cluster.collapsed}
                <details class="editor-sidebar__more">
                  <summary class="editor-sidebar__heading">
                    <Icon name="chevron-left" size="0.65rem" class="editor-sidebar__chevron" />
                    {cluster.label}
                  </summary>
                  <div class="editor-sidebar__more-body">
                    {#each cluster.items as field (field.name)}
                      <FieldRenderer
                        {field}
                        value={values[field.name]}
                        onChange={(v) => updateField(field.name, v)}
                      />
                    {/each}
                  </div>
                </details>
              {:else}
                <div class="editor-sidebar__cluster">
                  <p class="editor-sidebar__heading">{cluster.label}</p>
                  {#each cluster.items as field (field.name)}
                    <FieldRenderer
                      {field}
                      value={values[field.name]}
                      onChange={(v) => updateField(field.name, v)}
                    />
                  {/each}
                </div>
              {/if}
            {/each}
          {:else if seoField}
            {#each seoField.fields as child (child.name)}
              <FieldRenderer
                field={child}
                value={(values.seo as Record<string, unknown> | undefined)?.[child.name]}
                onChange={(v) => updateSeoChild(child.name, v)}
              />
            {/each}
          {/if}
        </div>
      </aside>
    </div>
  </div>
{/if}
