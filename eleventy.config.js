import { DateTime } from "luxon";
import pluginRss from "@11ty/eleventy-plugin-rss";
import embedEverything from "eleventy-plugin-embed-everything";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import Image from "@11ty/eleventy-img";
import { minify as htmlMinify } from "html-minifier-terser";
import { minify as jsMinify } from "terser";
import { PurgeCSS } from "purgecss";
import { readFile } from "node:fs/promises";

export default function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("letter", "layouts/letter.njk");
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addPlugin(embedEverything);
  eleventyConfig.addPlugin(pluginRss);

  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    widths: [300, 600, 900, "auto"],
    failOnError: false,
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
      sizes: "(max-width: 900px) 100vw, 900px",
    },
  });

  /* LQIP shortcode — returns a data: URI for a tiny (24px wide) JPEG of
     the source image. Used as inline background-image on cover panels so
     a blurred placeholder is visible from first paint while the full
     image loads. ~400-800 bytes per image, inlined into the HTML. */
  const lqipCache = new Map();
  eleventyConfig.addNunjucksAsyncShortcode("lqip", async function(src) {
    if (!src) return "";
    if (lqipCache.has(src)) return lqipCache.get(src);
    try {
      const meta = await Image(`assets/img/${src}`, {
        widths: [24],
        formats: ["jpeg"],
        outputDir: "_site/assets/img/lqip/",
        urlPath: "/assets/img/lqip/",
        sharpJpegOptions: { quality: 50, progressive: false },
      });
      const buf = await readFile(meta.jpeg[0].outputPath);
      const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
      lqipCache.set(src, dataUri);
      return dataUri;
    } catch (err) {
      console.error(`[lqip] ${src}:`, err.message);
      return "";
    }
  });

  /* Square thumbnail shortcode */
  eleventyConfig.addNunjucksAsyncShortcode("thumb", async function(src, alt, size = 120) {
    let metadata = await Image(`assets/img/${src}`, {
      widths: [size],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "_site/assets/img/thumb/",
      urlPath: "/assets/img/thumb/",
      transform: (sharp) => {
        return sharp.resize(size, size, { fit: "cover", position: "centre" });
      }
    });

    let imageAttributes = {
      alt,
      loading: "lazy",
      decoding: "async",
      sizes: `${size}px`,
    };

    return Image.generateHTML(metadata, imageAttributes);
  });

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
    if (process.env.ELEVENTY_ENV !== 'production' || !this.outputPath.endsWith('.html') || !content.includes('<!-- INLINE CSS-->')) {
      return content;
    }

    const purgeCSSResults = await new PurgeCSS().purge({
      content: [{ raw: content }],
      css: ['_site/assets/css/jgg.css'],
      keyframes: true,
      safelist: ['is-open', 'rail-collapsed', 'detail-collapsed', 'shell--media']
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

  /* CSS is compiled by Rollup (see rollup.config.styles.mjs).
     Watch the CSS file Rollup emits so eleventy --serve triggers a
     browser reload when styles change. */
  eleventyConfig.addWatchTarget("./_site/assets/css/jgg.css");

  /* Passthrough for assets */
  eleventyConfig.addPassthroughCopy({ "_includes/assets/icons": "assets/icons" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "_includes/assets/media": "assets/media" });
  eleventyConfig.addPassthroughCopy({ "assets/data": "assets/data" });
  eleventyConfig.addPassthroughCopy({ "assets/img": "assets/img" });
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
