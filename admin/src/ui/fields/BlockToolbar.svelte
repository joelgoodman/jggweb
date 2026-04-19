<script lang="ts">
  interface ToolbarCommand {
    key: string;
    label: string;
    title: string;
    disabled?: boolean;
  }

  interface Props {
    onCommand: (key: string, payload?: unknown) => void;
  }
  let { onCommand }: Props = $props();

  const blockTypes: ToolbarCommand[] = [
    { key: 'paragraph', label: 'P', title: 'Paragraph' },
    { key: 'h2', label: 'H2', title: 'Heading 2' },
    { key: 'h3', label: 'H3', title: 'Heading 3' },
    { key: 'bullet', label: '•', title: 'Bullet list' },
    { key: 'ordered', label: '1.', title: 'Numbered list' },
    { key: 'quote', label: '“”', title: 'Blockquote' },
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
      {b.label}
    </button>
  {/each}
</div>
