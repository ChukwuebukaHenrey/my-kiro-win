// Property 1 of the ui-renderer design: the validator module built with
// `DEFAULT_CODEGEN_OPTIONS` (the shipped, smaller module) reports the same diagnostics as the
// module built with `BASELINE_CODEGEN_OPTIONS` (the Day 2–4 setting). Both modules are built in
// this test, written to a temporary folder and loaded with a dynamic module load of a file URL,
// as `packages/schema/test/codegen.test.ts` does.
// A passing run is evidence for this property over the generated inputs, not a proof.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateManifest, type Manifest, type StandaloneValidate, type ValidationResult } from '@dreame/schema';
import { BASELINE_CODEGEN_OPTIONS, buildProfileModule, DEFAULT_CODEGEN_OPTIONS } from '@dreame/schema/codegen';
import { defineProfile, type Profile } from '@dreame/runtime';
import { coreNodeTypes } from '../src/core-types.ts';
import { defectiveManifestArb, UNBOUNDED_VAR_ID, validManifestArb } from './arbitraries.ts';

const NUM_RUNS = 100;
// Each run validates the input twice; 100 runs can exceed Vitest's 5 s default, as in Property 1
// of runtime-core.
const TIMEOUT_MS = 120_000;

const GENERATED_JS = fileURLToPath(new URL('../generated/core.validators.js', import.meta.url));

type GeneratedModule = Record<string, unknown>;

const defaultBuild = buildProfileModule('core', coreNodeTypes, DEFAULT_CODEGEN_OPTIONS);
const baselineBuild = buildProfileModule('core', coreNodeTypes, BASELINE_CODEGEN_OPTIONS);

const responseNames = coreNodeTypes.map((t) => `response_${t.type}`);

function exported(mod: GeneratedModule, name: string): StandaloneValidate {
  const fn = mod[name];
  if (typeof fn !== 'function') throw new Error(`generated module has no function export "${name}"`);
  return fn as StandaloneValidate;
}

/** The `core` profile bound to the validators of `mod`, as `src/core-profile.ts` binds the generated file. */
function profileOf(mod: GeneratedModule): Profile {
  const responseValidators: Record<string, StandaloneValidate> = {};
  for (const t of coreNodeTypes) responseValidators[t.type] = exported(mod, `response_${t.type}`);
  return defineProfile({
    id: 'core',
    nodeTypes: coreNodeTypes,
    validateSchema: exported(mod, 'validateManifest'),
    responseValidators,
  });
}

let dir = '';
let defaultMod: GeneratedModule = {};
let baselineMod: GeneratedModule = {};
let defaultProfile: Profile;
let baselineProfile: Profile;

async function load(name: string, js: string): Promise<GeneratedModule> {
  const file = join(dir, name);
  writeFileSync(file, js, 'utf8');
  return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as GeneratedModule;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dreame-equivalence-'));
  defaultMod = await load('core.default.validators.mjs', defaultBuild.js);
  baselineMod = await load('core.baseline.validators.mjs', baselineBuild.js);
  defaultProfile = profileOf(defaultMod);
  baselineProfile = profileOf(baselineMod);
});

