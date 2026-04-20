/**
 * Directory data for the Letters collection. Drops drafts from the
 * production build by returning `permalink: false` when `draft: true`
 * is set in frontmatter — keeps the file committed (so the CMS can
 * round-trip it) but suppresses its rendered page, feed entry, and
 * sitemap row. Dev builds render drafts normally so the author can
 * preview at their intended URL before flipping the flag off.
 */
const isProduction = process.env.ELEVENTY_ENV === "production";

export default {
  layout: "layouts/letter.njk",
  tags: "newsletter",
  eleventyComputed: {
    permalink: (data) => {
      // permalink: false suppresses the page output entirely, which
      // is enough — leave the item in collections.all so the admin
      // index can still surface it with a "Draft" badge. The custom
      // addCollection("letter") filter already drops drafts from the
      // published letters feed and list, and sitemap.njk skips items
      // with no URL.
      if (isProduction && data.draft === true) return false;
      const slug = data.slug || data.page.fileSlug;
      return `letters/${slug}/index.html`;
    },
  },
};
