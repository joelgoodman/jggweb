import type { MilkdownPlugin } from '@milkdown/ctx';

/**
 * A BlockDefinition describes an insertable custom content block. The
 * minimum contract is `template` — the raw markdown that gets inserted
 * at the cursor when the block is chosen from the toolbar. Blocks may
 * optionally supply Milkdown plugins for in-editor rich rendering
 * (schema + parse + serialize + node view); this POC ships the
 * template-insert path only, with the Milkdown plugin slot reserved so
 * rich rendering can land later without changing any schema code.
 */
export interface BlockDefinition {
  /** Unique identifier — matches the container marker name (::: name). */
  readonly name: string;
  /** Human-readable label shown in the block menu. */
  readonly label: string;
  /** Short description for the inserter. */
  readonly description?: string;
  /** Raw markdown inserted at the cursor. Supports a literal `$|$` cursor marker. */
  readonly template: string;
  /** Icon name (matches a file in ui/icons/). Rendered in the slash menu. */
  readonly icon?: string;
  /** Reserved: Milkdown plugins for rich in-editor rendering. */
  readonly plugins?: MilkdownPlugin[];
}

/** Cursor placeholder in a template — replaced with the user's caret after insert. */
export const CURSOR = '$|$';
