import { BooleanField, ListField, ObjectField, type AnyField } from './fields';
import type { FieldChange } from './frontmatter';

type Values = Record<string, unknown>;

/** An object field's values, or nothing when the file holds something else there. */
function asObject(value: unknown): Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Values) : {};
}

/** Not filled in: what `serialize` returns, or a file holds, for no value. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
}

/** Whether an edit left a field saying what it said before. */
function isUnchanged(field: AnyField, before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true;
  // Spacing and stray commas don't change a list.
  return field instanceof ListField &&
    JSON.stringify(field.serialize(before as string)) === JSON.stringify(field.serialize(after as string));
}

/**
 * The front matter edits that turn the loaded entry into the current one.
 * `loaded` and `current` are editor values; `raw` is the file's parsed front
 * matter. Only fields the writer changed are reported.
 */
export function diffFields(fields: AnyField[], loaded: Values, current: Values, raw: Values): FieldChange[] {
  return fields.flatMap((field): FieldChange[] => {
    const { name } = field;
    if (field instanceof ObjectField) {
      return diffFields(field.fields, asObject(loaded[name]), asObject(current[name]), asObject(raw[name]))
        .map(({ path, value }) => ({ path: [name, ...path], value }));
    }
    if (isUnchanged(field, loaded[name], current[name])) return [];

    const exists = Object.hasOwn(raw, name);
    let value = field.serialize(current[name]);
    // A checkbox already in the file is set to `false`, not removed.
    if (field instanceof BooleanField && exists) value = current[name] === true;
    if (isBlank(value)) value = undefined;
    if (value === undefined && !exists) return [];
    return [{ path: [name], value }];
  });
}

/** Front matter for a new file: filled fields only, in schema order. */
export function newFrontmatter(fields: AnyField[], values: Values): Values {
  const out: Values = {};
  for (const field of fields) {
    const value = field instanceof ObjectField
      ? newFrontmatter(field.fields, asObject(values[field.name]))
      : field.serialize(values[field.name]);
    const empty = isBlank(value) || (field instanceof ObjectField && !Object.keys(value as Values).length);
    if (!empty) out[field.name] = value;
  }
  return out;
}

/**
 * The first validation error, or null. New entries are checked in full. An
 * existing file is only held to what was edited, so an older one that lacks a
 * required field can still be saved.
 */
export function validateEntry(fields: AnyField[], current: Values, raw: Values, isNew: boolean): string | null {
  for (const field of fields) {
    const value = current[field.name];
    const original = raw[field.name];
    if (field instanceof ObjectField) {
      const error = validateEntry(field.fields, asObject(value), asObject(original), isNew);
      if (error) return error;
      continue;
    }
    if (!isNew) {
      if (isBlank(value) && isBlank(original)) continue;
      if (!isBlank(value) && Object.is(value, field.deserialize(original))) continue;
    }
    const error = field.validate(value);
    if (error) return error;
  }
  return null;
}
