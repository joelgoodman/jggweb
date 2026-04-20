/**
 * Directory data for the Pages collection. Every file dropped into
 * `pages/` picks up the `page` layout and a slug-based permalink, so
 * a `pages/about.md` with `slug: about` lands at `/about/`.
 *
 * Drafts (`draft: true` in frontmatter) get `permalink: false` in
 * production so their page doesn't render and they disappear from
 * feed/sitemap; dev builds keep them visible for preview. Tag-based
 * `collections.page` was replaced by an explicit addCollection in
 * eleventy.config.js so the same draft filter applies to listings.
 */
const isProduction = process.env.ELEVENTY_ENV === "production";

export default {
  layout: "layouts/page.njk",
  eleventyComputed: {
    permalink: (data) => {
      // permalink: false is enough to suppress production output —
      // leave the item in collections.all so the admin index can
      // still surface it with a draft badge. Our addCollection("page")
      // filter drops drafts from the listing used by templates.
      if (isProduction && data.draft === true) return false;
      // Explicit frontmatter override (home.md uses `permalink: /`).
      if (data.permalink && data.permalink !== undefined) return data.permalink;
      const slug = data.slug || data.page.fileSlug;
      return `/${slug}/`;
    },
  },
};
