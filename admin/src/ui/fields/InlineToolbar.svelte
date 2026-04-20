<script lang="ts">
  import Icon from '../Icon.svelte';
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
      onCommand('unlink');
    } else {
      onCommand('link', { href });
    }
  }

  // Block-type active state — highlights the button that matches the
  // current caret's containing block. List/quote wrappers take
  // precedence over the inner paragraph type so "List" stays lit
  // while editing a list item.
  const activeBlock = $derived.by(() => {
    if (state.block.inBulletList) return 'bullet';
    if (state.block.inOrderedList) return 'ordered';
    if (state.block.inBlockquote) return 'quote';
    if (state.block.parentType === 'heading') {
      return `h${state.block.headingLevel ?? 2}`;
    }
    return 'paragraph';
  });
</script>

{#if state.active}
  <div
    class="inline-toolbar"
    style:top="{state.coords.top - 48}px"
    style:left="{state.coords.left}px"
    role="toolbar"
    aria-label="Formatting"
  >
    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.strong}
      title="Bold (⌘B)"
      aria-label="Bold"
      aria-pressed={state.marks.strong}
      onmousedown={(e) => { e.preventDefault(); onCommand('strong'); }}
    ><Icon name="text-bold" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.em}
      title="Italic (⌘I)"
      aria-label="Italic"
      aria-pressed={state.marks.em}
      onmousedown={(e) => { e.preventDefault(); onCommand('em'); }}
    ><Icon name="text-italic" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.code}
      title="Inline code"
      aria-label="Inline code"
      aria-pressed={state.marks.code}
      onmousedown={(e) => { e.preventDefault(); onCommand('code'); }}
    ><code>{'<>'}</code></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={state.marks.link}
      title="Link (⌘K)"
      aria-label="Link"
      aria-pressed={state.marks.link}
      onmousedown={(e) => { e.preventDefault(); handleLink(); }}
    ><Icon name="link-3" size="0.95rem" /></button>

    <span class="inline-toolbar__sep" aria-hidden="true"></span>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={activeBlock === 'paragraph'}
      title="Paragraph"
      aria-label="Paragraph"
      aria-pressed={activeBlock === 'paragraph'}
      onmousedown={(e) => { e.preventDefault(); onCommand('paragraph'); }}
    ><Icon name="paragraph" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={activeBlock === 'h2'}
      title="Heading 2"
      aria-label="Heading 2"
      aria-pressed={activeBlock === 'h2'}
      onmousedown={(e) => { e.preventDefault(); onCommand('h2'); }}
    ><Icon name="heading-2" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={activeBlock === 'h3'}
      title="Heading 3"
      aria-label="Heading 3"
      aria-pressed={activeBlock === 'h3'}
      onmousedown={(e) => { e.preventDefault(); onCommand('h3'); }}
    ><Icon name="heading-3" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={activeBlock === 'bullet'}
      title="Bullet list"
      aria-label="Bullet list"
      aria-pressed={activeBlock === 'bullet'}
      onmousedown={(e) => { e.preventDefault(); onCommand('bullet'); }}
    ><Icon name="unordered-list" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={activeBlock === 'ordered'}
      title="Numbered list"
      aria-label="Numbered list"
      aria-pressed={activeBlock === 'ordered'}
      onmousedown={(e) => { e.preventDefault(); onCommand('ordered'); }}
    ><Icon name="ordered-list-2" size="0.95rem" /></button>

    <button
      type="button"
      class="inline-toolbar__btn"
      class:is-active={activeBlock === 'quote'}
      title="Blockquote"
      aria-label="Blockquote"
      aria-pressed={activeBlock === 'quote'}
      onmousedown={(e) => { e.preventDefault(); onCommand('quote'); }}
    ><Icon name="quote" size="0.95rem" /></button>
  </div>
{/if}
