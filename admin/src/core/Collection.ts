import type { AnyField } from './fields';
import { MarkdownField } from './fields';
import type { BlockDefinition } from './blocks';

export interface SlugContext {
  fields: Record<string, unknown>;
  date: string;
}

export interface CollectionOptions {
  /** Machine name — used in URLs and as the collection identifier. */
  name: string;
  /** Display label (defaults to a title-cased name). */
  label?: string;
  /** Repo-relative directory where entries live. */
  folder: string;
  /** File extension for entries (default: 'md'). */
  extension?: string;
  /** Frontmatter fields, in display order. */
  frontmatter: AnyField[];
  /** Body field (typically a MarkdownField). */
  body?: MarkdownField;
  /** Blocks available inside the body. Falls back to body.blocks if set. */
  blocks?: BlockDefinition[];
  /** Build the filename stem (without extension) for a new entry. */
  slug?: (ctx: SlugContext) => string;
  /** Show this field's value as the entry's display title in the list. */
  titleField?: string;
  /** Optional description surfaced in the UI. */
  description?: string;
}

/**
 * A Collection is a named group of entries on disk sharing a schema.
 * Everything about "what a letter looks like" is declared here; the
 * editor, storage layer, and list view all drive off this object.
 */
export class Collection {
  readonly name: string;
  readonly label: string;
  readonly folder: string;
  readonly extension: string;
  readonly frontmatter: AnyField[];
  readonly body: MarkdownField;
  readonly blocks: BlockDefinition[];
  readonly slug: (ctx: SlugContext) => string;
  readonly titleField: string;
  readonly description?: string;

  constructor(options: CollectionOptions) {
    this.name = options.name;
    this.label = options.label ?? titleCase(options.name);
    this.folder = stripSlashes(options.folder);
    this.extension = options.extension ?? 'md';
    this.frontmatter = options.frontmatter;
    this.body = options.body ?? new MarkdownField('body');
    this.blocks = options.blocks ?? this.body.blocks;
    this.slug = options.slug ?? defaultSlug;
    this.titleField = options.titleField ?? 'title';
    this.description = options.description;
  }

  findField(name: string): AnyField | undefined {
    return this.frontmatter.find((f) => f.name === name);
  }
}

export function defineCollection(options: CollectionOptions): Collection {
  return new Collection(options);
}

function defaultSlug({ fields, date }: SlugContext): string {
  const slug = String(fields.slug ?? fields.title ?? 'untitled');
  return `${date}-${slug}`;
}

function titleCase(s: string): string {
  return s.replace(/(?:^|[-_\s])(\w)/g, (_, c: string) => ' ' + c.toUpperCase()).trim();
}

function stripSlashes(s: string): string {
  return s.replace(/^\/+|\/+$/g, '');
}
