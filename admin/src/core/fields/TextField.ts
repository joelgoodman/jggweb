import { Field, type FieldOptions } from './Field';

export interface TextFieldOptions extends FieldOptions<string> {
  placeholder?: string;
  multiline?: boolean;
}

export class TextField extends Field<string> {
  readonly type = 'text';
  readonly placeholder?: string;
  readonly multiline: boolean;

  constructor(name: string, options: TextFieldOptions = {}) {
    super(name, options);
    this.placeholder = options.placeholder;
    this.multiline = options.multiline ?? false;
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
