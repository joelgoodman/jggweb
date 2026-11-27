import { describe, it, expect } from 'vitest';
import { diffFields, newFrontmatter, validateEntry } from '../src/core/changes';
import { fields } from '../src/core/fields';
import { updateEntry, InvalidFrontMatterError } from '../src/core/frontmatter';

const schema = [
  fields.text('title', { required: true }), fields.datetime('date'), fields.boolean('draft'), fields.list('tags'),
  fields.object('cover', { fields: [fields.text('image'), fields.text('alt')] }),
];
const raw = { title: 'T', date: '2024-02-22', draft: true, tags: ['a', 'b'], cover: { image: 'a.jpg', focus: { x: 0.5 } } };
const load = (fm: Record<string, unknown>) => Object.fromEntries(schema.map((f) => [f.name, f.deserialize(fm[f.name])]));
const diff = (edit: object, fm: Record<string, unknown> = raw) => diffFields(schema, load(fm), { ...load(fm), ...edit }, fm);

describe('diffFields', () => {
  it('reports nothing for an untouched entry', () => expect(diff({})).toEqual([]));
  it('reports a changed field', () => expect(diff({ title: 'U' })).toEqual([{ path: ['title'], value: 'U' }]));
  it('reports only the changed child', () =>
    expect(diff({ cover: { image: 'a.jpg', alt: 'A' } })).toEqual([{ path: ['cover', 'alt'], value: 'A' }]));
  it('writes false over an existing checkbox', () => expect(diff({ draft: false })).toEqual([{ path: ['draft'], value: false }]));
  it('adds no false for an absent checkbox', () => expect(diff({ draft: false }, { title: 'T' })).toEqual([]));
  it('removes a cleared field', () => expect(diff({ title: '' })).toEqual([{ path: ['title'], value: undefined }]));
  it('writes lists as arrays', () => expect(diff({ tags: 'a, b, c' })).toEqual([{ path: ['tags'], value: ['a', 'b', 'c'] }]));
  it('keeps a date-only value date-only', () => expect(diff({ date: '2024-03-01' })).toEqual([{ path: ['date'], value: '2024-03-01' }]));

  it('writes an edited date and time as ISO', () =>
    expect(diff({ date: '2024-03-01T10:00:00Z' })).toEqual([{ path: ['date'], value: '2024-03-01T10:00:00.000Z' }]));
  it('removes a cleared list', () => expect(diff({ tags: '' })).toEqual([{ path: ['tags'], value: undefined }]));
  it('ignores list punctuation that leaves the items alone', () => expect(diff({ tags: 'a,b, ' })).toEqual([]));
  it('sends nothing for a field that stays out of the file', () =>
    expect(diff({ tags: ' , ' }, { title: 'T' })).toEqual([]));

  for (const cover of ['photo.jpg', ['a.jpg', 'b.jpg'], null]) {
    it(`reports nothing for an untouched object stored as ${JSON.stringify(cover)}`, () =>
      expect(diff({}, { title: 'T', cover })).toEqual([]));
  }
  it('leaves an edit under a text parent for updateEntry to refuse', () => {
    const changes = diff({ cover: { image: '', alt: 'A' } }, { cover: 'photo.jpg' });
    expect(changes).toEqual([{ path: ['cover', 'alt'], value: 'A' }]);
    expect(() => updateEntry('---\ncover: photo.jpg\n---\n', changes)).toThrow(InvalidFrontMatterError);
  });
});

describe('validateEntry', () => {
  it('requires a field that had a value', () => expect(validateEntry(schema, { ...load(raw), title: '' }, raw, false)).toBe('title is required'));
  it('lets an older file without it save', () => expect(validateEntry(schema, load({}), {}, false)).toBeNull());
  it('requires it on new entries', () => expect(validateEntry(schema, load({}), {}, true)).toBe('title is required'));

  const nested = [
    fields.object('cover', { fields: [fields.text('image', { required: true })] }),
    fields.list('tags', { required: true }),
    fields.slug('slug'),
  ];
  const check = (edit: object, fm: Record<string, unknown>, isNew = false) => {
    const loaded = Object.fromEntries(nested.map((f) => [f.name, f.deserialize(fm[f.name])]));
    return validateEntry(nested, { ...loaded, ...edit }, fm, isNew);
  };
  it('applies the same rule to object children', () => {
    expect(check({ cover: { image: '' } }, { cover: { image: 'a.jpg' } })).toBe('image is required');
    expect(check({}, {})).toBeNull();
  });
  it('treats a list with no items as empty', () =>
    expect(check({ tags: ' , ' }, { tags: ['a'] })).toBe('tags is required'));
  it('lets a file with an empty list save', () => expect(check({}, { tags: [] })).toBeNull());
  it('does not check the format of an untouched value', () => expect(check({}, { slug: 'Old_Slug' })).toBeNull());
  it('checks the format of an edited value', () =>
    expect(check({ slug: 'New Slug' }, { slug: 'Old_Slug' })).toMatch(/Slug may only contain/));
});

describe('newFrontmatter', () => {
  it('writes only filled fields', () =>
    expect(newFrontmatter(schema, { ...load({}), title: 'T', tags: 'a, b' })).toEqual({ title: 'T', tags: ['a', 'b'] }));
  it('keeps the filled children of an object', () =>
    expect(newFrontmatter(schema, { ...load({}), cover: { image: 'a.jpg', alt: '' } })).toEqual({ cover: { image: 'a.jpg' } }));
});

describe('list field', () => {
  const list = fields.list('tags');
  it('reads an array or a string as text', () => {
    expect(list.deserialize(['a', 'b'])).toBe('a, b');
    expect(list.deserialize('a, b')).toBe('a, b');
    expect(list.deserialize(undefined)).toBe('');
  });
});
