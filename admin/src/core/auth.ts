const TOKEN_KEY = 'jgg-cms:token';

export interface StoredAuth {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
}
