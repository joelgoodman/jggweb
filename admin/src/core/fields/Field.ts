export interface FieldOptions<T = unknown> {
  label?: string;
  required?: boolean;
  hint?: string;
  default?: T;
}

/**
 * Base class every field inherits from. Subclasses define how a value
 * round-trips between raw YAML frontmatter and the editor's in-memory
 * representation, plus which UI component renders the input.
 */
export abstract class Field<T = unknown> {
  abstract readonly type: string;

  constructor(
    public readonly name: string,
    public readonly options: FieldOptions<T> = {},
  ) {}

  get label(): string {
    return this.options.label ?? this.name;
  }

  get required(): boolean {
    return this.options.required ?? false;
  }

  get hint(): string | undefined {
    return this.options.hint;
  }

  defaultValue(): T {
    return this.options.default as T;
  }

  /** Convert raw frontmatter value → editor value. */
  deserialize(raw: unknown): T {
    return raw as T;
  }

  /** Convert editor value → frontmatter-writable value. */
  serialize(value: T): unknown {
    return value;
  }

  validate(value: T): string | null {
    if (this.required && (value === null || value === undefined || value === '')) {
      return `${this.label} is required`;
    }
    return null;
  }
}
