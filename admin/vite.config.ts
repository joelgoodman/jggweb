import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * During dev, proxy /assets/fonts/* to the main site's font folder so
 * the admin uses the same self-hosted woff2 files as joelgoodman.co.
 * In production, Bunny serves /assets/fonts/ alongside /admin/ on the
 * same origin, so the plain absolute URL resolves naturally.
 */
function serveSiteFonts() {
  return {
    name: 'serve-site-fonts',
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (body?: Buffer | string) => void }, next: () => void) => void) => void;
      };
    }) {
      server.middlewares.use('/assets/fonts', (req, res, next) => {
        const filename = req.url?.replace(/^\//, '').split('?')[0];
        if (!filename) { next(); return; }
        try {
          const buf = readFileSync(resolve(__dirname, '../_includes/assets/fonts', filename));
          res.setHeader('Content-Type', 'font/woff2');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.end(buf);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), serveSiteFonts()],
  base: '/admin/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 4321,
  },
});
