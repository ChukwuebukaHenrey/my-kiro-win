// Validator property tests (design "Correctness Properties", Properties 2, 4 and 5). Each
// property has its own top-level `describe`, so later properties can be added as siblings at the
// end of this file.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  HARD_LIMITS,
  severityOf,
  sortDiagnostics,
  validateManifest,
  validateManifestText,
  type Manifest,
  type ValidationResult,
} from '@dreame/schema';
import { coreProfile } from '../src/index.ts';
import { defectiveManifestArb, validManifestArb } from './arbitraries.ts';

const NUM_RUNS = 100;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Freezes `v` and every object or array reachable from it; returns `v`. */
function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const key of Reflect.ownKeys(v)) deepFreeze((v as Record<PropertyKey, unknown>)[key]);
  }
  return v;
}

/** A deep-frozen copy of `raw`, so a mutation attempt throws and the generated value stays intact. */
function frozenCopy(raw: unknown): unknown {
  return deepFreeze(structuredClone(raw));
}

// ---------------------------------------------------------------------------
// Input arbitraries
// ---------------------------------------------------------------------------

const anyJson: fc.Arbitrary<unknown> = fc.jsonValue({ maxDepth: 2 });

/** Usually a value from `arb`, sometimes any JSON value, so field types vary. */
function loose(arb: fc.Arbitrary<unknown>): fc.Arbitrary<unknown> {
  return fc.oneof({ arbitrary: arb, weight: 3 }, { arbitrary: anyJson, weight: 1 });
}

const idLike = fc.constantFrom('n00', 'n01', 'n02', 'a', 'b', 'v0', '__proto__', 'constructor', '', 'x'.repeat(70));
const typeLike = fc.constantFrom('content', 'choice', 'outcome', 'collectionSelect', 'Content');
const urlLike = fc.constantFrom(
  'https://example.com/',
  'https://bit.ly/a',
  'https://user:p@example.com/',
  'https://',
  'http://example.com/',
  'javascript:alert(1)',
  'data:text/html,x',
);
const scalarLike = fc.oneof(fc.integer({ min: -5, max: 5 }), fc.boolean(), idLike, fc.constant(null), fc.double());
const textLike = fc.oneof(fc.string({ maxLength: 8 }), fc.constantFrom('', '   ', 'x'.repeat(2001)));

const refLike = loose(
  fc.oneof(
    fc.record({ var: loose(idLike) }),
    fc.record({ answer: loose(idLike) }),
    fc.record({ var: loose(idLike), answer: loose(idLike) }),
  ),
);

const condLike: fc.Arbitrary<unknown> = fc.letrec<{ cond: unknown }>((tie) => ({
  cond: fc.oneof(
    { maxDepth: 4, depthSize: 'small' },
    fc.record(
      { op: loose(fc.constantFrom('eq', 'gte', 'lte', 'includes')), ref: refLike, value: loose(scalarLike) },
      { requiredKeys: [] },
    ),
    fc.record(
      { op: loose(fc.constantFrom('and', 'or')), args: loose(fc.array(tie('cond'), { maxLength: 3 })) },
      { requiredKeys: [] },
    ),
    fc.record({ op: loose(fc.constant('not')), arg: tie('cond') }, { requiredKeys: [] }),
  ),
})).cond;

const effectLike = fc.record(
  { op: loose(fc.constantFrom('set', 'add')), var: loose(idLike), value: loose(scalarLike) },
  { requiredKeys: [] },
);

const configLike = loose(
  fc.oneof(
    fc.record({ title: loose(textLike), body: loose(textLike) }, { requiredKeys: ['body'] }),
    fc.record(
      {
        prompt: loose(textLike),
        options: loose(
          fc.array(
            fc.record(
              { id: loose(idLike), label: loose(textLike), effects: loose(fc.array(effectLike, { maxLength: 3 })) },
              { requiredKeys: ['id', 'label'] },
            ),
            { maxLength: 4 },
          ),
        ),
        shuffle: loose(fc.boolean()),
      },
      { requiredKeys: ['prompt', 'options'] },
    ),
    fc.record(
      {
        title: loose(textLike),
        body: loose(textLike),
        cta: loose(fc.record({ label: loose(textLike), url: loose(urlLike) })),
      },
      { requiredKeys: ['title', 'body'] },
    ),
  ),
);

const edgeLike = fc.record({ to: loose(idLike), when: condLike }, { requiredKeys: ['to'] });

