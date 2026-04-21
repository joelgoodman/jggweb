import { defineConfig, createLogger } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Silence Vite's "didn't resolve at build time" warnings for the
 * site's shared /assets/fonts/* paths. Those URLs are intentional:
 * Bunny serves the admin bundle under /admin/ and the font files
 * under /assets/fonts/ on the same origin, so an absolute URL in CSS
 * just works at runtime — Vite doesn't need to resolve it because
 * nothing is being bundled. Without this filter, every build logs
 * three false-positive warnings.
 */
function quietFontWarnings() {
  const logger = createLogger();
  const skip = (msg: unknown) =>
    typeof msg === 'string' && /\/assets\/fonts\/.*didn't resolve at build time/s.test(msg);

  // Vite's CSS asset resolver uses both warn and warnOnce depending on
  // the code path — patch both so the "didn't resolve at build time"
  // notices for shared site fonts disappear without swallowing real
  // warnings.
  const originalWarn = logger.warn.bind(logger);
  const originalWarnOnce = logger.warnOnce.bind(logger);
  logger.warn = (msg, options) => {
    if (skip(msg)) return;
    originalWarn(msg, options);
  };
  logger.warnOnce = (msg, options) => {
    if (skip(msg)) return;
    originalWarnOnce(msg, options);
  };
  return logger;
}

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
  customLogger: quietFontWarnings(),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 4321,
  },
});
