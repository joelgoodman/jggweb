import { Field, type FieldOptions } from './Field';

export interface BooleanFieldOptions extends FieldOptions<boolean> {
  /** Label rendered next to the checkbox itself, separate from the
   *  field's sidebar heading. Leave blank to reuse the field label. */
  checkboxLabel?: string;
}

/**
 * A boolean flag stored in frontmatter as `true` / `false`. Serializes
 * to `undefined` when false so the written YAML stays terse — a flag
 * only appears in the file once it's been flipped on. That keeps old
 * entries clean (no `draft: false` clutter) while new drafts emit
 * `draft: true` and survive the CMS round-trip.
 */
export class BooleanField extends Field<boolean> {
  readonly type = 'boolean';
  readonly checkboxLabel?: string;

  constructor(name: string, options: BooleanFieldOptions = {}) {
    super(name, options);
    this.checkboxLabel = options.checkboxLabel;
  }

  override defaultValue(): boolean {
    return this.options.default ?? false;
  }

  override deserialize(raw: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') return raw === 'true' || raw === 'yes' || raw === '1';
    return false;
  }

  override serialize(value: boolean): boolean | undefined {
    // Emit the key only when the flag is on — an off boolean is the
    // default and doesn't need to clutter the frontmatter.
    return value ? true : undefined;
  }

  override validate(_value: boolean): string | null {
    // Booleans can't really be required in the "must be checked" sense
    // without confusing UX; skip the base-class required check.
    return null;
  }
}
