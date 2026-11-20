import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { expandArgs, matchSegment, type DirReader } from '../src/expand.ts';

/** Fake reader: maps a directory to the names of the files in it. */
function fakeReader(dirs: Record<string, string[]>): DirReader {
  return {
    listFiles(dir: string): string[] | null {
      return Object.prototype.hasOwnProperty.call(dirs, dir) ? [...(dirs[dir] ?? [])] : null;
    },
  };
}

const reader = fakeReader({
  activities: ['shop.json', 'quiz.json', 'notes.md', 'a1.json', 'a22.json', 'B.json'],
  '.': ['root.json'],
});

describe('expandArgs', () => {
  it('expands activities/*.json to the matching files', () => {
    expect(expandArgs(['activities/*.json'], reader)).toEqual({
      files: ['activities/B.json', 'activities/a1.json', 'activities/a22.json', 'activities/quiz.json', 'activities/shop.json'],
      errors: [],
    });
  });

  it('matches exactly one character with ?', () => {
    expect(expandArgs(['activities/a?.json'], reader).files).toEqual(['activities/a1.json']);
  });

  it('treats \\ as a separator and outputs / paths', () => {
    expect(expandArgs(['activities\\a?.json'], reader).files).toEqual(['activities/a1.json']);
  });

  it('lists the current directory for a pattern without a directory', () => {
    expect(expandArgs(['*.json'], reader).files).toEqual(['root.json']);
  });

  it('sorts by code-unit order and removes duplicates', () => {
    const result = expandArgs(['activities/s*.json', 'activities/*.json', 'activities/shop.json'], reader);
    expect(result.errors).toEqual([]);
    expect(result.files).toEqual([
      'activities/B.json',
      'activities/a1.json',
      'activities/a22.json',
      'activities/quiz.json',
      'activities/shop.json',
    ]);
  });

  it('gives the same result for an already-expanded list as for the pattern', () => {
    const fromPattern = expandArgs(['activities/*.json'], reader);
    const shExpanded = ['activities/shop.json', 'activities/quiz.json', 'activities/a1.json', 'activities/a22.json', 'activities/B.json'];
    expect(expandArgs(shExpanded, reader)).toEqual(fromPattern);
  });

  it('rejects ** and a wildcard in a directory segment', () => {
    const result = expandArgs(['activities/**/*.json', 'a*/b.json'], reader);
    expect(result.files).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('**');
    expect(result.errors[1]).toContain('last path segment');
  });

  it('reports a pattern with no match, including a missing directory', () => {
    const result = expandArgs(['activities/*.yaml', 'missing/*.json'], reader);
    expect(result.files).toEqual([]);
    expect(result.errors).toEqual(['no files match "activities/*.yaml"', 'no files match "missing/*.json"']);
  });

  it('keeps a plain path even when the file does not exist', () => {
    expect(expandArgs(['activities/nope.json'], reader)).toEqual({ files: ['activities/nope.json'], errors: [] });
  });

  it('treats regex metacharacters in a pattern literally', () => {
    const r = fakeReader({ d: ['a.b', 'axb', '(x).json'] });
    expect(expandArgs(['d/a.b', 'd/(?).json'], r).files).toEqual(['d/(x).json', 'd/a.b']);
    expect(expandArgs(['d/a.?'], r).files).toEqual(['d/a.b']);
  });

  // Evidence for Requirement 17.3 over generated directories: the pattern `dir/*`
  // and the shuffled list of its files expand to the same result.
  it('property: pattern and expanded list agree', () => {
    const name = fc.stringMatching(/^[a-zA-Z0-9_-]{1,8}\.json$/);
    fc.assert(
      fc.property(fc.uniqueArray(name, { minLength: 1, maxLength: 10 }), fc.integer(), (names, seed) => {
        const r = fakeReader({ dir: names });
        const shuffled = names
          .map((n, i) => ({ n, k: (i * 2654435761 + seed) >>> 0 }))
          .sort((a, b) => a.k - b.k)
          .map((x) => `dir/${x.n}`);
        expect(expandArgs(shuffled, r)).toEqual(expandArgs(['dir/*.json'], r));
      }),
    );
  });
});

describe('matchSegment', () => {
  it('handles * backtracking and ? on code points', () => {
    expect(matchSegment('a*b*c', 'axxbyyc')).toBe(true);
    expect(matchSegment('a*b*c', 'axxbyy')).toBe(false);
    expect(matchSegment('?', '\u{1F600}')).toBe(true);
    expect(matchSegment('*', '')).toBe(true);
    expect(matchSegment('?', '')).toBe(false);
  });
});
