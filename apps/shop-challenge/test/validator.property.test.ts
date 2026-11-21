// Property 7 (design "Correctness Properties"; Architecture Spec §A3 property (b) for the
// shop-challenge profile). Follows the replace-at-path idea of the core validator property test in
// `packages/node-types/test/validator.property.test.ts`. A passing run is evidence for this
// property over the generated values, not a proof.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { HARD_LIMITS, validateManifest, type Manifest, type ValidationResult } from '@dreame/schema';
import { shopProfile } from '../src/profile.ts';
import { shopManifestArb } from './shop-arbitraries.ts';

const NUM_RUNS = 200;

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

/** Where the replaced value goes: anywhere, or inside a `collectionSelect` or `recommendOutcome` config. */
type Focus = 'any' | 'collectionSelect' | 'recommendOutcome';

interface Replacement {
  readonly focus: Focus;
  readonly pick: number;
  readonly value: unknown;
}

/** Paths at or below `/nodes/<i>/config` for every node of type `type` in `doc`. */
function configPaths(doc: unknown, all: readonly Path[], type: string): Path[] {
  const nodes = (doc as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const indices = new Set<number>();
  nodes.forEach((n, i) => {
    if (n !== null && typeof n === 'object' && (n as { type?: unknown }).type === type) indices.add(i);
  });
  return all.filter((p) => p.length >= 3 && p[0] === 'nodes' && typeof p[1] === 'number' && indices.has(p[1]) && p[2] === 'config');
}

/**
 * A JSON copy of `m` with the value at one path replaced by `r.value`. The path is chosen by
 * `r.pick` among all paths, or among the config paths of the `r.focus` node type when the manifest
 * has such a node. Returns the copy and whether the path was inside a focused config.
 */
function replaceOne(m: Manifest, r: Replacement): { doc: unknown; focused: Exclude<Focus, 'any'> | null } {
  const doc: unknown = JSON.parse(JSON.stringify(m));
  const all: Path[] = [];
  collectPaths(doc, [], all);
  const focusedPaths = r.focus === 'any' ? [] : configPaths(doc, all, r.focus);
  const pool = focusedPaths.length > 0 ? focusedPaths : all;
  const path = pool[r.pick % pool.length];
  if (path === undefined) return { doc, focused: null };
  let parent: unknown = doc;
  for (const k of path.slice(0, -1)) parent = (parent as Record<string | number, unknown>)[k];
  const key = path[path.length - 1];
  if (key === undefined) return { doc, focused: null };
  if (Array.isArray(parent) && typeof key === 'number') {
    parent[key] = r.value;
  } else if (parent !== null && typeof parent === 'object') {
    // defineProperty, so a `__proto__` key stays an own data property.
    Object.defineProperty(parent, String(key), { value: r.value, writable: true, enumerable: true, configurable: true });
  }
  return { doc, focused: focusedPaths.length > 0 && r.focus !== 'any' ? r.focus : null };
}

/** Random JSON, sometimes any JavaScript value (`fc.anything()`). */
const replacementValueArb: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 4, arbitrary: fc.jsonValue({ maxDepth: 3 }) },
  { weight: 1, arbitrary: fc.anything({ maxDepth: 2 }) },
);

const replacementArb: fc.Arbitrary<Replacement> = fc.record({
  focus: fc.constantFrom<Focus>('any', 'collectionSelect', 'recommendOutcome'),
  pick: fc.nat(),
  value: replacementValueArb,
});

/** `ok` is a boolean and there are at most `HARD_LIMITS.maxDiagnostics` diagnostics. */
function expectBoundedResult(result: ValidationResult): void {
  expect(typeof result.ok).toBe('boolean');
  expect(result.diagnostics.length).toBeLessThanOrEqual(HARD_LIMITS.maxDiagnostics);
}

describe('Feature: shop-challenge, Property 7: The validator does not crash on random input with the shop profile', () => {
  // **Validates: Requirements 9.2, 9.4**
  it('Feature: shop-challenge, Property 7: validateManifest returns a bounded result for any JSON value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expectBoundedResult(validateManifest(value, shopProfile));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: shop-challenge, Property 7: validateManifest returns a bounded result for any value from fc.anything()', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expectBoundedResult(validateManifest(value, shopProfile));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: shop-challenge, Property 7: validateManifest returns a bounded result for shop manifests with one value replaced', () => {
    const hits = { collectionSelect: 0, recommendOutcome: 0 };
    fc.assert(
      fc.property(shopManifestArb, replacementArb, (manifest, replacement) => {
        const { doc, focused } = replaceOne(manifest, replacement);
        if (focused !== null) hits[focused] += 1;
        const result = validateManifest(doc, shopProfile);
        expectBoundedResult(result);
        for (const d of result.diagnostics) {
          expect(typeof d.code).toBe('string');
          expect(typeof d.path).toBe('string');
        }
      }),
      { numRuns: NUM_RUNS },
    );
    // The generator reached the app node type configs, not only the shared fields.
    expect(hits.collectionSelect).toBeGreaterThan(0);
    expect(hits.recommendOutcome).toBeGreaterThan(0);
  });
});
