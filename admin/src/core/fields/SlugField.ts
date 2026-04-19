import { Field, type FieldOptions } from './Field';

export interface SlugFieldOptions extends FieldOptions<string> {
  /** Name of the sibling field to auto-derive the slug from. */
  from?: string;
}

export class SlugField extends Field<string> {
  readonly type = 'slug';
  readonly from?: string;

  constructor(name: string, options: SlugFieldOptions = {}) {
    super(name, options);
    this.from = options.from;
  }

  override defaultValue(): string {
    return this.options.default ?? '';
  }

  override deserialize(raw: unknown): string {
    return raw == null ? '' : String(raw);
  }

  override serialize(value: string): string {
    return slugify(value);
  }

  override validate(value: string): string | null {
    const base = super.validate(value);
    if (base) return base;
    if (value && !/^[a-z0-9-]+$/.test(value)) {
      return 'Slug may only contain lowercase letters, numbers, and hyphens';
    }
    return null;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
