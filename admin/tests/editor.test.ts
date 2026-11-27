// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';

// The body editor is Milkdown; these tests only need to feed it text. Like the
// real one, the stand-in reads `value` only as it mounts.
const editor = vi.hoisted(() => ({ type: (_markdown: string) => {}, shown: '', mounts: 0 }));
vi.mock('../src/ui/fields/MarkdownInput.svelte', () => ({
  default: (_anchor: unknown, props: { value: string; onChange: (v: string) => void }) => {
    editor.mounts++;
    editor.shown = props.value;
    editor.type = (markdown) => props.onChange(markdown);
  },
}));

/** Enough of the GitHub API for the editor: branches, files and merges. */
function fakeGitHub() {
  const branches = new Map<string, Map<string, { content: string; sha: string }>>([['main', new Map()]]);
  const writes: { path: string; branch: string; sha?: string; content: string }[] = [];
  const merges: string[] = [];
  let shas = 0;
  let held: { matches: (request: string) => boolean; until: Promise<void> } | undefined;
  let failWrite = false;
  const reply = (status: number, body?: unknown) =>
    new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status });

  async function fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const path = decodeURIComponent(new URL(url).pathname.replace('/repos/o/r', ''));
    const sent = init.body ? JSON.parse(String(init.body)) : {};
    if (held?.matches(`${init.method ?? 'GET'} ${path}`)) {
      const { until } = held;
      held = undefined;
      await until;
    }
    if (path.startsWith('/git/matching-refs/heads/')) {
      const prefix = path.slice('/git/matching-refs/heads/'.length);
      const refs = [...branches.keys()].filter((b) => b.startsWith(prefix)).map((b) => ({ ref: `refs/heads/${b}` }));
      return reply(200, refs);
    }
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
      if (failWrite) return reply(500);
      const files = branches.get(sent.branch)!;
      if (files.get(file)?.sha !== sent.sha) return reply(409);
      const content = Buffer.from(sent.content, 'base64').toString();
      const sha = `sha${++shas}`;
      files.set(file, { content, sha });
      writes.push({ path: file, branch: sent.branch, sha: sent.sha, content });
      return reply(200, { content: { path: file, sha } });
    }
    const files = branches.get(new URL(url).searchParams.get('ref') ?? 'main');
    const found = files?.get(file);
    const listed = [...(files?.keys() ?? [])].filter((p) => p.startsWith(`${file}/`));
    if (!found && listed.length) {
      return reply(200, listed.map((p) => ({ type: 'file', path: p, name: p.slice(file.length + 1), sha: files!.get(p)!.sha, size: 1 })));
    }
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
    /** Delays the next request matching e.g. `PUT /contents/`. Returns the release. */
    hold(start: string) {
      let release!: () => void;
      const until = new Promise<void>((resolve) => (release = resolve));
      held = { matches: (request) => request.startsWith(start), until };
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
    const release = github.hold('PUT');
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

describe('the body editor', () => {
  const entry = '---\ntitle: T\ndate: 2024-02-22\nevent_name: E\n---\n\nBody of old.\n';
  beforeEach(() => {
    github.add('speaking_events/old.md', entry);
    editor.mounts = 0;
  });

  for (const [what, from, to] of [
    ['an entry to a new one', 'speaking_events/old', 'speaking_events/new'],
    ['an entry to a new one elsewhere', 'speaking_events/old', 'appearances/new'],
    ['one new entry to another collection\'s', 'speaking_events/new', 'appearances/new'],
  ]) {
    it(`starts afresh and empty on a jump from ${what}`, async () => {
      confirmLeave.mockReturnValue(true);
      await open(`#/${from}`);
      editor.type('Body left behind.');
      flushSync();
      await visit(`#/${to}`);
      expect(editor.mounts).toBe(2);
      expect(editor.shown).toBe('');
    });
  }

  it('is left in place by saves, including the one that creates the file', async () => {
    await open('#/speaking_events/new');
    type(title(), 'Hello');
    type(input('event_name'), 'Event');
    editor.type('Written.');
    flushSync();
    await click('Save');
    expect(location.hash).not.toBe('#/speaking_events/new');
    type(title(), 'Hello again');
    await click('Save');
    expect(github.writes).toHaveLength(2);
    expect(editor.mounts).toBe(1);
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

describe('moving to another entry while a request is in flight', () => {
  const entry = (name: string) => `---\ntitle: ${name}\ndate: 2024-02-22\nevent_name: E\n---\n\nBody of ${name}.\n`;
  const at = (key: string) => `speaking_events/${key}.md`;
  beforeEach(() => {
    github.add(at('one'), entry('One'));
    github.add(at('two'), entry('Two'));
  });
  /** Edits the open entry's title, saves, and checks only that file was written. */
  async function expectSaveTo(path: string, body: string) {
    type(title(), 'Edited');
    await click('Save');
    const write = github.writes.at(-1)!;
    expect(write.path).toBe(path);
    expect(write.content).toContain('title: Edited');
    expect(write.content).toContain(body);
  }

  for (const [what, from] of [['a first save', 'new'], ['a later save', 'one']]) {
    it(`saves the entry on screen to its own file after ${what}`, async () => {
      await open(`#/speaking_events/${from}`);
      type(title(), 'Hello');
      type(input('event_name'), 'Event');
      const release = github.hold('PUT');
      await click('Save');
      await visit('#/speaking_events/two');
      release();
      await settle();

      expect(location.hash).toBe('#/speaking_events/two');
      expect(title().value).toBe('Two');
      expect(isDirty()).toBe(false);
      expect(document.querySelector('.entry__badge')).toBeNull();
      await expectSaveTo(at('two'), 'Body of Two.');
    });
  }

  it('writes the first file as new after a jump before the request is sent', async () => {
    await open('#/speaking_events/new');
    type(title(), 'Hello');
    type(input('event_name'), 'Event');
    const release = github.hold('GET /git/ref/');
    await click('Save');
    await visit('#/speaking_events/two');
    release();
    await settle();

    expect(github.writes).toHaveLength(1);
    expect(github.writes[0].sha).toBeUndefined();
    expect(github.writes[0].content).toContain('title: Hello');
  });

  it('leaves the same address in another collection alone', async () => {
    await open('#/speaking_events/new');
    type(title(), 'Hello');
    type(input('event_name'), 'Event');
    const release = github.hold('PUT');
    await click('Save');
    await visit('#/appearances/new');
    release();
    await settle();

    expect(location.hash).toBe('#/appearances/new');
    expect(document.querySelector('.editor-bar__path')).toBeNull();
    expect(document.querySelector('.entry__badge')).toBeNull();
  });

  it('loads a same-named entry in another collection after creating one', async () => {
    await open('#/speaking_events/new');
    type(title(), 'Hello');
    type(input('event_name'), 'Event');
    await click('Save');
    const key = location.hash.split('/').at(-1)!;
    github.add(`appearances/${key}.md`, entry('Elsewhere'));
    await visit(`#/appearances/${key}`);
    expect(title().value).toBe('Elsewhere');
  });

  it('ignores a slow load of the entry that was left', async () => {
    const release = github.hold(`GET /contents/${at('one')}`);
    await open('#/speaking_events/one');
    await visit('#/speaking_events/two');
    release();
    await settle();

    expect(title().value).toBe('Two');
    await expectSaveTo(at('two'), 'Body of Two.');
  });

  it('keeps the other entry unpublished when a publish finishes late', async () => {
    for (const key of ['one', 'two']) {
      github.branches.set(`draft/speaking_events/${key}`, new Map(github.branches.get('main')));
    }
    await open('#/speaking_events/one');
    const release = github.hold('POST /merges');
    await click('Publish');
    await visit('#/speaking_events/two');
    release();
    await settle();

    expect(github.merges).toEqual(['draft/speaking_events/one']);
    expect(document.querySelector('.entry__badge')).not.toBeNull();
  });
});

describe('a file name with characters git refuses in branch names', () => {
  it('lists, opens, saves and publishes', async () => {
    github.add('pages/My Note?.md', '---\ntitle: Spaced\n---\n\nBody.\n');
    await open('#/pages');
    await vi.waitFor(() => {
      flushSync();
      expect(document.body.textContent).toContain('Spaced');
    });
    const row = [...document.querySelectorAll<HTMLElement>('.entry')].find((el) => el.textContent!.includes('Spaced'))!;
    (row.closest('button, a') ?? row.querySelector('button, a') ?? row).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(title().value).toBe('Spaced');

    type(title(), 'Spaced out');
    await click('Save');
    const branch = 'draft/pages/My%20Note%3F';
    expect(github.writes).toEqual([expect.objectContaining({ path: 'pages/My Note?.md', branch })]);
    expect([...github.branches.keys()]).toEqual(['main', branch]);

    await visit('#/pages');
    await vi.waitFor(() => {
      flushSync();
      expect(document.querySelector('.entry__badge--unpublished')).not.toBeNull();
    });

    await visit('#/pages/My%20Note%3F');
    expect(title().value).toBe('Spaced out');
    await click('Publish');
    expect(github.merges).toEqual([branch]);
    expect([...github.branches.keys()]).toEqual(['main']);
  });
});
