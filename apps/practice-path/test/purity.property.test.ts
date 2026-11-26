// Property test for the hooks of the practice node types `recall`, `reviewQueue` and
// `masterySummary` (design "Correctness Properties", Property 3; as shop-challenge Property 3).
// Each hook runs on deep-frozen copies of generated inputs, so a write to an input throws.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng, type AttemptState, type Env, type JsonValue } from '@dreame/runtime';
import { recallNodeType, type RecallConfig, type RecallResponse } from '../src/node-types/recall.ts';
import { reviewQueueNodeType, REVIEW_LIMITS, type ReviewAnswer, type ReviewQueueResponse } from '../src/node-types/reviewQueue.ts';
import { masterySummaryNodeType, type MasterySummaryConfig } from '../src/node-types/masterySummary.ts';
import type { ItemSnapshot } from '../src/node-types/practice-state.ts';
import {
  acceptedTriesArb,
  idArb,
  recallConfigArb,
  REVIEW_NODE_ID,
  reviewNodeStateArb,
  reviewQueueConfigArb,
  reviewStateArb,
} from './practice-arbitraries.ts';

const NUM_RUNS = 100;

const RECALL_NODE_ID = 'r1';
const SUMMARY_NODE_ID = 'summary';
/** A node the hooks must not read or change. */
const NOISE_NODE_ID = 'noise-node';

const seedArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 0xffffffff });
const nowArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 10_000_000 });

/** Freezes `value` and every object reachable from it, so a later write throws (ES modules are strict). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return value;
}

/**
 * `value` with every non-array object replaced by `{ entries: [[key, value], …] }` of its own
 * keys, in order. `toStrictEqual` reads `a.constructor === b.constructor` as its type check, so a
 * generated node ID such as `constructor` would make two equal clones compare unequal; comparing
 * entry lists keeps such keys as data. Own keys whose value is `undefined` stay as entries.
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

/** Deep equality of `actual` and `expected` that treats every own key, including `constructor`, as data. */
function expectSameTree(actual: unknown, expected: unknown): void {
  expect(entriesTree(actual)).toStrictEqual(entriesTree(expected));
}

/** An `Env` whose `rng` starts at `seed`. */
function envFrom(seed: number, now: number): Env {
  return { now, rng: createRng(seed), variables: new Map() };
}

/** Random JSON as plain own data properties (a JSON round trip, so keys such as `__proto__` are plain keys). */
const jsonArb: fc.Arbitrary<JsonValue> = fc.jsonValue({ maxDepth: 2 }).map((v) => JSON.parse(JSON.stringify(v)) as JsonValue);

