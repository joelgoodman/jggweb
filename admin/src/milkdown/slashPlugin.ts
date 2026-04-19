import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import type { BlockDefinition } from '../core/blocks';
import { CURSOR } from '../core/blocks';

export interface SlashMenuState {
  active: boolean;
  /** Document position of the `/` character. */
  from: number;
  /** Text typed after the slash (used to filter items). */
  query: string;
  /** Screen coords of the caret when menu opened; used to position the menu. */
  coords: { top: number; left: number };
  /** Currently highlighted item index. */
  index: number;
}

const initialState: SlashMenuState = {
  active: false,
  from: 0,
  query: '',
  coords: { top: 0, left: 0 },
  index: 0,
};

export const slashPluginKey = new PluginKey<SlashMenuState>('slash-menu');

/**
 * Detects `/` typed at the start of an empty paragraph, tracks the query
 * the user types after it, and exposes that as plugin state the Svelte
 * host reads to render the menu. Arrow keys and Enter are intercepted
 * while active so they drive the menu instead of moving the caret.
 */
export function slashPlugin(
  getBlocks: () => BlockDefinition[],
  onPick: (block: BlockDefinition, from: number, to: number) => void,
) {
  return new Plugin<SlashMenuState>({
    key: slashPluginKey,
    state: {
      init: () => initialState,
      apply(tr: Transaction, prev: SlashMenuState, _old: EditorState, newState: EditorState): SlashMenuState {
        const meta = tr.getMeta(slashPluginKey) as Partial<SlashMenuState> | undefined;
        if (meta) return { ...prev, ...meta };

        if (!prev.active) return prev;

        // If the `/` itself has been deleted, close.
        const sel = newState.selection;
        if (prev.from >= newState.doc.content.size) return initialState;
        if (sel.from < prev.from) return initialState;

        // Otherwise track query text from `/` up to the caret.
        const text = newState.doc.textBetween(prev.from, sel.from, '\n', '\n');
        if (!text.startsWith('/')) return initialState;
        return { ...prev, query: text.slice(1) };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const s = slashPluginKey.getState(view.state);
        if (!s?.active) return false;

        const items = filterBlocks(getBlocks(), s.query);

        if (event.key === 'Escape') {
          view.dispatch(view.state.tr.setMeta(slashPluginKey, initialState));
          return true;
        }
        if (event.key === 'ArrowDown') {
          const next = items.length ? (s.index + 1) % items.length : 0;
          view.dispatch(view.state.tr.setMeta(slashPluginKey, { index: next }));
          return true;
        }
        if (event.key === 'ArrowUp') {
          const next = items.length ? (s.index - 1 + items.length) % items.length : 0;
          view.dispatch(view.state.tr.setMeta(slashPluginKey, { index: next }));
          return true;
        }
        if (event.key === 'Enter') {
          const chosen = items[s.index];
          if (chosen) {
            onPick(chosen, s.from, view.state.selection.from);
            view.dispatch(view.state.tr.setMeta(slashPluginKey, initialState));
            return true;
          }
        }
        return false;
      },
      handleTextInput(view, from, _to, text) {
        if (text !== '/') return false;
        const $pos = view.state.doc.resolve(from);
        // Only trigger at the very start of a paragraph.
        if ($pos.parent.type.name !== 'paragraph') return false;
        if ($pos.parentOffset !== 0) return false;
        // Defer so the `/` actually lands in the doc first.
        setTimeout(() => {
          const coords = view.coordsAtPos(from);
          view.dispatch(
            view.state.tr.setMeta(slashPluginKey, {
              active: true,
              from,
              query: '',
              coords: { top: coords.bottom, left: coords.left },
              index: 0,
            }),
          );
        }, 0);
        return false;
      },
    },
  });
}

export function filterBlocks(blocks: BlockDefinition[], query: string): BlockDefinition[] {
  if (!query) return blocks;
  const q = query.toLowerCase();
  return blocks.filter((b) => b.name.includes(q) || b.label.toLowerCase().includes(q));
}

/** Render a block's template, stripping the cursor marker. */
export function renderTemplate(block: BlockDefinition): string {
  return block.template.replace(CURSOR, '');
}
