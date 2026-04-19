import { Field, type FieldOptions } from './Field';
import type { BlockDefinition } from '../blocks/Block';

export interface MarkdownFieldOptions extends FieldOptions<string> {
  blocks?: BlockDefinition[];
}

/**
 * The post body. Stored as raw markdown text in the source file (outside
 * frontmatter). Backed by the Milkdown editor; custom blocks are
 * provided by the collection's block list.
 */
export class MarkdownField extends Field<string> {
  readonly type = 'markdown';
  readonly blocks: BlockDefinition[];

  constructor(name: string, options: MarkdownFieldOptions = {}) {
    super(name, options);
    this.blocks = options.blocks ?? [];
  }

  override defaultValue(): string {
    return this.options.default ?? '';
  }

  override deserialize(raw: unknown): string {
    return raw == null ? '' : String(raw);
  }

  override serialize(value: string): string {
    return value;
  }
}
