import EleventyFetch from "@11ty/eleventy-fetch";

/**
 * Presentation / slide embed plugin.
 *
 * `eleventy-plugin-embed-everything` covers video (YouTube, Vimeo,
 * TikTok, Twitch…) but doesn't know about slide-deck services.
 * This fills that gap: during the HTML transform pass we scan for
 * bare URLs to registered providers and swap them for embed markup.
 *
 * Providers fall into two shapes:
 * - `oembed`: hit an oEmbed endpoint at build, cache via
 *   eleventy-fetch, inline the returned HTML. Used where the embed
 *   depends on a server-assigned hash we can't derive from the URL
 *   (Speakerdeck, SlideShare).
 * - `template`: deterministic URL → iframe HTML mapping. Used where
 *   the embed URL is derivable from the share URL (Figma, Canva).
 *
 * Adding a service means one entry in the `providers` array — no
 * wiring required anywhere else.
 */

const providers = [
  {
    name: "speakerdeck",
    match: /https:\/\/speakerdeck\.com\/[^\/\s"<>]+\/[^\/\s"<>?#]+/g,
    oembed: (url) =>
      `https://speakerdeck.com/oembed.json?url=${encodeURIComponent(url)}`,
  },
  {
    name: "slideshare",
    match: /https:\/\/(?:www\.)?slideshare\.net\/[^\/\s"<>]+\/[^\/\s"<>?#]+/g,
    oembed: (url) =>
      `https://www.slideshare.net/api/oembed/2?url=${encodeURIComponent(url)}&format=json`,
  },
  {
    name: "figma",
    match: /https:\/\/(?:www\.)?figma\.com\/(?:file|proto|design|slides|board)\/[^\s"<>]+/g,
    template: (url) =>
      `<iframe class="embed embed--figma" loading="lazy" style="border:1px solid rgba(0,0,0,.1)" src="https://www.figma.com/embed?embed_host=jggweb&url=${encodeURIComponent(url)}" allowfullscreen></iframe>`,
  },
  {
    name: "canva",
    // Canva share links look like canva.com/design/{id}/{slug}/view
    match: /https:\/\/(?:www\.)?canva\.com\/design\/[^\/\s"<>]+\/[^\/\s"<>?#]+\/view/g,
    template: (url) => {
      // Canva's embed URL is the share URL with ?embed appended.
      const sep = url.includes("?") ? "&" : "?";
      return `<iframe class="embed embed--canva" loading="lazy" src="${url}${sep}embed" allowfullscreen></iframe>`;
    },
  },
];

/**
 * Build-time oEmbed fetch. Cached for 30 days via eleventy-fetch so
 * repeat builds don't hammer upstream APIs. `directory: ".cache"`
 * matches eleventy-img's convention; already gitignored via `_cache/`
 * in existing .gitignore patterns.
 */
async function fetchOembed(url) {
  try {
    const json = await EleventyFetch(url, {
      duration: "30d",
      type: "json",
      directory: ".cache",
    });
    return typeof json?.html === "string" ? json.html : null;
  } catch (err) {
    console.warn(`[slide-embeds] oembed failed: ${url} — ${err.message}`);
    return null;
  }
}

/**
 * Replace a provider's URLs in a block of HTML with embed markup.
 * markdown-it's `linkify: true` wraps bare URLs in <a>, so a standalone
 * URL ends up as either:
 *   <p>URL</p>
 *   <p><a href="URL">URL</a></p>
 * Both forms count as "standalone" and get rewritten. URLs inside
 * lists or inline in prose stay untouched because their parent is
 * <li>/<h*>, not <p>.
 */
async function replaceProvider(html, provider) {
  const source = provider.match.source.replace(/\/g$/, "");
  const paragraphRE = new RegExp(
    `<p>\\s*(?:<a[^>]+href="(${source})"[^>]*>[^<]*<\\/a>|(${source}))\\s*<\\/p>`,
    "g"
  );
  const matches = [...html.matchAll(paragraphRE)];
  if (matches.length === 0) return html;

  let out = html;
  for (const m of matches) {
    const url = m[1] || m[2];
    let embed;
    if (provider.oembed) embed = await fetchOembed(provider.oembed(url));
    else embed = provider.template(url);
    if (!embed) continue;
    out = out.replace(m[0], embed);
  }
  return out;
}

export default function slideEmbedsPlugin(eleventyConfig) {
  eleventyConfig.addTransform("slide-embeds", async function (content) {
    // Collection items with `permalink: false` (e.g. speaking_events)
    // get outputPath=false, not a string — guard before calling
    // endsWith().
    if (typeof this.outputPath !== "string" || !this.outputPath.endsWith(".html")) {
      return content;
    }
    let out = content;
    for (const provider of providers) {
      out = await replaceProvider(out, provider);
    }
    return out;
  });
}

export { providers };
