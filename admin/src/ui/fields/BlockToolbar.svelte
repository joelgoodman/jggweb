<script lang="ts">
  import Icon from '../Icon.svelte';

  interface ToolbarCommand {
    key: string;
    icon?: string;
    label?: string;
    title: string;
  }

  interface Props {
    onCommand: (key: string, payload?: unknown) => void;
  }
  let { onCommand }: Props = $props();

  // HR has no icon by design — we keep the em-dash label so the rule
  // glyph reads as a horizontal line in the toolbar.
  const blockTypes: ToolbarCommand[] = [
    { key: 'paragraph', icon: 'pilcrow', title: 'Paragraph' },
    { key: 'h2', icon: 'heading-2', title: 'Heading 2' },
    { key: 'h3', icon: 'heading-3', title: 'Heading 3' },
    { key: 'bullet', icon: 'unordered-list-2', title: 'Bullet list' },
    { key: 'ordered', icon: 'ordered-list-2', title: 'Numbered list' },
    { key: 'quote', icon: 'quote', title: 'Blockquote' },
    { key: 'hr', label: '—', title: 'Horizontal rule' },
  ];
</script>

<div class="block-toolbar" role="toolbar" aria-label="Block formatting">
  {#each blockTypes as b (b.key)}
    <button
      type="button"
      class="block-toolbar__btn"
      title={b.title}
      aria-label={b.title}
      onclick={() => onCommand(b.key)}
    >
      {#if b.icon}
        <Icon name={b.icon} size="1.05rem" />
      {:else}
        <span class="block-toolbar__label">{b.label}</span>
      {/if}
    </button>
  {/each}
</div>
