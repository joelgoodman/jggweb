const { DateTime } = require("luxon");
const pluginRss    = require("@11ty/eleventy-plugin-rss");
const readingTime = require('eleventy-plugin-reading-time');
const blogTools = require("eleventy-plugin-blog-tools");
const embedEverything = require("eleventy-plugin-embed-everything");
const htmlmin = require("html-minifier");
const CleanCSS = require("clean-css");

module.exports = function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("letter", "layouts/letter.njk");

  eleventyConfig.cloudinaryCloudName = 'joelgoodman';
  eleventyConfig.cloudinaryFetch = false;
	eleventyConfig.srcsetWidths = [ 320, 640, 960, 1280, 1600, 1920, 2240, 2560 ];
	eleventyConfig.fallbackWidth = 960;

  eleventyConfig.addPlugin(readingTime);
  eleventyConfig.addPlugin(blogTools);
  eleventyConfig.addPlugin(embedEverything);
  eleventyConfig.setDataDeepMerge(true);

  /* Date filters */
  // Human readable
  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj, {zone: 'America/Chicago'}).toFormat("dd LLL yyyy");
  });

  eleventyConfig.addFilter("yearDate", dateObj => {
    return DateTime.fromJSDate(dateObj, {zone: 'America/Chicago'}).toFormat("yyyy");
  });

  // Machine Readable https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, {zone: 'America/Chicago'}).toFormat('yyyy-LL-dd');
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

  // only content in the `posts/` directory
  eleventyConfig.addCollection("letter", function(collection) {
    return collection.getAllSorted().filter(function(item) {
      return item.inputPath.match(/^\.\/letters\//) !== null;
    });
  });

  /* Passthrough for assets */
  // Copy `_includes/assets/` to `_site/assets`
  eleventyConfig.addPassthroughCopy({ "_includes/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/webfonts": "assets/webfonts" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy("browserconfig.xml");
  eleventyConfig.addPassthroughCopy("robots.txt");

  // RSS Setup via @freshyill
  eleventyConfig.addCollection("allUpdates", function(collection) {
    return collection.getFilteredByGlob(["posts/*.md"]).sort(function(a, b) {
      return b.date - a.date;
    });
  });

  let markdownIt = require("markdown-it");
  let options = {
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
  };
  let opts = {
    permalink: true,
    permalinkClass: "direct-link",
    permalinkSymbol: "#"
  };

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
