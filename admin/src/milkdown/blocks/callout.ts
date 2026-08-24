import type { BlockDefinition } from '../../core/blocks';
import { directiveContainer } from '../directives';
import { insertContainerNode } from '../blockHelpers';

export const calloutSchema = directiveContainer({
  name: 'callout',
  className: 'callout',
  withKind: true,
  schemaName: 'callout',
});

// Three slash-menu entries share the one `callout` node/directive —
// the kind is picked at insert time (via a dedicated insert() per
// variant) rather than edited after the fact, since there's no
// in-editor control for changing a callout's kind once placed.
function calloutVariant(
  variantName: string,
  kind: 'note' | 'warning' | 'tip',
  label: string,
  description: string,
  icon: string,
): BlockDefinition {
  return {
    name: variantName,
    label,
    description,
    icon,
    plugins: [...calloutSchema],
    insert: ({ view, from, to }) => {
      insertContainerNode(view, from, to, 'callout', { kind });
    },
  };
}

export const CalloutNote = calloutVariant(
  'callout-note',
  'note',
  'Callout: Note',
  'Emphasized side-note for extra context.',
  'msg-quote',
);

export const CalloutWarning = calloutVariant(
  'callout-warning',
  'warning',
  'Callout: Warning',
  'Flag something readers should be careful about.',
  'triangle-warning',
);

export const CalloutTip = calloutVariant(
  'callout-tip',
  'tip',
  'Callout: Tip',
  'Suggest a helpful action or shortcut.',
  'lightbulb',
);
