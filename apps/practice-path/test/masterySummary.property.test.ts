// Property test for the `masterySummary` node type (design C8, "Correctness Properties"). The
// Wiring_Hook wrote the first version of this file; task 8.3 replaced its property with
// Property 6 and kept the file name.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng, type AttemptState, type Env, type JsonValue } from '@dreame/runtime';
import { masteryResult, masterySummaryNodeType, type MasterySummaryConfig } from '../src/node-types/masterySummary.ts';
import {
  readMasteryResult,
  type ItemResult,
  type MasteryItem,
  type MasteryResult,
  type TryResult,
} from '../src/node-types/practice-state.ts';
import { idArb, reviewNodeStateArb, type PlantedReview, type ReviewNodeStateCase } from './practice-arbitraries.ts';

const NUM_RUNS = 200;

/** The node ID of the `masterySummary` node in the generated attempt states; never `from`. */
const SUMMARY_NODE_ID = 'summary';
/** Another node holding a Review_Queue node state, which `enter` must not read; never `from`. */
const NOISE_NODE_ID = 'noise-node';

/** `from` IDs that match `NODE_ID_PATTERN`, including `Object.prototype` names. */
const fromIdArb: fc.Arbitrary<string> = fc
  .oneof({ weight: 6, arbitrary: idArb }, { weight: 1, arbitrary: fc.constantFrom('toString', 'constructor', 'valueOf') })
  .filter((id) => id !== SUMMARY_NODE_ID && id !== NOISE_NODE_ID);

/** A `masterySummary` config within the C8 limits; `tutorShare` is optional. */
const configArb: fc.Arbitrary<MasterySummaryConfig> = fc
  .record({
    title: fc.string({ minLength: 1, maxLength: 120 }),
    body: fc.string({ maxLength: 200 }),
    from: fromIdArb,
    withShare: fc.boolean(),
  })
  .map(({ title, body, from, withShare }): MasterySummaryConfig => ({
    title,
    body,
    from,
    ...(withShare ? { tutorShare: { label: 'Send result to tutor', url: 'https://wa.me/12125550142' } } : {}),
  }));

interface MasteryCase {
  readonly cfg: MasterySummaryConfig;
  readonly source: ReviewNodeStateCase;
  readonly state: AttemptState;
}

/** An attempt state at `SUMMARY_NODE_ID` with the generated `from` state, an optional noise state and an optional earlier own state. */
const caseArb: fc.Arbitrary<MasteryCase> = fc
  .record({
    cfg: configArb,
    source: reviewNodeStateArb,
    noise: fc.option(reviewNodeStateArb, { nil: undefined }),
    own: fc.boolean(),
  })
  .map(({ cfg, source, noise, own }): MasteryCase => {
    const nodeState: Record<string, JsonValue> = {};
    if (source.value !== undefined) nodeState[cfg.from] = source.value;
    if (noise !== undefined && noise.value !== undefined) nodeState[NOISE_NODE_ID] = noise.value;
    if (own) nodeState[SUMMARY_NODE_ID] = { items: 'old' };
    const state: AttemptState = {
      activityId: 'practice-mastery-property',
      manifestVersion: 1,
      seed: 7,
      rngState: 7,
      status: 'playing',
      currentNodeId: SUMMARY_NODE_ID,
      vars: {},
      answers: {},
      nodeState,
      path: [{ nodeId: SUMMARY_NODE_ID, at: 0 }],
      transitions: 0,
      events: [],
      startedAt: 0,
      updatedAt: 0,
    };
    return { cfg, source, state };
  });

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

/** The Item_Result rule of the Glossary as a table: First_Try_Result, then Review_Result (`none` when absent). */
const ITEM_RESULT_TABLE: Readonly<Record<TryResult, Readonly<Record<TryResult | 'none', ItemResult>>>> = {
  correct: { correct: 'firstTry', incorrect: 'firstTry', none: 'firstTry' },
  incorrect: { correct: 'reviewed', incorrect: 'missed', none: 'missed' },
};

/**
 * Reference model of Requirements 9.9, 9.10 and 9.12, written without `itemResult` or
 * `masteryResult`: for a missing or damaged state, no items, zero counts and empty lists;
 * otherwise one entry per planted item in stored order whose `result` comes from the table with
 * the first planted Review_Result for its Item_ID, the counts of each result, `nextReview` as the
 * Item_IDs of the `reviewed` and `missed` items, and `missedTopics` as the distinct Topics of
 * the `missed` items in first-occurrence order.
 */
