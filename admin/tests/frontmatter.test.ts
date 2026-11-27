import { describe, it, expect } from 'vitest';
import { parseEntry, updateEntry, InvalidFrontMatterError } from '../src/core/frontmatter';

const raw = `---
title: Old   # keep me
date: 2024-02-22
excerpt: >-
  two
  lines
cover:
  image: a.jpg
  focus:
    x: 0.5
published: false
note: ""
---

Body *here*.
`;
const set = (path: string[], value: unknown) => [{ path, value }];

describe('updateEntry', () => {
  it('returns the file untouched with no changes', () => expect(updateEntry(raw, [])).toBe(raw));
  it('rewrites one key and keeps its comment', () =>
    expect(updateEntry(raw, set(['title'], 'New'))).toBe(raw.replace('title: Old', 'title: New')));
  it('replaces a block scalar only', () =>
    expect(updateEntry(raw, set(['excerpt'], 'one'))).toBe(raw.replace('excerpt: >-\n  two\n  lines', 'excerpt: one')));
  it('adds a nested key without dropping siblings', () =>
    expect(updateEntry(raw, set(['cover', 'alt'], 'Alt'))).toBe(raw.replace('    x: 0.5\n', '    x: 0.5\n  alt: Alt\n')));
  it('removes a key', () =>
    expect(updateEntry(raw, set(['note'], undefined))).toBe(raw.replace('note: ""\n', '')));
  it('creates a missing parent at the end of the front matter', () =>
    expect(updateEntry(raw, set(['seo', 'title'], 'S'))).toBe(raw.replace('note: ""\n', 'note: ""\nseo:\n  title: S\n')));
  it('removes a parent left empty', () =>
    expect(updateEntry('---\na: 1\nseo:\n  title: X\n---\n\nB\n', set(['seo', 'title'], undefined))).toBe('---\na: 1\n---\n\nB\n'));
  it('writes arrays as block lists', () =>
    expect(updateEntry('---\ntags:\n  - x\n---\n', set(['tags'], ['a', 'b']))).toBe('---\ntags:\n  - a\n  - b\n---\n'));
  it('replaces only the body', () =>
    expect(updateEntry(raw, [], 'New body')).toBe(raw.replace('Body *here*.', 'New body')));
  it('leaves a file without front matter alone', () => expect(updateEntry('Just text\n', [])).toBe('Just text\n'));
  it('adds front matter only when a field is filled', () =>
    expect(updateEntry('Just text\n', set(['title'], 'T'))).toBe('---\ntitle: T\n---\n\nJust text\n'));
  it('keeps CRLF, including in a new body', () => {
    const crlf = raw.replace(/\n/g, '\r\n');
    expect(updateEntry(crlf, set(['title'], 'New'), 'a\nb')).toBe(
      crlf.replace('title: Old', 'title: New').replace('Body *here*.', 'a\r\nb'));
  });
  it('reads and keeps a BOM', () => {
    expect(parseEntry('﻿' + raw).frontmatter.title).toBe('Old');
    expect(updateEntry('﻿' + raw, set(['title'], 'New'))).toBe('﻿' + raw.replace('title: Old', 'title: New'));
  });
});

describe('parseEntry', () => {
  it('treats a leading divider as body', () => {
    const text = '---\nsome text\n---\nmore\n';
    expect(parseEntry(text)).toEqual({ frontmatter: {}, body: text });
  });
  it('throws on invalid YAML', () =>
    expect(() => parseEntry('---\ntitle: "x\n---\n')).toThrow(InvalidFrontMatterError));
});

describe('updateEntry comment and safety edges', () => {
  it('keeps a same-line comment out of a new multi-line value', () =>
    expect(updateEntry('---\na: x # c\n---\n', set(['a'], 'y\nz'))).toBe('---\na: |- # c\n  y\n  z\n---\n'));
  it('keeps the comments around a replaced list', () =>
    expect(updateEntry('---\nt: # head\n  - x\n# next\nn: 1\n---\n', set(['t'], ['y']))).toBe(
      '---\nt: # head\n  - y\n# next\nn: 1\n---\n'));
  it('refuses to write front matter it could not read back', () =>
    expect(() => updateEntry('---\na: &x 1\nb: *x\n---\n', set(['a'], 2))).toThrow(InvalidFrontMatterError));
  it('refuses to splice inline front matter', () =>
    expect(() => updateEntry('---\n{a: 1, b: 2}\n---\n', set(['a'], undefined))).toThrow(InvalidFrontMatterError));
});
