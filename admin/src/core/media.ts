/**
 * Image types a writer may upload: raster formats only. An SVG can carry
 * script, and the site serves the CMS from the same origin (/admin/), where
 * the CMS keeps the GitHub token, so an uploaded SVG could run there.
 */
export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

/**
 * A file name safe in a repository and a URL: lowercase letters, digits and
 * hyphens, then the extension. A name with nothing left is `upload`. Matches
 * the existing convention in assets/img/ (e.g. `kiev-12.jpg`).
 */
export function safeFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (safe || 'upload') + (ext ? `.${ext}` : '');
}

/** A file's URL on GitHub, which works only for a public repository. */
export function rawFileUrl({ owner, repo, branch }: { owner: string; repo: string; branch: string }, path: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodePath(branch)}/${encodePath(path)}`;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
