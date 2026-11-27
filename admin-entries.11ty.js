/**
 * Build-time index of CMS-editable collections.
 *
 * Emitted to `/admin/entries.json` so the CMS can render list views
 * without N+1 GitHub Contents API round-trips per collection. Each
 * entry's shape matches the in-memory EntryMeta the list component
 * already consumes: title, date, optional subtitle.
 *
 * The index is stale the moment a new entry lands via the CMS —
 * that's why the CMS also falls back to per-file fetches for paths
 * absent from the index and patches its in-memory copy after each
 * save.
 */
export default class {
  data() {
    return {
      permalink: "/admin/entries.json",
      eleventyExcludeFromCollections: true,
      layout: null,
    };
  }

  render({ collections }) {
    // Pull from collections.all (unfiltered by the draft guard on
    // addCollection) so the CMS list view can still see drafts in a
    // production build — it just flags them with a badge rather than
    // hiding them the way the live site does.
    const all = collections.all || [];
    const inFolder = (prefix) => (item) =>
      typeof item.inputPath === "string" && item.inputPath.startsWith(prefix);

    const letters = all.filter(inFolder("./letters/")).map((item) => ({
      path: stripLeadingDot(item.inputPath),
      slug: item.fileSlug,
      title: item.data.title ?? "",
      date: toIso(item.data.date_published ?? item.date),
      draft: item.data.draft === true,
    }));

    const pages = all.filter(inFolder("./pages/")).map((item) => ({
      path: stripLeadingDot(item.inputPath),
      slug: item.fileSlug,
      title: item.data.title ?? "",
      date: toIso(item.date),
      draft: item.data.draft === true,
    }));

    const speakingEvents = all.filter(inFolder("./speaking_events/")).map((item) => ({
      path: stripLeadingDot(item.inputPath),
      slug: item.fileSlug,
      title: item.data.title ?? "",
      date: toIso(item.data.date),
      subtitle: item.data.event_name ?? "",
    }));

    const appearances = all.filter(inFolder("./appearances/")).map((item) => ({
      path: stripLeadingDot(item.inputPath),
      slug: item.fileSlug,
      title: item.data.title ?? "",
      date: toIso(item.data.date),
      subtitle: item.data.source_name ?? "",
    }));

    const payload = {
      generated_at: new Date().toISOString(),
      letters,
      pages,
      speaking_events: speakingEvents,
      appearances,
    };

    return JSON.stringify(payload);
  }
}

function stripLeadingDot(p) {
  return (p || "").replace(/^\.\//, "");
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // A date-only value parses to UTC midnight; keep it date-only so the
  // CMS list doesn't show the previous day west of UTC.
  return d.toISOString().replace("T00:00:00.000Z", "");
}
