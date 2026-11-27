import { describe, it, expect, vi, afterEach } from 'vitest';
import { GitHubAdapter } from '../src/core/storage';

const adapter = () => new GitHubAdapter({ owner: 'o', repo: 'r', branch: 'main', token: 't' });
const fileReply = (bytes: Uint8Array) =>
  new Response(
    JSON.stringify({ path: 'posts/a.md', sha: 's', encoding: 'base64', content: Buffer.from(bytes).toString('base64') }),
    { status: 200 },
  );

afterEach(() => vi.unstubAllGlobals());

describe('reading files', () => {
  it('keeps a byte-order mark and writes it back byte for byte', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from('---\ntitle: T\n---\nBody\n')]);
    let written: Buffer | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') {
        written = Buffer.from(JSON.parse(String(init.body)).content, 'base64');
        return new Response(JSON.stringify({ content: { path: 'posts/a.md', sha: 's2' } }), { status: 200 });
      }
      return fileReply(bytes);
    });
    const file = await adapter().read('posts/a.md');
    expect(file.content.startsWith('﻿---')).toBe(true);
    await adapter().write('posts/a.md', file.content, { message: 'm', sha: file.sha });
    expect([...written!]).toEqual([...bytes]);
  });

  it('refuses a file that is not UTF-8 instead of replacing its bytes', async () => {
    vi.stubGlobal('fetch', async () => fileReply(new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x0a])));
    await expect(adapter().read('posts/a.md')).rejects.toThrow(/isn't UTF-8 text/);
  });

  it('opens an empty file', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ path: 'posts/a.md', sha: 's', encoding: 'base64', content: '' }), { status: 200 }));
    expect((await adapter().read('posts/a.md')).content).toBe('');
  });
});

describe('listing branches', () => {
  it('asks for 100 at a time and follows every next page', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const page = new URL(url).searchParams.get('page') ?? '1';
      const refs = [{ ref: `refs/heads/draft/posts/p${page}` }];
      const link = page === '1' ? `<${url.replace('per_page=100', 'per_page=100&page=2')}>; rel="next", <x>; rel="last"` : '';
      return new Response(JSON.stringify(refs), { status: 200, headers: link ? { Link: link } : {} });
    });
    expect(await adapter().listBranches('draft/posts')).toEqual(['draft/posts/p1', 'draft/posts/p2']);
    expect(urls[0]).toContain('per_page=100');
    expect(urls).toHaveLength(2);
  });

  it('does not follow a next page on another host', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return new Response('[]', { status: 200, headers: { Link: '<https://evil.example/x>; rel="next"' } });
    });
    expect(await adapter().listBranches('draft/posts')).toEqual([]);
    expect(urls).toHaveLength(1);
  });
});
