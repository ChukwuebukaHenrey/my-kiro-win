// Property test for the shared node types `content`, `choice` and `outcome`
// (ui-renderer design "Correctness Properties", Property 10; design C13).
// The Wiring_Hook finds this file as the existing property test of the shared node types.
// A passing run is evidence for the property over the generated manifests, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ManifestNode } from '@dreame/schema';
import { createRng, type AnyNodeType, type AttemptState, type Env } from '@dreame/runtime';
import { choiceNodeType, contentNodeType, outcomeNodeType, type ChoiceConfig } from '../src/index.ts';
import { playManifest, runtimeFor, validManifestArb } from './arbitraries.ts';

const NUM_RUNS = 100;

const SHARED_NODE_TYPES: Readonly<Record<string, AnyNodeType>> = {
  content: contentNodeType,
  choice: choiceNodeType,
  outcome: outcomeNodeType,
};

/** Freezes `value` and every object reachable from it, so a later write throws (ES modules are strict). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return value;
}

interface ResponseRecipe {
  /** Selects the `choice` option. */
  readonly pick: number;
  /** Extra keys; `isValidResponse` of all three types accepts any non-array object that has the required keys. */
  readonly extra: Readonly<Record<string, unknown>>;
}

/** JSON round trip, so extra keys such as `__proto__` are plain own data properties. */
const extraArb: fc.Arbitrary<Record<string, unknown>> = fc
  .dictionary(fc.string({ maxLength: 8 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 3 })
  .map((d) => JSON.parse(JSON.stringify(d)) as Record<string, unknown>);

const responseRecipeArb: fc.Arbitrary<ResponseRecipe> = fc.record({ pick: fc.nat(), extra: extraArb });

/** A response for `node` built from `r`; for `choice` the `optionId` is one of the node's options. */
function responseFor(node: ManifestNode, r: ResponseRecipe): unknown {
  if (node.type !== 'choice') return { ...r.extra };
  const options = (node.config as ChoiceConfig).options;
  const option = options[r.pick % options.length];
  if (option === undefined) throw new Error(`responseFor: choice node "${node.id}" has no options`);
  return { ...r.extra, optionId: option.id };
}

describe('Feature: ui-renderer, Property 10: Shared node type reduce leaves its inputs unchanged', () => {
  // **Validates: Requirements 16.5**
  it('reduce on deep-frozen config, state and response does not throw, changes no input and returns the same state twice', () => {
    const exercised = new Set<string>();
    fc.assert(
      fc.property(
        validManifestArb,
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 12 }),
        fc.array(responseRecipeArb, { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 0, max: 60_000 }),
        (manifest, seed, picks, recipes, stepMs) => {
          const rt = runtimeFor(manifest);
          const states = playManifest(rt, { seed, picks });
          states.forEach((state, i) => {
            // The current node is the node the state reached; the last state is at an outcome.
            const node = rt.nodes.get(state.currentNodeId);
            if (node === undefined) throw new Error(`no node "${state.currentNodeId}"`);
            const nodeType = SHARED_NODE_TYPES[node.type];
            if (nodeType === undefined) throw new Error(`"${node.type}" is not a shared node type`);
            const recipe = recipes[i % recipes.length];
            if (recipe === undefined) throw new Error('no response recipe');
            const response = responseFor(node, recipe);
            expect(nodeType.isValidResponse(node.config, response)).toBe(true);

            const cfg = deepFreeze(structuredClone(node.config));
            const s = deepFreeze(structuredClone(state)) as AttemptState;
            const r = deepFreeze(structuredClone(response));
            const env: Env = { now: state.updatedAt + stepMs, rng: createRng(state.rngState), variables: rt.variables };

            const first: AttemptState = nodeType.reduce(cfg, s, r, env);
            const second: AttemptState = nodeType.reduce(cfg, s, r, env);

            expect(cfg).toStrictEqual(node.config);
            expect(s).toStrictEqual(state);
            expect(r).toStrictEqual(response);
            expect(second).toStrictEqual(first);
            exercised.add(node.type);
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Each of the three shared node types was called at least once over the run.
    expect([...exercised].sort()).toEqual(['choice', 'content', 'outcome']);
  });
});
