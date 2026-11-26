// Property tests for the `reviewQueue` node type (design C7, "Correctness Properties"). The
// Wiring_Hook wrote the first version of this file; task 7.3 replaced its property with
// Property 4 and kept the file name, and task 7.4 adds Property 5.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateManifest, type Manifest } from '@dreame/schema';
import {
  checkAction,
  createRng,
  createRuntime,
  reduce,
  type AttemptState,
  type Env,
  type JsonValue,
  type Runtime,
} from '@dreame/runtime';
import { REVIEW_LIMITS, reviewQueueNodeType, type ReviewAnswer } from '../src/node-types/reviewQueue.ts';
import { readReviewQueueState, type ItemSnapshot, type ItemSummary } from '../src/node-types/practice-state.ts';
import { practiceProfile } from '../src/profile.ts';
import {
  idArb,
  queueArb,
  REVIEW_NODE_ID,
  reviewQueueConfigArb,
  reviewStateArb,
  snapshotJson,
} from './practice-arbitraries.ts';

const NUM_RUNS = 200;

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

/** The own entries of `nodeState` other than the reviewQueue node's. */
function withoutReviewNode(nodeState: Readonly<Record<string, JsonValue>>): [string, JsonValue][] {
  return Object.entries(nodeState).filter(([id]) => id !== REVIEW_NODE_ID);
}

/**
 * Reference model of Requirements 8.1–8.3, written without `buildQueue` or `summarize`: the
 * found snapshots are the planted ones in `from` order; `items` holds `{ itemId, topic?, prompt,
 * firstTry }` of each; `queue` holds each snapshot whose `firstTry` is `incorrect` and whose
 * Item_ID has not been queued yet.
 */
function modelState(planted: readonly (ItemSnapshot | null)[]): { items: ItemSummary[]; queue: ItemSnapshot[] } {
  const items: ItemSummary[] = [];
  const queue: ItemSnapshot[] = [];
  const queuedIds: string[] = [];
  for (const snapshot of planted) {
    if (snapshot === null) continue;
    items.push(
      snapshot.topic === undefined
        ? { itemId: snapshot.itemId, prompt: snapshot.prompt, firstTry: snapshot.firstTry }
        : { itemId: snapshot.itemId, topic: snapshot.topic, prompt: snapshot.prompt, firstTry: snapshot.firstTry },
    );
    if (snapshot.firstTry === 'incorrect' && !queuedIds.includes(snapshot.itemId)) {
      queuedIds.push(snapshot.itemId);
      queue.push(snapshot);
    }
  }
  return { items, queue };
}

