import { DateTime } from "luxon";
import pluginRss from "@11ty/eleventy-plugin-rss";
import embedEverything from "eleventy-plugin-embed-everything";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import Image from "@11ty/eleventy-img";
import { minify as htmlMinify } from "html-minifier-terser";
import { minify as jsMinify } from "terser";
import { PurgeCSS } from "purgecss";
import { readFile } from "node:fs/promises";
import markdownIt from "markdown-it";
import markdownItContainer from "markdown-it-container";
import markdownItAnchor from "markdown-it-anchor";

export default function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("letter", "layouts/letter.njk");
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addPlugin(embedEverything);
  eleventyConfig.addPlugin(pluginRss);

  /* Markdown library + custom block containers.
     ::: callout {.note}   →  <aside class="callout" data-kind="note">…</aside>
     ::: pullquote         →  <blockquote class="pullquote">…</blockquote>
     Driven by the CMS's block toolbar; renders identically whether the
     markdown was written by hand or inserted via the editor. */
  const md = markdownIt({ html: true, linkify: true, typographer: true });
  md.use(markdownItContainer, "callout", {
    validate: (params) => /^callout(\s|$)/.test(params.trim()),
    render: (tokens, idx) => {
      if (tokens[idx].nesting === 1) {
        const params = tokens[idx].info.trim().slice("callout".length).trim();
        const kindMatch = params.match(/\{\.([a-z0-9_-]+)\}/i);
        const kind = kindMatch ? kindMatch[1] : "note";
        return `<aside class="callout" data-kind="${kind}">\n`;
      }
      return `</aside>\n`;
    },
  });
  md.use(markdownItContainer, "pullquote", {
    render: (tokens, idx) =>
      tokens[idx].nesting === 1
        ? `<blockquote class="pullquote">\n`
        : `</blockquote>\n`,
  });
  // Auto-generate IDs on H2/H3 from heading text so /highlights/#foo
  // links (and the like) still work without hand-authoring anchors.
  md.use(markdownItAnchor, {
    level: [2, 3],
    tabIndex: false,
    slugify: (s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
  });
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    // Dense width ladder so the browser's srcset picker can land close to
    // the displayed size on common DPR×viewport combos. 850 is the key
    // step: Lighthouse tests at a 412px CSS viewport with DPR 2, wanting
    // 824 device px — 850 is a near-perfect match, where 900 or 1000
    // would leave ~10–20% oversized.
    widths: [450, 700, 850, 1100, 1400, 1800, "auto"],
    failOnError: false,
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
      sizes: "(max-width: 1023px) 100vw, 50vw",
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

  // "Mar 2026" — for the speaking events list byline. Uses UTC so
  // month-precision dates like `2026-03-01` don't roll backwards a day
  // (and a month) when rendered in a western timezone.
  eleventyConfig.addFilter("monthYearDate", dateObj => {
    return DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat("LLL yyyy");
  });

  /* Group a collection of items by the year of their `date`, newest
     year first. Each group keeps its items sorted by date descending so
     the newest talks within a year show on top. Returns an array of
     { year, items } — Nunjucks can't `Map.entries()` cleanly. */
  eleventyConfig.addFilter("groupByYear", items => {
    const map = new Map();
    for (const item of items) {
      const year = DateTime.fromJSDate(item.data.date, {zone: 'utc'}).toFormat('yyyy');
      if (!map.has(year)) map.set(year, []);
      map.get(year).push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.data.date - a.data.date);
    }
    return [...map.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, list]) => ({ year, items: list }));
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
      safelist: ['is-open', 'rail-collapsed', 'detail-collapsed', 'shell--media', 'is-loading', 'is-success', 'is-error']
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

  // Speaking events — per-file entries in speaking_events/ that don't
  // emit their own pages (permalink: false via dir data) and only show
  // up inside speaking.njk, grouped by year.
  eleventyConfig.addCollection("speaking_event", function(collection) {
    return collection.getAll().filter(function(item) {
      return item.inputPath.match(/^\.\/speaking_events\//) !== null;
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
  eleventyConfig.addPassthroughCopy({ "admin/dist": "admin" });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
}
