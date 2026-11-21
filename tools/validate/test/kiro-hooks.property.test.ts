/**
 * Property 9 of the ui-renderer design (Requirements 17.2, 17.5).
 *
 * The Activity_Hook passes `{{filePath}}` to the shell inside double quotes, so its matcher
 * is the only control on what reaches the shell (design C13 H1, D19). The matcher is read
 * from `.kiro/hooks/validate-activities.json` at run time. Passing runs are evidence for
 * this property over the generated inputs only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOOK_FILE = join(ROOT, '.kiro', 'hooks', 'validate-activities.json');
const NUM_RUNS = 500;

/** The `matcher` of every hook in the Activity_Hook file, in file order. */
function readMatchers(): string[] {
  const parsed: unknown = JSON.parse(readFileSync(HOOK_FILE, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('hooks' in parsed) || !Array.isArray(parsed.hooks)) {
    throw new Error(`${HOOK_FILE} has no "hooks" array`);
  }
  return parsed.hooks.map((hook: unknown, i: number) => {
    if (typeof hook !== 'object' || hook === null || !('matcher' in hook) || typeof hook.matcher !== 'string') {
      throw new Error(`hook ${i} in ${HOOK_FILE} has no string "matcher"`);
    }
    return hook.matcher;
  });
}

const matchers = readMatchers();
const matcher = new RegExp(matchers[0] ?? '');

/** Every character the design lists as safe: letters, digits, `.`, `_`, `-`, space, `:`, `/`, `\`. */
const SAFE_CHARSET = /^[A-Za-z0-9._ :/\\-]*$/;

/** Characters PowerShell or `cmd.exe` would interpret inside or around `"{{filePath}}"`. */
const SHELL_METACHARS = ['$', '`', '"', ';', '&', '|', '(', ')', '\n', '\r', '%', '^', "'", '<', '>', '*', '?', '!'];

/**
 * Path segments of `s`. A leading drive designator (`C:`) is the root, not a segment, as in
 * Windows paths: `C:activities\x.json` is the drive-relative path `activities\x.json`.
 */
function segments(s: string): string[] {
  return s.replace(/^[A-Za-z]:/, '').split(/[\\/]/);
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SEGMENT_CHARS = [...LETTERS, ...DIGITS, '.', '_', '-'];
const PREFIX_CHARS = [...SEGMENT_CHARS, ' '];

const separatorArb = fc.constantFrom('/', '\\');
const safeSegmentArb = fc.string({ unit: fc.constantFrom(...SEGMENT_CHARS), minLength: 1, maxLength: 10 });
const prefixSegmentArb = fc.string({ unit: fc.constantFrom(...PREFIX_CHARS), minLength: 1, maxLength: 10 });
const driveArb = fc.constantFrom(...LETTERS).map((letter) => `${letter}:`);

/** `segment + separator` for each segment, with an independently chosen separator. */
function joined(segs: readonly string[], seps: readonly string[]): string {
  return segs.map((seg, i) => `${seg}${seps[i] ?? '/'}`).join('');
}

/**
 * A safe prefix (optional drive, optional leading separator, segments that may hold spaces),
 * the segment `activities`, zero or more safe segments and a safe file name ending in `.json`.
 */
const safePathArb: fc.Arbitrary<string> = fc
  .record({
    drive: fc.option(driveArb, { nil: '' }),
    lead: fc.option(separatorArb, { nil: '' }),
    prefix: fc.array(fc.tuple(prefixSegmentArb, separatorArb), { maxLength: 5 }),
    activitiesSep: separatorArb,
    rest: fc.array(fc.tuple(safeSegmentArb, separatorArb), { maxLength: 4 }),
    base: safeSegmentArb,
  })
  .map(
    ({ drive, lead, prefix, activitiesSep, rest, base }) =>
      `${drive}${lead}` +
      joined(prefix.map(([s]) => s), prefix.map(([, sep]) => sep)) +
      `activities${activitiesSep}` +
      joined(rest.map(([s]) => s), rest.map(([, sep]) => sep)) +
      `${base}.json`,
  );

/** A safe path with one shell metacharacter or other unsafe character inserted anywhere. */
const unsafeInsertArb: fc.Arbitrary<string> = fc
  .tuple(
    safePathArb,
    fc.oneof(fc.constantFrom(...SHELL_METACHARS), fc.constantFrom('\t', '\u0000', 'é', '\u00a0', '\u2028', '#', '=', ',')),
    fc.nat(),
  )
  .map(([path, ch, at]) => {
    const i = at % (path.length + 1);
    return `${path.slice(0, i)}${ch}${path.slice(i)}`;
  });

/** Strings built from path-like pieces, metacharacters and other characters, joined at random. */
const tokenStringArb: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: safeSegmentArb },
      { weight: 3, arbitrary: separatorArb },
      { weight: 2, arbitrary: fc.constantFrom('activities', '.json', 'C:', ' ', ':', '..') },
      { weight: 2, arbitrary: fc.constantFrom(...SHELL_METACHARS) },
      { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 3 }) },
    ),
    { minLength: 1, maxLength: 14 },
  )
  .map((tokens) => tokens.join(''));

const anyStringArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: safePathArb },
  { weight: 3, arbitrary: unsafeInsertArb },
  { weight: 3, arbitrary: tokenStringArb },
  { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 40 }) },
);

describe('Feature: ui-renderer, Property 9: The activity matcher accepts only shell-safe paths', () => {
  it('reads one matcher shared by both Activity_Hook hooks', () => {
    expect(matchers).toHaveLength(2);
    expect(matchers[1]).toBe(matchers[0]);
    expect(matcher.flags).toBe('');
  });

  it('accepts a string only if it is shell-safe, ends with .json and has an activities segment', () => {
    let accepted = 0;
    let rejectedUnsafe = 0;
    fc.assert(
      fc.property(anyStringArb, (s) => {
        if (!matcher.test(s)) {
          if (SHELL_METACHARS.some((ch) => s.includes(ch))) rejectedUnsafe += 1;
          return;
        }
        accepted += 1;
        expect(s).toMatch(SAFE_CHARSET);
        expect(s.endsWith('.json')).toBe(true);
        expect(segments(s)).toContain('activities');
      }),
      { numRuns: NUM_RUNS },
    );
    // Both branches were reached, so the implication was checked on matching strings and
    // the generators produced strings with shell metacharacters.
    expect(accepted).toBeGreaterThan(0);
    expect(rejectedUnsafe).toBeGreaterThan(0);
  });

  it('matches every safe path under an activities segment, with either separator', () => {
    fc.assert(
      fc.property(safePathArb, (path) => {
        expect(matcher.test(path)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
