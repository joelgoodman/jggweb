import { Field, type FieldOptions } from './Field';

export interface ImageFieldOptions extends FieldOptions<string> {
  /** Directory (relative to repo root) where uploaded files are written. */
  directory: string;
  /**
   * Public URL prefix prepended to the stored filename at render time. If
   * left undefined, the frontmatter stores the filename only — matching the
   * site's existing convention (`cover.image: filename.jpg`).
   */
  publicPath?: string;
  /** Accepted MIME types for upload. */
  accept?: string[];
}

export class ImageField extends Field<string> {
  readonly type = 'image';
  readonly directory: string;
  readonly publicPath?: string;
  readonly accept: string[];

  constructor(name: string, options: ImageFieldOptions) {
    super(name, options);
    this.directory = options.directory.replace(/^\/+|\/+$/g, '');
    this.publicPath = options.publicPath;
    this.accept = options.accept ?? ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
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
