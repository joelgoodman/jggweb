// SCSS build — sass.compile (modern API) → postcss (autoprefixer + cssnano).
// Replaces the rollup-plugin-postcss pipeline so we're off the deprecated
// legacy Sass JS API. Pass --watch to keep the process alive and rebuild
// on change.

import * as sass from "sass";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";
import { writeFile, mkdir } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";

const isProd = process.env.ELEVENTY_ENV === "production";
const watchMode = process.argv.includes("--watch");

const INPUT = "assets/css/jgg.scss";
const OUTPUT = "_site/assets/css/jgg.css";
const WATCH_DIRS = ["assets/css", "_includes/assets/scss"];

async function build() {
  const start = Date.now();
  const compiled = sass.compile(INPUT, {
    loadPaths: ["_includes/assets/scss", "node_modules"],
    style: isProd ? "compressed" : "expanded",
    sourceMap: !isProd,
    sourceMapIncludeSources: !isProd,
  });

  const plugins = [autoprefixer()];
  if (isProd) plugins.push(cssnano());

  const result = await postcss(plugins).process(compiled.css, {
    from: INPUT,
    to: OUTPUT,
    map: !isProd
      ? { inline: false, annotation: true, prev: compiled.sourceMap }
      : false,
  });

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, result.css);
  if (result.map) await writeFile(`${OUTPUT}.map`, result.map.toString());

  console.log(`[css] built in ${Date.now() - start}ms`);
}

try {
  await build();
} catch (err) {
  console.error(err);
  if (!watchMode) process.exit(1);
}

if (watchMode) {
  let pending;
  const queue = () => {
    clearTimeout(pending);
    pending = setTimeout(() => build().catch(console.error), 50);
  };
  for (const dir of WATCH_DIRS) {
    watch(dir, { recursive: true }, queue);
  }
  console.log(`[css] watching ${WATCH_DIRS.join(", ")}`);
}
