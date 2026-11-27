// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';

// The body editor is Milkdown; these tests only need to feed it text. Like the
// real one, the stand-in reads `value` only as it mounts.
// `pending` is typing the real editor reports only after a pause, or when asked.
const editor = vi.hoisted(() => ({
  type: (_markdown: string) => {},
  shown: '',
  mounts: 0,
  pending: undefined as string | undefined,
}));
vi.mock('../src/ui/fields/MarkdownInput.svelte', () => ({
  default: (_anchor: unknown, props: { value: string; onChange: (v: string) => void }) => {
    editor.mounts++;
    editor.shown = props.value;
    editor.pending = undefined;
    editor.type = (markdown) => props.onChange(markdown);
    return {
      flush: () => {
        if (editor.pending === undefined) return;
        props.onChange(editor.pending);
        editor.pending = undefined;
      },
    };
  },
}));

/** Enough of the GitHub API for the editor: branches, files and merges. */
function fakeGitHub() {
  const branches = new Map<string, Map<string, { content: string; sha: string }>>([['main', new Map()]]);
  const writes: { path: string; branch: string; sha?: string; content: string }[] = [];
  const merges: string[] = [];
  // Each branch's tip, and what each commit holds. A branch set up by a test
  // without a commit has the tip `tip:<branch>`.
  const tips = new Map<string, string>([['main', 'c0']]);
  const commits = new Map<string, { branch: string; files: Map<string, { content: string; sha: string }> }>();
  const tipOf = (branch: string) => tips.get(branch) ?? `tip:${branch}`;
  const commit = (branch: string) => {
    const sha = `c${++shas}`;
    tips.set(branch, sha);
    commits.set(sha, { branch, files: new Map(branches.get(branch)) });
  };
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
      const name = path.slice(15);
      return branches.has(name) ? reply(200, { object: { sha: tipOf(name) } }) : reply(404);
    }
    if (path === '/git/refs') {
      const name = sent.ref.slice(11);
      branches.set(name, new Map(commits.get(sent.sha)?.files ?? branches.get('main')));
      tips.set(name, sent.sha);
      return reply(201);
    }
    if (path.startsWith('/git/refs/heads/')) {
      branches.delete(path.slice(16));
      tips.delete(path.slice(16));
      return reply(204);
    }
    if (path === '/merges') {
      const head: string = sent.head;
      const from =
        commits.get(head) ??
        (head.startsWith('tip:') && branches.has(head.slice(4))
          ? { branch: head.slice(4), files: branches.get(head.slice(4))! }
          : branches.has(head) ? { branch: head, files: branches.get(head)! } : undefined);
      if (!from) return reply(404);
      merges.push(from.branch);
      for (const [file, value] of from.files) branches.get('main')!.set(file, value);
      commit('main');
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
      commit(sent.branch);
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
    /** A save made elsewhere, e.g. in another tab. */
    saveElsewhere(branch: string, path: string, content: string) {
      branches.get(branch)!.set(path, { content, sha: `sha${++shas}` });
      commit(branch);
    },
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
const change = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
};
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
      // Still unsaved until the save finishes, so the browser's move asks.
      confirmLeave.mockReturnValue(true);
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
    confirmLeave.mockReturnValue(true);
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

