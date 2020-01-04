const { DateTime } = require("luxon");
const pluginRss    = require("@11ty/eleventy-plugin-rss");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const htmlmin = require("html-minifier");

module.exports = function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("post", "layouts/post.njk");

  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(readingTime);
  eleventyConfig.setDataDeepMerge(true);

  /* Date filters */
  // Human readable
  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat("dd LLL yyyy");
  });

  // Machine Readable https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat('yyyy-LL-dd');
  });

  /* Minification filters */
  eleventyConfig.addFilter("cssmin", function(code) {
    return new CleanCSS({}).minify(code).styles;
  });

  eleventyConfig.addTransform("htmlmin", function(content, outputPath) {
    if( outputPath.endsWith(".html") ) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true
      });
      return minified;
    }

    return content;
  });

  /* Passthrough for assets */
  // Copy `_includes/assets/` to `_site/assets`
  eleventyConfig.addPassthroughCopy({ "_includes/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/webfonts": "assets/webfonts" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy("browserconfig.xml");
  eleventyConfig.addPassthroughCopy("robots.txt");

  eleventyConfig.addCollection("tagList", require("./_11ty/getTagList"));

  // RSS Setup via @freshyill
  eleventyConfig.addCollection("allUpdates", function(collection) {
    return collection.getFilteredByGlob(["posts/*.md"]).sort(function(a, b) {
      return b.date - a.date;
    });
  });

  return {
    templateFormats: [
      "md",
      "njk",
      "html",
      "liquid"
    ],

    // If your site lives in a different subdirectory, change this.
    // Leading or trailing slashes are all normalized away, so don’t worry about it.
    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for URLs (it does not affect your file structure)
    pathPrefix: "/",

    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    passthroughFileCopy: true,
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
}
