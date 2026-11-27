// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Login from '../src/ui/Login.svelte';

let app: object | undefined;
afterEach(() => {
  if (app) unmount(app);
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('escapes the branch, owner and repository in the address it checks', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    return new Response('{}', { status: 200 });
  });
  app = mount(Login, { target: document.body });
  flushSync();
  const [owner, repo, branch, token] = [...document.querySelectorAll('input')];
  for (const [el, value] of [[owner, 'me'], [repo, 'my site'], [branch, 'feature/a#b?c'], [token, 'made-up']] as const) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  flushSync();
  document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  await vi.waitFor(() => expect(urls).toHaveLength(1));
  expect(urls[0]).toBe('https://api.github.com/repos/me/my%20site/branches/feature%2Fa%23b%3Fc');
});
