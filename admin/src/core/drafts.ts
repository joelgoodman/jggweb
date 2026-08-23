import type { GitHubAdapter } from './storage';

/**
 * Branch-per-entry drafting: opening any entry for editing works
 * against `draft/<collection>/<slug>` instead of committing straight to
 * main. Publishing merges that branch into main (which is also what
 * triggers the site's deploy workflow) and deletes it. Naming the
 * branch after the collection and slug means it's self-describing —
 * listing drafts for a collection is just a matching-refs call, no
 * separate index to keep in sync.
 */
export function draftBranchName(collection: string, slug: string): string {
  return `draft/${collection}/${slug}`;
}

/** Does this entry currently have unpublished changes on a draft branch? */
export async function hasDraftBranch(gh: GitHubAdapter, collection: string, slug: string): Promise<boolean> {
  const sha = await gh.getBranchSha(draftBranchName(collection, slug));
  return sha !== null;
}

/**
 * Ensure a draft branch exists for this entry, branching it from the
 * current tip of `mainBranch` if it doesn't, and return its name.
 */
export async function ensureDraftBranch(
  gh: GitHubAdapter,
  mainBranch: string,
  collection: string,
  slug: string,
): Promise<string> {
  const branch = draftBranchName(collection, slug);
  const existing = await gh.getBranchSha(branch);
  if (existing) return branch;
  const mainSha = await gh.getBranchSha(mainBranch);
  if (!mainSha) throw new Error(`Could not resolve HEAD of "${mainBranch}"`);
  await gh.createBranch(branch, mainSha);
  return branch;
}

/** Merge an entry's draft branch into main and delete it. */
export async function publishDraft(
  gh: GitHubAdapter,
  mainBranch: string,
  collection: string,
  slug: string,
): Promise<'merged' | 'up-to-date'> {
  const branch = draftBranchName(collection, slug);
  const result = await gh.merge(mainBranch, branch, `Publish: ${slug}`);
  await gh.deleteBranch(branch);
  return result;
}

/** Slugs of every in-progress draft in a collection (branch exists, published or not). */
export async function listDraftSlugs(gh: GitHubAdapter, collection: string): Promise<string[]> {
  const prefix = `${collection}/`;
  const branches = await gh.listBranches(`draft/${collection}`);
  return branches
    .filter((b) => b.startsWith(`draft/${prefix}`))
    .map((b) => b.slice(`draft/${prefix}`.length));
}
