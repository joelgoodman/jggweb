import EleventyFetch from "@11ty/eleventy-fetch";

/**
 * VideoObject JSON-LD for YouTube iframes embedded in post content.
 *
 * embed-everything produces <iframe src="youtube-nocookie.com/embed/ID">
 * markup at build. For GEO, we want those videos to be discoverable
 * as first-class content entities — not just hidden inside iframes
 * that crawlers may or may not follow. This transform scans rendered
 * HTML for unique video IDs, hits YouTube's oEmbed endpoint to pull
 * title + thumbnail (cached 30 days), and injects a VideoObject
 * JSON-LD block before </body> for each one.
 *
 * Limitations:
 * - oEmbed doesn't return uploadDate, which is "strongly recommended"
 *   by Google but not required for the schema to be valid. Video
 *   rich-result eligibility may be reduced as a result.
 * - One VideoObject per unique video per page — duplicates are
 *   deduped by ID, so a page can carry multiple different videos.
 */
export default function videoSchemaPlugin(eleventyConfig) {
  eleventyConfig.addTransform("video-schema", async function (content) {
    if (typeof this.outputPath !== "string" || !this.outputPath.endsWith(".html")) {
      return content;
    }

    const ids = new Set();
    const regex = /<iframe[^>]*src="[^"]*youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]+)/g;
    let m;
    while ((m = regex.exec(content)) !== null) ids.add(m[1]);
    if (ids.size === 0) return content;

    const schemas = [];
    for (const id of ids) {
      const meta = await fetchOembed(id);
      if (!meta) continue;
      schemas.push(buildVideoObject(id, meta));
    }
    if (schemas.length === 0) return content;

    const inject = schemas
      .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
      .join("\n");

    // Append before </body> so the scripts sit next to other runtime
    // tags — falls back to string append if no body tag (edge cases
    // like raw XML outputs).
    if (content.includes("</body>")) {
      return content.replace("</body>", `${inject}\n</body>`);
    }
    return content + "\n" + inject;
  });
}

async function fetchOembed(id) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${id}`,
  )}&format=json`;
  try {
    return await EleventyFetch(url, {
      duration: "30d",
      type: "json",
      directory: ".cache",
    });
  } catch (err) {
    console.warn(`[video-schema] oembed failed for ${id}: ${err.message}`);
    return null;
  }
}

function buildVideoObject(id, oembed) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: oembed.title,
    description: oembed.title,
    thumbnailUrl: oembed.thumbnail_url,
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    author: oembed.author_name
      ? {
          "@type": "Person",
          name: oembed.author_name,
          url: oembed.author_url,
        }
      : undefined,
  };
}