const nodeLike = fc.record({
  id: loose(idLike),
  type: loose(typeLike),
  config: configLike,
  edges: loose(fc.array(edgeLike, { maxLength: 4 })),
});

const varLike = fc.record(
  {
    id: loose(idLike),
    type: loose(fc.constantFrom('number', 'boolean', 'enum')),
    initial: loose(scalarLike),
    min: loose(fc.integer({ min: -5, max: 5 })),
    max: loose(fc.integer({ min: -5, max: 5 })),
    values: loose(fc.array(idLike, { maxLength: 3 })),
  },
  { requiredKeys: ['id', 'type', 'initial'] },
);

/** Values with the manifest's keys, where every field may have a random type. */
const manifestShapedArb: fc.Arbitrary<unknown> = fc.record(
  {
    schemaVersion: loose(fc.constantFrom(1, 2)),
    profile: loose(fc.constantFrom('core', 'shop')),
    activityId: loose(fc.constantFrom('demo', 'Bad ID')),
    version: loose(fc.integer({ min: -1, max: 3 })),
    requires: loose(fc.dictionary(typeLike, loose(fc.integer({ min: 0, max: 3 })), { maxKeys: 4 })),
    entryNodeId: loose(idLike),
    fallbackOutcomeId: loose(idLike),
    limits: loose(
      fc.record({ maxNodes: loose(fc.integer({ min: 0, max: 201 })), maxTransitions: loose(fc.integer({ min: -1, max: 1001 })) }),
    ),
    variables: loose(fc.array(varLike, { maxLength: 4 })),
    nodes: loose(fc.array(nodeLike, { maxLength: 6 })),
    theme: loose(fc.constantFrom('default', 'Bad Theme')),
    validUntil: loose(fc.constantFrom('2030-01-01', '2030-02-30', 'not-a-date')),
  },
  {
    requiredKeys: [
      'schemaVersion', 'profile', 'activityId', 'version', 'requires', 'entryNodeId',
      'fallbackOutcomeId', 'limits', 'variables', 'nodes', 'theme',
    ],
  },
);

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

interface Edit {
  readonly pick: number;
  /** Replacement value; `undefined` removes the key or array item. */
  readonly value: unknown;
}

/** A JSON copy of `m` with each edit applied in turn at the position chosen by `pick`. */
function perturb(m: Manifest, edits: readonly Edit[]): unknown {
  const out: unknown = JSON.parse(JSON.stringify(m));
  for (const edit of edits) {
    const paths: Path[] = [];
    collectPaths(out, [], paths);
    const path = paths[edit.pick % paths.length];
    if (path === undefined) break;
    let parent: unknown = out;
    for (const k of path.slice(0, -1)) parent = (parent as Record<string | number, unknown>)[k];
    const key = path[path.length - 1];
    if (key === undefined) break;
    if (Array.isArray(parent) && typeof key === 'number') {
      if (edit.value === undefined) parent.splice(key, 1);
      else parent[key] = structuredClone(edit.value);
    } else if (parent !== null && typeof parent === 'object') {
      const obj = parent as Record<string, unknown>;
      if (edit.value === undefined) delete obj[String(key)];
      // defineProperty, so a `__proto__` key stays an own data property.
      else Object.defineProperty(obj, String(key), { value: structuredClone(edit.value), writable: true, enumerable: true, configurable: true });
    }
  }
  return out;
}

/** Valid `core` manifests with 1–3 fields replaced by random JSON values or removed. */
const perturbedManifestArb: fc.Arbitrary<unknown> = fc
  .tuple(
    validManifestArb,
    fc.array(fc.record({ pick: fc.nat(), value: fc.option(anyJson, { nil: undefined }) }), { minLength: 1, maxLength: 3 }),
  )
  .map(([m, edits]) => perturb(m, edits));

/** Single UTF-16 code units, including lone surrogates. */
const codeUnitArb = fc.integer({ min: 0, max: 0xffff }).map((c) => String.fromCharCode(c));

/** JSON text of the value families above, sometimes cut short so it no longer parses. */
const jsonTextArb: fc.Arbitrary<string> = fc
  .tuple(fc.oneof(fc.jsonValue(), manifestShapedArb, perturbedManifestArb), fc.boolean(), fc.nat())
  .map(([v, cut, n]) => {
    const text = JSON.stringify(v) ?? 'null';
    return cut ? text.slice(0, n % (text.length + 1)) : text;
  });

const textArb: fc.Arbitrary<string> = fc.oneof(fc.string(), fc.string({ unit: codeUnitArb }), jsonTextArb);

