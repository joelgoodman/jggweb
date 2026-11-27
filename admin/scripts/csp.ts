import type { Plugin } from 'vite';

/**
 * The Content-Security-Policy the built CMS carries. The CMS keeps a GitHub
 * token in the browser, so it may connect only to its own origin and the
 * GitHub API: a script that got in still couldn't send the token anywhere
 * else. Everything else it loads is on joelgoodman.co itself: the bundle under
 * /admin/assets/, fonts under /assets/fonts/ and /admin/entries.json. Images may
 * come from anywhere over https (previews from raw.githubusercontent.com,
 * images linked from bodies) and from blob: URLs for just-uploaded files.
 * Styles allow inline because Svelte and ProseMirror set style attributes.
 */
export function contentSecurityPolicy(): string {
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'"]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['font-src', ["'self'", 'data:']],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['connect-src', ["'self'", 'https://api.github.com']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'none'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

/**
 * Puts the policy in the built index.html, after the charset. The dev server is
 * left without it: Vite's client injects inline scripts there.
 */
export function cspPlugin(): Plugin {
  return {
    name: 'content-security-policy',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html;
      const content = contentSecurityPolicy().replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return html.replace(/(<meta charset=[^>]*>)/i, `$1\n  <meta http-equiv="Content-Security-Policy" content="${content}">`);
    },
  };
}
