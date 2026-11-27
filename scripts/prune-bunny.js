// Removes files from Bunny Object Storage that the latest build no longer
// contains. Used by scripts/upload-to-bunny.js after the upload, so a page
// is never missing while its replacement is on the way.
//
// The storage zone also holds data written at runtime by
// scripts/edge/newsletter-signup.js. Those folders are never listed or
// deleted. Add any new runtime folder here before it starts being written.

export const PROTECTED_PREFIXES = ['newsletter-tokens/', 'newsletter-rate-limit/'];

const STORAGE_HOST = 'storage.bunnycdn.com';

const isProtected = (path) => PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

export function findStale(remoteFiles, localFiles) {
  const local = new Set(localFiles.map((f) => f.normalize('NFC')));
  return remoteFiles.filter((f) => !isProtected(f) && !local.has(f.normalize('NFC'))).sort();
}

function request({ zone, apiKey, fetch = globalThis.fetch }, path, method = 'GET') {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return fetch(`https://${STORAGE_HOST}/${zone}/${encoded}`, { method, headers: { AccessKey: apiKey } });
}

export async function listRemote(options, folder = '') {
  const res = await request(options, folder);
  if (!res.ok) throw new Error(`List failed for /${folder}: ${res.status} ${res.statusText}`);
  const files = [];
  for (const entry of await res.json()) {
    const path = `${folder}${entry.ObjectName}`;
    if (entry.IsDirectory) {
      if (!isProtected(`${path}/`)) files.push(...(await listRemote(options, `${path}/`)));
    } else if (!isProtected(path)) {
      files.push(path);
    }
  }
  return files;
}

/** Lists stale files and, only when `remove` is true, deletes them. */
export async function pruneRemote(localFiles, { remove = false, log = console.log, ...options }) {
  if (!localFiles.includes('index.html')) {
    throw new Error('Refusing to prune: the build has no index.html');
  }

  const stale = findStale(await listRemote(options), localFiles);
  log(`${stale.length} remote file(s) are not in this build.`);
  for (const path of stale) log(`  ${remove ? 'deleting' : 'stale'}: ${path}`);

  if (!remove) {
    if (stale.length) log('Nothing deleted. Set BUNNY_PRUNE=true to delete them.');
    return stale;
  }

  for (const path of stale) {
    const res = await request(options, path, 'DELETE');
    if (!res.ok && res.status !== 404) {
      throw new Error(`Delete failed for ${path}: ${res.status} ${res.statusText}`);
    }
  }
  return stale;
}
