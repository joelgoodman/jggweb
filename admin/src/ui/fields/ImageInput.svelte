<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ImageField } from '../../core/fields';
  import { store, showToast } from '../../state.svelte';
  import Icon from '../Icon.svelte';

  interface Props { field: ImageField; value: string; onChange: (v: string) => void }
  let { field, value, onChange }: Props = $props();

  let uploading = $state(false);
  let dragging = $state(false);

  /**
   * Just-uploaded files preview from an in-memory object URL so the
   * image appears instantly — no wait for GitHub's CDN or a deploy.
   * Keyed by filename so we only serve the blob when `value` matches
   * the file that produced it; loading a different entry falls back
   * to the remote URL below.
   */
  let session = $state<{ filename: string; blobUrl: string } | null>(null);

  onDestroy(() => {
    if (session) URL.revokeObjectURL(session.blobUrl);
  });

  /**
   * Preview URL resolution, in priority order:
   * 1. Session blob URL if we just uploaded this filename — instant.
   * 2. GitHub raw URL — works before deploy, in dev and prod. Assumes
   *    a public repo (private repos would need an auth'd fetch).
   * 3. The site-relative path as a last-ditch fallback.
   */
  const previewUrl = $derived.by(() => {
    if (!value) return '';
    if (session && session.filename === value) return session.blobUrl;
    if (store.auth) {
      const { owner, repo, branch } = store.auth;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${field.directory}/${encodeURIComponent(value)}`;
    }
    const prefix = field.publicPath ?? `/${field.directory}/`;
    return `${prefix.replace(/\/$/, '')}/${value}`;
  });

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !store.storage) return;
    const file = files[0];
    if (!field.accept.includes(file.type)) {
      showToast(`Unsupported file type: ${file.type}`, 'error');
      return;
    }
    uploading = true;
    try {
      const buf = await file.arrayBuffer();
      const filename = sanitizeFilename(file.name);
      const path = `${field.directory}/${filename}`;
      await store.storage.uploadBinary(path, buf, {
        message: `content: upload ${path}`,
      });
      if (session) URL.revokeObjectURL(session.blobUrl);
      session = { filename, blobUrl: URL.createObjectURL(file) };
      onChange(filename);
      showToast('Image uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      uploading = false;
    }
  }

  function sanitizeFilename(name: string): string {
    const dot = name.lastIndexOf('.');
    const stem = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';
    return stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + ext.toLowerCase();
  }
</script>

<div class="input">
  <span class="input__label">{field.label}{field.required ? ' *' : ''}</span>

  <div
    class="image-drop"
    class:is-dragging={dragging}
    ondragover={(e) => { e.preventDefault(); dragging = true; }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => { e.preventDefault(); dragging = false; handleFiles(e.dataTransfer?.files ?? null); }}
    role="button"
    tabindex="0"
  >
    {#if value}
      <img class="image-drop__preview" src={previewUrl} alt={value} />
      <div class="image-drop__meta">
        <code>{value}</code>
      </div>
    {:else}
      <Icon name="image-plus" size="1.5rem" class="image-drop__placeholder" />
      <p>Drop an image here</p>
    {/if}
    <label class="image-drop__picker">
      <input type="file" accept={field.accept.join(',')} onchange={(e) => handleFiles((e.target as HTMLInputElement).files)} hidden />
      <span class="btn">{uploading ? 'Uploading…' : value ? 'Replace' : 'Choose file'}</span>
    </label>

    {#if value}
      <button class="image-drop__remove" type="button" onclick={() => onChange('')} aria-label="Remove image">
        <Icon name="trash-2-content" size="0.85rem" />
      </button>
    {/if}
  </div>

  {#if field.hint}<span class="input__hint">{field.hint}</span>{/if}
</div>
