<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { Collection } from '../core/Collection';
  import { TextField, ObjectField, type AnyField } from '../core/fields';
  import { parseEntry, stringifyEntry, updateEntry, InvalidFrontMatterError } from '../core/frontmatter';
  import { diffFields, newFrontmatter, validateEntry } from '../core/changes';
  import { slugify, calendarDate } from '../core/fields';
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
    replaceNewEntryRoute,
    NEW_ENTRY,
  } from '../state.svelte';
  import { MergeConflict } from '../core/storage';
  import FieldRenderer from './FieldRenderer.svelte';
  import MarkdownInput from './fields/MarkdownInput.svelte';
  import Icon from './Icon.svelte';

  interface Props { collection: Collection; entryKey: string }
  let { collection, entryKey }: Props = $props();

  // The filename stem a new entry was first saved as. From then on this editor
  // treats it as an existing file, without reloading it.
  let createdKey = $state<string | undefined>(undefined);
  let createdIn: string | undefined;
  const savedKey = $derived(createdKey ?? entryKey);
  const isNew = $derived(createdKey === undefined && entryKey === NEW_ENTRY);

  // One editor instance serves whichever entry the address names. This moves on
  // each time it opens an entry (and when it closes), so that a request finishing
  // late can tell its entry is gone and leave the editor's state alone.
  let session = 0;
  onDestroy(() => session++);
  // The session `load()` last began. The body editor reads its text only as it
  // mounts, so each load gets a new one; saving doesn't load.
  let loadedSession = $state(0);

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
  // The file as last read or written (undefined for a new entry), and the
  // editor values and body it gave. Saves write only what differs from these.
  let loadedRaw = $state<string | undefined>(undefined);
  let loadedValues = $state.raw<Record<string, unknown>>({});
  let loadedBody = $state<string>('');
  // Why an existing entry couldn't be opened. Nothing can be saved over it.
  let loadError = $state<string | undefined>(undefined);
  const dirty = $derived(
    JSON.stringify({ values, body }) !== JSON.stringify({ values: loadedValues, body: loadedBody }),
  );

  // The body editor reports typing after a short pause. `flush` reports it now.
  let bodyInput = $state<{ flush?: () => void } | undefined>();
  /** Whether anything is unsaved, counting typing not yet reported. */
  function hasUnsaved(): boolean {
    bodyInput?.flush?.();
    return dirty;
  }

  $effect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    setUnsavedGuard(hasUnsaved);
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
    const opened = ++session;
    loadedSession = opened;
    loading = true;
    const init: Record<string, unknown> = {};
    for (const f of collection.frontmatter) init[f.name] = f.defaultValue();
    const initBody = collection.body.defaultValue();
    createdKey = undefined;
    values = init;
    body = initBody;
    loadedRaw = undefined;
    loadedValues = init;
    loadedBody = initBody;
    loadError = undefined;
    activeBranch = undefined;

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
      if (opened !== session) return;
      activeBranch = branch;
      const file = await store.storage.read(path, branch ? { branch } : undefined);
      if (opened !== session) return;
      const parsed = parseEntry(file.content);
      const next: Record<string, unknown> = {};
      for (const f of collection.frontmatter) next[f.name] = f.deserialize(parsed.frontmatter[f.name]);
      values = next;
      body = parsed.body;
      loadedRaw = file.content;
      loadedValues = next;
      loadedBody = parsed.body;
      sha = file.sha;
      loadedPath = path;
    } catch (err) {
      if (opened !== session) return;
      const reason = err instanceof Error ? err.message : String(err);
      // YAML errors go on to quote the source; the first line says enough.
      loadError = err instanceof InvalidFrontMatterError
        ? `This entry's front matter can't be read: ${reason.split('\n')[0].replace(/[.:]+$/, '')}. Fix the file, then reopen it.`
        : `This entry couldn't be loaded: ${reason}`;
    } finally {
      if (opened === session) loading = false;
    }
  }

  $effect(() => {
    const key = entryKey;
    const name = collection.name;
    store.storage;
    // load() reads state it also assigns, so it must not add dependencies. The
    // address changing to the entry just created is not a reason to reload.
    untrack(() => { if (key !== createdKey || name !== createdIn) load(); });
  });

  function buildFilename(): string {
    const titleValue = String(values[collection.titleField] ?? '');
    // A title with no letters or digits gives no slug.
    const slugValue = String(values['slug'] || slugify(titleValue) || 'untitled');
    // The day the writer sees in the date field, not the UTC day it is stored as.
    const date = calendarDate(String((collection.dateField && values[collection.dateField]) || ''));
    const stem = collection.slug({ fields: { ...values, slug: slugValue }, date });
    // Never a file named `.md`.
    return /[^\s.-]/.test(stem) ? stem : 'untitled';
  }

  async function save() {
    // Publishing merges what was saved; a save now could land on the draft
    // branch just before publishing deletes it.
    if (!store.storage || publishing || (!isNew && loadedRaw === undefined)) return;
    bodyInput?.flush?.();
    // The entry being saved. The props and state may be another's after an await.
    const opened = session;
    const target = collection;
    const previousSha = sha;
    // What this save writes. Typing during the request stays unsaved.
    const saved = { values: $state.snapshot(values), body };
    const original = loadedRaw === undefined ? {} : parseEntry(loadedRaw).frontmatter;
    const invalid = validateEntry(collection.frontmatter, saved.values, original, isNew);
    if (invalid) { showToast(invalid, 'error'); return; }
    saving = true;
    try {
      let raw: string;
      if (loadedRaw === undefined) {
        raw = stringifyEntry(newFrontmatter(collection.frontmatter, saved.values), saved.body);
      } else {
        const changes = diffFields(collection.frontmatter, loadedValues, saved.values, original);
        raw = updateEntry(loadedRaw, changes, saved.body === loadedBody ? undefined : saved.body);
        if (raw === loadedRaw) {
          // The differences don't reach the file, so there is nothing unsaved.
          loadedValues = saved.values;
          loadedBody = saved.body;
          showToast('No changes to save');
          return;
        }
      }
      const creating = isNew;
      const slugStem = creating ? buildFilename() : savedKey;
      const filename = `${slugStem}.${target.extension}`;
      const path = `${target.folder}/${filename}`;
      // Every save lands on this entry's draft branch, never main —
      // publishing (merging that branch into main) is a separate,
      // explicit step below.
      const branch = await ensureDraftBranch(target.name, slugStem);
      const commit = await store.storage.write(path, raw, {
        message: creating
          ? `content: add ${target.name} "${filename}"`
          : `content: update ${target.name} "${filename}"`,
        sha: previousSha,
        branch,
      });
      if (opened === session) {
        activeBranch = branch;
        sha = commit.sha;
        loadedPath = commit.path;
        loadedRaw = raw;
        loadedValues = saved.values;
        loadedBody = saved.body;
      }
      // Patch the in-memory index so the list view reflects the save
      // without waiting for the next site build. The index emits one
      // bucket per collection; we only touch collections that actually
      // have a bucket (letters, pages, speaking_events, appearances).
      const indexBucket = (
        {
          letters: 'letters',
          pages: 'pages',
          speaking_events: 'speaking_events',
          appearances: 'appearances',
        } as const
      )[target.name as 'letters' | 'pages' | 'speaking_events' | 'appearances'];
      if (indexBucket) {
        upsertIndexEntry(indexBucket, {
          path,
          slug: filename.replace(/\.[^.]+$/, ''),
          title: String(saved.values[target.titleField] ?? ''),
          date:
            (typeof saved.values.date_published === 'string' && saved.values.date_published) ||
            (typeof saved.values.date === 'string' && saved.values.date) ||
            null,
          subtitle:
            (typeof saved.values.event_name === 'string' && saved.values.event_name) ||
            (typeof saved.values.source_name === 'string' && saved.values.source_name) ||
            undefined,
          draft: saved.values.draft === true,
        });
      }
      showToast('Saved');
      if (creating && opened === session) {
        createdKey = slugStem;
        createdIn = target.name;
        replaceNewEntryRoute(target.name, slugStem);
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
    if (!activeBranch || saving || publishing) return;
    // Publish puts live the last save, so unsaved changes would be left out.
    if (hasUnsaved()) {
      showToast('Save first: Publish puts live what was last saved.', 'error');
      return;
    }
    const opened = session;
    const path = loadedPath;
    const published = loadedRaw;
    publishing = true;
    try {
      const { result, kept } = await publishDraft(collection.name, savedKey);
      if (kept) {
        showToast('Published the saved version. A newer save, made elsewhere, is still unpublished.');
        return;
      }
      if (opened === session) activeBranch = undefined;
      showToast(result === 'merged' ? 'Published' : 'Already up to date');
      // The next save starts a draft from main. Main's copy may differ from
      // what was saved if the merge combined other changes to it.
      if (path && store.storage && opened === session) {
        const onMain = await store.storage.read(path);
        if (opened !== session) return;
        if (onMain.content === published) sha = onMain.sha;
        else if (!hasUnsaved()) await load();
        else showToast('Published. The file on main also has other changes; reopen it before saving again.', 'error');
      }
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
{:else if loadError}
  <div class="editor-shell">
    <header class="editor-bar">
      <button class="btn btn--ghost" onclick={() => navigate({ name: 'list', collection: collection.name })}>
        <Icon name="chevron-left" size="0.95rem" />
        {collection.label}
      </button>
    </header>
    <p class="empty" role="alert">{loadError}</p>
  </div>
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
        <button class="btn btn--ghost" onclick={save} disabled={saving || publishing}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          class="btn btn--primary"
          onclick={publish}
          disabled={!activeBranch || publishing || saving || dirty}
          title={!activeBranch
            ? 'No unpublished changes'
            : dirty
              ? 'Save first: Publish puts live what was last saved'
              : undefined}
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
            value={String(values[titleField.name] ?? '')}
            placeholder="Add title"
            oninput={handleTitleInput}
            onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          ></textarea>
        {/if}

        {#key loadedSession}
          <MarkdownInput
            bind:this={bodyInput}
            field={collection.body}
            value={body}
            blocks={collection.blocks}
            onChange={(v) => (body = v)}
          />
        {/key}
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
