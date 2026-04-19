import type { StorageAdapter } from './core/storage';
import { GitHubAdapter } from './core/storage';
import { loadAuth, saveAuth, clearAuth, type StoredAuth } from './core/auth';
import { collections, type SiteConfig } from './config/schema';

interface Route {
  name: 'list' | 'editor' | 'login';
  collection?: string;
  entry?: string;
}

interface AppState {
  auth: StoredAuth | null;
  route: Route;
  storage: StorageAdapter | null;
  toast: { message: string; kind: 'info' | 'error' } | null;
}

export const store = $state<AppState>({
  auth: loadAuth(),
  route: parseHash(),
  storage: null,
  toast: null,
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
