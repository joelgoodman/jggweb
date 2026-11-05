import { fetchOembed } from "../eleventy-plugins/video-schema.js";

export default {
  permalink: false,
  eleventyExcludeFromCollections: false,
  eleventyComputed: {
    // YouTube channel (name + URL) for VideoObject.author — Google flags
    // a missing author.url. The channel isn't always the event named in
    // source_name (e.g. a keynote on Joel's own channel), so both come
    // from oEmbed together. Cached 30 days in .cache/.
    channel: async (data) => {
      if (data.type !== "video" || !data.id) return undefined;
      const meta = await fetchOembed(data.id);
      if (!meta?.author_url) return undefined;
      return { name: meta.author_name, url: meta.author_url };
    },
  },
};
