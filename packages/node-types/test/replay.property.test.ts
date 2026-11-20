// Reducer property tests (design "Correctness Properties", Properties 3 and 6).
// Each property has its own top-level `describe`, so later properties can be added as siblings.
// A passing run is evidence for the property over the generated manifests, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Manifest } from '@dreame/schema';
import {
  checkAction,
  createAttempt,
  reduce,
  type Action,
  type ActionRejection,
  type AttemptState,
  type Runtime,
} from '@dreame/runtime';
import {
  MISSING_NODE_ID,
  acceptedResponse,
  buildManifest,
  manifestRecipeArb,
  playManifest,
  runtimeFor,
  validManifestArb,
  type ManifestRecipe,
} from './arbitraries.ts';

const NUM_RUNS = 100;

/** One recorded action with the clock value it was applied at. */
interface Step {
  readonly action: Action;
  readonly now: number;
}

interface Recording {
  readonly states: readonly AttemptState[];
  readonly steps: readonly Step[];
}

/**
 * Valid manifests where every `choice` node has `shuffle: true` and the entry node is a `choice`,
 * so `createAttempt` and later steps draw from the seeded RNG.
 */
const shuffledManifestArb: fc.Arbitrary<Manifest> = manifestRecipeArb
  .map(
    (r): ManifestRecipe => ({
      ...r,
      nonTerminals: r.nonTerminals.map((nt, i) => ({ ...nt, shuffle: true, ...(i === 0 ? { kind: 'choice' as const } : {}) })),
    }),
  )
  .map(buildManifest);

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

/** Plays from `createAttempt` with accepted responses chosen by `picks` and records each action. */
function record(rt: Runtime, seed: number, picks: readonly number[], startAt: number, stepMs: number): Recording {
  const maxSteps = rt.manifest.limits.maxTransitions + 2;
  let s = createAttempt(rt, seed, { now: startAt });
  const states: AttemptState[] = [s];
  const steps: Step[] = [];
  for (let i = 0; i < maxSteps && s.status === 'playing'; i++) {
    const pick = picks[i % picks.length] ?? 0;
    const action: Action = { type: 'respond', nodeId: s.currentNodeId, response: acceptedResponse(rt, s, pick) };
    const now = startAt + (i + 1) * stepMs;
    s = reduce(rt, s, action, { now });
    states.push(s);
    steps.push({ action, now });
  }
  return { states, steps };
}

/** Applies `steps` to `from` and returns every resulting state, `from` excluded. */
function applySteps(rt: Runtime, from: AttemptState, steps: readonly Step[]): AttemptState[] {
  const out: AttemptState[] = [];
  let s = from;
  for (const step of steps) {
    s = reduce(rt, s, step.action, { now: step.now });
    out.push(s);
  }
  return out;
}

