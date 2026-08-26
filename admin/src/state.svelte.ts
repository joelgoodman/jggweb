import type { StorageAdapter } from './core/storage';
import { GitHubAdapter } from './core/storage';
import { loadAuth, saveAuth, clearAuth, type StoredAuth } from './core/auth';
import * as drafts from './core/drafts';
export { draftBranchName } from './core/drafts';
import { collections, type SiteConfig } from './config/schema';

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

window.addEventListener('hashchange', () => {
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
 * dirty state. Doesn't cover the browser's native Back/Forward buttons,
 * which change location.hash directly and only surface as `hashchange`
 * after the fact.
 */
let unsavedGuard: (() => boolean) | null = null;
export function setUnsavedGuard(check: (() => boolean) | null): void {
  unsavedGuard = check;
}

export function navigate(route: Route) {
  if (unsavedGuard?.() && !confirm('You have unsaved changes. Leave without saving?')) return;
  const hash = serializeRoute(route);
  if (location.hash !== hash) location.hash = hash;
  else store.route = route;
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
 * matches the EntriesIndex keys (letters, pages, speaking_events).
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

export function publishDraft(collection: string, slug: string): Promise<'merged' | 'up-to-date'> {
  return drafts.publishDraft(requireGitHubStorage(), store.auth!.branch, collection, slug);
}

export function listDraftSlugs(collection: string): Promise<string[]> {
  return drafts.listDraftSlugs(requireGitHubStorage(), collection);
}

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { name: 'list' };
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] === 'login') return { name: 'login' };
  if (parts.length === 1) return { name: 'list', collection: parts[0] };
  if (parts.length >= 2) return { name: 'editor', collection: parts[0], entry: parts.slice(1).join('/') };
  return { name: 'list' };
}

function serializeRoute(route: Route): string {
  if (route.name === 'login') return '#/login';
  if (route.name === 'list') return route.collection ? `#/${route.collection}` : '#/';
  if (route.name === 'editor') return `#/${route.collection}/${route.entry}`;
  return '#/';
}
