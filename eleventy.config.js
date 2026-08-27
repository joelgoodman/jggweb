import { DateTime } from "luxon";
import pluginRss from "@11ty/eleventy-plugin-rss";
import embedEverything from "eleventy-plugin-embed-everything";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import Image from "@11ty/eleventy-img";
import { minify as htmlMinify } from "html-minifier-terser";
import { minify as jsMinify } from "terser";
import { PurgeCSS } from "purgecss";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { GlobalFonts, createCanvas, loadImage } from "@napi-rs/canvas";
import markdownIt from "markdown-it";
import markdownItContainer from "markdown-it-container";
import markdownItAnchor from "markdown-it-anchor";
import slideEmbedsPlugin from "./eleventy-plugins/slide-embeds.js";
import videoSchemaPlugin from "./eleventy-plugins/video-schema.js";

export default function(eleventyConfig) {
  eleventyConfig.addLayoutAlias("letter", "layouts/letter.njk");
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addPlugin(embedEverything);
  eleventyConfig.addPlugin(pluginRss);
  // Registered AFTER embed-everything so it only picks up URLs that
  // plugin missed (Speakerdeck / SlideShare / Figma / Canva).
  eleventyConfig.addPlugin(slideEmbedsPlugin);
  // Emits VideoObject JSON-LD for every YouTube iframe in the rendered
  // output — feeds AI search / video rich results with structured
  // metadata that plain iframes don't expose.
  eleventyConfig.addPlugin(videoSchemaPlugin);

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
    outputDir: "_site/assets/img/responsive/",
    urlPath: "/assets/img/responsive/",
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

  /* OG share image shortcode — composites the letter title over its cover
     image (full color, title set in the site's variable font at true
     ExtraBold via the wght axis) at standard 1200x630 social-card size.
     Title sits in a left-aligned column anchored to the bottom-right.
     Output is hashed on the source path + title so unchanged letters skip
     regeneration between builds instead of re-running sharp/canvas every
     time. */
  const OG_WIDTH = 1200;
  const OG_HEIGHT = 630;
  const OG_MARGIN = 45;
  const OG_COLUMN_WIDTH = Math.round(OG_WIDTH * 0.65);
  const OG_OUTPUT_DIR = "_site/assets/img/og/";
  const OG_URL_PATH = "/assets/img/og/";
  let ogFontRegistered = false;

  // Emoji rarely exist in the subsetted brand font, so they'd either
  // fall back to a mismatched system glyph or throw wrapping off by
  // measuring differently than they draw. Strip them for the card only —
  // the real title (browser tab, page heading) keeps them.
  function stripEmoji(text) {
    return text
      .replace(/\p{Extended_Pictographic}\u{FE0F}?/gu, "") // pictograph + optional variation selector
      .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "") // skin-tone modifiers
      .replace(/\u{200D}/gu, "") // zero-width joiner
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function wrapOgTitle(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // Crop straight to a caller-given focal point (normalized 0-1 x/y)
  // instead of guessing — for the rare photo where entropy-based auto
  // crop misses the actual subject (e.g. a portrait-orientation source
  // squeezed into the wide card, where the subject isn't in whichever
  // band has the most raw visual texture).
  async function extractAroundFocus(image, focus) {
    const { width: srcW, height: srcH } = await image.metadata();
    const targetAspect = OG_WIDTH / OG_HEIGHT;
    const sourceAspect = srcW / srcH;

    const cropW = sourceAspect > targetAspect ? Math.round(srcH * targetAspect) : srcW;
    const cropH = sourceAspect > targetAspect ? srcH : Math.round(srcW / targetAspect);

    const left = Math.min(Math.max(Math.round(focus.x * srcW - cropW / 2), 0), srcW - cropW);
    const top = Math.min(Math.max(Math.round(focus.y * srcH - cropH / 2), 0), srcH - cropH);

    return image.extract({ left, top, width: cropW, height: cropH }).resize(OG_WIDTH, OG_HEIGHT);
  }

  async function renderOgImage(srcPath, title, focus) {
    if (!ogFontRegistered) {
      GlobalFonts.registerFromPath(
        "_includes/assets/fonts/PlusJakartaSans-VariableFont_wght-subset.woff2",
        "OGTitle"
      );
      ogFontRegistered = true;
    }

    // Stay in a lossless buffer (PNG) through every intermediate step —
    // sharp only encodes to JPEG once, at the very end, so text edges and
    // photo detail don't take a second generation of compression loss.
    // .rotate() with no args bakes in the EXIF orientation before any
    // crop/resize — sharp doesn't do this automatically, so source photos
    // shot in portrait or upside-down (EXIF orientation 2-8) would
    // otherwise composite onto the card exactly as the raw sensor stored
    // them.
    const cropped = focus
      ? await extractAroundFocus(sharp(srcPath).rotate(), focus)
      : sharp(srcPath).rotate().resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "entropy" });
    const bg = await cropped.png().toBuffer();

    const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(await loadImage(bg), 0, 0, OG_WIDTH, OG_HEIGHT);

    const columnRight = OG_WIDTH - OG_MARGIN;

    const cleanTitle = title ? stripEmoji(title) : "";

    if (cleanTitle) {
      ctx.fontVariationSettings = '"wght" 800';
      ctx.letterSpacing = "-0.02em";
      let fontSize = 110;
      let lines;
      do {
        ctx.font = `${fontSize}px OGTitle`;
        // OG_COLUMN_WIDTH is a wrap ceiling, not a fixed box — short
        // titles shouldn't reserve the full width.
        lines = wrapOgTitle(ctx, cleanTitle, OG_COLUMN_WIDTH);
        if (lines.length <= 2) break;
        fontSize -= 4;
      } while (fontSize > 44);

      // Anchor the block to its actual widest line so it always sits
      // flush against the right margin, instead of floating inside a
      // column sized for the wrap ceiling.
      const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const columnLeft = columnRight - maxLineWidth;

      // Diagonal scrim concentrated behind the bottom-right text column —
      // keeps the title legible without dimming the whole photo.
      const scrim = ctx.createLinearGradient(
        columnLeft - 80, OG_HEIGHT * 0.3,
        OG_WIDTH, OG_HEIGHT
      );
      scrim.addColorStop(0, "rgba(8,8,10,0)");
      scrim.addColorStop(1, "rgba(8,8,10,0.6)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

      const lineHeight = fontSize * 0.95;
      ctx.fillStyle = "#f0ead8";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      let y = OG_HEIGHT - OG_MARGIN - (lines.length - 1) * lineHeight;
      for (const line of lines) {
        ctx.fillText(line, columnLeft, y);
        y += lineHeight;
      }
    }

    // Single, tuned JPEG encode — mozjpeg + no chroma subsampling so the
    // cream text edges and photo color stay clean.
    return sharp(canvas.toBuffer("image/png"))
      .jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  }

  const ogImageCache = new Map();
  eleventyConfig.addFilter("ogImage", async function(src, title, focus) {
    if (!src) return "";
    const focusKey = focus && typeof focus.x === "number" && typeof focus.y === "number"
      ? `${focus.x},${focus.y}`
      : "";
    const cacheKey = `${src}::${title || ""}::${focusKey}`;
    if (ogImageCache.has(cacheKey)) return ogImageCache.get(cacheKey);

    const hash = createHash("sha1").update(cacheKey).digest("hex").slice(0, 12);
    const outputPath = `${OG_OUTPUT_DIR}${hash}.jpg`;
    const url = `${OG_URL_PATH}${hash}.jpg`;

    try {
      await stat(outputPath);
      ogImageCache.set(cacheKey, url);
      return url;
    } catch {
      // Not on disk yet — fall through and render it.
    }

    try {
      const buf = await renderOgImage(`assets/img/${src}`, title, focusKey ? focus : null);
      await mkdir(OG_OUTPUT_DIR, { recursive: true });
      await writeFile(outputPath, buf);
      ogImageCache.set(cacheKey, url);
      return url;
    } catch (err) {
      console.error(`[ogImage] ${src}:`, err.message);
      return `/assets/img/${src}`;
    }
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

  /* First-paragraph extractor for SEO description fallbacks. Takes
     rendered HTML, iterates <p> elements, and returns the first one
     that isn't part of site chrome (subscribe panel, letter-list
     overlay, now-playing widget). Semantic wrapper elements like
     <nav>/<aside>/<footer> are stripped first, but the slide-panels
     live inside <main> so we also skip paragraphs whose class attr
     names the panel that owns them. */
  // Trailing \b would fail against BEM-style `subscribe-panel__desc`
  // because `_` is a regex word char — no boundary between `l` and
  // `_`. Match the prefix substring instead; BEM descendants all start
  // with the block name so this stays authoritative. `detail__eyebrow`
  // gets skipped too — eyebrows are category labels, not descriptions.
  const CHROME_PARAGRAPH = /class="[^"]*(?:subscribe-panel|letter-list-panel|now-playing|site-footer|detail__eyebrow)/;
  eleventyConfig.addFilter("firstParagraphText", (html, maxLen = 200) => {
    if (!html) return "";
    const cleaned = String(html).replace(
      /<(nav|aside|footer|script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    );
    const regex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = regex.exec(cleaned)) !== null) {
      if (CHROME_PARAGRAPH.test(m[1])) continue;
      const text = m[2]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      if (text.length <= maxLen) return text;
      return text.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + "…";
    }
    return "";
  });

  /* Absolute URL for a site-relative path (e.g. "/assets/img/x.jpg"). */
  eleventyConfig.addFilter("toAbsolute", (path, base) => {
    if (!path) return "";
    if (/^https?:\/\//.test(path)) return path;
    const root = (base || "").replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : "/" + path;
    return root + suffix;
  });

  /* Nunjucks lacks a `.startswith` string method; this filter patches
     that gap so templates can branch on URL prefixes and image paths
     without reaching for regex. */
  eleventyConfig.addFilter("startsWith", (str, prefix) =>
    String(str || "").startsWith(prefix || "")
  );

  /* Tags come in as either a string ("higher education, small business")
     or an array (Eleventy normalizes single-string `tags: foo` to an
     array in collection contexts). Return a trimmed, deduped array of
     non-empty tag labels for emitting article:tag meta and similar. */
  eleventyConfig.addFilter("tagList", (tags) => {
    if (!tags) return [];
    const arr = Array.isArray(tags) ? tags : String(tags).split(",");
    const seen = new Set();
    return arr
      .map((t) => String(t).trim())
      .filter((t) => t && !seen.has(t) && seen.add(t));
  });

  /* Normalize any candidate description (excerpt, summary, first
     paragraph) for use inside <meta name="description"> and social
     card attributes: strip HTML tags, decode entities, collapse
     whitespace, and soft-truncate near a word boundary at ~160 chars
     — the ceiling most crawlers display. */
  eleventyConfig.addFilter("metaDescription", (text, maxLen = 160) => {
    if (!text) return "";
    const stripped = String(text)
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped.length <= maxLen) return stripped;
    return stripped.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + "…";
  });

  eleventyConfig.addShortcode("yt", (videoURL, title) => {
		const url = new URL(videoURL);
		const id = url.searchParams.get("v");
		return `<iframe class="yt-embed" src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video player${
			title ? ` for ${title}` : ""
		}" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
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
    // Collection items with permalink:false (speaking_events) pass
    // through every transform with outputPath=false, not a string —
    // guard before calling .endsWith().
    if (
      process.env.ELEVENTY_ENV !== 'production' ||
      typeof this.outputPath !== 'string' ||
      !this.outputPath.endsWith('.html') ||
      !content.includes('<!-- INLINE CSS-->')
    ) {
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
    if( process.env.ELEVENTY_ENV !== 'production' ||
        !this.outputPath ||
        !this.outputPath.endsWith(".html") ) {
      return content;
    }

    let minified = await htmlMinify(content, {
      useShortDoctype: true,
      removeComments: true,
      collapseWhitespace: true
    });
    return minified;
  });

  // `draft: true` in frontmatter hides an entry from production
  // builds — feed, sitemap, collection listings, and (via the dir
  // data files in letters/ and pages/) its own page output. Dev
  // builds still render drafts so you can preview before publishing.
  const isProduction = process.env.ELEVENTY_ENV === 'production';
  const isPublished = (item) => !(isProduction && item.data?.draft === true);

  // only content in the `letters/` directory
  eleventyConfig.addCollection("letter", function(collection) {
    return collection.getAllSorted().filter(function(item) {
      return item.inputPath.match(/^\.\/letters\//) !== null && isPublished(item);
    });
  });

  // Pages — long-form static pages in the pages/ directory. Replaces
  // the tag-based `collections.page` so we can apply the same draft
  // filter letters get.
  eleventyConfig.addCollection("page", function(collection) {
    return collection.getAllSorted().filter(function(item) {
      return item.inputPath.match(/^\.\/pages\//) !== null && isPublished(item);
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

  // Appearances — external media (video/podcast/etc.) Joel is featured
  // in. Per-file entries in appearances/ that don't emit their own
  // pages (permalink: false via dir data) and only show up inside
  // appearances.njk, grouped by year.
  eleventyConfig.addCollection("appearance", function(collection) {
    return collection.getAll().filter(function(item) {
      return item.inputPath.match(/^\.\/appearances\//) !== null;
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
