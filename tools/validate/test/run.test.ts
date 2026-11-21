import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Diagnostic } from '@dreame/schema';
import { run, type CliIo } from '../src/run.ts';
import { formatDiagnostic } from '../src/format.ts';

/** Characters `escapeControl` must never let through (mirrors `format.ts`). */
const RAW_UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

type FakeIo = CliIo & { stdout: string[]; stderr: string[] };

/**
 * In-memory `CliIo`. `files` maps a path to its bytes (a string is UTF-8 encoded),
 * `dirs` maps a directory to its file names, and `throwOn` makes `readFile` throw.
 */
function fakeIo(
  files: Record<string, Uint8Array | string> = {},
  dirs: Record<string, string[]> = {},
  throwOn: Record<string, unknown> = {},
): FakeIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    readFile(path: string): Uint8Array | null {
      if (Object.hasOwn(throwOn, path)) throw throwOn[path];
      if (!Object.hasOwn(files, path)) return null;
      const data = files[path] as Uint8Array | string;
      return typeof data === 'string' ? new TextEncoder().encode(data) : data;
    },
    listFiles(dir: string): string[] | null {
      return Object.hasOwn(dirs, dir) ? [...(dirs[dir] as string[])] : null;
    },
    out(line: string): void {
      stdout.push(line);
    },
    err(line: string): void {
      stderr.push(line);
    },
  };
}

/** Small valid core manifest: content → choice → one of two outcomes, `requires` exact. */
function validManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    profile: 'core',
    activityId: 'cli-sample',
    version: 1,
    requires: { content: 1, choice: 1, outcome: 1 },
    entryNodeId: 'intro',
    fallbackOutcomeId: 'tryAgain',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      { id: 'intro', type: 'content', config: { body: 'Welcome.' }, edges: [{ to: 'q' }] },
      {
        id: 'q',
        type: 'choice',
        config: {
          prompt: 'Ready?',
          options: [
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ],
        },
        edges: [{ to: 'done', when: { op: 'eq', ref: { answer: 'q' }, value: 'yes' } }, { to: 'tryAgain' }],
      },
      { id: 'done', type: 'outcome', config: { title: 'Done', body: 'Well done.' }, edges: [] },
      { id: 'tryAgain', type: 'outcome', config: { title: 'Try again', body: 'Come back soon.' }, edges: [] },
    ],
    theme: 'default',
  };
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