// ---------------------------------------------------------------------------
// Property 2
// ---------------------------------------------------------------------------

/** The result contract of Req 7.2, 7.4 and 7.10. */
function expectResultContract(result: ValidationResult): void {
  const { diagnostics } = result;
  const errors = diagnostics.filter((d) => d.severity === 'error');
  expect(result.ok).toBe(errors.length === 0);
  expect(diagnostics.length).toBeLessThanOrEqual(HARD_LIMITS.maxDiagnostics);
  expect(diagnostics).toEqual(sortDiagnostics(diagnostics));
  for (const d of diagnostics) expect(d.severity).toBe(severityOf(d.code));
  expect(new Set(errors.map((d) => d.stage)).size).toBeLessThanOrEqual(1);
}

/** Validates a deep-frozen copy of `raw`; checks no throw, no mutation and the result contract. */
function checkValue(raw: unknown): void {
  const snapshot = structuredClone(raw);
  const input = frozenCopy(raw);
  const result = validateManifest(input, coreProfile);
  expect(input).toEqual(snapshot);
  expectResultContract(result);
}

describe('Feature: runtime-core, Property 2: The validator does not throw on random input', () => {
  // **Validates: Requirements 7.2, 7.4, 7.5, 7.6, 7.7, 7.10**
  it('validateManifest holds the result contract for any JSON value', () => {
    fc.assert(fc.property(fc.jsonValue(), checkValue), { numRuns: NUM_RUNS });
  });

  it('validateManifest holds the result contract for manifest-shaped values with random field types', () => {
    fc.assert(fc.property(manifestShapedArb, checkValue), { numRuns: NUM_RUNS });
  });

  it('validateManifest holds the result contract for valid manifests with random fields replaced or removed', () => {
    fc.assert(fc.property(perturbedManifestArb, checkValue), { numRuns: NUM_RUNS });
  });

  it('validateManifestText holds the result contract for any string', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        expectResultContract(validateManifestText(text, coreProfile));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4
// ---------------------------------------------------------------------------

describe('Feature: runtime-core, Property 4: Generated valid manifests pass validation', () => {
  // **Validates: Requirements 7.3, 16.9**
  it('validateManifest accepts every generated valid manifest with no errors and no requires-unused warning', () => {
    fc.assert(
      fc.property(validManifestArb, (m) => {
        const result = validateManifest(m, coreProfile);
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(result.diagnostics.filter((d) => d.code === 'requires-unused')).toEqual([]);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.manifest).toBe(m);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5
// ---------------------------------------------------------------------------

describe('Feature: runtime-core, Property 5: Injected defects are reported at the expected stage', () => {
  // **Validates: Requirements 7.1, 9.1, 9.3, 10.1, 10.2, 11.2, 11.8, 16.8**
  it('validateManifest rejects each injected defect with errors only at the expected stage', () => {
    fc.assert(
      fc.property(defectiveManifestArb, ({ manifest, defect }) => {
        const result = validateManifest(manifest, coreProfile);
        expect(result.ok).toBe(false);
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors.length).toBeGreaterThan(0);
        for (const d of errors) expect(d.stage).toBe(defect.stage);
        expect(errors.map((d) => `${d.stage}/${d.code}`)).toContain(`${defect.stage}/${defect.code}`);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // The outcome config schema requires CTA URLs to start with `https://`, so a non-https scheme
  // stops at the `schema` stage before `conditions/unsafe-url` can run.
  it('an http: CTA URL is rejected at stage schema with code schema at the CTA path', () => {
    const [sample] = fc.sample(validManifestArb, { numRuns: 1, seed: 42 });
    if (sample === undefined) throw new Error('fc.sample returned no manifest');
    const m: Manifest = JSON.parse(JSON.stringify(sample)) as Manifest;
    const index = m.nodes.findIndex((n) => n.type === 'outcome');
    const outcome = m.nodes[index];
    if (outcome === undefined) throw new Error('the sample manifest has no outcome node');
    outcome.config = { ...(outcome.config as Record<string, unknown>), cta: { label: 'Open', url: 'http://example.com/' } };

    const result = validateManifest(m, coreProfile);
    expect(result.ok).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    for (const d of errors) expect(d.stage).toBe('schema');
    expect(errors.map((d) => [d.stage, d.code, d.path])).toContainEqual([
      'schema',
      'schema',
      `/nodes/${index}/config/cta/url`,
    ]);
  });
});
