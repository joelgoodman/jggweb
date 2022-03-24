const { DateTime } = require("luxon");
const pluginRss    = require("@11ty/eleventy-plugin-rss");
const readingTime = require('eleventy-plugin-reading-time');
const blogTools = require("eleventy-plugin-blog-tools");
const embedEverything = require("eleventy-plugin-embed-everything");
const htmlmin = require("html-minifier");
const { minify } = require("terser");
const { PurgeCSS } = require('purgecss')
const CleanCSS = require("clean-css");

module.exports = function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("letter", "layouts/letter.njk");
  eleventyConfig.addPlugin(readingTime);
  eleventyConfig.addPlugin(blogTools);
  eleventyConfig.addPlugin(embedEverything);
  eleventyConfig.addPlugin(pluginRss);
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

  eleventyConfig.addNunjucksAsyncFilter("jsmin", async function (
    code,
    callback
  ) {
    try {
      const minified = await minify(code);
      callback(null, minified.code);
    } catch (err) {
      console.error("Terser error: ", err);
      // Fail gracefully.
      callback(null, code);
    }
  });

  /**
   * Remove any CSS not used on the page and inline the remaining CSS in the
   * <head>.
   *
   * @see {@link https://github.com/FullHuman/purgecss}
   */
  eleventyConfig.addTransform('purge-and-inline-css', async function(content) {
    if (process.env.ELEVENTY_ENV !== 'production' || !this.outputPath.endsWith('.html')) {
      return content;
    }

    const purgeCSSResults = await new PurgeCSS().purge({
      content: [{ raw: content }],
      css: ['_site/assets/css/jgg.css'],
      keyframes: true
    });

    return content.replace('<!-- INLINE CSS-->', '<style>' + purgeCSSResults[0].css + '</style>');
  });

  eleventyConfig.addTransform("htmlmin", function(content) {
    if( this.outputPath.endsWith(".html") ) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true
      });
      return minified;
    }

    return content;
  });

  // only content in the `letters/` directory
  eleventyConfig.addCollection("letter", function(collection) {
    return collection.getAllSorted().filter(function(item) {
      return item.inputPath.match(/^\.\/letters\//) !== null;
    });
  });

 // WEBMENTIONS FILTER
  eleventyConfig.addFilter('webmentionsForUrl', (webmentions, url) => {
    // define which types of webmentions should be included per URL.
    // possible values listed here:
    // https://github.com/aaronpk/webmention.io#find-links-of-a-specific-type-to-a-specific-page
    const allowedTypes = ['mention-of', 'in-reply-to', 'like-of']

    // define which HTML tags you want to allow in the webmention body content
    // https://github.com/apostrophecms/sanitize-html#what-are-the-default-options
    const allowedHTML = {
      allowedTags: ['b', 'i', 'em', 'strong', 'a'],
      allowedAttributes: {
        a: ['href']
      }
    }

    // clean webmention content for output
    const clean = (entry) => {
      const { html, text } = entry.content

      if (html) {
        // really long html mentions, usually newsletters or compilations
        entry.content.value =
          html.length > 2000
            ? `mentioned this in <a href="${entry['wm-source']}">${entry['wm-source']}</a>`
            : sanitizeHTML(html, allowedHTML)
      } else {
        entry.content.value = sanitizeHTML(text, allowedHTML)
      }

      return entry
    }

    // sort webmentions by published timestamp chronologically.
    // swap a.published and b.published to reverse order.
    const orderByDate = (a, b) => new Date(b.published) - new Date(a.published)

    // only allow webmentions that have an author name and a timestamp
    const checkRequiredFields = (entry) => {
      const { author, published } = entry
      return !!author && !!author.name && !!published
    }

    // run all of the above for each webmention that targets the current URL
    return webmentions
      .filter((entry) => entry['wm-target'] === url)
      .filter((entry) => allowedTypes.includes(entry['wm-property']))
      .filter(checkRequiredFields)
      .sort(orderByDate)
      .map(clean)
  })


  /* Passthrough for assets */
  // Copy `_includes/assets/` to `_site/assets`
  eleventyConfig.addPassthroughCopy({ "_includes/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/icons": "assets/icons" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("browserconfig.xml");

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
    passthroughFileCopy: true,
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
}