describe('run (validate CLI core)', () => {
  it('prints PASS and exits 0 for a valid manifest', () => {
    const io = fakeIo({ 'a.json': json(validManifest()) });
    expect(run(['a.json'], io)).toBe(0);
    expect(io.stdout).toEqual(['PASS a.json']);
    expect(io.stderr).toEqual([]);
  });

  it('prints PASS with an indented requires-unused warning and exits 0', () => {
    // `requires` still lists `choice`, but the choice node is removed.
    const m = validManifest();
    m['variables'] = [{ id: 'score', type: 'number', initial: 0 }];
    const nodes = (m['nodes'] as Array<Record<string, unknown>>).filter((n) => n['id'] !== 'q');
    nodes[0] = {
      id: 'intro',
      type: 'content',
      config: { body: 'Welcome.' },
      edges: [{ to: 'done', when: { op: 'gte', ref: { var: 'score' }, value: 1 } }, { to: 'tryAgain' }],
    };
    m['nodes'] = nodes;
    const io = fakeIo({ 'w.json': json(m) });
    expect(run(['w.json'], io)).toBe(0);
    expect(io.stdout[0]).toBe('PASS w.json');
    expect(io.stdout.slice(1)).toHaveLength(1);
    expect(io.stdout[1]).toMatch(/^ {2}warning refs\/requires-unused at \/requires\/choice: /);
  });

  it('prints FAIL with the diagnostic and exits 1 for a dangling edge', () => {
    const m = validManifest();
    (m['nodes'] as Array<Record<string, unknown>>)[0] = {
      id: 'intro',
      type: 'content',
      config: { body: 'Welcome.' },
      edges: [{ to: 'nowhere' }],
    };
    const io = fakeIo({ 'd.json': json(m) });
    expect(run(['d.json'], io)).toBe(1);
    expect(io.stdout[0]).toBe('FAIL d.json');
    expect(io.stdout.some((l) => /^ {2}error [a-z]+\/dangling-ref at /.test(l))).toBe(true);
  });

  it('reports parse/too-large for oversize bytes without decoding them', () => {
    // 0xFF is never valid UTF-8, so a decode attempt would add parse/invalid-utf8.
    const io = fakeIo({ 'big.json': new Uint8Array(65_537).fill(0xff) });
    expect(run(['big.json'], io)).toBe(1);
    expect(io.stdout).toHaveLength(2);
    expect(io.stdout[0]).toBe('FAIL big.json');
    expect(io.stdout[1]).toMatch(/^ {2}error parse\/too-large at : file is 65537 bytes/);
  });

  it('reports parse/invalid-utf8 for invalid UTF-8 bytes', () => {
    const io = fakeIo({ 'bad.json': new Uint8Array([0x7b, 0xff, 0x7d]) });
    expect(run(['bad.json'], io)).toBe(1);
    expect(io.stdout).toEqual(['FAIL bad.json', '  error parse/invalid-utf8 at : file is not valid UTF-8']);
  });

  it('reports parse/invalid-json for invalid JSON', () => {
    const io = fakeIo({ 'j.json': '{"schemaVersion":' });
    expect(run(['j.json'], io)).toBe(1);
    expect(io.stdout[0]).toBe('FAIL j.json');
    expect(io.stdout[1]).toMatch(/^ {2}error parse\/invalid-json at /);
  });

  it.each(['nope', '__proto__', 'toString'])('reports unknown-profile for profile %j', (profile) => {
    const io = fakeIo({ 'p.json': json({ ...validManifest(), profile }) });
    expect(run(['p.json'], io)).toBe(1);
    expect(io.stdout).toHaveLength(2);
    expect(io.stdout[0]).toBe('FAIL p.json');
    expect(io.stdout[1]).toMatch(/^ {2}error parse\/unknown-profile at \/profile: /);
    expect(io.stdout[1]).toContain('one of: core');
  });

  it('reports unknown-profile when profile is missing', () => {
    const m = validManifest();
    delete m['profile'];
    const io = fakeIo({ 'p.json': json(m) });
    expect(run(['p.json'], io)).toBe(1);
    expect(io.stdout[1]).toMatch(/parse\/unknown-profile/);
  });

  it('prints FAIL for a missing plain path, exits 1 and still checks later files', () => {
    const io = fakeIo({ 'ok.json': json(validManifest()) });
    expect(run(['missing.json', 'ok.json'], io)).toBe(1);
    expect(io.stdout).toEqual(['FAIL missing.json: file is missing or unreadable', 'PASS ok.json']);
  });

  it('prints FAIL with internal error and no stack trace, then continues with later files', () => {
    const io = fakeIo({ 'b.json': json(validManifest()) }, {}, { 'a.json': new Error('disk on fire\nPASS fake') });
    expect(run(['a.json', 'b.json'], io)).toBe(1);
    expect(io.stdout).toEqual(['FAIL a.json: internal error: disk on fire\\u000aPASS fake', 'PASS b.json']);
    expect(io.stdout.join('\n')).not.toMatch(/\bat .+:\d+:\d+/);
  });

  it('exits 2 with usage on stderr for no arguments', () => {
    const io = fakeIo();
    expect(run([], io)).toBe(2);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.some((l) => l.startsWith('usage: pnpm validate'))).toBe(true);
  });

  it('exits 2 with usage on stderr for a pattern that matches no files', () => {
    const io = fakeIo({}, { activities: ['README.md'] });
    expect(run(['activities/*.json'], io)).toBe(2);
    expect(io.stdout).toEqual([]);
    expect(io.stderr).toContain('error: no files match "activities/*.json"');
    expect(io.stderr.some((l) => l.startsWith('usage: pnpm validate'))).toBe(true);
  });

  it('prints control characters from a manifest string escaped, on one line', () => {
    const profile = 'x\n\u001b[32mPASS\u2028fake\u009b31m\u202e';
    const io = fakeIo({ 'e.json': json({ ...validManifest(), profile }) });
    expect(run(['e.json'], io)).toBe(1);
    expect(io.stdout).toHaveLength(2);
    for (const line of io.stdout) {
      expect(line).not.toMatch(RAW_UNSAFE);
      expect(line.includes('\n')).toBe(false);
    }
    expect(io.stdout[1]).toContain('\\u2028');
    expect(io.stdout[1]).toContain('\\u009b');
    expect(io.stdout[1]).toContain('\\u202e');
  });

  // Task 8.4 adds real-file cases below this line.

  describe('real files (Requirements 19.2, 19.8, 19.10)', () => {
    // Repo root as a `/`-separated prefix, so the CLI sees the same path form it prints.
    const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).split('\\').join('/');

    /** `CliIo` backed by `node:fs`, mirroring `src/cli.ts`, with output captured. */
    function fsIo(): FakeIo {
      const stdout: string[] = [];
      const stderr: string[] = [];
      return {
        stdout,
        stderr,
        readFile(path: string): Uint8Array | null {
          try {
            return readFileSync(path);
          } catch {
            return null;
          }
        },
        listFiles(dir: string): string[] | null {
          try {
            return readdirSync(dir, { withFileTypes: true })
              .filter((entry) => entry.isFile())
              .map((entry) => entry.name);
          } catch {
            return null;
          }
        },
        out(line: string): void {
          stdout.push(line);
        },
        err(line: string): void {
          stderr.push(line);
        },
      };
    }

    it('expands activities/*.json to the demo manifests only and passes them', () => {
      const io = fsIo();
      expect(run([`${ROOT}activities/*.json`], io)).toBe(0);
      expect(io.stderr).toEqual([]);
      const statusLines = io.stdout.filter((l) => /^(PASS|FAIL) /.test(l));
      expect(statusLines).toEqual([
        `PASS ${ROOT}activities/core-demo-study-break.json`,
        `PASS ${ROOT}activities/shop-gift-bundle.json`,
      ]);
      expect(io.stdout.join('\n')).not.toContain('fixtures');
    });

    it('fails the broken fixture with refs/dangling-ref and exits 1', () => {
      const io = fsIo();
      const file = `${ROOT}activities/fixtures/broken-dangling-edge.json`;
      expect(run([file], io)).toBe(1);
      expect(io.stdout[0]).toBe(`FAIL ${file}`);
      expect(io.stdout.join('\n')).toContain('refs/dangling-ref');
    });

    it('passes the shop-challenge demo and fails the Shop_Fixture with one select-unsatisfiable (Requirements 17.7, 17.8)', () => {
      const demo = `${ROOT}activities/shop-gift-bundle.json`;
      const demoIo = fsIo();
      expect(run([demo], demoIo)).toBe(0);
      expect(demoIo.stdout).toEqual([`PASS ${demo}`]);

      const fixture = `${ROOT}activities/fixtures/broken-shop-over-budget.json`;
      const io = fsIo();
      expect(run([fixture], io)).toBe(1);
      expect(io.stdout[0]).toBe(`FAIL ${fixture}`);
      const diagnostics = io.stdout.slice(1);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatch(/^ {2}error conditions\/select-unsatisfiable at /);
    });
  });
});

describe('formatDiagnostic', () => {
  const unsafe = fc.constantFrom('\n', '\r', '\t', '\u0000', '\u001b', '\u007f', '\u0085', '\u009b', '\u2028', '\u2029', '\u202e', '\u2066');
  const text = fc
    .array(fc.oneof(fc.string({ unit: 'binary', maxLength: 8 }), unsafe), { maxLength: 12 })
    .map((parts) => parts.join(''));

  it('Feature: runtime-core, CLI: formatDiagnostic output is one line with no raw control character', () => {
    fc.assert(
      fc.property(text, text, (path, message) => {
        const d: Diagnostic = { severity: 'error', stage: 'schema', code: 'schema', path, message };
        const line = formatDiagnostic(d);
        expect(line).not.toMatch(RAW_UNSAFE);
        expect(line.startsWith('  error schema/schema at ')).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
