import { describe, it, expect } from 'vitest';
import { rawFileUrl, safeFilename, UPLOAD_IMAGE_TYPES } from '../src/core/media';
import { fields } from '../src/core/fields';

describe('safeFilename', () => {
  it.each([
    ['My Photo (1).JPG', 'my-photo-1.jpg'],
    ['Ünïcode.png', 'n-code.png'],
    ['???.png', 'upload.png'],
    ['no-extension', 'no-extension'],
    ['.png', 'upload.png'],
    ['odd.p n?g', 'odd.png'],
  ])('names %j %j', (name, safe) => expect(safeFilename(name)).toBe(safe));
});

describe('uploads', () => {
  it('take raster images only, in the body and in image fields', () => {
    expect(UPLOAD_IMAGE_TYPES).not.toContain('image/svg+xml');
    expect(fields.image('cover', { directory: 'assets/img' }).accept).toEqual(UPLOAD_IMAGE_TYPES);
  });
});

describe('rawFileUrl', () => {
  it('escapes the owner, repository, branch and path, keeping their slashes', () =>
    expect(rawFileUrl({ owner: 'me', repo: 'my site', branch: 'feature/a#b' }, 'assets/img/a b.jpg')).toBe(
      'https://raw.githubusercontent.com/me/my%20site/feature/a%23b/assets/img/a%20b.jpg',
    ));
});
