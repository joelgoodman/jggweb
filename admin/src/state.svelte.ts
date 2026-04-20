import type { StorageAdapter } from './core/storage';
import { GitHubAdapter } from './core/storage';
import { loadAuth, saveAuth, clearAuth, type StoredAuth } from './core/auth';
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

export function navigate(route: Route) {
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
