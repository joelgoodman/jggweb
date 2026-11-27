import type { StorageAdapter } from './core/storage';
import { GitHubAdapter } from './core/storage';
import { loadAuth, saveAuth, clearAuth, type StoredAuth } from './core/auth';
import * as drafts from './core/drafts';
export { draftBranchName } from './core/drafts';
import { collections, type SiteConfig } from './config/schema';

/** The entry key of a new, unsaved entry. No file name can contain `\0`. */
export const NEW_ENTRY = '\0new';

interface Route {
  name: 'list' | 'editor' | 'login';
  collection?: string;
  entry?: string;
}

/**
 * Entry metadata as emitted by the build-time /admin/entries.json
 * index. The CMS uses this to skip per-file fetches for anything that
 * was already in the repo at last deploy; anything newer falls through
 * to a live Contents API read in the list view.
 */
export interface IndexEntry {
  path: string;
  slug: string;
  title: string;
  date: string | null;
  subtitle?: string;
  draft?: boolean;
}
interface EntriesIndex {
  generated_at: string;
  letters: IndexEntry[];
  pages: IndexEntry[];
  speaking_events: IndexEntry[];
  appearances: IndexEntry[];
}

interface AppState {
  auth: StoredAuth | null;
  route: Route;
  storage: StorageAdapter | null;
  toast: { message: string; kind: 'info' | 'error' } | null;
  entriesIndex: EntriesIndex | null;
  indexLoading: boolean;
}

export const store = $state<AppState>({
  auth: loadAuth(),
  route: parseHash(),
  storage: null,
  toast: null,
  entriesIndex: null,
  indexLoading: false,
});

/** Resolved config for the site. */
export const config: SiteConfig = { collections };

rebuildStorage();

// The address on screen. The browser's Back and Forward change the address
// before anything can ask; a No puts it back.
let shownHash = location.hash;
window.addEventListener('hashchange', () => {
  if (location.hash === shownHash) return;
  if (!mayLeave()) {
    history.pushState(null, '', shownHash || location.pathname + location.search);
    return;
  }
  shownHash = location.hash;
  store.route = parseHash();
});

function rebuildStorage() {
  if (store.auth) {
    store.storage = new GitHubAdapter(store.auth);
  } else {
    store.storage = null;
  }
}

export function signIn(auth: StoredAuth) {
  saveAuth(auth);
  store.auth = auth;
  rebuildStorage();
  const firstCollection = config.collections[0];
  if (firstCollection) navigate({ name: 'list', collection: firstCollection.name });
}

export function signOut() {
  // Asked first: once the token is gone, nothing could be saved.
  if (!mayLeave()) return;
  unsavedGuard = null;
  clearAuth();
  store.auth = null;
  store.storage = null;
  navigate({ name: 'login' });
}

/**
 * Lets the currently-mounted EntryEditor register a "do I have unsaved
 * changes?" check that every in-app navigation goes through. `navigate`
 * is the one chokepoint every route change already calls (back button,
 * sidebar links, sign-out, save's post-create redirect), so gating it
 * here covers all of them without each caller needing to know about
 * dirty state. The browser's Back and Forward change the address first; the
 * `hashchange` listener asks then and restores the address on a No.
 */
let unsavedGuard: (() => boolean) | null = null;
export function setUnsavedGuard(check: (() => boolean) | null): void {
  unsavedGuard = check;
}

/** Whether the editor may be left: nothing unsaved, or the writer said yes. */
function mayLeave(): boolean {
  return !unsavedGuard?.() || confirm('You have unsaved changes. Leave without saving?');
}

export function navigate(route: Route) {
  if (!mayLeave()) return;
  const hash = serializeRoute(route);
  if (location.hash !== hash) {
    location.hash = hash;
    shownHash = location.hash;
    store.route = parseHash();
  } else store.route = route;
}

/**
 * Points the address at the file a new entry was just saved as. The editor stays
 * as it is: no history step, reload or unsaved-changes prompt.
 */
export function replaceNewEntryRoute(collection: string, entry: string) {
  const { route } = store;
  if (route.name !== 'editor' || route.collection !== collection || route.entry !== NEW_ENTRY) return;
  const next: Route = { name: 'editor', collection, entry };
  history.replaceState(null, '', serializeRoute(next));
  shownHash = location.hash;
  store.route = next;
}

