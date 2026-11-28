// Make arbitrary global data available with this file.
export default {
  environment: process.env.ELEVENTY_ENV,
  newsletter: {
    // Posts to the Bunny edge script (scripts/edge/newsletter-signup.js),
    // which validates the submission (honeypot, timing, rate limits,
    // disposable-domain/placeholder-name blocks, optional Turnstile) and
    // only then forwards it server-to-server to Loops' Form endpoint.
    // Loops' own Form endpoint is public and unauthenticated with no bot
    // protection of its own, so it must never be the value here directly —
    // that's what let a bot hammer it straight and get sending shut down.
    action: "https://jgg-signup-wyd1f.bunny.run/",
    mailingListId: "cmo4kru8p0zn60iyq41zh7jo3",
    description: "Occasional letters on digital strategy, higher ed, and the work I'm thinking through. No spam, unsubscribe anytime.",
    // Optional Cloudflare Turnstile site key (public, safe to commit). Leave
    // empty to skip rendering the widget — the edge script only requires a
    // token when TURNSTILE_SECRET_KEY is set on its end, so this and that
    // env var should be turned on together.
    turnstileSiteKey: "0x4AAAAAAEjDvPkfM9xIF2I2"
  }
};
