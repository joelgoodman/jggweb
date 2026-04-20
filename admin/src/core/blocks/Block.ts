import type { MilkdownPlugin } from '@milkdown/ctx';
import type { EditorView } from '@milkdown/prose/view';
import type { StorageAdapter } from '../storage';

/**
 * A BlockDefinition describes an insertable content block. There are
 * two insertion paths:
 *
 *   1. Container blocks (Callout, PullQuote) define a `template` for
 *      the slash menu to replace the current paragraph with, and ship
 *      Milkdown `plugins` that register a ProseMirror node + parser +
 *      serializer so the block renders as a styled card in the editor
 *      and round-trips through `::: name` markdown.
 *
 *   2. Action blocks (Image, Video embed, Audio embed) override the
 *      default insertion with an `insert()` function that can open a
 *      file picker, prompt for a URL, upload media, and construct
 *      whatever ProseMirror transaction fits. The template field is
 *      ignored when `insert` is present.
 */
export interface BlockDefinition {
  /** Unique identifier — matches the container marker name (::: name). */
  readonly name: string;
  /** Human-readable label shown in the block menu. */
  readonly label: string;
  /** Short description for the inserter. */
  readonly description?: string;
  /** Raw markdown inserted at the cursor. Used when `insert` is not defined. */
  readonly template?: string;
  /** Icon name (matches a file in ui/icons/). Rendered in the slash menu. */
  readonly icon?: string;
  /** Reserved: Milkdown plugins for rich in-editor rendering. */
  readonly plugins?: MilkdownPlugin[];
  /** Custom insertion handler — called instead of template/node logic. */
  readonly insert?: (ctx: InsertContext) => void | Promise<void>;
}

/**
 * Context handed to a block's custom `insert()`. The runtime provides
 * file-picking and prompting utilities so blocks don't have to reach
 * into the DOM directly, and can rely on consistent UX (toasts,
 * cancellation semantics) across the admin.
 */
export interface InsertContext {
  /** The live ProseMirror view. */
  view: EditorView;
  /** Document range the slash menu captured (from `/` to the caret). */
  from: number;
  to: number;
  /** Repo storage adapter — use this to commit uploaded media. */
  storage: StorageAdapter | null;
  /** Open a native file picker. Resolves to null if the user cancels. */
  pickFile: (accept: string) => Promise<File | null>;
  /** Show a simple text prompt. Resolves to null if cancelled. */
  promptInput: (label: string, defaultValue?: string) => string | null;
  /** Show a toast for feedback (uploads, errors, etc.). */
  showToast: (msg: string, kind?: 'info' | 'error') => void;
}

/** Cursor placeholder in a template — replaced with the user's caret after insert. */
export const CURSOR = '$|$';
