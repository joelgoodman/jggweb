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
  /**
   * The current block's type name (e.g. `paragraph`, `heading`, `blockquote`).
   * Plus list/quote ancestry flags so the popover can highlight the active
   * block button even when the caret is inside nested list structure.
   */
  block: {
    parentType: string;
    headingLevel?: number;
    inBulletList: boolean;
    inOrderedList: boolean;
    inBlockquote: boolean;
  };
}

const initialState: SelectionToolbarState = {
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
};

export const selectionPluginKey = new PluginKey<SelectionToolbarState>('selection-toolbar');

/**
 * Tracks the current text selection and reports a derived state
 * (active/position/active-marks/active-block) that the Svelte host
 * reads to render a floating inline popover. Runs on every
 * transaction so the popover follows the selection live.
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
          block: getBlockInfo(newState),
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
          let coords: { top: number; left: number; width: number };
          try {
            const startCoords = view.coordsAtPos(from);
            const endCoords = view.coordsAtPos(to);
            coords = {
              top: Math.min(startCoords.top, endCoords.top),
              left: (startCoords.left + endCoords.left) / 2,
              width: Math.abs(endCoords.left - startCoords.left),
            };
          } catch {
            // coordsAtPos can throw during transient decoration updates;
            // skip this tick — the next update will recompute.
            return;
          }
          // Tolerance keeps us out of a dispatch loop from subpixel
          // reflows (hinting, font load) — the popover tracks to within
          // half a pixel.
          const changed =
            Math.abs(coords.top - s.coords.top) > 0.5 ||
            Math.abs(coords.left - s.coords.left) > 0.5 ||
            Math.abs(coords.width - s.coords.width) > 0.5;
          if (changed) {
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

function getBlockInfo(state: EditorState) {
  const { $from } = state.selection;
  const parent = $from.parent;
  const info = {
    parentType: parent.type.name,
    headingLevel: parent.type.name === 'heading' ? (parent.attrs.level as number) : undefined,
    inBulletList: false,
    inOrderedList: false,
    inBlockquote: false,
  };
  for (let depth = $from.depth; depth >= 0; depth--) {
    const name = $from.node(depth).type.name;
    if (name === 'bullet_list') info.inBulletList = true;
    if (name === 'ordered_list') info.inOrderedList = true;
    if (name === 'blockquote') info.inBlockquote = true;
  }
  return info;
}
