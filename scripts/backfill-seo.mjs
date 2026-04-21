#!/usr/bin/env node
/**
 * One-shot migration: copy legacy frontmatter into the `seo:` block on
 * letters/ and pages/ so the CMS SEO panel isn't empty for entries
 * authored before the panel existed. Idempotent — only writes fields
 * that aren't already set on seo.
 *
 *   letters/*.md → seo.description ← excerpt
 *                  seo.image       ← cover.image
 *                  seo.image_alt   ← cover.alt
 *
 *   pages/*.md   → seo.description ← summary
 *                  seo.image       ← cover.image
 *                  seo.image_alt   ← cover.alt
 *
 * Run:  node scripts/backfill-seo.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const COLLECTIONS = [
  { dir: 'letters', descriptionFrom: 'excerpt' },
  { dir: 'pages', descriptionFrom: 'summary' },
];

async function backfillFile(filePath, { descriptionFrom }) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = matter(raw);
  const fm = parsed.data;
  const seo = { ...(fm.seo || {}) };
  const before = JSON.stringify(seo);

  if (!seo.description && fm[descriptionFrom]) {
    seo.description = fm[descriptionFrom];
  }
  if (!seo.image && fm.cover?.image) {
    seo.image = fm.cover.image;
  }
  if (!seo.image_alt && fm.cover?.alt) {
    seo.image_alt = fm.cover.alt;
  }

  if (JSON.stringify(seo) === before) return false;

  fm.seo = seo;
  await writeFile(filePath, matter.stringify(parsed.content, fm));
  return true;
}

async function run() {
  let touched = 0;
  for (const col of COLLECTIONS) {
    const entries = await readdir(col.dir);
    for (const name of entries) {
      if (!name.endsWith('.md')) continue;
      const filePath = path.join(col.dir, name);
      const changed = await backfillFile(filePath, col);
      if (changed) {
        console.log(`  updated: ${filePath}`);
        touched++;
      }
    }
  }
  console.log(`\n${touched} file(s) updated.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