export function showToast(message: string, kind: 'info' | 'error' = 'info') {
  store.toast = { message, kind };
  setTimeout(() => {
    if (store.toast?.message === message) store.toast = null;
  }, 4000);
}

/**
 * Load the build-time index once per session. Served from
 * /admin/entries.json alongside the SPA bundle. In dev (where the
 * vite server doesn't have access to eleventy's output) the fetch
 * will 404 and the list view transparently falls back to per-file
 * GitHub reads.
 */
let indexPromise: Promise<EntriesIndex | null> | null = null;
export function getEntriesIndex(): Promise<EntriesIndex | null> {
  if (store.entriesIndex) return Promise.resolve(store.entriesIndex);
  if (indexPromise) return indexPromise;
  store.indexLoading = true;
  indexPromise = (async () => {
    try {
      const res = await fetch('/admin/entries.json', { cache: 'no-cache' });
      if (!res.ok) return null;
      const json = (await res.json()) as EntriesIndex;
      store.entriesIndex = json;
      return json;
    } catch {
      return null;
    } finally {
      store.indexLoading = false;
    }
  })();
  return indexPromise;
}

/**
 * Patch the in-memory index after a CMS save so the list view
 * reflects the edit immediately — otherwise the updated entry would
 * show stale metadata until the next site build. `collectionKey`
 * matches the EntriesIndex keys (letters, pages, speaking_events,
 * appearances).
 */
export function upsertIndexEntry(collectionKey: keyof Omit<EntriesIndex, 'generated_at'>, entry: IndexEntry): void {
  if (!store.entriesIndex) return;
  const list = store.entriesIndex[collectionKey];
  const idx = list.findIndex((e) => e.path === entry.path);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
}

/**
 * Draft-branch helpers, wired to the signed-in GitHubAdapter and the
 * configured main branch. Throw if storage isn't a GitHubAdapter —
 * branching is a git-specific concept a hypothetical non-git
 * StorageAdapter wouldn't implement, so this stays out of that
 * interface rather than forcing every backend to support it.
 */
function requireGitHubStorage(): GitHubAdapter {
  if (!(store.storage instanceof GitHubAdapter)) {
    throw new Error('Draft branches require the GitHub storage backend.');
  }
  return store.storage;
}

export function hasDraftBranch(collection: string, slug: string): Promise<boolean> {
  return drafts.hasDraftBranch(requireGitHubStorage(), collection, slug);
}

export function ensureDraftBranch(collection: string, slug: string): Promise<string> {
  return drafts.ensureDraftBranch(requireGitHubStorage(), store.auth!.branch, collection, slug);
}

export function publishDraft(collection: string, slug: string): Promise<drafts.Published> {
  return drafts.publishDraft(requireGitHubStorage(), store.auth!.branch, collection, slug);
}

export function listDraftSlugs(collection: string): Promise<string[]> {
  return drafts.listDraftSlugs(requireGitHubStorage(), collection);
}

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { name: 'list' };
  const raws = raw.split('/').filter(Boolean);
  const parts = raws.map(decodeSegment);
  if (parts[0] === 'login') return { name: 'login' };
  if (parts.length === 1) return { name: 'list', collection: parts[0] };
  // `new` as typed is a new entry; a file named `new` is written `%6Eew`.
  if (raws.length === 2 && raws[1] === 'new') return { name: 'editor', collection: parts[0], entry: NEW_ENTRY };
  if (parts.length >= 2) return { name: 'editor', collection: parts[0], entry: parts.slice(1).join('/') };
  return { name: 'list' };
}

function serializeRoute(route: Route): string {
  if (route.name === 'login') return '#/login';
  if (route.name === 'list') return route.collection ? `#/${encodeURIComponent(route.collection)}` : '#/';
  if (route.name === 'editor') {
    const entry = route.entry === undefined || route.entry === NEW_ENTRY ? 'new' : encodeURIComponent(route.entry);
    return `#/${encodeURIComponent(route.collection ?? '')}/${entry === 'new' && route.entry !== NEW_ENTRY && route.entry !== undefined ? '%6Eew' : entry}`;
  }
  return '#/';
}

/** A file name from the address; browsers escape spaces and more in it. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // a lone `%` typed into the address
  }
}