/** An attempt state at `nodeId` whose `seed` and `rngState` are `seed`. */
function attemptAt(nodeId: string, seed: number, nodeState: Record<string, JsonValue>): AttemptState {
  return {
    activityId: 'practice-purity-property',
    manifestVersion: 1,
    seed,
    rngState: seed,
    status: 'playing',
    currentNodeId: nodeId,
    vars: {},
    answers: {},
    nodeState,
    path: [{ nodeId, at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

/** The result of one checked hook call: the returned state and the `env.rng` state after the call. */
interface PureCall {
  readonly result: AttemptState;
  readonly rngAfter: number;
}

/**
 * Calls `call` on deep-frozen copies of `cfg`, `state` and `response` with an `Env` built from
 * `seed`, then again with a second `Env` built from the same seed. Checks that no call throws,
 * that the inputs stay deep-equal to copies taken before the calls, that the returned `rngState`
 * equals the input `rngState` (only `env.rng` advances), that both results are deep-equal and
 * that both `env.rng` objects end in the same state.
 */
function expectPureCall<C, R>(
  seed: number,
  now: number,
  cfg: C,
  state: AttemptState,
  response: R,
  call: (c: C, s: AttemptState, r: R, env: Env) => AttemptState,
): PureCall {
  const before = structuredClone({ cfg, state, response });
  const c = deepFreeze(structuredClone(cfg));
  const s = deepFreeze(structuredClone(state));
  const r = deepFreeze(structuredClone(response));

  const env1 = envFrom(seed, now);
  const first = call(c, s, r, env1);
  expectSameTree({ cfg: c, state: s, response: r }, before);
  expect(first.rngState).toBe(before.state.rngState);

  const env2 = envFrom(seed, now);
  const second = call(c, s, r, env2);
  expectSameTree({ cfg: c, state: s, response: r }, before);
  expectSameTree(second, first);
  expect(env2.rng.state).toBe(env1.rng.state);
  return { result: first, rngAfter: env1.rng.state };
}

const recallEnter = recallNodeType.enter;
const reviewEnter = reviewQueueNodeType.enter;
const masteryEnter = masterySummaryNodeType.enter;

// ---------------------------------------------------------------------------------------------
// `recall`: the node may hold no state, an `order` from an earlier `enter`, or damaged JSON.

type RecallPrior = 'none' | 'order' | 'damaged';

interface RecallCase {
  readonly cfg: RecallConfig;
  readonly seed: number;
  readonly now: number;
  readonly prior: RecallPrior;
  readonly state: AttemptState;
  readonly response: RecallResponse;
}

const recallCaseArb: fc.Arbitrary<RecallCase> = recallConfigArb.chain((cfg) => {
  const ids = cfg.options.map((option) => option.id);
  const priorArb: fc.Arbitrary<{ prior: RecallPrior; value: JsonValue | undefined }> = fc.oneof(
    fc.constant({ prior: 'none' as const, value: undefined }),
    fc.shuffledSubarray(ids, { minLength: ids.length, maxLength: ids.length }).map((order) => ({ prior: 'order' as const, value: { order: [...order] } })),
    jsonArb.map((value) => ({ prior: 'damaged' as const, value })),
  );
  return fc
    .record({
      seed: seedArb,
      now: nowArb,
      prior: priorArb,
      noise: fc.option(jsonArb, { nil: undefined }),
      tries: acceptedTriesArb(cfg),
    })
    .map(({ seed, now, prior, noise, tries }): RecallCase => {
      const nodeState: Record<string, JsonValue> = {};
      if (prior.value !== undefined) nodeState[RECALL_NODE_ID] = prior.value;
      if (noise !== undefined) nodeState[NOISE_NODE_ID] = noise;
      return { cfg, seed, now, prior: prior.prior, state: attemptAt(RECALL_NODE_ID, seed, nodeState), response: { tries: [...tries] } };
    });
});

// ---------------------------------------------------------------------------------------------
// `reviewQueue`: the `from` nodes hold any mix of Recall node states (`reviewStateArb`), and the
// accepted response answers planted Item_IDs and unknown ones, each Item_ID once.

/** Accepted `reviewQueue` responses: 0–24 answers with distinct Item_IDs, drawn from the planted snapshots and random IDs. */
function reviewResponseArb(planted: readonly (ItemSnapshot | null)[]): fc.Arbitrary<ReviewQueueResponse> {
  const known = planted.filter((item): item is ItemSnapshot => item !== null);
  const itemIdArb = known.length === 0 ? idArb : fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...known.map((item) => item.itemId)) }, { weight: 1, arbitrary: idArb });
  const answerArb = itemIdArb.chain((itemId) => {
    const item = known.find((entry) => entry.itemId === itemId);
    const optionIdArb =
      item === undefined
        ? idArb
        : fc.oneof(fc.constant(item.correctOptionId), fc.constantFrom(...item.options.map((option) => option.id)), idArb);
    return optionIdArb.map((optionId): ReviewAnswer => ({ itemId, optionId }));
  });
  return fc
    .uniqueArray(answerArb, { maxLength: REVIEW_LIMITS.maxFrom, selector: (answer: ReviewAnswer) => answer.itemId })
    .map((answers): ReviewQueueResponse => ({ answers: answers.map((answer) => ({ itemId: answer.itemId, optionId: answer.optionId })) }));
}

/** The state after `reduce` at the `reviewQueue` node, moved to the `masterySummary` node. */
function atSummaryNode(s: AttemptState): AttemptState {
  return { ...s, currentNodeId: SUMMARY_NODE_ID, path: [...s.path, { nodeId: SUMMARY_NODE_ID, at: s.updatedAt }] };
}

// ---------------------------------------------------------------------------------------------
// `masterySummary`: the `from` node may or may not hold a state; when it does, the state is
// missing, damaged or readable (`reviewNodeStateArb`).

const masteryFromArb: fc.Arbitrary<string> = fc
  .oneof({ weight: 6, arbitrary: idArb }, { weight: 1, arbitrary: fc.constantFrom('toString', 'constructor', 'valueOf') })
  .filter((id) => id !== SUMMARY_NODE_ID && id !== NOISE_NODE_ID);

function masteryConfigArb(from: fc.Arbitrary<string>): fc.Arbitrary<MasterySummaryConfig> {
  return fc
    .record({ title: fc.string({ minLength: 1, maxLength: 120 }), body: fc.string({ maxLength: 200 }), from, withShare: fc.boolean() })
    .map(({ title, body, from: fromId, withShare }): MasterySummaryConfig => ({
      title,
      body,
      from: fromId,
      ...(withShare ? { tutorShare: { label: 'Send result to tutor', url: 'https://wa.me/12125550142' } } : {}),
    }));
}

describe('Feature: practice-path, Property 3: Practice node type hooks leave their inputs unchanged and are deterministic', () => {
  // **Validates: Requirements 6.7, 6.10, 8.9, 8.12, 9.11**

  it('recall.enter and recall.reduce on deep-frozen inputs change no input, advance only env.rng and repeat', () => {
    if (recallEnter === undefined) throw new Error('recall must define enter');
    const seen = new Set<string>();
    fc.assert(
      fc.property(recallCaseArb, ({ cfg, seed, now, prior, state, response }) => {
        expect(recallNodeType.isValidResponse(cfg, response)).toBe(true);
        const optionIds = cfg.options.map((option) => option.id);

        const entered = expectPureCall(seed, now, cfg, state, undefined, (c, s, _r, env) => recallEnter(c, s, env));
        if (cfg.shuffle === true) {
          // The only random draws are the `env.rng` shuffle of the option IDs.
          const reference = createRng(seed);
          const order = reference.shuffle(optionIds);
          expectSameTree(entered.result.nodeState[RECALL_NODE_ID], { order });
          expect(entered.rngAfter).toBe(reference.state);
        } else {
          expectSameTree(entered.result, state);
          expect(entered.rngAfter).toBe(seed);
        }

        // reduce on the state before and after enter; reduce draws no random number.
        for (const s of [state, entered.result]) {
          const reduced = expectPureCall(seed, now, cfg, s, response, (c, st, r, env) => recallNodeType.reduce(c, st, r, env));
          expect(reduced.rngAfter).toBe(seed);
        }
        seen.add(`${prior}/${cfg.shuffle === true ? 'shuffle' : 'fixed'}`);
      }),
      { numRuns: NUM_RUNS },
    );
    // Each kind of prior node state was tried with and without `shuffle`.
    expect([...seen].sort()).toEqual(['damaged/fixed', 'damaged/shuffle', 'none/fixed', 'none/shuffle', 'order/fixed', 'order/shuffle']);
  });

  it('reviewQueue.enter and reviewQueue.reduce on deep-frozen inputs change no input, draw no random number and repeat', () => {
    if (reviewEnter === undefined || masteryEnter === undefined) throw new Error('reviewQueue and masterySummary must define enter');
    let found = 0;
    let withOwnState = 0;
    let answered = 0;
    fc.assert(
      fc.property(
        reviewQueueConfigArb.chain((cfg) =>
          reviewStateArb(cfg).chain((sc) =>
            fc.record({
              cfg: fc.constant(cfg),
              sc: fc.constant(sc),
              response: reviewResponseArb(sc.planted),
              seed: seedArb,
              now: nowArb,
              title: fc.string({ minLength: 1, maxLength: 120 }),
            }),
          ),
        ),
        ({ cfg, sc, response, seed, now, title }) => {
          expect(reviewQueueNodeType.isValidResponse(cfg, response)).toBe(true);
          const state: AttemptState = { ...sc.state, seed, rngState: seed };

          const entered = expectPureCall(seed, now, cfg, state, undefined, (c, s, _r, env) => reviewEnter(c, s, env));
          expect(entered.rngAfter).toBe(seed);

          // reduce on the state before `enter` (no, damaged or empty own state) and after it (stored Queue).
          let reducedAfterEnter: AttemptState = state;
          for (const s of [state, entered.result]) {
            const reduced = expectPureCall(seed, now, cfg, s, response, (c, st, r, env) => reviewQueueNodeType.reduce(c, st, r, env));
            expect(reduced.rngAfter).toBe(seed);
            reducedAfterEnter = reduced.result;
          }

          // masterySummary.enter on the reviewQueue state that reduce stored.
          const summaryCfg: MasterySummaryConfig = { title, body: 'Your results.', from: REVIEW_NODE_ID };
          const summary = expectPureCall(seed, now, summaryCfg, atSummaryNode(reducedAfterEnter), undefined, (c, s, _r, env) =>
            masteryEnter(c, s, env),
          );
          expect(summary.rngAfter).toBe(seed);

          if (sc.planted.some((item) => item !== null)) found += 1;
          if (Object.hasOwn(state.nodeState, REVIEW_NODE_ID)) withOwnState += 1;
          if (response.answers.length > 0) answered += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Found snapshots, an earlier own state and non-empty responses all occur.
    expect(found).toBeGreaterThan(0);
    expect(withOwnState).toBeGreaterThan(0);
    expect(answered).toBeGreaterThan(0);
  });

  it('masterySummary.enter on deep-frozen inputs, with or without the from state, changes no input, draws no random number and repeats', () => {
    if (masteryEnter === undefined) throw new Error('masterySummary must define enter');
    let withFrom = 0;
    let withoutFrom = 0;
    fc.assert(
      fc.property(
        fc.record({
          cfg: masteryConfigArb(masteryFromArb),
          source: reviewNodeStateArb,
          noise: fc.option(jsonArb, { nil: undefined }),
          own: fc.boolean(),
          seed: seedArb,
          now: nowArb,
        }),
        ({ cfg, source, noise, own, seed, now }) => {
          const nodeState: Record<string, JsonValue> = {};
          if (source.value !== undefined) nodeState[cfg.from] = source.value;
          if (noise !== undefined) nodeState[NOISE_NODE_ID] = noise;
          if (own) nodeState[SUMMARY_NODE_ID] = { items: 'old' };
          const state = attemptAt(SUMMARY_NODE_ID, seed, nodeState);

          const entered = expectPureCall(seed, now, cfg, state, undefined, (c, s, _r, env) => masteryEnter(c, s, env));
          expect(entered.rngAfter).toBe(seed);

          if (Object.hasOwn(state.nodeState, cfg.from)) withFrom += 1;
          else withoutFrom += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // States with and without the `from` state both occur.
    expect(withFrom).toBeGreaterThan(0);
    expect(withoutFrom).toBeGreaterThan(0);
  });
});
