/**
 * Property 8 of the ui-renderer design (Requirements 17.2, 17.3, 17.4).
 *
 * `runValidateHook` and `run` read the same in-memory files for the same arguments. The
 * hook must return `run`'s exit code and put every line `run` printed (through `out` or
 * `err`), in order and each followed by `\n`, on stdout for exit 0 and on stderr for
 * exit 1 or 2, with the other stream empty. Passing runs are evidence for this property
 * over the generated inputs only.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { defectiveManifestArb, validManifestArb } from '../../../packages/node-types/test/arbitraries.ts';
import { runValidateHook } from '../src/hook.ts';
import { run, type CliIo } from '../src/run.ts';

const NUM_RUNS = 200;

/** A path that is never listed and whose read throws, to reach the internal-error line. */
const THROWING_PATH = 'act/boom.json';

type Readers = Pick<CliIo, 'readFile' | 'listFiles'>;

interface Scenario {
  /** Bytes of `act/f0.json`, `act/f1.json`, … in order. */
  readonly contents: readonly Uint8Array[];
  readonly argv: readonly string[];
}

const encoder = new TextEncoder();

function encode(text: string): Uint8Array {
  return encoder.encode(text);
}

function fileName(i: number): string {
  return `f${i}.json`;
}

/**
 * In-memory readers: `act/` holds the generated files plus `notes.txt` and
 * `.hidden.json`, `empty/` holds nothing, and every other directory is missing.
 */
function memoryReaders(contents: readonly Uint8Array[]): Readers {
  const files = new Map<string, Uint8Array>();
  contents.forEach((bytes, i) => files.set(`act/${fileName(i)}`, bytes));
  files.set('act/notes.txt', encode('not json'));
  files.set('act/.hidden.json', encode('{}'));
  const dirs = new Map<string, string[]>([
    ['act', [...contents.map((_, i) => fileName(i)), 'notes.txt', '.hidden.json']],
    ['empty', []],
  ]);
  return {
    readFile(path: string): Uint8Array | null {
      if (path === THROWING_PATH) throw new Error('read failed\nPASS spoofed');
      return files.get(path) ?? null;
    },
    listFiles(dir: string): string[] | null {
      const names = dirs.get(dir);
      return names === undefined ? null : [...names];
    },
  };
}

const validBytesArb: fc.Arbitrary<Uint8Array> = validManifestArb.map((m) => encode(JSON.stringify(m)));

const fileBytesArb: fc.Arbitrary<Uint8Array> = fc.oneof(
  { weight: 3, arbitrary: validBytesArb },
  { weight: 3, arbitrary: defectiveManifestArb.map(({ manifest }) => encode(JSON.stringify(manifest))) },
  { weight: 1, arbitrary: fc.jsonValue({ maxDepth: 3 }).map((v) => encode(JSON.stringify(v))) },
  {
    weight: 1,
    // Random JSON objects that pass the profile lookup, so they reach the schema stage.
    arbitrary: fc
      .dictionary(fc.string({ maxLength: 8 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 5 })
      .map((d) => encode(JSON.stringify({ ...d, profile: 'core' }))),
  },
  { weight: 1, arbitrary: fc.uint8Array({ maxLength: 64 }) },
  { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 40 }).map(encode) },
);

/** Plain paths (index `n` is a missing file), globs that match, and arguments that exit 2. */
function argArb(n: number): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 4, arbitrary: fc.nat(n).map((i) => `act/${fileName(i)}`) },
    { weight: 2, arbitrary: fc.constantFrom('act/*.json', 'act/f?.json', 'act\\f*.json', 'act/*') },
    { weight: 1, arbitrary: fc.constant(THROWING_PATH) },
    { weight: 1, arbitrary: fc.constantFrom('empty/*.json', 'missing/*.json', 'act/**.json', 'a*/f0.json') },
  );
}

/** Any mix of contents and arguments, including no arguments. */
const mixedScenarioArb: fc.Arbitrary<Scenario> = fc
  .array(fileBytesArb, { minLength: 1, maxLength: 4 })
  .chain((contents) =>
    fc
      .oneof(
        { weight: 1, arbitrary: fc.constant<string[]>([]) },
        { weight: 6, arbitrary: fc.array(argArb(contents.length), { minLength: 1, maxLength: 4 }) },
      )
      .map((argv) => ({ contents, argv })),
  );

/** Only valid manifests and arguments that resolve to them, so exit 0 is common. */
const passingScenarioArb: fc.Arbitrary<Scenario> = fc
  .array(validBytesArb, { minLength: 1, maxLength: 3 })
  .chain((contents) =>
    fc
      .oneof(
        fc.constant(['act/*.json']),
        fc.array(fc.nat(contents.length - 1).map((i) => `act/${fileName(i)}`), { minLength: 1, maxLength: 3 }),
      )
      .map((argv) => ({ contents, argv })),
  );

const scenarioArb: fc.Arbitrary<Scenario> = fc.oneof(
  { weight: 3, arbitrary: mixedScenarioArb },
  { weight: 1, arbitrary: passingScenarioArb },
);

/** Runs `run` and records its `out` and `err` lines in one list, in call order. */
function runRecorded(argv: readonly string[], readers: Readers): { code: 0 | 1 | 2; lines: string[] } {
  const lines: string[] = [];
  const code = run(argv, {
    readFile: (path) => readers.readFile(path),
    listFiles: (dir) => readers.listFiles(dir),
    out: (line) => lines.push(line),
    err: (line) => lines.push(line),
  });
  return { code, lines };
}

describe('Feature: ui-renderer, Property 8: Hook output reaches the agent on every exit code', () => {
  it('routes every line run prints to stdout on exit 0 and to stderr on exit 1 or 2', () => {
    const seen = new Set<number>();
    fc.assert(
      fc.property(scenarioArb, ({ contents, argv }) => {
        const readers = memoryReaders(contents);
        const expected = runRecorded(argv, readers);
        const hook = runValidateHook(argv, readers);
        seen.add(expected.code);

        expect(hook.code).toBe(expected.code);
        expect(expected.lines.length).toBeGreaterThan(0);
        const text = expected.lines.map((line) => `${line}\n`).join('');
        if (expected.code === 0) {
          expect(hook).toEqual({ code: 0, stdout: text, stderr: '' });
        } else {
          expect(hook).toEqual({ code: expected.code, stdout: '', stderr: text });
        }
      }),
      { numRuns: NUM_RUNS },
    );
    // The generators reach every exit code, so each routing branch was exercised.
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
