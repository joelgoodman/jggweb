import { it, expect } from 'vitest';
import { contentSecurityPolicy, cspPlugin } from '../scripts/csp';

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `));
const html = '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Decibel CMS</title>\n</head>\n</html>';
type Transform = (html: string, ctx: { server?: unknown }) => string;
const transform = cspPlugin().transformIndexHtml as unknown as Transform;

it('connects only to the CMS itself and the GitHub API', () => {
  const csp = contentSecurityPolicy();
  expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https://api.github.com");
  expect(directive(csp, 'script-src')).toBe("script-src 'self'");
  expect(directive(csp, 'object-src')).toBe("object-src 'none'");
});

it("lets the site's own fonts, entries.json and image previews load", () => {
  const csp = contentSecurityPolicy();
  // /assets/fonts/ and /admin/entries.json are on the same origin as /admin/.
  expect(directive(csp, 'font-src')).toBe("font-src 'self' data:");
  expect(directive(csp, 'default-src')).toBe("default-src 'self'");
  // Previews come from raw.githubusercontent.com, just-uploaded files from blob: URLs.
  expect(directive(csp, 'img-src')).toBe("img-src 'self' data: blob: https:");
  expect(directive(csp, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
});

it('goes into the built page right after the charset, and not into the dev server', () => {
  const built = transform(html, {});
  expect(built).toMatch(/<meta charset="utf-8">\n {2}<meta http-equiv="Content-Security-Policy" content="default-src 'self'; [^"]+">/);
  expect(transform(html, { server: {} })).toBe(html);
});
