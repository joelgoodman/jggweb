import { TextField, type TextFieldOptions } from './TextField';
import { SlugField, type SlugFieldOptions } from './SlugField';
import { DateTimeField, type DateTimeFieldOptions } from './DateTimeField';
import { ImageField, type ImageFieldOptions } from './ImageField';
import { ObjectField, type ObjectFieldOptions } from './ObjectField';
import { MarkdownField, type MarkdownFieldOptions } from './MarkdownField';
import type { Field } from './Field';

export { Field } from './Field';
export type { FieldOptions } from './Field';
export { TextField, SlugField, DateTimeField, ImageField, ObjectField, MarkdownField };
export { slugify } from './SlugField';

/**
 * Ergonomic factory namespace — the authoring surface for schema.ts
 * config files. Using a single `fields.text(...)` namespace keeps
 * collection definitions readable and gives us a natural place to hang
 * new field types without importing each class by name.
 */
export const fields = {
  text: (name: string, options?: TextFieldOptions) => new TextField(name, options),
  slug: (name: string, options?: SlugFieldOptions) => new SlugField(name, options),
  datetime: (name: string, options?: DateTimeFieldOptions) => new DateTimeField(name, options),
  image: (name: string, options: ImageFieldOptions) => new ImageField(name, options),
  object: <T extends Record<string, unknown>>(name: string, options: ObjectFieldOptions<T>) =>
    new ObjectField<T>(name, options),
  markdown: (name: string, options?: MarkdownFieldOptions) => new MarkdownField(name, options),
} as const;

export type AnyField = Field<unknown>;
