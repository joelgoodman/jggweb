import { Field, type FieldOptions } from './Field';

export interface ObjectFieldOptions<T extends Record<string, unknown>> extends FieldOptions<T> {
  fields: Field[];
  collapsed?: boolean;
}

/**
 * Groups child fields under a single frontmatter key. Serializes to a
 * plain object; deserializes by dispatching to each child field's own
 * deserialize method. Supports arbitrary nesting.
 */
export class ObjectField<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends Field<T> {
  readonly type = 'object';
  readonly fields: Field[];
  readonly collapsed: boolean;

  constructor(name: string, options: ObjectFieldOptions<T>) {
    super(name, options);
    this.fields = options.fields;
    this.collapsed = options.collapsed ?? false;
  }

  override defaultValue(): T {
    const out: Record<string, unknown> = {};
    for (const f of this.fields) out[f.name] = f.defaultValue();
    return out as T;
  }

  override deserialize(raw: unknown): T {
    const input = (raw ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const f of this.fields) out[f.name] = f.deserialize(input[f.name]);
    return out as T;
  }

  override serialize(value: T): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of this.fields) {
      const v = f.serialize((value as Record<string, unknown>)[f.name]);
      if (v !== '' && v !== null && v !== undefined) out[f.name] = v;
    }
    return out;
  }

  override validate(value: T): string | null {
    for (const f of this.fields) {
      const err = f.validate((value as Record<string, unknown>)[f.name]);
      if (err) return err;
    }
    return null;
  }
}
