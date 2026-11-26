// Property 10 (design "Correctness Properties"; Architecture Spec §A3 property (c) for the
// practice-path profile). A passing run is evidence for this property over the generated
// manifests, seeds, action sequences and clock sequences, not a proof.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateManifest, type Manifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type ActionRejection, type AttemptState, type Runtime } from '@dreame/runtime';
import { practiceProfile } from '../src/profile.ts';
import { practiceAcceptedResponse, practiceManifestArb } from './practice-arbitraries.ts';

const NUM_RUNS = 100;

const STEP_KINDS = ['accepted', 'rejected', 'random-json'] as const;
type StepKind = (typeof STEP_KINDS)[number];

/** Node types whose accepted responses count as practice responses. */
const PRACTICE_TYPES: ReadonlySet<string> = new Set(['recall', 'reviewQueue']);

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
 * Responses with the wrong shape for every node type in the practice profile: `content` (`{}`),
 * `choice` (`{ optionId }`), `recall` (`{ tries }`), `reviewQueue` (`{ answers }`) and
 * `masterySummary` (terminal).
 */
const WRONG_SHAPE_RESPONSES: readonly unknown[] = [
  undefined,
  null,
  7,
  'o0',
  [],
  { optionId: 1 },
  { optionId: '__no_such_option__' },
  { tries: 'a' },
  { tries: [] },
  { tries: [1, 2] },
  { tries: ['__no_such_option__'] },
  { answers: 'a' },
  { answers: [{ itemId: 1, optionId: 'a' }] },
  { answers: [{ itemId: '__no_such_item__', optionId: 'a' }] },
  { tries: [], answers: [], extra: true },
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
  /** Accepted actions sent at a `recall` or `reviewQueue` node. */
  readonly practiceAccepted: number;
}

/** The response for `r` at the current node of `s`, derived only from `rt`, `s` and `r`. */
function responseFor(rt: Runtime, s: AttemptState, r: StepRecipe): unknown {
  switch (r.kind) {
    case 'accepted':
      return practiceAcceptedResponse(rt, s, r.pick);
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
  const result = validateManifest(manifest, practiceProfile);
  if (!result.ok) throw new Error('play: manifest does not pass validation');
  const rt = createRuntime(practiceProfile, result.manifest);
  let s = createAttempt(rt, seed, { now: startAt });
  const states: AttemptState[] = [s];
  const rejections: (ActionRejection | null)[] = [];
  let practiceAccepted = 0;
  for (const step of steps) {
    if (s.status !== 'playing') break;
    const nodeType = rt.nodes.get(s.currentNodeId)?.type;
    const action = { type: 'respond', nodeId: s.currentNodeId, response: responseFor(rt, s, step) } as Action;
    const rejection = checkAction(rt, s, action);
    rejections.push(rejection);
    if (rejection === null) {
      if (nodeType !== undefined && PRACTICE_TYPES.has(nodeType)) practiceAccepted += 1;
      s = reduce(rt, s, action, { now: step.now });
    }
    states.push(s);
  }
  return { states, rejections, practiceAccepted };
}

/**
 * `value` with every non-array object replaced by `{ plain, entries: [[key, value], …] }` of its
 * own keys, in order, as in `purity.property.test.ts`. `toStrictEqual` reads
 * `a.constructor === b.constructor` as its type check, so a node ID such as `constructor` in
 * `nodeState` or `answers` would make two equal states compare unequal; entry lists keep such
 * keys as data.
 */
function entriesTree(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(entriesTree);
  if (typeof value !== 'object' || value === null) return value;
  const proto: unknown = Object.getPrototypeOf(value);
  return {
    plain: proto === Object.prototype || proto === null,
    entries: Reflect.ownKeys(value).map((key) => [key, entriesTree((value as Record<PropertyKey, unknown>)[key])]),
  };
}

describe('Feature: practice-path, Property 10: Same seed and same actions give the same attempt', () => {
  // **Validates: Requirements 10.3, 10.4**
  it('Feature: practice-path, Property 10: Same seed and same actions give the same attempt', () => {
    const counts = { runs: 0, lesson: 0, core: 0, accepted: 0, rejected: 0, practiceAccepted: 0, runsWithPractice: 0 };
    fc.assert(
      fc.property(
        practiceManifestArb,
        fc.integer({ min: 0, max: 0xffffffff }),
        timeArb,
        fc.array(stepRecipeArb, { minLength: 1, maxLength: 24 }),
        (manifest, seed, startAt, steps) => {
          fc.pre(validateManifest(manifest, practiceProfile).ok);
          counts.runs += 1;
          counts[manifest.nodes.some((n) => n.type === 'recall') ? 'lesson' : 'core'] += 1;

          // Two independent runs: separate copies of the inputs and separate runtimes.
          const a = play(structuredClone(manifest), seed, startAt, structuredClone(steps));
          const b = play(structuredClone(manifest), seed, startAt, structuredClone(steps));

          expect(b.rejections).toStrictEqual(a.rejections);
          expect(b.states).toHaveLength(a.states.length);
          a.states.forEach((s, i) => expect(entriesTree(b.states[i])).toStrictEqual(entriesTree(s)));
          for (const r of a.rejections) counts[r === null ? 'accepted' : 'rejected'] += 1;
          counts.practiceAccepted += a.practiceAccepted;
          if (a.practiceAccepted > 0) counts.runsWithPractice += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );

    console.info(
      `Property 10: ${counts.lesson} lesson and ${counts.core} core manifests; ${counts.accepted} accepted and ${counts.rejected} rejected actions; ` +
        `${counts.practiceAccepted} accepted recall/reviewQueue actions in ${counts.runsWithPractice} of ${counts.runs} runs`,
    );
    // Both kinds of manifests and both accepted and rejected actions were exercised, and at least
    // a tenth of the runs sent an accepted `recall` or `reviewQueue` response (about a third did
    // in the first run; a tenth keeps the check stable under random seeds).
    expect(counts.lesson).toBeGreaterThan(0);
    expect(counts.core).toBeGreaterThan(0);
    expect(counts.accepted).toBeGreaterThan(0);
    expect(counts.rejected).toBeGreaterThan(0);
    expect(counts.runsWithPractice).toBeGreaterThanOrEqual(Math.ceil(counts.runs / 10));
  }, 170_000);
});
