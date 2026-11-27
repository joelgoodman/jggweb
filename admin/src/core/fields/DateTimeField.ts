import { Field, type FieldOptions } from './Field';

export interface DateTimeFieldOptions extends FieldOptions<string> {
  /** If true, value is stored as full ISO with milliseconds + Z suffix. */
  iso?: boolean;
}

/** A calendar date with no time, e.g. `2024-02-22`. */
export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Stores datetimes as ISO strings. Existing letters use the shape
 * `2024-02-22T13:38:16.000Z` — that's the default output. A date-only
 * value stays date-only.
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
    if (isDateOnly(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
}
