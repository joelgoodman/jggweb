import type { BlockDefinition } from '../../core/blocks';
import { directiveContainer } from '../directives';

export const pullquoteSchema = directiveContainer({
  name: 'pullquote',
  className: 'pullquote',
  schemaName: 'pullquote',
});

export const PullQuote: BlockDefinition = {
  name: 'pullquote',
  label: 'Pull quote',
  description: 'Emphasized quotation styled larger than body text. End with a line starting with "— " to add a source.',
  icon: 'opening-quotation-mark',
  plugins: [...pullquoteSchema],
};
