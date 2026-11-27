import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStale, listRemote, pruneRemote } from './prune-bunny.js';

const STORAGE = 'https://storage.bunnycdn.com/zone/';

/** A fake storage zone: keys are file paths. Records every DELETE. */
function fakeStorage(files, { failList } = {}) {
  const deleted = [];
  const fetch = async (url, { method = 'GET', headers } = {}) => {
    assert.equal(headers.AccessKey, 'key');
    const path = decodeURIComponent(url.slice(STORAGE.length));
    if (method === 'DELETE') {
      deleted.push(path);
      return new Response(null, { status: 200 });
    }
    if (failList === path) return new Response(null, { status: 500 });
    const names = new Map();
    for (const f of files.filter((f) => f.startsWith(path))) {
      const [head, ...rest] = f.slice(path.length).split('/');
      names.set(head, rest.length > 0);
    }
    return Response.json([...names].map(([ObjectName, IsDirectory]) => ({ ObjectName, IsDirectory })));
  };
  return { fetch, deleted };
}

const options = (storage, extra) => ({ zone: 'zone', apiKey: 'key', fetch: storage.fetch, log: () => {}, ...extra });
const local = ['index.html', 'assets/new.js', 'letters/a post/index.html'];
const remote = [
  ...local,
  'assets/old.js',
  'letters/gone/index.html',
  'newsletter-tokens/abc.json',
  'newsletter-rate-limit/_global.json',
];

test('stale files are those absent from the build, never runtime data', () => {
  assert.deepEqual(findStale(remote, local), ['assets/old.js', 'letters/gone/index.html']);
});

test('names that differ only in Unicode form are the same file', () => {
  assert.deepEqual(findStale(['café.jpg', 'index.html'], ['café.jpg', 'index.html']), []);
});

test('listing walks folders but never enters protected ones', async () => {
  const storage = fakeStorage(remote, { failList: 'newsletter-tokens/' });
  assert.deepEqual((await listRemote(options(storage))).sort(), [...local, 'assets/old.js', 'letters/gone/index.html'].sort());
});

test('reports without deleting unless told to', async () => {
  const storage = fakeStorage(remote);
  const stale = await pruneRemote(local, options(storage));
  assert.equal(stale.length, 2);
  assert.deepEqual(storage.deleted, []);
});

test('deletes only stale files when enabled', async () => {
  const storage = fakeStorage(remote);
  await pruneRemote(local, options(storage, { remove: true }));
  assert.deepEqual(storage.deleted.sort(), ['assets/old.js', 'letters/gone/index.html']);
});

test('encodes each path segment', async () => {
  const urls = [];
  const storage = fakeStorage(['index.html', 'a b/#1?.txt']);
  const fetch = (url, init) => (urls.push(url), storage.fetch(url, init));
  await pruneRemote(['index.html'], options({ fetch }, { remove: true }));
  assert.ok(urls.includes(`${STORAGE}a%20b/%231%3F.txt`));
});

test('refuses to prune against a build with no home page', async () => {
  const storage = fakeStorage(remote);
  await assert.rejects(pruneRemote([], options(storage, { remove: true })), /index\.html/);
  assert.deepEqual(storage.deleted, []);
});

test('deletes nothing when a listing fails', async () => {
  const storage = fakeStorage(remote, { failList: 'letters/' });
  await assert.rejects(pruneRemote(local, options(storage, { remove: true })), /500/);
  assert.deepEqual(storage.deleted, []);
});
