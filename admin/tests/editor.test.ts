// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';

// The body editor is Milkdown; these tests only need to feed it text.
const editor = vi.hoisted(() => ({ type: (_markdown: string) => {} }));
vi.mock('../src/ui/fields/MarkdownInput.svelte', () => ({
  default: (_anchor: unknown, props: { onChange: (v: string) => void }) => {
    editor.type = (markdown) => props.onChange(markdown);
  },
}));

/** Enough of the GitHub API for the editor: branches, files and merges. */
function fakeGitHub() {
  const branches = new Map<string, Map<string, { content: string; sha: string }>>([['main', new Map()]]);
  const writes: { path: string; branch: string; sha?: string; content: string }[] = [];
  const merges: string[] = [];
  let shas = 0;
  let hold: Promise<void> | undefined;
  let failWrite = false;
  const reply = (status: number, body?: unknown) =>
    new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status });

  async function fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const path = decodeURIComponent(new URL(url).pathname.replace('/repos/o/r', ''));
    const sent = init.body ? JSON.parse(String(init.body)) : {};
    if (path.startsWith('/git/ref/heads/')) {
      return branches.has(path.slice(15)) ? reply(200, { object: { sha: 'head' } }) : reply(404);
    }
    if (path === '/git/refs') {
      branches.set(sent.ref.slice(11), new Map(branches.get('main')));
      return reply(201);
    }
    if (path.startsWith('/git/refs/heads/')) {
      branches.delete(path.slice(16));
      return reply(204);
    }
    if (path === '/merges') {
      if (!branches.has(sent.head)) return reply(404);
      merges.push(sent.head);
      return reply(201);
    }
    const file = path.slice('/contents/'.length);
    if (init.method === 'PUT') {
      await hold;
      if (failWrite) return reply(500);
      const files = branches.get(sent.branch)!;
      if (files.get(file)?.sha !== sent.sha) return reply(409);
      const content = Buffer.from(sent.content, 'base64').toString();
      const sha = `sha${++shas}`;
      files.set(file, { content, sha });
      writes.push({ path: file, branch: sent.branch, sha: sent.sha, content });
      return reply(200, { content: { path: file, sha } });
    }
    const found = branches.get(new URL(url).searchParams.get('ref') ?? 'main')?.get(file);
    if (!found) return reply(404);
    return reply(200, {
      path: file, sha: found.sha, encoding: 'base64', content: Buffer.from(found.content).toString('base64'),
    });
  }

  return {
    fetch,
    writes,
    merges,
    branches,
    add: (path: string, content: string) => branches.get('main')!.set(path, { content, sha: `sha${++shas}` }),
    holdWrites() {
      let release!: () => void;
      hold = new Promise((resolve) => (release = resolve));
      return release;
    },
    failWrites: () => (failWrite = true),
  };
}

let github: ReturnType<typeof fakeGitHub>;
let App: typeof import('../src/ui/App.svelte').default;
let app: object | undefined;
let confirmLeave: ReturnType<typeof vi.fn>;

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r));
  flushSync();
};
const visit = async (hash: string) => {
  location.hash = hash;
  await settle();
};
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent!.trim() === text)!;
const click = async (text: string) => {
  button(text).click();
  await settle();
};
const input = (name: string) => document.querySelector<HTMLInputElement>(`[data-field-name="${name}"] input`)!;
const title = () => document.querySelector<HTMLTextAreaElement>('textarea.editor-title')!;
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};
const blur = (el: HTMLElement) => {
  el.dispatchEvent(new FocusEvent('focus'));
  el.dispatchEvent(new FocusEvent('blur'));
  flushSync();
};
/** Whether closing the tab would warn about unsaved changes. */
const isDirty = () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
const toast = () => document.body.textContent!;

beforeAll(async () => {
  localStorage.setItem('decibel-cms:token', JSON.stringify({ token: 'fake', owner: 'o', repo: 'r', branch: 'main' }));
  App = (await import('../src/ui/App.svelte')).default;
});
beforeEach(() => {
  github = fakeGitHub();
  vi.stubGlobal('fetch', github.fetch);
  confirmLeave = vi.fn(() => false);
  vi.stubGlobal('confirm', confirmLeave);
});
afterEach(async () => {
  if (app) unmount(app);
  app = undefined;
  await visit('');
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
async function open(hash: string) {
  await visit(hash);
  app = mount(App, { target: document.body });
  await settle();
}

describe('a new entry', () => {
  async function startSaving() {
    await open('#/speaking_events/new');
    type(title(), 'Hello');
    type(input('event_name'), 'Event');
    const release = github.holdWrites();
    await click('Save');
    return release;
  }

  it('keeps text typed during its first save and carries on as that file', async () => {
    const release = await startSaving();
    const titleEl = title();
    type(titleEl, 'Hello again');
    editor.type('Typed while saving.');
    release();
    await settle();

    const { path, branch } = github.writes[0];
    const slug = path.slice('speaking_events/'.length, -'.md'.length);
    expect(slug).toMatch(/^\d{4}-\d{2}-hello$/);
    expect(confirmLeave).not.toHaveBeenCalled();
    expect(location.hash).toBe(`#/speaking_events/${slug}`);
    expect(title()).toBe(titleEl);
    expect(titleEl.value).toBe('Hello again');
    expect(isDirty()).toBe(true);

    await click('Save');
    expect(github.writes[1]).toMatchObject({ path, branch, sha: expect.any(String) });
    expect(github.writes[1].content).toContain('title: Hello again');
    expect(github.writes[1].content).toContain('Typed while saving.');
    expect([...github.branches.keys()]).toEqual(['main', branch]);
    expect(isDirty()).toBe(false);

    await click('Publish');
    expect(github.merges).toEqual([`draft/speaking_events/${slug}`]);
  });

  it('does not pull the writer back after they leave mid-save', async () => {
    const release = await startSaving();
    confirmLeave.mockReturnValue(true);
    await click('Speaking');
    release();
    await settle();
    expect(location.hash).toBe('#/speaking_events');
  });

  it('starts blank when the writer returns to the new-entry address', async () => {
    (await startSaving())();
    await settle();
    await visit('#/speaking_events/new');
    expect(title().value).toBe('');
  });
});

describe('an existing entry', () => {
  const path = 'speaking_events/old.md';
  const file = '---\ntitle: T\ndate: 2024-02-22\nevent_name: E\nslug: Old_Slug\n---\n\nBody.\n';
  beforeEach(async () => {
    github.add(path, file);
    await open('#/speaking_events/old');
  });

  it('keeps a non-conforming slug that was only focused', async () => {
    blur(input('slug'));
    expect(input('slug').value).toBe('Old_Slug');
    expect(isDirty()).toBe(false);
    await click('Save');
    expect(github.writes).toEqual([]);
  });

  it('tidies a slug that was typed in', () => {
    type(input('slug'), 'New Slug');
    blur(input('slug'));
    expect(input('slug').value).toBe('new-slug');
  });

  it('is clean after a save that finds nothing to write', async () => {
    editor.type('Body.\n\n\n');
    flushSync();
    expect(isDirty()).toBe(true);
    await click('Save');
    expect(toast()).toContain('No changes to save');
    expect(github.writes).toEqual([]);
    expect(isDirty()).toBe(false);
  });

  it('is not marked unpublished by a write that fails', async () => {
    github.failWrites();
    type(title(), 'U');
    await click('Save');
    expect(toast()).toContain('GitHub 500');
    expect(document.querySelector('.entry__badge')).toBeNull();
    expect(button('Publish').disabled).toBe(true);
    expect(isDirty()).toBe(true);
  });
});
