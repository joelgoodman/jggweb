<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor, rootCtx, defaultValueCtx, commandsCtx } from '@milkdown/core';
  import {
    commonmark,
    toggleStrongCommand,
    toggleEmphasisCommand,
    toggleInlineCodeCommand,
    toggleLinkCommand,
    wrapInHeadingCommand,
    turnIntoTextCommand,
    wrapInBulletListCommand,
    wrapInOrderedListCommand,
    wrapInBlockquoteCommand,
    insertHrCommand,
  } from '@milkdown/preset-commonmark';
  import { nord } from '@milkdown/theme-nord';
  import { listener, listenerCtx } from '@milkdown/plugin-listener';
  import { block, BlockProvider } from '@milkdown/plugin-block';
  import { $prose as proseWrap } from '@milkdown/utils';
  import { Plugin } from '@milkdown/prose/state';
  import type { EditorView } from '@milkdown/prose/view';
  import type { NodeType } from '@milkdown/prose/model';
  import type { MarkdownField } from '../../core/fields';
  import type { BlockDefinition } from '../../core/blocks';
  import { slashPlugin, slashPluginKey, filterBlocks, type SlashMenuState } from '../../milkdown/slashPlugin';
  import { selectionPlugin, selectionPluginKey, type SelectionToolbarState } from '../../milkdown/selectionPlugin';
  import { directivesRemark } from '../../milkdown/directives';
  import { pickFile } from '../../milkdown/blockHelpers';
  import { store, showToast } from '../../state.svelte';
  import InlineToolbar from './InlineToolbar.svelte';
  import Icon from '../Icon.svelte';
  import '@milkdown/theme-nord/style.css';

  interface Props {
    field: MarkdownField;
    value: string;
    blocks: BlockDefinition[];
    onChange: (v: string) => void;
  }
  let { field, value, blocks, onChange }: Props = $props();

  let wrapperEl: HTMLElement;
  let hostEl: HTMLElement;
  let handleEl: HTMLElement;
  let editor: Editor | null = null;
  let editorView: EditorView | null = null;
  let blockProvider: BlockProvider | null = null;

  let slash = $state<SlashMenuState>({
    active: false,
    from: 0,
    query: '',
    coords: { top: 0, left: 0 },
    index: 0,
  });
  let selectionState = $state<SelectionToolbarState>({
    active: false,
    coords: { top: 0, left: 0, width: 0 },
    marks: { strong: false, em: false, code: false, link: false },
    linkHref: '',
    block: {
      parentType: 'paragraph',
      inBulletList: false,
      inOrderedList: false,
      inBlockquote: false,
    },
  });

  const visibleBlocks = $derived(filterBlocks(blocks, slash.query));

  function insertBlockNode(block: BlockDefinition, from: number, to: number) {
    if (!editorView) return;

    // Action blocks (Image, Video, Audio) override the default insert
    // flow with their own handler — file picker, URL prompt, etc.
    if (block.insert) {
      void block.insert({
        view: editorView,
        from,
        to,
        storage: store.storage,
        pickFile,
        promptInput: (label, defaultValue = '') => window.prompt(label, defaultValue),
        showToast,
      });
      return;
    }

    const state = editorView.state;
    const schema = state.schema;
    const nodeType = schema.nodes[block.name] as NodeType | undefined;

    if (!nodeType) {
      const template = block.template ?? '';
      const tr = state.tr.replaceRangeWith(from, to, schema.text(template.replace('$|$', '')));
      editorView.dispatch(tr);
      editorView.focus();
      return;
    }

    const paragraph = schema.nodes.paragraph.create();
    const attrs = nodeType.spec.attrs
      ? Object.fromEntries(
          Object.entries(nodeType.spec.attrs).map(([k, v]) => [k, (v as { default?: unknown }).default]),
        )
      : {};
    const node = nodeType.create(attrs, paragraph);
    const resolvedFrom = state.doc.resolve(from);
    const rangeFrom = resolvedFrom.before(resolvedFrom.depth);
    const rangeTo = Math.min(to + 1, state.doc.content.size);

    const tr = state.tr.replaceRangeWith(rangeFrom, rangeTo, node);
    const caretPos = rangeFrom + 2;
    tr.setSelection(state.selection.constructor.near(tr.doc.resolve(caretPos)) as never);
    editorView.dispatch(tr);
    editorView.focus();
  }

  /**
   * Route toolbar button keys to Milkdown commands. Keeping the command
   * registry in one place (this switch) means the toolbar components
   * can stay dumb — they just emit string keys — and future blocks or
   * marks only need an entry here plus a button in a toolbar template.
   */
  function dispatchCommand(key: string, payload?: unknown) {
    if (!editor) return;
    editor.action((ctx) => {
      const commands = ctx.get(commandsCtx);
      switch (key) {
        case 'strong': commands.call(toggleStrongCommand.key); break;
        case 'em': commands.call(toggleEmphasisCommand.key); break;
        case 'code': commands.call(toggleInlineCodeCommand.key); break;
        case 'link': commands.call(toggleLinkCommand.key, payload); break;
        case 'unlink': commands.call(toggleLinkCommand.key); break;
        case 'paragraph': commands.call(turnIntoTextCommand.key); break;
        case 'h2': commands.call(wrapInHeadingCommand.key, 2); break;
        case 'h3': commands.call(wrapInHeadingCommand.key, 3); break;
        case 'bullet': commands.call(wrapInBulletListCommand.key); break;
        case 'ordered': commands.call(wrapInOrderedListCommand.key); break;
        case 'quote': commands.call(wrapInBlockquoteCommand.key); break;
        case 'hr': commands.call(insertHrCommand.key); break;
      }
    });
    editorView?.focus();
  }

  onMount(async () => {
    const slashProsePlugin = proseWrap(() =>
      slashPlugin(
        () => blocks,
        (block, from, to) => insertBlockNode(block, from, to),
      ),
    );
    const selectionProsePlugin = proseWrap(() => selectionPlugin());

    // State-sync runs in view.update(), which fires AFTER view.state is
    // committed — the plugin-listener's `selectionUpdated` hook fires
    // during state.apply, so view.state there is still the old state.
    // Reading plugin state from the listener produced stale values for
    // the inline popover (marks/block info one keystroke behind).
    const stateSyncPlugin = proseWrap(
      () =>
        new Plugin({
          view: () => ({
            update(view) {
              editorView = view;
              const slashNext = slashPluginKey.getState(view.state);
              if (slashNext) slash = { ...slashNext };
              const selNext = selectionPluginKey.getState(view.state);
              if (selNext) selectionState = { ...selNext };
            },
          }),
        }),
    );

    const blockPlugins = blocks.flatMap((b) => b.plugins ?? []);

    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, hostEl);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_c, md) => onChange(md));
      })
      .config(nord)
      .use(commonmark)
      .use(directivesRemark)
      .use(blockPlugins)
      .use(listener)
      .use(block)
      .use(slashProsePlugin)
      .use(selectionProsePlugin)
      .use(stateSyncPlugin)
      .create();

    editor.action((ctx) => {
      blockProvider = new BlockProvider({
        ctx,
        content: handleEl,
        // Anchor the drag handle to the top of the block instead of the
        // vertical center — matches the published reading column's
        // first-line eyebrow and avoids the handle drifting to the
        // middle of multi-line paragraphs.
        getPlacement: () => 'left-start',
        // Nudge right (into the gutter) and down a touch so the handle
        // visually lines up with the first line's cap height.
        getOffset: () => ({ mainAxis: 6, crossAxis: 4 }),
      });
      blockProvider.update();
    });
  });

  onDestroy(() => {
    blockProvider?.destroy();
    blockProvider = null;
    editor?.destroy();
    editor = null;
    editorView = null;
  });

  function onItemClick(block: BlockDefinition) {
    if (!editorView) return;
    const state = slashPluginKey.getState(editorView.state);
    if (!state?.active) return;
    insertBlockNode(block, state.from, editorView.state.selection.from);
    editorView.dispatch(
      editorView.state.tr.setMeta(slashPluginKey, {
        active: false,
        from: 0,
        query: '',
        coords: { top: 0, left: 0 },
        index: 0,
      }),
    );
  }