describe('Feature: runtime-core, Property 3: Same seed and actions give the same result', () => {
  // **Validates: Requirements 12.7, 15.13, 15.14, 16.5**
  it('replays deep-equal states and resumes identically from a JSON round trip of an intermediate state', () => {
    fc.assert(
      fc.property(
        shuffledManifestArb,
        seedArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        fc.integer({ min: 0, max: 60_000 }),
        fc.nat(),
        (manifest, seed, picks, startAt, stepMs, cut) => {
          const rt = runtimeFor(manifest);
          const { states, steps } = record(rt, seed, picks, startAt, stepMs);

          // A second, independent run with the same seed, recorded actions and clock values.
          const replayStart = createAttempt(rt, seed, { now: startAt });
          const replayed = [replayStart, ...applySteps(rt, replayStart, steps)];
          expect(replayed).toHaveLength(states.length);
          replayed.forEach((s, i) => expect(s).toStrictEqual(states[i]));

          // Resume from a JSON round trip of state k and apply the remaining actions.
          const k = cut % states.length;
          const stateK = states[k];
          if (stateK === undefined) throw new Error(`no state at index ${k}`);
          const resumedFrom = JSON.parse(JSON.stringify(stateK)) as AttemptState;
          expect(resumedFrom).toStrictEqual(stateK);
          const resumed = applySteps(rt, resumedFrom, steps.slice(k));
          expect(resumed).toStrictEqual(states.slice(k + 1));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6
// ---------------------------------------------------------------------------

/** Freezes `value` and every object reachable from it, so a later write throws (ES modules are strict). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return value;
}

/** `xs[pick % xs.length]`; the element may itself be `undefined` (some lists contain it). */
function pickFrom<T>(xs: readonly T[], pick: number): T {
  if (xs.length === 0) throw new Error('pickFrom: empty list');
  return xs[pick % xs.length] as T;
}

const ACTION_KINDS = ['accepted', 'wrong-node', 'unknown-type', 'non-object', 'random-json', 'schema-invalid', 'unknown-option'] as const;
type ActionKind = (typeof ACTION_KINDS)[number];

interface ActionRecipe {
  readonly kind: ActionKind;
  /** Selects the state the action is sent to. */
  readonly at: number;
  /** Selects the option, node ID, type or response used by the kind. */
  readonly pick: number;
  readonly primitive: unknown;
  readonly json: unknown;
}

/** Node IDs that are never the current node: absent, prototype keys and non-strings. */
const WRONG_NODE_IDS: readonly unknown[] = [MISSING_NODE_ID, '__proto__', 'constructor', '', 42, null, undefined];
/** `type` values other than `respond`; `undefined` means the property is left out. */
const UNKNOWN_TYPES: readonly unknown[] = ['Respond', 'answer', 'reset', '', 1, null, undefined];
/** Responses that fail both the `content` response schema `{}` and the `choice` one `{ optionId: string }`. */
const SCHEMA_INVALID_RESPONSES: readonly unknown[] = [
  undefined,
  null,
  7,
  'o0',
  [],
  [{ optionId: 'o0' }],
  { optionId: 1 },
  { optionId: null },
  { optionId: 'o0', extra: true },
  { extra: 1 },
];
/** Option IDs the builder never produces (it uses `o0`–`o3`), including prototype keys. */
const UNKNOWN_OPTION_IDS: readonly string[] = ['o8', 'zz', '__proto__', 'toString', 'constructor', 'hasOwnProperty', ''];

const actionRecipeArb: fc.Arbitrary<ActionRecipe> = fc.record({
  kind: fc.constantFrom(...ACTION_KINDS),
  at: fc.nat(),
  pick: fc.nat(),
  primitive: fc.oneof(fc.constant(null), fc.constant(undefined), fc.integer(), fc.double(), fc.string(), fc.boolean(), fc.bigInt()),
  json: fc.jsonValue(),
});

/**
 * Builds the action for `r` at state `s` and the rejection `checkAction` must return for it
 * (Req 15.3 order), or `undefined` when the kind has no fixed expectation.
 */
function buildAction(rt: Runtime, s: AttemptState, r: ActionRecipe): { action: unknown; expected: ActionRejection | null | undefined } {
  const playing = s.status === 'playing';
  const expect = (rejection: ActionRejection | null): ActionRejection | null => (playing ? rejection : 'not-playing');
  const accepted = (): unknown => (playing ? acceptedResponse(rt, s, r.pick) : {});
  switch (r.kind) {
    case 'accepted':
      return { action: { type: 'respond', nodeId: s.currentNodeId, response: accepted() }, expected: expect(null) };
    case 'wrong-node': {
      const ids: unknown[] = [...rt.nodes.keys()].filter((id) => id !== s.currentNodeId);
      ids.push(...WRONG_NODE_IDS);
      return { action: { type: 'respond', nodeId: pickFrom(ids, r.pick), response: accepted() }, expected: expect('wrong-node') };
    }
    case 'unknown-type': {
      const type = pickFrom(UNKNOWN_TYPES, r.pick);
      const base = { nodeId: s.currentNodeId, response: accepted() };
      return { action: type === undefined ? base : { ...base, type }, expected: expect('unknown-action') };
    }
    case 'non-object':
      return { action: r.primitive, expected: expect('unknown-action') };
    case 'random-json':
      return { action: r.json, expected: playing ? undefined : 'not-playing' };
    case 'schema-invalid':
      return {
        action: { type: 'respond', nodeId: s.currentNodeId, response: pickFrom(SCHEMA_INVALID_RESPONSES, r.pick) },
        expected: expect('invalid-response'),
      };
    case 'unknown-option':
      return {
        action: { type: 'respond', nodeId: s.currentNodeId, response: { optionId: pickFrom(UNKNOWN_OPTION_IDS, r.pick) } },
        expected: expect('invalid-response'),
      };
  }
}

describe('Feature: runtime-core, Property 6: Rejected actions leave the state unchanged', () => {
  // **Validates: Requirements 15.4, 15.11, 16.7**
  it('returns the same state object for every rejected action, a new one exactly for accepted actions, and mutates nothing', () => {
    fc.assert(
      fc.property(
        validManifestArb,
        seedArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 12 }),
        fc.array(actionRecipeArb, { minLength: 1, maxLength: 10 }),
        (manifest, seed, picks, recipes) => {
          const rt = runtimeFor(manifest);
          const states = playManifest(rt, { seed, picks }).map(deepFreeze);
          // The ended state is among the targets, so actions after the attempt has ended are sent.
          expect(states.some((st) => st.status !== 'playing')).toBe(true);

          for (const r of recipes) {
            const s = pickFrom(states, r.at);
            const { action, expected } = buildAction(rt, s, r);
            deepFreeze(action);
            const stateBefore = structuredClone(s);
            const actionBefore = structuredClone(action);

            const rejection = checkAction(rt, s, action as Action);
            if (expected !== undefined) expect(rejection).toBe(expected);
            const next = reduce(rt, s, action as Action, { now: s.updatedAt + 1000 });
            if (rejection === null) expect(next).not.toBe(s);
            else expect(next).toBe(s);

            expect(s).toStrictEqual(stateBefore);
            expect(action).toStrictEqual(actionBefore);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