describe('Feature: practice-path, Property 4: The Queue holds exactly the first-try misses in `from` order', () => {
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.10**
  it('reviewQueue.enter stores the summaries of the found snapshots and the first-try misses, each Item_ID once, in from order', () => {
    let emptyQueue = 0;
    let repeatedMiss = 0;
    let notFound = 0;
    let total = 0;
    fc.assert(
      fc.property(
        reviewQueueConfigArb.chain((cfg) => fc.record({ cfg: fc.constant(cfg), sc: reviewStateArb(cfg) })),
        ({ cfg, sc }) => {
          const { state: s, planted } = sc;
          expect(planted).toHaveLength(cfg.from.length);
          const before = structuredClone({ cfg, s });
          const enter = reviewQueueNodeType.enter;
          expect(enter).toBeDefined();
          const after = enter === undefined ? s : enter(cfg, s, env());

          // The inputs are unchanged, and only the reviewQueue node's state differs.
          expect({ cfg, s }).toEqual(before);
          const { nodeState: afterNodeState, ...afterRest } = after;
          const { nodeState: sNodeState, ...sRest } = s;
          expect(afterRest).toStrictEqual(sRest);
          expect(withoutReviewNode(afterNodeState)).toStrictEqual(withoutReviewNode(sNodeState));

          // The stored state equals the model and reads back as a ReviewQueueNodeState.
          const expected = modelState(planted);
          const stored = afterNodeState[REVIEW_NODE_ID];
          expect(stored).toStrictEqual(expected);
          expect(readReviewQueueState(stored)).toStrictEqual(expected);
          expect(JSON.parse(JSON.stringify(stored))).toStrictEqual(expected);

          // Direct checks of the Queue: misses only, each Item_ID once, empty when there is no miss.
          const queueIds = expected.queue.map((item) => item.itemId);
          expect(new Set(queueIds).size).toBe(queueIds.length);
          expect(expected.queue.every((item) => item.firstTry === 'incorrect')).toBe(true);
          const found = planted.filter((item): item is ItemSnapshot => item !== null);
          if (!found.some((item) => item.firstTry === 'incorrect')) expect(expected.queue).toEqual([]);

          total += 1;
          if (expected.queue.length === 0) emptyQueue += 1;
          const missIds = found.filter((item) => item.firstTry === 'incorrect').map((item) => item.itemId);
          if (new Set(missIds).size < missIds.length) repeatedMiss += 1;
          if (found.length < cfg.from.length) notFound += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Empty and non-empty Queues, a repeated missed Item_ID and a from node without a snapshot all occur.
    expect(emptyQueue).toBeGreaterThan(0);
    expect(total - emptyQueue).toBeGreaterThan(0);
    expect(repeatedMiss).toBeGreaterThan(0);
    expect(notFound).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Property 5. The attempt state sits at the `reviewQueue` node with a stored `{ items, queue }`
// holding the generated Queue, so `reduce` reads that Queue (design C7, D57). The response goes
// through the runtime `checkAction` and `reduce`, so the precompiled response validator and
// `isValidResponse` both run.

const ACTIVITY_ID = 'practice-review-property';

/** `r1 (recall) → review (reviewQueue from [r1]) → done (outcome)`, as a practice-path manifest. */
function reviewManifest(): Manifest {
  return {
    schemaVersion: 1,
    profile: 'practice-path',
    activityId: ACTIVITY_ID,
    version: 1,
    requires: { recall: 1, reviewQueue: 1, outcome: 1 },
    entryNodeId: 'r1',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      {
        id: 'r1',
        type: 'recall',
        config: {
          itemId: 'q1',
          prompt: 'Question q1',
          options: [
            { id: 'a', label: 'Right' },
            { id: 'b', label: 'Wrong' },
          ],
          correctOptionId: 'a',
          explanation: 'Option a is right.',
          maxRetries: 1,
        },
        edges: [{ to: REVIEW_NODE_ID }],
      },
      { id: REVIEW_NODE_ID, type: 'reviewQueue', config: { title: 'Review', from: ['r1'] }, edges: [{ to: 'done' }] },
      { id: 'done', type: 'outcome', config: { title: 'Done', body: 'Lesson finished.' }, edges: [] },
    ],
    theme: 'default',
  } as Manifest;
}

function reviewRuntime(): Runtime {
  const result = validateManifest(reviewManifest(), practiceProfile);
  if (!result.ok) {
    const d = result.diagnostics[0];
    throw new Error(`reviewManifest is not valid: ${d === undefined ? 'no diagnostics' : `${d.stage}/${d.code} at ${d.path}: ${d.message}`}`);
  }
  return createRuntime(practiceProfile, result.manifest);
}

/** A fresh plain-JSON Item summary of `item`; `topic` is left out when absent. */
function summaryJson(item: ItemSnapshot): { [k: string]: JsonValue } {
  const fields: { [k: string]: JsonValue } = { itemId: item.itemId, prompt: item.prompt, firstTry: item.firstTry };
  return item.topic === undefined ? fields : { itemId: item.itemId, topic: item.topic, prompt: item.prompt, firstTry: item.firstTry };
}

/** The stored `{ items, queue }` of the Queue, before `reduce`. */
function queueStateValue(queue: readonly ItemSnapshot[]): { [k: string]: JsonValue } {
  return { items: queue.map(summaryJson), queue: queue.map(snapshotJson) };
}

/** An attempt state at the `reviewQueue` node, after r1, with the Queue stored by `enter`. */
function stateAtReview(queue: readonly ItemSnapshot[]): AttemptState {
  return {
    activityId: ACTIVITY_ID,
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId: REVIEW_NODE_ID,
    vars: {},
    answers: { r1: 'incorrect' },
    nodeState: { [REVIEW_NODE_ID]: queueStateValue(queue) },
    path: [
      { nodeId: 'r1', at: 0 },
      { nodeId: REVIEW_NODE_ID, at: 0 },
    ],
    transitions: 1,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reference model of the response schema and `isValidResponse` (Requirements 8.4–8.6), written
 * without the precompiled validator: an object whose only own key is `answers`, an array of at
 * most 24 entries, each an object whose own keys are exactly `itemId` and `optionId`, both
 * strings of at most 64 UTF-16 code units, and no `itemId` twice.
 */
function modelAccepts(r: unknown): boolean {
  if (!isPlainRecord(r)) return false;
  const keys = Object.keys(r);
  if (keys.length !== 1 || keys[0] !== 'answers') return false;
  const answers = r['answers'];
  if (!Array.isArray(answers) || answers.length > REVIEW_LIMITS.maxFrom) return false;
  const itemIds: string[] = [];
  for (const entry of answers as unknown[]) {
    if (!isPlainRecord(entry)) return false;
    const entryKeys = Object.keys(entry).sort();
    if (entryKeys.length !== 2 || entryKeys[0] !== 'itemId' || entryKeys[1] !== 'optionId') return false;
    const itemId = entry['itemId'];
    const optionId = entry['optionId'];
    if (typeof itemId !== 'string' || typeof optionId !== 'string') return false;
    if (itemId.length > 64 || optionId.length > 64) return false;
    if (itemIds.includes(itemId)) return false;
    itemIds.push(itemId);
  }
  return true;
}

/**
 * Reference model of the Review_Results (Requirements 8.7, 8.8, 8.11), written without
 * `reviewResults`: one entry per Queue Item in Queue order, `correct` exactly when the accepted
 * response holds an answer for that Item_ID whose `optionId` is the Item's `correctOptionId`.
 * Accepted responses repeat no `itemId`, so `find` names the only answer for an Item_ID.
 */
function modelResults(queue: readonly ItemSnapshot[], answers: readonly ReviewAnswer[]): { [k: string]: JsonValue }[] {
  return queue.map((item) => {
    const answer = answers.find((entry) => entry.itemId === item.itemId);
    return { itemId: item.itemId, result: answer !== undefined && answer.optionId === item.correctOptionId ? 'correct' : 'incorrect' };
  });
}

/** Item_IDs that are mostly not in the Queue: random IDs, empty, prototype names, and 64 and 65 code units. */
const unknownItemIdArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: idArb },
  { weight: 1, arbitrary: fc.constantFrom('', '__proto__', 'toString', 'constructor', 'x'.repeat(64), 'x'.repeat(65)) },
  { weight: 1, arbitrary: fc.string({ maxLength: 70 }) },
);

/** Option IDs for `item`: its correct option, any of its options, or a random ID (including 65 code units); random only without an item. */
function optionIdArb(item: ItemSnapshot | undefined): fc.Arbitrary<string> {
  const random = fc.oneof(idArb, fc.constantFrom('', 'x'.repeat(65)), fc.string({ maxLength: 70 }));
  if (item === undefined) return random;
  return fc.oneof(
    { weight: 3, arbitrary: fc.constant(item.correctOptionId) },
    { weight: 3, arbitrary: fc.constantFrom(...item.options.map((option) => option.id)) },
    { weight: 1, arbitrary: random },
  );
}

/** One answer: an Item_ID from the Queue or an unknown one, with an option ID for that Item. */
function answerArb(queue: readonly ItemSnapshot[]): fc.Arbitrary<ReviewAnswer> {
  const itemIdArb =
    queue.length === 0
      ? unknownItemIdArb
      : fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...queue.map((item) => item.itemId)) }, { weight: 1, arbitrary: unknownItemIdArb });
  return itemIdArb.chain((itemId) =>
    optionIdArb(queue.find((item) => item.itemId === itemId)).map((optionId): ReviewAnswer => ({ itemId, optionId })),
  );
}

/** Answer lists with no repeated Item_ID: some Queue Items in any order, mixed with 0–6 unknown Item_IDs. */
function uniqueAnswersArb(queue: readonly ItemSnapshot[]): fc.Arbitrary<ReviewAnswer[]> {
  const queueIds = queue.map((item) => item.itemId);
  return fc
    .tuple(
      fc.shuffledSubarray([...queue]),
      fc.uniqueArray(
        unknownItemIdArb.filter((id) => !queueIds.includes(id)),
        { maxLength: 6 },
      ),
    )
    .chain(([items, unknownIds]) =>
      fc.tuple(fc.tuple(...items.map((item) => optionIdArb(item))), fc.tuple(...unknownIds.map(() => optionIdArb(undefined)))).map(
        ([known, unknown]): ReviewAnswer[] => [
          ...items.map((item, i): ReviewAnswer => ({ itemId: item.itemId, optionId: known[i] ?? '' })),
          ...unknownIds.map((itemId, i): ReviewAnswer => ({ itemId, optionId: unknown[i] ?? '' })),
        ],
      ),
    )
    .chain((answers) => fc.shuffledSubarray(answers, { minLength: answers.length, maxLength: answers.length }));
}

/** An answer entry damaged by an extra key, a missing key, a non-string field, or a non-object value. */
function damagedEntryArb(answer: ReviewAnswer): fc.Arbitrary<unknown> {
  return fc.oneof(
    fc.tuple(fc.string(), fc.jsonValue()).map(([key, value]) => ({
      itemId: answer.itemId,
      optionId: answer.optionId,
      [key === 'itemId' || key === 'optionId' ? 'extra' : key]: value,
    })),
    fc.constant({ itemId: answer.itemId }),
    fc.constant({ optionId: answer.optionId }),
    fc.constant({ itemId: 1, optionId: answer.optionId }),
    fc.constant({ itemId: answer.itemId, optionId: null }),
    fc.constantFrom<unknown>(null, 'x', 3, [], [answer.itemId, answer.optionId]),
  );
}

/**
 * Candidate responses: answer lists with no repeats (mostly accepted), lists of 0–30 random
 * answers with repeats, 25–30 answers with distinct Item_IDs, a list with one Item_ID repeated,
 * an extra key on the response, a damaged entry, a non-array `answers`, and random JSON or values.
 */
function responseArb(queue: readonly ItemSnapshot[]): fc.Arbitrary<unknown> {
  const unique = uniqueAnswersArb(queue);
  const random = answerArb(queue);
  return fc.oneof(
    { weight: 6, arbitrary: unique.map((answers) => ({ answers })) },
    { weight: 2, arbitrary: fc.array(random, { maxLength: 30 }).map((answers) => ({ answers })) },
    {
      weight: 1,
      arbitrary: fc
        .uniqueArray(random, { minLength: 25, maxLength: 30, selector: (answer: ReviewAnswer) => answer.itemId })
        .map((answers) => ({ answers })),
    },
    {
      weight: 1,
      arbitrary: fc.tuple(unique, fc.nat(), fc.nat(), optionIdArb(undefined)).map(([answers, from, at, optionId]) => {
        if (answers.length === 0) return { answers };
        const repeated: ReviewAnswer = { itemId: answers[from % answers.length]!.itemId, optionId };
        const list = [...answers];
        list.splice(at % (list.length + 1), 0, repeated);
        return { answers: list };
      }),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(unique, fc.string(), fc.jsonValue())
        .map(([answers, key, value]) => ({ answers, [key === 'answers' ? 'extra' : key]: value })),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(unique, fc.nat(), random)
        .chain(([answers, at, fallback]) => {
          const index = answers.length === 0 ? 0 : at % answers.length;
          return damagedEntryArb(answers[index] ?? fallback).map((entry) => {
            const list: unknown[] = [...answers];
            list.splice(index, answers.length === 0 ? 0 : 1, entry);
            return { answers: list };
          });
        }),
    },
    { weight: 1, arbitrary: fc.record({ answers: fc.anything() }) },
    { weight: 1, arbitrary: fc.oneof(fc.jsonValue(), fc.anything(), unique) },
  );
}

describe('Feature: practice-path, Property 5: Review responses and Review_Results match the reference model', () => {
  // **Validates: Requirements 8.4, 8.5, 8.6, 8.7, 8.8, 8.11**
  it('checkAction at a reviewQueue node accepts exactly what the reference model accepts, and reduce stores the model Review_Results', () => {
    const rt = reviewRuntime();
    expect(rt.profile.registry.get('reviewQueue')).toBe(reviewQueueNodeType);
    let accepted = 0;
    let total = 0;
    let unknownIgnored = 0;
    let correctResults = 0;
    let incorrectResults = 0;
    let nonEmptyQueue = 0;
    fc.assert(
      fc.property(
        queueArb.chain((queue) => fc.record({ queue: fc.constant(queue), response: responseArb(queue) })),
        ({ queue, response }) => {
          const s = stateAtReview(queue);
          const action = { type: 'respond', nodeId: REVIEW_NODE_ID, response } as const;
          const expectedAccept = modelAccepts(response);
          expect(checkAction(rt, s, action)).toBe(expectedAccept ? null : 'invalid-response');

          const before = structuredClone(s);
          const after = reduce(rt, s, action, { now: 1 });
          expect(s).toEqual(before);
          total += 1;
          if (queue.length > 0) nonEmptyQueue += 1;
          if (!expectedAccept) {
            // A rejected action returns the state itself.
            expect(after).toBe(s);
            return;
          }
          accepted += 1;

          const answers = (response as { answers: ReviewAnswer[] }).answers;
          const results = modelResults(queue, answers);
          const expected = { ...queueStateValue(queue), results };
          const stored = after.nodeState[REVIEW_NODE_ID];
          expect(stored).toStrictEqual(expected);
          expect(readReviewQueueState(stored)).toStrictEqual(expected);
          expect(after.currentNodeId).toBe('done');

          // Direct checks: one result per Queue Item in Queue order.
          const storedResults = readReviewQueueState(stored)?.results ?? [];
          expect(storedResults.map((entry) => entry.itemId)).toEqual(queue.map((item) => item.itemId));

          const queueIds = queue.map((item) => item.itemId);
          if (answers.some((answer) => !queueIds.includes(answer.itemId))) unknownIgnored += 1;
          correctResults += storedResults.filter((entry) => entry.result === 'correct').length;
          incorrectResults += storedResults.filter((entry) => entry.result === 'incorrect').length;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Acceptance and rejection, non-empty Queues, ignored unknown answers and both results all occur.
    expect(accepted).toBeGreaterThan(0);
    expect(total - accepted).toBeGreaterThan(0);
    expect(nonEmptyQueue).toBeGreaterThan(0);
    expect(unknownIgnored).toBeGreaterThan(0);
    expect(correctResults).toBeGreaterThan(0);
    expect(incorrectResults).toBeGreaterThan(0);
  });
});