function modelResult(planted: PlantedReview | null): MasteryResult {
  if (planted === null) return { items: [], counts: { firstTry: 0, reviewed: 0, missed: 0 }, missedTopics: [], nextReview: [] };
  const items = planted.items.map((item): MasteryItem => {
    const review = planted.results.find((entry) => entry.itemId === item.itemId)?.result ?? 'none';
    const result = ITEM_RESULT_TABLE[item.firstTry][review];
    return item.topic === undefined
      ? { itemId: item.itemId, prompt: item.prompt, result }
      : { itemId: item.itemId, topic: item.topic, prompt: item.prompt, result };
  });
  const count = (result: ItemResult): number => items.filter((item) => item.result === result).length;
  const missedTopicList = items.flatMap((item) => (item.result === 'missed' && item.topic !== undefined ? [item.topic] : []));
  return {
    items,
    counts: { firstTry: count('firstTry'), reviewed: count('reviewed'), missed: count('missed') },
    missedTopics: missedTopicList.filter((topic, i) => missedTopicList.indexOf(topic) === i),
    nextReview: items.filter((item) => item.result !== 'firstTry').map((item) => item.itemId),
  };
}

/** The own entries of `nodeState` other than the masterySummary node's. */
function withoutSummaryNode(nodeState: Readonly<Record<string, JsonValue>>): [string, JsonValue][] {
  return Object.entries(nodeState).filter(([id]) => id !== SUMMARY_NODE_ID);
}

describe('Feature: practice-path, Property 6: Mastery_Result follows the Item_Result rule', () => {
  // **Validates: Requirements 9.9, 9.10, 9.12**
  it('masterySummary.enter stores the Mastery_Result of the reference model for readable, missing and damaged from states', () => {
    let missingOrDamaged = 0;
    let readable = 0;
    const seen = { firstTry: 0, reviewed: 0, missed: 0 };
    let repeatedMissedTopic = 0;
    let missedWithoutTopic = 0;
    fc.assert(
      fc.property(caseArb, ({ cfg, source, state: s }) => {
        const before = structuredClone({ cfg, s });
        const enter = masterySummaryNodeType.enter;
        expect(enter).toBeDefined();
        const after = enter === undefined ? s : enter(cfg, s, env());

        // The inputs are unchanged, and only the masterySummary node's state differs.
        expect({ cfg, s }).toEqual(before);
        const { nodeState: afterNodeState, ...afterRest } = after;
        const { nodeState: sNodeState, ...sRest } = s;
        expect(afterRest).toStrictEqual(sRest);
        expect(withoutSummaryNode(afterNodeState)).toStrictEqual(withoutSummaryNode(sNodeState));

        // The stored Mastery_Result equals the model and reads back as a MasteryResult.
        const expected = modelResult(source.planted);
        const stored = afterNodeState[SUMMARY_NODE_ID];
        expect(stored).toStrictEqual(expected);
        expect(readMasteryResult(stored)).toStrictEqual(expected);
        expect(JSON.parse(JSON.stringify(stored))).toStrictEqual(expected);
        expect(masteryResult(cfg, s)).toStrictEqual(expected);

        // Direct checks of the invariants (Requirement 9.12).
        const { items, counts, missedTopics, nextReview } = expected;
        expect(counts.firstTry + counts.reviewed + counts.missed).toBe(items.length);
        for (const result of ['firstTry', 'reviewed', 'missed'] as const) {
          expect(counts[result]).toBe(items.filter((item) => item.result === result).length);
        }
        expect(nextReview).toEqual(items.filter((item) => item.result === 'reviewed' || item.result === 'missed').map((item) => item.itemId));
        expect(new Set(missedTopics).size).toBe(missedTopics.length);
        if (source.planted === null) {
          expect(expected).toStrictEqual({ items: [], counts: { firstTry: 0, reviewed: 0, missed: 0 }, missedTopics: [], nextReview: [] });
          missingOrDamaged += 1;
          return;
        }
        expect(items.map((item) => item.itemId)).toEqual(source.planted.items.map((item) => item.itemId));
        readable += 1;
        seen.firstTry += counts.firstTry;
        seen.reviewed += counts.reviewed;
        seen.missed += counts.missed;
        const missedTopicList = items.flatMap((item) => (item.result === 'missed' && item.topic !== undefined ? [item.topic] : []));
        if (missedTopics.length < missedTopicList.length) repeatedMissedTopic += 1;
        if (items.some((item) => item.result === 'missed' && item.topic === undefined)) missedWithoutTopic += 1;
      }),
      { numRuns: NUM_RUNS },
    );
    // Missing or damaged and readable states, all three results, a repeated missed Topic and a missed item without a Topic all occur.
    expect(missingOrDamaged).toBeGreaterThan(0);
    expect(readable).toBeGreaterThan(0);
    expect(seen.firstTry).toBeGreaterThan(0);
    expect(seen.reviewed).toBeGreaterThan(0);
    expect(seen.missed).toBeGreaterThan(0);
    expect(repeatedMissedTopic).toBeGreaterThan(0);
    expect(missedWithoutTopic).toBeGreaterThan(0);
  });
});
