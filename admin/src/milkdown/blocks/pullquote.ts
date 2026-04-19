import type { BlockDefinition } from '../../core/blocks';
import { CURSOR } from '../../core/blocks';
import { directiveContainer } from '../directives';

export const pullquoteSchema = directiveContainer({
  name: 'pullquote',
  className: 'pullquote',
  schemaName: 'pullquote',
});

export const PullQuote: BlockDefinition = {
  name: 'pullquote',
  label: 'Pull quote',
  description: 'Emphasized quotation styled larger than body text.',
  template: `::: pullquote\n${CURSOR}\n:::`,
  icon: 'quote',
  plugins: [pullquoteSchema],
};
