import type { FileContent, FileRef, StorageAdapter, WriteOptions } from './StorageAdapter';

export interface GitHubAdapterOptions {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  author?: { name: string; email: string };
}

interface ContentEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

interface ContentFile extends ContentEntry {
  type: 'file';
  content?: string;
  encoding?: string;
}

const API = 'https://api.github.com';

export class GitHubAdapter implements StorageAdapter {
  constructor(private readonly opts: GitHubAdapterOptions) {}

  async list(
    folder: string,
    { extensions, branch }: { extensions?: string[]; branch?: string } = {},
  ): Promise<FileRef[]> {
    // A missing folder is a valid state for a brand-new collection —
    // the first entry authored through the CMS will create it. Treat
    // 404 as an empty list instead of bubbling the error up to the UI.
    let entries: ContentEntry[] = [];
    try {
      entries =
        (await this.api<ContentEntry[]>(
          `/contents/${encode(folder)}?ref=${branch ?? this.opts.branch}`,
        )) ?? [];
    } catch (err) {
      if (err instanceof GitHubNotFound) return [];
      throw err;
    }
    const files = entries.filter((e) => e.type === 'file');
    const filtered = extensions?.length
      ? files.filter((f) => extensions.some((ext) => f.name.endsWith(`.${ext}`)))
      : files;
    return filtered.map((f) => ({ path: f.path, name: f.name, sha: f.sha, size: f.size }));
  }

  async read(path: string, { branch }: { branch?: string } = {}): Promise<FileContent> {
    const file = await this.api<ContentFile>(`/contents/${encode(path)}?ref=${branch ?? this.opts.branch}`);
    if (!file.content || file.encoding !== 'base64') {
      throw new Error(`Unexpected response for ${path}`);
    }
    return { path: file.path, sha: file.sha, content: base64DecodeUtf8(file.content) };
  }

  async write(path: string, content: string, opts: WriteOptions): Promise<FileContent> {
    const body = {
      message: opts.message,
      branch: opts.branch ?? this.opts.branch,
      content: base64EncodeUtf8(content),
      sha: opts.sha,
      ...(this.opts.author ? { author: this.opts.author, committer: this.opts.author } : {}),
    };
    const res = await this.api<{ content: ContentFile }>(`/contents/${encode(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return { path: res.content.path, sha: res.content.sha, content };
  }

  async uploadBinary(path: string, data: ArrayBuffer, opts: WriteOptions): Promise<FileContent> {
    const body = {
      message: opts.message,
      branch: opts.branch ?? this.opts.branch,
      content: base64EncodeBytes(new Uint8Array(data)),
      sha: opts.sha,
      ...(this.opts.author ? { author: this.opts.author, committer: this.opts.author } : {}),
    };
    const res = await this.api<{ content: ContentFile }>(`/contents/${encode(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return { path: res.content.path, sha: res.content.sha, content: '' };
  }

  async delete(path: string, opts: WriteOptions): Promise<void> {
    if (!opts.sha) throw new Error('delete requires a sha');
    const body = {
      message: opts.message,
      branch: opts.branch ?? this.opts.branch,
      sha: opts.sha,
      ...(this.opts.author ? { author: this.opts.author, committer: this.opts.author } : {}),
    };
    await this.api<unknown>(`/contents/${encode(path)}`, {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  }

  /** SHA of a branch's tip, or null if the branch doesn't exist. */
  async getBranchSha(branch: string): Promise<string | null> {
    try {
      const ref = await this.api<{ object: { sha: string } }>(`/git/ref/${encode(`heads/${branch}`)}`);
      return ref.object.sha;
    } catch (err) {
      if (err instanceof GitHubNotFound) return null;
      throw err;
    }
  }

  /** Create a new branch pointing at `fromSha`. */
  async createBranch(branch: string, fromSha: string): Promise<void> {
    await this.api<unknown>('/git/refs', {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }),
    });
  }

  /** Delete a branch. An already-missing branch is not an error. */
  async deleteBranch(branch: string): Promise<void> {
    try {
      await this.api<unknown>(`/git/refs/${encode(`heads/${branch}`)}`, { method: 'DELETE' });
    } catch (err) {
      if (err instanceof GitHubNotFound) return;
      throw err;
    }
  }

  /** Branch names under `refs/heads/<prefix>` (prefix without leading/trailing slashes). */
  async listBranches(prefix: string): Promise<string[]> {
    try {
      const refs = await this.api<{ ref: string }[]>(`/git/matching-refs/${encode(`heads/${prefix}`)}`);
      return refs.map((r) => r.ref.replace(/^refs\/heads\//, ''));
    } catch (err) {
      if (err instanceof GitHubNotFound) return [];
      throw err;
    }
  }

  /**
   * Merge `head` into `base`. Returns 'merged' when a merge commit was
   * made, 'up-to-date' when base already contains everything on head
   * (GitHub replies 204 rather than creating an empty merge commit).
   * Throws MergeConflict on a real conflict (409) instead of the
   * generic error `api()` would raise, so callers can show a
   * publish-specific message.
   */
  async merge(base: string, head: string, message: string): Promise<'merged' | 'up-to-date'> {
    const { owner, repo, token } = this.opts;
    const res = await fetch(`${API}/repos/${owner}/${repo}/merges`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base, head, commit_message: message }),
    });
    if (res.status === 201) return 'merged';
    if (res.status === 204) return 'up-to-date';
    if (res.status === 409) throw new MergeConflict(base, head);
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${text}`);
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { owner, repo, token } = this.opts;
    const res = await fetch(`${API}/repos/${owner}/${repo}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 404) throw new GitHubNotFound(path);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

export class GitHubNotFound extends Error {
  constructor(public readonly path: string) {
    super(`Not found: ${path}`);
  }
}

export class MergeConflict extends Error {
  constructor(public readonly base: string, public readonly head: string) {
    super(`Merge conflict merging ${head} into ${base}`);
  }
}

function encode(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return base64EncodeBytes(bytes);
}

function base64EncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64DecodeUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
