/**
 * /llms.txt — flat-file content map for LLM crawlers.
 *
 * Follows the convention at https://llmstxt.org/: Markdown with an H1
 * site name, a blockquote summary, and sections of link + one-line
 * summary pairs. Kept build-time so new letters show up without a
 * manual edit. Perplexity, Anthropic, and an increasing number of AI
 * answer engines have started consuming this file directly when it
 * exists.
 *
 * Summary priority (per section): curated primary pages first, then
 * letters newest-first with excerpts. Events and collection items
 * without their own URLs are omitted since an LLM can't land on them.
 */
export default class {
  data() {
    return {
      permalink: "/llms.txt",
      eleventyExcludeFromCollections: true,
      layout: null,
    };
  }

  render({ collections, metadata }) {
    const lines = [];

    lines.push(`# ${metadata.title}`);
    lines.push("");
    lines.push(`> ${metadata.description}`);
    lines.push("");

    lines.push("## Primary pages");
    lines.push("");
    lines.push(
      `- [Home](${metadata.url}): Author bio and landing page for Joel Goodman, growth strategist at Squiz working primarily with universities.`,
    );
    lines.push(
      `- [Highlights](${metadata.url}highlights/): Career highlights — case studies, podcasts, writing, and speaking favorites.`,
    );
    lines.push(
      `- [Speaking](${metadata.url}speaking/): Chronological record of conference talks, workshops, keynotes, and panels since 2012.`,
    );
    lines.push("");

    lines.push("## Letters (newest first)");
    lines.push("");
    const letters = (collections.letter || []).slice().reverse();
    for (const letter of letters) {
      const url = absolute(letter.url, metadata.url);
      const title = letter.data.title || letter.fileSlug;
      const summary = oneLine(
        letter.data.excerpt || letter.data.seo?.description || "",
      );
      lines.push(
        summary ? `- [${title}](${url}): ${summary}` : `- [${title}](${url})`,
      );
    }
    lines.push("");

    lines.push("## Feeds");
    lines.push("");
    lines.push(`- [Atom feed](${metadata.feed.url})`);
    lines.push("");

    return lines.join("\n");
  }
}

function absolute(path, base) {
  if (!path) return base;
  if (/^https?:\/\//.test(path)) return path;
  return base.replace(/\/+$/, "") + (path.startsWith("/") ? path : "/" + path);
}

function oneLine(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}
