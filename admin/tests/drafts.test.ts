import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { draftBranchName, listDraftSlugs, refSegment, fromRefSegment } from '../src/core/drafts';
import type { GitHubAdapter } from '../src/core/storage';

/** Whether git accepts a branch name. */
function gitAccepts(branch: string): boolean {
  try {
    execFileSync('git', ['check-ref-format', `refs/heads/${branch}`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const awkward = [
  'My Note',
  'what?',
  'a:b',
  'tilde~1',
  'caret^2',
  'star*',
  'open[bracket',
  'back\\slash',
  'tab\there',
  'bell\x07',
  'del\x7f',
  '100%',
  '%41',
  'a..b',
  '...',
  '.hidden',
  'ends.',
  'ends..',
  'name.lock',
  'name.lock.',
  'x..lock',
  'mail@{home}',
  '@',
  '@{',
  'café notes',
  'emoji 🎉',
  ' leading and trailing ',
];

describe('draft branch names', () => {
  it('leaves ordinary file names as they are', () => {
    for (const stem of ['2024-02-22-hello-world', 'about', 'Notes_2024', 'a.b', 'v1.2.3', 'x@y', 'café']) {
      expect(refSegment(stem)).toBe(stem);
      expect(draftBranchName('posts', stem)).toBe(`draft/posts/${stem}`);
    }
  });

  it.each(awkward)('gives git a name it accepts for %j', (stem) => {
    const branch = draftBranchName('posts', stem);
    expect(gitAccepts(branch)).toBe(true);
  });

  it.each(awkward)('reads %j back from its branch name', (stem) => {
    expect(fromRefSegment(refSegment(stem))).toBe(stem);
  });

  it('covers names git refuses as they are', () => {
    const refused = awkward.filter((stem) => !gitAccepts(`draft/posts/${stem}`));
    // Only these are fine unescaped; they're here for the round trip.
    expect(awkward.filter((stem) => !refused.includes(stem))).toEqual(['100%', '%41', '@']);
  });

  it('keeps different names apart', () => {
    const names = [...awkward, 'My%20Note', 'My Note', '%2E', '.'];
    const branches = names.map((n) => refSegment(n));
    expect(new Set(branches).size).toBe(new Set(names).size);
  });

  it('lists drafts by their file names', async () => {
    const stems = ['hello', 'My Note', 'what?', '100%'];
    const gh = {
      listBranches: async (prefix: string) =>
        [...stems.map((s) => draftBranchName('posts', s)), draftBranchName('postscript', 'x')].filter((b) =>
          b.startsWith(`${prefix}`),
        ),
    } as unknown as GitHubAdapter;
    expect(await listDraftSlugs(gh, 'posts')).toEqual(stems);
  });
});
