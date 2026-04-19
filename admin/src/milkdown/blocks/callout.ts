import type { BlockDefinition } from '../../core/blocks';
import { CURSOR } from '../../core/blocks';
import { directiveContainer } from '../directives';

export const calloutSchema = directiveContainer({
  name: 'callout',
  className: 'callout',
  withKind: true,
  schemaName: 'callout',
});

export const Callout: BlockDefinition = {
  name: 'callout',
  label: 'Callout',
  description: 'Emphasized side-note with an optional kind (note, warning, tip).',
  template: `::: callout {.note}\n${CURSOR}\n:::`,
  icon: 'msg-quote',
  plugins: [calloutSchema],
};
