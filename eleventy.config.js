import { DateTime } from "luxon";
import pluginRss from "@11ty/eleventy-plugin-rss";
import embedEverything from "eleventy-plugin-embed-everything";
import { minify as htmlMinify } from "html-minifier-terser";
import { minify as jsMinify } from "terser";
import { PurgeCSS } from "purgecss";
import CleanCSS from "clean-css";

export default function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("letter", "layouts/letter.njk");
  eleventyConfig.addPlugin(embedEverything);
  eleventyConfig.addPlugin(pluginRss);

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

  /* Reading time filter (replaces eleventy-plugin-reading-time) */
  eleventyConfig.addFilter("readingTime", (content) => {
    const words = (content || "").split(/\s+/).filter(Boolean).length;
    const minutes = Math.ceil(words / 238);
    return minutes < 1 ? "1 min" : `${minutes} min`;
  });

  /* Minification filters */
  eleventyConfig.addFilter("cssmin", function(code) {
    return new CleanCSS({}).minify(code).styles;
  });

  eleventyConfig.addShortcode("yt", (videoURL, title) => {
		const url = new URL(videoURL);
		const id = url.searchParams.get("v");
		return `<iframe class="yt-embed" src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video player${
			title ? ` for ${title}` : ""
		}" frameborder="0" allowfullscreen></iframe>`;
	});

  eleventyConfig.addNunjucksAsyncFilter("jsmin", async function (
    code,
    callback
  ) {
    try {
      const minified = await jsMinify(code);
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
      css: ['_includes/assets/css/jgg.css'],
      keyframes: true
    });

    return content.replace('<!-- INLINE CSS-->', '<style>' + purgeCSSResults[0].css + '</style>');
  });

  eleventyConfig.addTransform("htmlmin", async function(content) {
    if( this.outputPath && this.outputPath.endsWith(".html") ) {
      let minified = await htmlMinify(content, {
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

  /* Passthrough for assets */
  eleventyConfig.addPassthroughCopy({ "_includes/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/icons": "assets/icons" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("browserconfig.xml");

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
}