</script>

<div class="markdown-input" bind:this={wrapperEl}>
  <div class="milkdown-host" bind:this={hostEl}></div>

  <div
    class="block-handle"
    bind:this={handleEl}
    role="button"
    aria-label="Drag to reorder block"
    title="Drag to reorder"
  >
    <Icon name="grip-dots-vertical" size="0.95rem" />
  </div>

  <InlineToolbar state={selectionState} onCommand={dispatchCommand} />

  {#if slash.active}
    <div
      class="slash-menu is-open"
      style:top="{slash.coords.top + 6}px"
      style:left="{slash.coords.left}px"
      role="listbox"
    >
      {#if visibleBlocks.length === 0}
        <div class="slash-menu__empty">No matching blocks</div>
      {:else}
        {#each visibleBlocks as b, i (b.name)}
          <button
            type="button"
            class="slash-menu__item"
            class:is-active={i === slash.index}
            onclick={() => onItemClick(b)}
            onmouseenter={() => (slash.index = i)}
          >
            {#if b.icon}
              <span class="slash-menu__item-icon">
                <Icon name={b.icon} size="1.1rem" />
              </span>
            {/if}
            <span class="slash-menu__item-body">
              <span class="slash-menu__item-label">{b.label}</span>
              {#if b.description}
                <span class="slash-menu__item-desc">{b.description}</span>
              {/if}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
