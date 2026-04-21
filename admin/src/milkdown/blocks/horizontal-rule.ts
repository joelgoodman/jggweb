import type { BlockDefinition } from '../../core/blocks';

/**
 * Horizontal rule block — inserts a short divider line between
 * sections. Milkdown's commonmark preset registers the `hr` node in
 * its schema and the `insertHrCommand` command, but the slash menu
 * needs an explicit entry to surface it. HR is a leaf node (no
 * content), so the default insertBlockNode flow — which creates a
 * wrapping paragraph — doesn't apply; use the `insert` callback to
 * dispatch a minimal replacement transaction instead.
 *
 * Styling is already in place on both surfaces (short 80px centered
 * accent line): see _post-detail.scss and admin/src/ui/styles.css.
 */
export const HorizontalRuleBlock: BlockDefinition = {
  name: 'hr',
  label: 'Horizontal rule',
  description: 'Short centered line. Marks a section break in the flow.',
  icon: 'divider-3',
  insert: (ctx) => {
    const { view, from, to } = ctx;
    const hrType = view.state.schema.nodes.hr;
    if (!hrType) {
      ctx.showToast('Editor schema is missing the hr node', 'error');
      return;
    }
    const state = view.state;
    // Replace the surrounding paragraph (the empty one the slash menu
    // was invoked from) with the hr node — matches how the container
    // blocks (callout, pullquote) handle range selection.
    const resolved = state.doc.resolve(from);
    const rangeFrom = resolved.before(resolved.depth);
    const rangeTo = Math.min(to + 1, state.doc.content.size);
    const tr = state.tr.replaceRangeWith(rangeFrom, rangeTo, hrType.create());
    view.dispatch(tr);
    view.focus();
  },
};
