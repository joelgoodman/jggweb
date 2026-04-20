/**
 * Directory data for the Pages collection. Every file dropped into
 * `pages/` picks up the `page` layout and a slug-based permalink, so
 * a `pages/about.md` with `slug: about` lands at `/about/`.
 */
export default {
  layout: "layouts/page.njk",
  permalink: function (data) {
    const slug = data.slug || data.page.fileSlug;
    return `/${slug}/`;
  },
  tags: ["page"],
};
