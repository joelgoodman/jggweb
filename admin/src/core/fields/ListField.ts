import { Field, type FieldOptions } from './Field';

export interface ListFieldOptions extends FieldOptions<string> {
  placeholder?: string;
}

/**
 * A YAML array edited as comma-separated text. A value written as a string in
 * the file stays a string until it is edited.
 */
export class ListField extends Field<string> {
  readonly type = 'list';
  readonly placeholder?: string;
  readonly multiline = false;

  constructor(name: string, options: ListFieldOptions = {}) {
    super(name, options);
    this.placeholder = options.placeholder;
  }

  override defaultValue(): string {
    return this.options.default ?? '';
  }

  override deserialize(raw: unknown): string {
    if (Array.isArray(raw)) return raw.map(String).join(', ');
    return raw == null ? '' : String(raw);
  }

  override serialize(value: string): string[] | undefined {
    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }

  override validate(value: string): string | null {
    return super.validate(this.serialize(value) ? value : '');
  }
}
