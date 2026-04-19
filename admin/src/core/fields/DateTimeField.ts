import { Field, type FieldOptions } from './Field';

export interface DateTimeFieldOptions extends FieldOptions<string> {
  /** If true, value is stored as full ISO with milliseconds + Z suffix. */
  iso?: boolean;
}

/**
 * Stores datetimes as ISO strings. Existing letters use the shape
 * `2024-02-22T13:38:16.000Z` — that's the default output.
 */
export class DateTimeField extends Field<string> {
  readonly type = 'datetime';
  readonly iso: boolean;

  constructor(name: string, options: DateTimeFieldOptions = {}) {
    super(name, options);
    this.iso = options.iso ?? true;
  }

  override defaultValue(): string {
    return this.options.default ?? new Date().toISOString();
  }

  override deserialize(raw: unknown): string {
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw === 'string' && raw.length) return raw;
    return '';
  }

  override serialize(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
}
