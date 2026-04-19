import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/prose/state';

export interface SelectionToolbarState {
  active: boolean;
  coords: { top: number; left: number; width: number };
  marks: {
    strong: boolean;
    em: boolean;
    code: boolean;
    link: boolean;
  };
  linkHref: string;
}

const initialState: SelectionToolbarState = {
  active: false,
  coords: { top: 0, left: 0, width: 0 },
  marks: { strong: false, em: false, code: false, link: false },
  linkHref: '',
};

export const selectionPluginKey = new PluginKey<SelectionToolbarState>('selection-toolbar');

/**
 * Tracks the current text selection and reports a derived state
 * (active/position/active-marks) that the Svelte host reads to render
 * a floating inline toolbar. Runs on every transaction so the toolbar
 * follows as the user extends or moves the selection.
 */
export function selectionPlugin() {
  return new Plugin<SelectionToolbarState>({
    key: selectionPluginKey,
    state: {
      init: () => initialState,
      apply(tr: Transaction, prev: SelectionToolbarState, _old: EditorState, newState: EditorState): SelectionToolbarState {
        const sel = newState.selection;
        if (sel.empty || !sel.$from.parent.isTextblock) return initialState;

        const marks = {
          strong: isMarkActive(newState, 'strong'),
          em: isMarkActive(newState, 'emphasis'),
          code: isMarkActive(newState, 'inlineCode'),
          link: isMarkActive(newState, 'link'),
        };

        const base: SelectionToolbarState = {
          active: true,
          coords: prev.coords,
          marks,
          linkHref: getLinkHref(newState),
        };

        const meta = tr.getMeta(selectionPluginKey) as Partial<SelectionToolbarState> | undefined;
        return meta ? { ...base, ...meta } : base;
      },
    },
    view() {
      return {
        update(view) {
          const s = selectionPluginKey.getState(view.state);
          if (!s?.active) return;
          const { from, to } = view.state.selection;
          const startCoords = view.coordsAtPos(from);
          const endCoords = view.coordsAtPos(to);
          const coords = {
            top: Math.min(startCoords.top, endCoords.top),
            left: (startCoords.left + endCoords.left) / 2,
            width: Math.abs(endCoords.left - startCoords.left),
          };
          if (
            coords.top !== s.coords.top ||
            coords.left !== s.coords.left ||
            coords.width !== s.coords.width
          ) {
            view.dispatch(view.state.tr.setMeta(selectionPluginKey, { coords }));
          }
        },
      };
    },
  });
}

function isMarkActive(state: EditorState, markName: string): boolean {
  const mark = state.schema.marks[markName];
  if (!mark) return false;
  const { from, to, empty, $from } = state.selection;
  if (empty) return !!mark.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, mark);
}

function getLinkHref(state: EditorState): string {
  const link = state.schema.marks.link;
  if (!link) return '';
  const { $from } = state.selection;
  const mark = link.isInSet($from.marks());
  return mark ? String(mark.attrs.href ?? '') : '';
}
