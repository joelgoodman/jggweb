<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { commandsCtx, editorViewCtx, serializerCtx, type Editor } from '@milkdown/core';
  import {
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
  import { history } from '@milkdown/plugin-history';
  import { clipboard } from '@milkdown/plugin-clipboard';
  import { $prose as proseWrap } from '@milkdown/utils';
  import { Plugin } from '@milkdown/prose/state';
  import type { EditorView } from '@milkdown/prose/view';
  import type { NodeType } from '@milkdown/prose/model';
  import type { MarkdownField } from '../../core/fields';
  import type { BlockDefinition } from '../../core/blocks';
  import { slashPlugin, slashPluginKey, filterBlocks, type SlashMenuState } from '../../milkdown/slashPlugin';
  import { selectionPlugin, selectionPluginKey, type SelectionToolbarState } from '../../milkdown/selectionPlugin';
  import { pasteTablesPlugin } from '../../milkdown/pasteTables';
  import { createMarkdownEditor, roundTripMarkdown } from '../../milkdown/markdown';
  import { checkEditable, bodyOrOriginal } from '../../core/editability';
  import { pickFile, insertContainerNode } from '../../milkdown/blockHelpers';
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
  let removed = false;
  // Until the body is checked, neither editor shows. `plain` opens it as text.
  let checked = $state(false);
  let plain = $state(false);
  // The body as loaded. `value` follows the edits.
  let original = $state('');
  // What the editor writes for the body as loaded. While the document gives
  // that, the body is reported as it was loaded, so an undone edit saves nothing.
  let baseline: string | undefined;

  /**
   * Reports the body now. The editor reports typing only after a 200 ms pause,
   * so Save and the unsaved-changes checks call this first.
   */
  export function flush(): void {
    if (!editor || baseline === undefined) return;
    const md = editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc));
    onChange(bodyOrOriginal(md, baseline, original));
  }

  let slash = $state<SlashMenuState>({
    active: false,
    from: 0,
    query: '',
    coords: { top: 0, bottom: 0, left: 0 },
    index: 0,
  });
  let slashMenuEl = $state<HTMLElement | null>(null);
  // Unclamped guess, good enough for the first paint before the menu's
  // real size is known. Refined below once it's measurable.
  const naiveSlashPos = $derived({ top: slash.coords.bottom + 6, left: slash.coords.left });
  // Menu placement, recomputed against the caret + viewport each time
  // the menu opens or its item list changes size. Flips above the
  // caret when there's no room below, and keeps the menu from
  // clipping off the right edge of the viewport.
  let refinedSlashPos = $state<{ top: number; left: number; placement: 'below' | 'above' } | null>(
    null,
  );
  const slashMenuPos = $derived(refinedSlashPos ?? { ...naiveSlashPos, placement: 'below' as const });
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

    const schema = editorView.state.schema;
    const nodeType = schema.nodes[block.name] as NodeType | undefined;

    if (!nodeType) {
      const template = block.template ?? '';
      const tr = editorView.state.tr.replaceRangeWith(from, to, schema.text(template.replace('$|$', '')));
      editorView.dispatch(tr);
      editorView.focus();
      return;
    }

    insertContainerNode(editorView, from, to, block.name);
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
    original = value;
    // A check that fails is no reason to trust the visual editor with the body.
    const reason = await checkEditable(original, (md) => roundTripMarkdown(md, blocks)).catch(
      () => 'unsupported' as const,
    );
    // Another entry may have taken this editor's place while it was checked.
    if (removed) return;
    checked = true;
    if (reason) {
      plain = true;
      return;
    }

    const slashProsePlugin = proseWrap(() =>
      slashPlugin(
        () => blocks,
        (block, from, to) => insertBlockNode(block, from, to),
      ),
    );
    const selectionProsePlugin = proseWrap(() => selectionPlugin());
    const pasteTablesProsePlugin = proseWrap(() =>
      pasteTablesPlugin(() =>
        showToast('The pasted table is now text, one line per row: the visual editor has no tables.', 'error'),
      ),
    );

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

    const created = await createMarkdownEditor({ root: hostEl, value: original, blocks })
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_c, md) => {
          if (baseline !== undefined) onChange(bodyOrOriginal(md, baseline, original));
        });
      })
      .config(nord)
      .use(listener)
      .use(history)
      .use(clipboard)
      .use(block)
      .use(slashProsePlugin)
      .use(selectionProsePlugin)
      .use(pasteTablesProsePlugin)
      .use(stateSyncPlugin)
      .create();

    // Another entry may have taken this editor's place while it was starting.
    if (removed) {
      void created.destroy();
      return;
    }
    editor = created;
    baseline = created.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc));

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
    removed = true;
    blockProvider?.destroy();
    blockProvider = null;
    // The change listener is debounced and outlives the editor. Left subscribed,
    // it would report this body after the next entry's had been loaded.
    editor?.action((ctx) => {
      ctx.get(listenerCtx).listeners.markdownUpdated.length = 0;
    });
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
        coords: { top: 0, bottom: 0, left: 0 },
        index: 0,
      }),
    );
  }

  // Recompute the menu's on-screen position whenever it opens, its
  // anchor moves, or its item list changes size (fewer/more rows as
  // the query filters). Runs after the DOM has the current menu size.
  $effect(() => {
    slash.active;
    slash.coords;
    visibleBlocks.length;
    if (!slash.active || !slashMenuEl) {
      refinedSlashPos = null;
      return;
    }
    const margin = 8;
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = slashMenuEl.getBoundingClientRect();

    let left = slash.coords.left;
    left = Math.min(left, vw - margin - rect.width);
    left = Math.max(margin, left);

    const fitsBelow = slash.coords.bottom + gap + rect.height <= vh - margin;
    const fitsAbove = slash.coords.top - gap - rect.height >= margin;
    const placement = fitsBelow || !fitsAbove ? 'below' : 'above';
    const top =
      placement === 'below' ? slash.coords.bottom + gap : slash.coords.top - gap - rect.height;

    refinedSlashPos = { top, left, placement };
  });
</script>

<div class="markdown-input" bind:this={wrapperEl}>
  {#if plain}
    <p class="markdown-plain-notice" role="note">
      This entry uses Markdown the visual editor can't keep intact, so it's open as plain text. Nothing is changed until you edit it.
    </p>
    <textarea
      class="markdown-plain"
      aria-label={field.label}
      spellcheck="true"
      value={original}
      oninput={(e) => onChange(e.currentTarget.value)}
    ></textarea>
  {/if}
  <div class="milkdown-host" class:is-hidden={!checked || plain} bind:this={hostEl}></div>

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
      bind:this={slashMenuEl}
      style:top="{slashMenuPos.top}px"
      style:left="{slashMenuPos.left}px"
      role="listbox"
    >
      <div class="slash-menu__list">
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
      <div class="slash-menu__footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Insert</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  {/if}
</div>
