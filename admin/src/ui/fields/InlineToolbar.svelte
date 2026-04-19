<script lang="ts">
  import type { SelectionToolbarState } from '../../milkdown/selectionPlugin';

  interface Props {
    state: SelectionToolbarState;
    onCommand: (key: string, payload?: unknown) => void;
  }
  let { state, onCommand }: Props = $props();

  function handleLink() {
    const current = state.linkHref ?? '';
    const href = window.prompt('Link URL', current);
    if (href === null) return;
    if (href === '') {
      // Empty string removes the link.
      onCommand('unlink');
    } else {
      onCommand('link', { href });
    }
  }
</script>

{#if state.active}
  <div
    class="inline-toolbar"
    style:top="{state.coords.top - 44}px"
    style:left="{state.coords.left}px"
    role="toolbar"
    aria-label="Text formatting"
  >
    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.strong}
      title="Bold (⌘B)"
      aria-label="Bold"
      aria-pressed={state.marks.strong}
      onmousedown={(e) => { e.preventDefault(); onCommand('strong'); }}
    ><strong>B</strong></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.em}
      title="Italic (⌘I)"
      aria-label="Italic"
      aria-pressed={state.marks.em}
      onmousedown={(e) => { e.preventDefault(); onCommand('em'); }}
    ><em>I</em></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.code}
      title="Inline code"
      aria-label="Inline code"
      aria-pressed={state.marks.code}
      onmousedown={(e) => { e.preventDefault(); onCommand('code'); }}
    ><code>{'<>'}</code></button>

    <span class="inline-toolbar__sep" aria-hidden="true"></span>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.link}
      title="Link (⌘K)"
      aria-label="Link"
      aria-pressed={state.marks.link}
      onmousedown={(e) => { e.preventDefault(); handleLink(); }}
    >🔗</button>
  </div>
{/if}