describe('saving and publishing', () => {
  const path = 'speaking_events/one.md';
  const file = '---\ntitle: One\ndate: 2024-02-22\nevent_name: E\n---\n\nBody.\n';
  const draft = 'draft/speaking_events/one';
  beforeEach(() => {
    github.add(path, file);
  });
  async function openDraft() {
    github.branches.set(draft, new Map(github.branches.get('main')));
    github.saveElsewhere(draft, path, file);
    await open('#/speaking_events/one');
  }

  it('saves typing the body editor has not reported yet', async () => {
    await open('#/speaking_events/one');
    editor.pending = 'Body.\n\nTyped just before Save.\n';
    await click('Save');
    expect(github.writes[0].content).toContain('Typed just before Save.');
  });

  it('counts unreported typing as unsaved when leaving', async () => {
    await open('#/speaking_events/one');
    editor.pending = 'Body.\n\nNot reported yet.\n';
    await click('Speaking');
    expect(confirmLeave).toHaveBeenCalled();
    expect(location.hash).toBe('#/speaking_events/one');
  });

  it('keeps Publish off while there are unsaved changes, so it never puts live an older save', async () => {
    await openDraft();
    expect(button('Publish').disabled).toBe(false);
    type(title(), 'Changed');
    expect(button('Publish').disabled).toBe(true);
    expect(button('Publish').title).toMatch(/Save first/);
  });

  it('does not publish typing that arrives as Publish is clicked', async () => {
    await openDraft();
    editor.pending = 'Body.\n\nLate.\n';
    await click('Publish');
    expect(github.merges).toEqual([]);
    expect(toast()).toMatch(/Save first/);
  });

  it('keeps Save off while publishing', async () => {
    await openDraft();
    const release = github.hold('POST /merges');
    button('Publish').click();
    await settle();
    expect(button('Save').disabled).toBe(true);
    release();
    await settle();
    expect(button('Save').disabled).toBe(false);
  });

  it('keeps a draft branch that gained a save while publishing', async () => {
    await openDraft();
    const release = github.hold('POST /merges');
    button('Publish').click();
    await settle();
    github.saveElsewhere(draft, path, file.replace('Body.', 'Saved in another tab.'));
    release();
    await settle();
    expect(github.branches.has(draft)).toBe(true);
    expect(github.branches.get('main')!.get(path)!.content).toBe(file);
    expect(document.querySelector('.entry__badge')).not.toBeNull();
    expect(toast()).toMatch(/newer save/i);
  });

  it('deletes the draft branch after publishing what it holds, and saves again afterwards', async () => {
    await open('#/speaking_events/one');
    type(title(), 'Published title');
    await click('Save');
    await click('Publish');
    expect(github.branches.has(draft)).toBe(false);
    expect(github.branches.get('main')!.get(path)!.content).toContain('title: Published title');
    type(title(), 'Next title');
    await click('Save');
    expect(toast()).not.toMatch(/GitHub 409/);
    expect(github.writes.at(-1)!.content).toContain('title: Next title');
  });

  it('names a new entry whose title has no letters or digits', async () => {
    await open('#/speaking_events/new');
    type(title(), '???');
    type(input('event_name'), 'Event');
    change(input('date'), '2024-02-22T12:00');
    await click('Save');
    expect(github.writes[0].path).toBe('speaking_events/2024-02-untitled.md');
  });
});

describe('leaving with unsaved changes', () => {
  beforeEach(async () => {
    github.add('pages/one.md', '---\ntitle: One\n---\n\nBody.\n');
    github.add('pages/two.md', '---\ntitle: Two\n---\n\nBody.\n');
    await open('#/pages/one');
    type(title(), 'Changed');
  });

  it('asks before signing out, and a No keeps the edits and the sign-in', async () => {
    await click('Sign out');
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('decibel-cms:token')).not.toBeNull();
    expect(title().value).toBe('Changed');
  });

  it('signs out after one Yes', async () => {
    const token = localStorage.getItem('decibel-cms:token')!;
    confirmLeave.mockReturnValue(true);
    await click('Sign out');
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('decibel-cms:token')).toBeNull();
    expect(document.querySelector('.login')).not.toBeNull();
    const { signIn } = await import('../src/state.svelte');
    signIn(JSON.parse(token));
  });

  it('asks when the browser goes back, and a No stays on the entry', async () => {
    await visit('#/pages/two');
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('#/pages/one');
    expect(title().value).toBe('Changed');
  });

  it('goes where the browser went after a Yes', async () => {
    confirmLeave.mockReturnValue(true);
    await visit('#/pages/two');
    expect(location.hash).toBe('#/pages/two');
    expect(title().value).toBe('Two');
  });
});

describe('an entry whose file is named new', () => {
  it('opens as that file, not as a new entry', async () => {
    github.add('pages/new.md', '---\ntitle: Named new\n---\n\nBody.\n');
    await open('#/pages');
    await vi.waitFor(() => {
      flushSync();
      expect(document.body.textContent).toContain('Named new');
    });
    (document.querySelector('.entry__title') as HTMLElement).closest('button, a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(location.hash).not.toBe('#/pages/new');
    expect(title().value).toBe('Named new');
    expect(document.querySelector('.editor-bar__path')!.textContent).toBe('pages/new.md');
  });
});

describe('a new entry\'s file name', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  // West of UTC, a late-evening date is stored as the next UTC day (and month).
  it('takes the day the writer picked, not the UTC day it is stored as', async () => {
    process.env.TZ = 'America/Los_Angeles';
    await open('#/speaking_events/new');
    type(title(), 'Hello');
    type(input('event_name'), 'Event');
    change(input('date'), '2024-02-29T23:30');
    await click('Save');
    expect(github.writes[0].path).toBe('speaking_events/2024-02-hello.md');
    expect(github.writes[0].content).toContain('2024-03-01T07:30');
  });

  it('dates a letter by its publish date', async () => {
    process.env.TZ = 'America/Los_Angeles';
    await open('#/letters/new');
    type(title(), 'Hello');
    change(input('date_published'), '2024-02-29T23:30');
    await click('Save');
    expect(github.writes[0].path).toBe('letters/2024-02-29-hello.md');
  });
});