afterAll(() => {
  if (dir !== '') rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

type Row = readonly [code: string, stage: string, path: string, severity: string];

/** The diagnostics of `result` as `(code, stage, path, severity)` rows, sorted, so equal arrays mean equal multisets. */
function rows(result: ValidationResult): Row[] {
  return result.diagnostics
    .map((d): Row => [d.code, d.stage, d.path, d.severity])
    .sort((a, b) => (a.join('\u0000') < b.join('\u0000') ? -1 : a.join('\u0000') > b.join('\u0000') ? 1 : 0));
}

/** Validates separate copies of `input` with both profiles and compares `ok` and the diagnostic multiset. */
function expectSameDiagnostics(input: unknown): void {
  const a = validateManifest(structuredClone(input), defaultProfile);
  const b = validateManifest(structuredClone(input), baselineProfile);
  expect(a.ok).toBe(b.ok);
  expect(rows(a)).toEqual(rows(b));
}

/** Compares every `response_<type>` result of the two modules on separate copies of `value`. */
function expectSameResponses(value: unknown): void {
  for (const name of responseNames) {
    const a = exported(defaultMod, name)(structuredClone(value));
    const b = exported(baselineMod, name)(structuredClone(value));
    expect({ name, result: a }).toEqual({ name, result: b });
  }
}

// ---------------------------------------------------------------------------
// Input arbitraries (built on `arbitraries.ts`, which stays unchanged)
// ---------------------------------------------------------------------------

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

/** A JSON copy of `m` with the value at the position chosen by `pick` replaced by `value`. */
function replaceOne(m: Manifest, pick: number, value: unknown): unknown {
  const out: unknown = JSON.parse(JSON.stringify(m));
  const paths: Path[] = [];
  collectPaths(out, [], paths);
  const path = paths[pick % paths.length];
  if (path === undefined) return out;
  let parent: unknown = out;
  for (const k of path.slice(0, -1)) parent = (parent as Record<string | number, unknown>)[k];
  const key = path[path.length - 1];
  if (key === undefined || parent === null || typeof parent !== 'object') return out;
  // defineProperty, so a `__proto__` key stays an own data property.
  Object.defineProperty(parent, String(key), { value: structuredClone(value), writable: true, enumerable: true, configurable: true });
  return out;
}

/** Valid manifests with one value replaced by random JSON. */
const replacedManifestArb: fc.Arbitrary<unknown> = fc
  .tuple(validManifestArb, fc.nat(), fc.jsonValue({ maxDepth: 3 }))
  .map(([m, pick, value]) => replaceOne(m, pick, value));

type Wrapper = 'not' | 'and' | 'or';

/** A condition of nesting depth `depth`: `depth - 1` wrappers around one leaf on the unbounded number variable. */
function nestedCond(depth: number, wrappers: readonly Wrapper[]): unknown {
  let cond: unknown = { op: 'eq', ref: { var: UNBOUNDED_VAR_ID }, value: 0 };
  for (let d = 1; d < depth; d++) {
    const w = wrappers[d % wrappers.length] ?? 'not';
    cond = w === 'not' ? { op: 'not', arg: cond } : { op: w, args: [cond] };
  }
  return cond;
}

/**
 * A copy of `m` where the non-terminal node chosen by `pick` gets a new first edge, to the target
 * of its last edge, with `when` set to `cond`. Returns the copy and the index of that node.
 */
function withNestedWhen(m: Manifest, pick: number, cond: unknown): { manifest: unknown; nodeIndex: number } {
  const out = JSON.parse(JSON.stringify(m)) as { nodes: { edges: { to: string; when?: unknown }[] }[] };
  const indices = out.nodes.flatMap((node, i) => (node.edges.length > 0 ? [i] : []));
  const nodeIndex = indices[pick % indices.length];
  if (nodeIndex === undefined) throw new Error('withNestedWhen: the manifest has no node with edges');
  const node = out.nodes[nodeIndex];
  const last = node?.edges[node.edges.length - 1];
  if (node === undefined || last === undefined) throw new Error('withNestedWhen: no last edge');
  node.edges.unshift({ to: last.to, when: cond });
  return { manifest: out, nodeIndex };
}

/** Manifests with an edge `when` nested 1–10 levels. */
const nestedWhenManifestArb: fc.Arbitrary<unknown> = fc
  .tuple(
    validManifestArb,
    fc.nat(),
    fc.integer({ min: 1, max: 10 }),
    fc.array(fc.constantFrom<Wrapper>('not', 'and', 'or'), { minLength: 1, maxLength: 9 }),
  )
  .map(([m, pick, depth, wrappers]) => withNestedWhen(m, pick, nestedCond(depth, wrappers)).manifest);

/** Random JSON, plus response-shaped objects so the response validators also see near-valid values. */
const responseLikeArb: fc.Arbitrary<unknown> = fc.oneof(
  { arbitrary: fc.jsonValue(), weight: 3 },
  { arbitrary: fc.record({ optionId: fc.jsonValue({ maxDepth: 1 }) }, { requiredKeys: [] }), weight: 1 },
  { arbitrary: fc.dictionary(fc.constantFrom('optionId', 'tag', 'value', '__proto__'), fc.jsonValue({ maxDepth: 1 }), { maxKeys: 2 }), weight: 1 },
);

// ---------------------------------------------------------------------------
// Property 1
// ---------------------------------------------------------------------------

describe('Feature: ui-renderer, Property 1: Smaller validators report the same diagnostics', () => {
  // **Validates: Requirements 4.1, 4.3, 4.4**

  it('the module built with DEFAULT_CODEGEN_OPTIONS is byte-identical to the generated file', () => {
    const generated = readFileSync(GENERATED_JS);
    expect(Buffer.from(defaultBuild.js, 'utf8').equals(generated)).toBe(true);
  });

  it('the two builds differ, so the comparison is between two modules', () => {
    expect(defaultBuild.js).not.toBe(baselineBuild.js);
  });

  it('valid manifests get the same ok and diagnostics', () => {
    fc.assert(fc.property(validManifestArb, expectSameDiagnostics), { numRuns: NUM_RUNS });
  }, TIMEOUT_MS);

  it('manifests with one injected defect get the same ok and diagnostics', () => {
    fc.assert(
      fc.property(defectiveManifestArb, ({ manifest }) => expectSameDiagnostics(manifest)),
      { numRuns: NUM_RUNS },
    );
  }, TIMEOUT_MS);

  it('manifests with one value replaced by random JSON get the same ok and diagnostics', () => {
    fc.assert(fc.property(replacedManifestArb, expectSameDiagnostics), { numRuns: NUM_RUNS });
  }, TIMEOUT_MS);

  it('manifests with an edge when nested 1-10 levels get the same ok and diagnostics', () => {
    fc.assert(fc.property(nestedWhenManifestArb, expectSameDiagnostics), { numRuns: NUM_RUNS });
  }, TIMEOUT_MS);

  it('random JSON gets the same ok and diagnostics from validateManifest', () => {
    fc.assert(fc.property(fc.jsonValue(), expectSameDiagnostics), { numRuns: NUM_RUNS });
  }, TIMEOUT_MS);

  it('random JSON gets the same result from each response_<type> validator', () => {
    fc.assert(fc.property(responseLikeArb, expectSameResponses), { numRuns: NUM_RUNS });
  }, TIMEOUT_MS);

  it('a when nested 9 levels reports schema/cond-too-deep at that when path with both modules', () => {
    const [sample] = fc.sample(validManifestArb, { numRuns: 1, seed: 42 });
    if (sample === undefined) throw new Error('fc.sample returned no manifest');
    const { manifest, nodeIndex } = withNestedWhen(sample, 0, nestedCond(9, ['not']));
    const whenPath = `/nodes/${nodeIndex}/edges/0/when`;
    for (const profile of [defaultProfile, baselineProfile]) {
      const result = validateManifest(structuredClone(manifest), profile);
      expect(result.ok).toBe(false);
      expect(rows(result)).toContainEqual(['cond-too-deep', 'schema', whenPath, 'error']);
    }
    expectSameDiagnostics(manifest);
  });
});
