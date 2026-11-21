// Property 8 (design "Correctness Properties"; Architecture Spec §A3 property (c) for the
// shop-challenge profile). A passing run is evidence for this property over the generated
// manifests, seeds, action sequences and clock sequences, not a proof.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateManifest, type Manifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type ActionRejection, type AttemptState, type Runtime } from '@dreame/runtime';
import { shopProfile } from '../src/profile.ts';
import { shopAcceptedResponse, shopManifestArb } from './shop-arbitraries.ts';

const NUM_RUNS = 100;

const STEP_KINDS = ['accepted', 'rejected', 'random-json'] as const;
type StepKind = (typeof STEP_KINDS)[number];

/** One generated step: what kind of response to send, how to build it, and the clock value. */
interface StepRecipe {
  readonly kind: StepKind;
  /** Chooses the accepted response or the wrong-shape response. */
  readonly pick: number;
  /** The response for `random-json`. */
  readonly json: unknown;
  readonly now: number;
}

/**
 * Responses with the wrong shape for every node type in the shop profile: `content` (`{}`),
 * `choice` (`{ optionId }`) and `collectionSelect` (`{ itemIds }`).
 */
const WRONG_SHAPE_RESPONSES: readonly unknown[] = [
  undefined,
  null,
  7,
  'o0',
  [],
  { optionId: 1 },
  { optionId: null },
  { itemIds: 'a' },
  { itemIds: [1, 2] },
  { itemIds: null },
  { itemIds: ['__no_such_item__'] },
  { optionId: '__no_such_option__' },
  { optionId: 'o0', itemIds: [], extra: true },
];

const timeArb = fc.integer({ min: 0, max: 2_000_000_000_000 });

const stepRecipeArb: fc.Arbitrary<StepRecipe> = fc.record({
  kind: fc.constantFrom(...STEP_KINDS),
  pick: fc.nat(),
  json: fc.jsonValue(),
  now: timeArb,
});

interface Run {
  readonly states: readonly AttemptState[];
  readonly rejections: readonly (ActionRejection | null)[];
}

/** The response for `r` at the current node of `s`, derived only from `rt`, `s` and `r`. */
function responseFor(rt: Runtime, s: AttemptState, r: StepRecipe): unknown {
  switch (r.kind) {
    case 'accepted':
      return shopAcceptedResponse(rt, s, r.pick);
    case 'rejected':
      return WRONG_SHAPE_RESPONSES[r.pick % WRONG_SHAPE_RESPONSES.length];
    case 'random-json':
      return r.json;
  }
}

/**
 * Validates `manifest`, builds its own runtime, and plays `steps` from `createAttempt`. Each action
 * is gated by `checkAction` as the player does: a rejected action leaves the state unchanged.
 * Stops when the status is not `playing`. Returns every state, the initial one first.
 */
function play(manifest: Manifest, seed: number, startAt: number, steps: readonly StepRecipe[]): Run {
  const result = validateManifest(manifest, shopProfile);
  if (!result.ok) throw new Error('play: manifest does not pass validation');
  const rt = createRuntime(shopProfile, result.manifest);
  let s = createAttempt(rt, seed, { now: startAt });
  const states: AttemptState[] = [s];
  const rejections: (ActionRejection | null)[] = [];
  for (const step of steps) {
    if (s.status !== 'playing') break;
    const action = { type: 'respond', nodeId: s.currentNodeId, response: responseFor(rt, s, step) } as Action;
    const rejection = checkAction(rt, s, action);
    rejections.push(rejection);
    if (rejection === null) s = reduce(rt, s, action, { now: step.now });
    states.push(s);
  }
  return { states, rejections };
}

describe('Feature: shop-challenge, Property 8: Same seed and same actions give the same attempt', () => {
  // **Validates: Requirements 9.3, 9.4**
  it('Feature: shop-challenge, Property 8: Same seed and same actions give the same attempt', () => {
    const counts = { accepted: 0, rejected: 0, bundle: 0, core: 0 };
    fc.assert(
      fc.property(
        shopManifestArb,
        fc.integer({ min: 0, max: 0xffffffff }),
        timeArb,
        fc.array(stepRecipeArb, { minLength: 1, maxLength: 24 }),
        (manifest, seed, startAt, steps) => {
          fc.pre(validateManifest(manifest, shopProfile).ok);
          counts[manifest.nodes.some((n) => n.type === 'collectionSelect') ? 'bundle' : 'core'] += 1;

          // Two independent runs: separate copies of the inputs and separate runtimes.
          const a = play(structuredClone(manifest), seed, startAt, structuredClone(steps));
          const b = play(structuredClone(manifest), seed, startAt, structuredClone(steps));

          expect(b.rejections).toStrictEqual(a.rejections);
          expect(b.states).toHaveLength(a.states.length);
          a.states.forEach((s, i) => expect(b.states[i]).toStrictEqual(s));
          for (const r of a.rejections) counts[r === null ? 'accepted' : 'rejected'] += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );

    console.info(
      `Property 8: ${counts.bundle} bundle and ${counts.core} core manifests; ${counts.accepted} accepted and ${counts.rejected} rejected actions`,
    );
    // Both kinds of manifests and both accepted and rejected actions were exercised.
    expect(counts.bundle).toBeGreaterThan(0);
    expect(counts.core).toBeGreaterThan(0);
    expect(counts.accepted).toBeGreaterThan(0);
    expect(counts.rejected).toBeGreaterThan(0);
  }, 170_000);
});
