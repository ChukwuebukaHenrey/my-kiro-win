// Property 9 (design "Correctness Properties"; Architecture Spec §A3 property (b) for the
// practice-path profile). Follows the replace-at-path idea of the shop-challenge validator property
// test in `apps/shop-challenge/test/validator.property.test.ts`, with foci on the practice node type
// configs. A passing run is evidence for this property over the generated values, not a proof.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateManifest, type Manifest, type ValidationResult } from '@dreame/schema';
import { practiceProfile } from '../src/profile.ts';
import { practiceManifestArb } from './practice-arbitraries.ts';

const NUM_RUNS = 200;

/** The diagnostics bound of Requirement 10.2 (`HARD_LIMITS.maxDiagnostics`). */
const MAX_DIAGNOSTICS = 50;

type Path = readonly (string | number)[];

/** Every position inside `v` (object keys and array indices), parents before children. */
function collectPaths(v: unknown, prefix: Path, out: Path[]): void {
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      const p = [...prefix, i];
      out.push(p);
      collectPaths(x, p, out);
    });
  } else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const p = [...prefix, k];
      out.push(p);
      collectPaths(x, p, out);
    }
  }
}

/**
 * Where the replaced value goes: anywhere (`type` null), anywhere at or below the config of a node
 * of `type` (`key` null), or at or below `config.<key>` of such a node. When no node of that type
 * has `config.<key>` (for example an absent optional `tutorShare`), the key is added with the
 * random value.
 */
interface Focus {
  readonly label: string;
  readonly type: string | null;
  readonly key: string | null;
}

const FOCI: readonly Focus[] = [
  { label: 'any', type: null, key: null },
  { label: 'recall', type: 'recall', key: null },
  { label: 'recall.options', type: 'recall', key: 'options' },
  { label: 'recall.correctOptionId', type: 'recall', key: 'correctOptionId' },
  { label: 'reviewQueue', type: 'reviewQueue', key: null },
  { label: 'reviewQueue.from', type: 'reviewQueue', key: 'from' },
  { label: 'masterySummary', type: 'masterySummary', key: null },
  { label: 'masterySummary.from', type: 'masterySummary', key: 'from' },
  { label: 'masterySummary.tutorShare', type: 'masterySummary', key: 'tutorShare' },
];

interface Replacement {
  readonly focus: Focus;
  readonly pick: number;
  readonly value: unknown;
}

/** Sets `parent[key] = value`; defineProperty, so a `__proto__` key stays an own data property. */
function setAt(parent: unknown, key: string | number, value: unknown): void {
  if (Array.isArray(parent) && typeof key === 'number') {
    parent[key] = value;
  } else if (parent !== null && typeof parent === 'object') {
    Object.defineProperty(parent, String(key), { value, writable: true, enumerable: true, configurable: true });
  }
}

/** Indices of the nodes of type `type` in `doc` whose `config` is an object. */
function nodeIndices(doc: unknown, type: string): number[] {
  const nodes = (doc as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const out: number[] = [];
  nodes.forEach((n, i) => {
    if (n === null || typeof n !== 'object' || (n as { type?: unknown }).type !== type) return;
    const config = (n as { config?: unknown }).config;
    if (config !== null && typeof config === 'object' && !Array.isArray(config)) out.push(i);
  });
  return out;
}

/**
 * A JSON copy of `m` with the value at one path replaced by `r.value`, the path chosen by `r.pick`
 * within `r.focus`. Returns the copy and the focus label when the replacement landed inside it
 * (`null` for `any`, or when the manifest has no node of the focused type).
 */
function replaceOne(m: Manifest, r: Replacement): { doc: unknown; focused: string | null } {
  const doc: unknown = JSON.parse(JSON.stringify(m));
  const all: Path[] = [];
  collectPaths(doc, [], all);
  const { type, key } = r.focus;
  const indices = type === null ? [] : nodeIndices(doc, type);
  let pool: Path[] = all;
  let focused: string | null = null;
  if (type !== null && indices.length > 0) {
    const inConfig = all.filter(
      (p) => p.length >= 3 && p[0] === 'nodes' && typeof p[1] === 'number' && indices.includes(p[1]) && p[2] === 'config',
    );
    const inKey = key === null ? inConfig : inConfig.filter((p) => p.length >= 4 && p[3] === key);
    if (inKey.length === 0 && key !== null) {
      // No node of this type has `config.<key>`: add it with the random value.
      const i = indices[r.pick % indices.length]!;
      const config = ((doc as { nodes: unknown[] }).nodes[i] as { config: unknown }).config;
      setAt(config, key, r.value);
      return { doc, focused: r.focus.label };
    }
    pool = inKey;
    focused = r.focus.label;
  }
  const path = pool[r.pick % pool.length];
  if (path === undefined) return { doc, focused: null };
  let parent: unknown = doc;
  for (const k of path.slice(0, -1)) parent = (parent as Record<string | number, unknown>)[k];
  const last = path[path.length - 1];
  if (last === undefined) return { doc, focused: null };
  setAt(parent, last, r.value);
  return { doc, focused };
}

/** Random JSON, sometimes any JavaScript value (`fc.anything()`). */
const replacementValueArb: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 4, arbitrary: fc.jsonValue({ maxDepth: 3 }) },
  { weight: 1, arbitrary: fc.anything({ maxDepth: 2 }) },
);

const replacementArb: fc.Arbitrary<Replacement> = fc.record({
  focus: fc.constantFrom(...FOCI),
  pick: fc.nat(),
  value: replacementValueArb,
});

/** `ok` is a boolean and there are at most 50 diagnostics, each with a string `code` and `path`. */
function expectBoundedResult(result: ValidationResult): void {
  expect(typeof result.ok).toBe('boolean');
  expect(result.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS);
  for (const d of result.diagnostics) {
    expect(typeof d.code).toBe('string');
    expect(typeof d.path).toBe('string');
  }
}

describe('Feature: practice-path, Property 9: The validator does not crash on random input with the practice profile', () => {
  // **Validates: Requirements 10.2, 10.4**
  it('Feature: practice-path, Property 9: validateManifest returns a bounded result for any JSON value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expectBoundedResult(validateManifest(value, practiceProfile));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: practice-path, Property 9: validateManifest returns a bounded result for any value from fc.anything()', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expectBoundedResult(validateManifest(value, practiceProfile));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: practice-path, Property 9: validateManifest returns a bounded result for practice manifests with one value replaced', () => {
    const hits = new Map<string, number>();
    fc.assert(
      fc.property(practiceManifestArb, replacementArb, (manifest, replacement) => {
        const { doc, focused } = replaceOne(manifest, replacement);
        if (focused !== null) hits.set(focused, (hits.get(focused) ?? 0) + 1);
        expectBoundedResult(validateManifest(doc, practiceProfile));
      }),
      { numRuns: NUM_RUNS },
    );
    // The generator reached the practice node type configs, not only the shared fields.
    for (const focus of FOCI) {
      if (focus.type !== null) expect(hits.get(focus.label) ?? 0, focus.label).toBeGreaterThan(0);
    }
  });
});
