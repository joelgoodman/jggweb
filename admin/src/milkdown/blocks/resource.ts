import type { BlockDefinition } from '../../core/blocks';
import { directiveContainer } from '../directives';

export const resourceSchema = directiveContainer({
  name: 'resource',
  className: 'resource-card',
  schemaName: 'resource',
});

export const Resource: BlockDefinition = {
  name: 'resource',
  label: 'Resource card',
  description: 'A titled card linking out to an article, book, or tool. First line is a [Title](url) link, the rest is an optional description.',
  icon: 'external-link',
  plugins: [...resourceSchema],
};
