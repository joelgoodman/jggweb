import type { BlockDefinition } from '../../core/blocks';
import { directiveContainer } from '../directives';

export const statSchema = directiveContainer({
  name: 'stat',
  className: 'stat-callout',
  schemaName: 'stat',
});

export const Stat: BlockDefinition = {
  name: 'stat',
  label: 'Stat',
  description: 'A big number or short phrase with a caption underneath. First line is the stat, the rest is the caption.',
  icon: 'chart-trend-up',
  plugins: [...statSchema],
};
