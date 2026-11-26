// Example tests for the Progress_Model (design C10, D63, "Device storage format, version 1",
// "Progress_File"): the key format, Due_For_Review, `answeredItems` on attempts played with the
// runtime over a small in-test lesson, `updateProgress` on new and existing keys, trimming at
// RECORD_CAP and at the 65,536-character file limit, merging, and `parseProgressFile`. These tests
// are evidence for the cases listed, not a proof of correctness.

import { describe, expect, it } from 'vitest';
import { validateManifest, type Manifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type AttemptState, type Runtime } from '@dreame/runtime';
import { readReviewQueueState } from '../src/node-types/practice-state.ts';
import { practiceProfile } from '../src/profile.ts';
import {
  PROGRESS_FILE_FORMAT,
  PROGRESS_FILE_MAX,
  PROGRESS_KEY_PATTERN,
  RECORD_CAP,
  answeredItems,
  buildProgressFile,
  dueCount,
  isDueForReview,
  isProgressStore,
  lessonItemIds,
  mergeProgress,
  parseProgressFile,
  progressKey,
  recordAttempt,
  updateProgress,
  type ItemRecord,
  type ItemResult,
  type ProgressStore,
} from '../src/progress.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rec(lastSeenAt: number, last: ItemResult = 'missed', seen = 1, firstTryMisses = 0): ItemRecord {
  return { seen, firstTryMisses, last, lastSeenAt };
}

/** Keys of `store` in the trim order: `lastSeenAt` ascending, then key by code unit. */
function trimOrder(store: ProgressStore): string[] {
  return Object.keys(store).sort((a, b) => {
    const ta = store[a]?.lastSeenAt ?? 0;
    const tb = store[b]?.lastSeenAt ?? 0;
    if (ta !== tb) return ta - tb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function sorted(keys: readonly string[]): string[] {
  return [...keys].sort();
}

/** True when `store` is over RECORD_CAP records or over PROGRESS_FILE_MAX characters of file text. */
function overCaps(store: ProgressStore): boolean {
  return Object.keys(store).length > RECORD_CAP || buildProgressFile(store).length > PROGRESS_FILE_MAX;
}

/**
 * Checks a trim result: within both caps, every `keep` key present, the removed records are the
 * first of `before` in the trim order, the others deep-equal their old values, and putting back the
 * last removed record would break a cap (so no more was removed than needed).
 */
function expectTrimmed(before: ProgressStore, after: ProgressStore, keep: readonly string[]): number {
  expect(overCaps(after)).toBe(false);
  for (const key of keep) expect(Object.hasOwn(after, key)).toBe(true);
  const order = trimOrder(before).filter((key) => !keep.includes(key));
  const removed = order.length + keep.length - Object.keys(after).length;
  expect(removed).toBeGreaterThan(0);
  expect(Object.keys(after)).toEqual(sorted([...order.slice(removed), ...keep]));
  for (const key of order.slice(removed)) expect(after[key]).toEqual(before[key]);
  const lastRemoved = order[removed - 1] as string;
  expect(overCaps({ ...after, [lastRemoved]: before[lastRemoved] as ItemRecord })).toBe(true);
  return removed;
}

// ---------------------------------------------------------------------------
// Small in-test lesson: r1, r2 (recall) → rq (reviewQueue) → ms (masterySummary)
// ---------------------------------------------------------------------------

const ACTIVITY = 'practice-progress-test';

function recallConfig(itemId: string) {
  return {
    itemId,
    prompt: `Question ${itemId}`,
    options: [
      { id: 'a', label: 'Right' },
      { id: 'b', label: 'Wrong' },
    ],
    correctOptionId: 'a',
    explanation: 'Option a is right.',
    maxRetries: 1,
  };
}

const LESSON = {
  schemaVersion: 1,
  profile: 'practice-path',
  activityId: ACTIVITY,
  version: 1,
  requires: { recall: 1, reviewQueue: 1, masterySummary: 1 },
  entryNodeId: 'r1',
  fallbackOutcomeId: 'ms',
  limits: { maxNodes: 10, maxTransitions: 10 },
  variables: [],
  nodes: [
    { id: 'r1', type: 'recall', config: recallConfig('q1'), edges: [{ to: 'r2' }] },
    { id: 'r2', type: 'recall', config: recallConfig('q2'), edges: [{ to: 'rq' }] },
    { id: 'rq', type: 'reviewQueue', config: { title: 'Review', from: ['r1', 'r2'] }, edges: [{ to: 'ms' }] },
    { id: 'ms', type: 'masterySummary', config: { title: 'Your results', body: 'Done.', from: 'rq' }, edges: [] },
  ],
  theme: 'default',
};

function lessonRuntime(): { rt: Runtime; manifest: Manifest } {
  const result = validateManifest(LESSON, practiceProfile);
  if (!result.ok) throw new Error('the in-test lesson does not pass validation');
  return { rt: createRuntime(practiceProfile, result.manifest), manifest: result.manifest };
}

/** Plays the responses in turn from `createAttempt`; step `i` (from 1) runs at time `1000 + i * 1000`. */
function play(rt: Runtime, responses: readonly unknown[]): AttemptState {
  let s = createAttempt(rt, 7, { now: 1000 });
  responses.forEach((response, i) => {
    const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
    expect(checkAction(rt, s, action)).toBeNull();
    s = reduce(rt, s, action, { now: 1000 + (i + 1) * 1000 });
  });
  return s;
}

const RIGHT = { tries: ['a'] };
const WRONG_THEN_RIGHT = { tries: ['b', 'a'] };

// ---------------------------------------------------------------------------
// Key format and Due_For_Review
// ---------------------------------------------------------------------------

describe('progressKey', () => {
  it('joins the activity ID and the Item_ID with a colon, matching PROGRESS_KEY_PATTERN', () => {
    const key = progressKey('practice-fractions', 'fractions-1');
    expect(key).toBe('practice-fractions:fractions-1');
    expect(new RegExp(PROGRESS_KEY_PATTERN).test(key)).toBe(true);
  });
});

describe('isDueForReview and dueCount', () => {
  it('reports reviewed and missed as Due_For_Review, firstTry as not', () => {
    expect(isDueForReview(rec(1, 'firstTry'))).toBe(false);
    expect(isDueForReview(rec(1, 'reviewed'))).toBe(true);
    expect(isDueForReview(rec(1, 'missed'))).toBe(true);
  });

  it('counts the due records of the given Item_IDs under the given activity only', () => {
    const store: ProgressStore = {
      'lesson-a:q1': rec(1, 'firstTry'),
      'lesson-a:q2': rec(1, 'reviewed'),
      'lesson-a:q3': rec(1, 'missed'),
      'lesson-b:q4': rec(1, 'missed'),
    };
    expect(dueCount(store, 'lesson-a', ['q1', 'q2', 'q3', 'q4', 'q5'])).toBe(2);
    expect(dueCount(store, 'lesson-b', ['q4'])).toBe(1);
    expect(dueCount({}, 'lesson-a', ['q1'])).toBe(0);
  });

  it('does not read inherited keys', () => {
    expect(dueCount({}, 'constructor', ['__proto__'])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// answeredItems and recordAttempt on runtime attempts
// ---------------------------------------------------------------------------

describe('answeredItems on the in-test lesson', () => {
  const { rt, manifest } = lessonRuntime();

  it('lessonItemIds lists the recall Item_IDs in manifest order', () => {
    expect(lessonItemIds(manifest)).toEqual(['q1', 'q2']);
  });

  it('a finished attempt gives firstTry for a right first Try and reviewed for a corrected review', () => {
    const s = play(rt, [RIGHT, WRONG_THEN_RIGHT, { answers: [{ itemId: 'q2', optionId: 'a' }] }]);
    expect(s.status).toBe('finished');
    expect(answeredItems(manifest, s)).toEqual([
      { itemId: 'q1', firstTry: 'correct', result: 'firstTry' },
      { itemId: 'q2', firstTry: 'incorrect', result: 'reviewed' },
    ]);
  });

  it('a wrong review answer gives missed', () => {
    const s = play(rt, [WRONG_THEN_RIGHT, WRONG_THEN_RIGHT, { answers: [{ itemId: 'q1', optionId: 'a' }, { itemId: 'q2', optionId: 'b' }] }]);
    expect(s.status).toBe('finished');
    expect(answeredItems(manifest, s)).toEqual([
      { itemId: 'q1', firstTry: 'incorrect', result: 'reviewed' },
      { itemId: 'q2', firstTry: 'incorrect', result: 'missed' },
    ]);
  });

  it('a Queue Item with no Review_Result counts as missed', () => {
    const s = play(rt, [RIGHT, WRONG_THEN_RIGHT]);
    expect([s.status, s.currentNodeId]).toEqual(['playing', 'rq']);
    const queueState = readReviewQueueState(s.nodeState['rq']);
    expect(queueState?.queue.map((item) => item.itemId)).toEqual(['q2']);
    expect(queueState?.results).toBeUndefined();
    expect(answeredItems(manifest, s)).toEqual([
      { itemId: 'q1', firstTry: 'correct', result: 'firstTry' },
      { itemId: 'q2', firstTry: 'incorrect', result: 'missed' },
    ]);
  });

  it('skips recall nodes without a stored answer', () => {
    const s = play(rt, [WRONG_THEN_RIGHT]);
    expect(answeredItems(manifest, s)).toEqual([{ itemId: 'q1', firstTry: 'incorrect', result: 'missed' }]);
    expect(answeredItems(manifest, play(rt, []))).toEqual([]);
  });

  it('recordAttempt applies answeredItems at s.updatedAt', () => {
    const s = play(rt, [RIGHT, WRONG_THEN_RIGHT, { answers: [{ itemId: 'q2', optionId: 'a' }] }]);
    expect(s.updatedAt).toBe(4000);
    expect(recordAttempt({}, manifest, s)).toEqual({
      [`${ACTIVITY}:q1`]: { seen: 1, firstTryMisses: 0, last: 'firstTry', lastSeenAt: 4000 },
      [`${ACTIVITY}:q2`]: { seen: 1, firstTryMisses: 1, last: 'reviewed', lastSeenAt: 4000 },
    });
  });
});

// ---------------------------------------------------------------------------
// updateProgress
// ---------------------------------------------------------------------------

describe('updateProgress', () => {
  it('creates a new record and updates an existing one, keeping the others unchanged', () => {
    const store: ProgressStore = {
      'lesson-a:q2': rec(100, 'reviewed', 2, 1),
      'lesson-a:q9': rec(50, 'missed', 3, 3),
      'lesson-b:q1': rec(70, 'firstTry'),
    };
    const snapshot = structuredClone(store);
    const next = updateProgress(
      store,
      'lesson-a',
      [
        { itemId: 'q2', firstTry: 'incorrect', result: 'missed' },
        { itemId: 'q1', firstTry: 'correct', result: 'firstTry' },
      ],
      200,
    );
    expect(next).toEqual({
      'lesson-a:q1': { seen: 1, firstTryMisses: 0, last: 'firstTry', lastSeenAt: 200 },
      'lesson-a:q2': { seen: 3, firstTryMisses: 2, last: 'missed', lastSeenAt: 200 },
      'lesson-a:q9': rec(50, 'missed', 3, 3),
      'lesson-b:q1': rec(70, 'firstTry'),
    });
    expect(Object.keys(next)).toEqual(['lesson-a:q1', 'lesson-a:q2', 'lesson-a:q9', 'lesson-b:q1']);
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect(store).toEqual(snapshot);
  });

  it('a correct first Try on an existing record leaves firstTryMisses unchanged', () => {
    const next = updateProgress({ 'lesson-a:q1': rec(10, 'missed', 4, 2) }, 'lesson-a', [{ itemId: 'q1', firstTry: 'correct', result: 'firstTry' }], 20);
    expect(next['lesson-a:q1']).toEqual({ seen: 5, firstTryMisses: 2, last: 'firstTry', lastSeenAt: 20 });
  });
});

// ---------------------------------------------------------------------------
// Trimming (Requirement 12.6, D63)
// ---------------------------------------------------------------------------

describe('trimming', () => {
  it('trims a store over RECORD_CAP to at most RECORD_CAP records, oldest first with ties by key', () => {
    // 1,100 records inserted in reverse; ten share each lastSeenAt, and within a tie the key order
    // is the reverse of the index order, so the tie order differs from the insertion order.
    const entries: [string, ItemRecord][] = [];
    for (let i = 1099; i >= 0; i--) entries.push([`a:x${9999 - i}`, rec(Math.floor(i / 10))]);
    const store: ProgressStore = Object.fromEntries(entries);
    expect(Object.keys(store)).toHaveLength(1100);
    const next = updateProgress(store, 'a', [{ itemId: 'new', firstTry: 'incorrect', result: 'missed' }], 5000);
    expect(Object.keys(next).length).toBeLessThanOrEqual(RECORD_CAP);
    const removed = expectTrimmed(store, next, ['a:new']);
    expect(removed).toBeGreaterThanOrEqual(1101 - RECORD_CAP);
    expect(next['a:new']).toEqual({ seen: 1, firstTryMisses: 1, last: 'missed', lastSeenAt: 5000 });
    // The first tie group (lastSeenAt 0, i = 0..9) goes by key: x9990 (i = 9) first, x9999 (i = 0) last.
    expect(trimOrder(store).slice(0, 2)).toEqual(['a:x9990', 'a:x9991']);
    expect(Object.hasOwn(next, 'a:x9990')).toBe(false);
  });

  it('trims at the 65,536-character file limit and keeps the current attempt records', () => {
    // 400 records with 129-character keys: under RECORD_CAP, but the file text is over the limit.
    const activity = 'p'.repeat(64);
    const entries: [string, ItemRecord][] = [];
    for (let i = 399; i >= 0; i--) entries.push([progressKey(activity, `I${String(i).padStart(63, '0')}`), rec(Math.floor(i / 10), 'reviewed')]);
    const store: ProgressStore = Object.fromEntries(entries);
    expect(Object.keys(store).length).toBeLessThan(RECORD_CAP);
    expect(buildProgressFile(store).length).toBeGreaterThan(PROGRESS_FILE_MAX);
    // `now` is 0, so the attempt records come first in the trim order; they stay because they are kept.
    const items = ['A1', 'A2', 'A3'].map((itemId) => ({ itemId, firstTry: 'correct' as const, result: 'firstTry' as const }));
    const next = updateProgress(store, activity, items, 0);
    const keep = items.map((item) => progressKey(activity, item.itemId));
    expect(trimOrder(next).slice(0, 3)).toEqual(keep);
    expectTrimmed(store, next, keep);
    expect(Object.keys(next).length).toBeLessThan(RECORD_CAP);
    expect(buildProgressFile(next).length).toBeLessThanOrEqual(PROGRESS_FILE_MAX);
    for (const key of keep) expect(next[key]).toEqual({ seen: 1, firstTryMisses: 0, last: 'firstTry', lastSeenAt: 0 });
  });
});

// ---------------------------------------------------------------------------
// mergeProgress and buildProgressFile
// ---------------------------------------------------------------------------

describe('mergeProgress', () => {
  it('keeps the later lastSeenAt per key and the current record on equal times', () => {
    const current: ProgressStore = { 'l:b': rec(5, 'missed'), 'l:c': rec(9, 'firstTry'), 'l:d': rec(3, 'reviewed') };
    const incoming: ProgressStore = { 'l:a': rec(1, 'missed'), 'l:b': rec(6, 'firstTry'), 'l:c': rec(8, 'missed'), 'l:d': rec(3, 'missed', 2) };
    const merged = mergeProgress(current, incoming);
    expect(merged).toEqual({ 'l:a': rec(1, 'missed'), 'l:b': rec(6, 'firstTry'), 'l:c': rec(9, 'firstTry'), 'l:d': rec(3, 'reviewed') });
    expect(Object.keys(merged)).toEqual(['l:a', 'l:b', 'l:c', 'l:d']);
    expect(mergeProgress(merged, merged)).toEqual(merged);
  });
});

describe('buildProgressFile', () => {
  it('writes the design example as compact JSON', () => {
    const store: ProgressStore = { 'practice-fractions:fractions-1': rec(1763800000000, 'reviewed', 2, 1) };
    expect(buildProgressFile(store)).toBe(
      '{"format":"dreame-practice-progress","version":1,"items":{"practice-fractions:fractions-1":{"seen":2,"firstTryMisses":1,"last":"reviewed","lastSeenAt":1763800000000}}}',
    );
  });

  it('gives equal text for equal stores built in another key and field order', () => {
    const a: ProgressStore = { 'l:a': rec(1), 'l:b': rec(2) };
    const b: ProgressStore = { 'l:b': { lastSeenAt: 2, last: 'missed', firstTryMisses: 0, seen: 1 }, 'l:a': rec(1) };
    expect(buildProgressFile(b)).toBe(buildProgressFile(a));
  });
});

// ---------------------------------------------------------------------------
// isProgressStore and parseProgressFile (Requirement 13.5)
// ---------------------------------------------------------------------------

describe('isProgressStore', () => {
  it('accepts an empty store and a valid record, and rejects an extra field or a bad key', () => {
    expect(isProgressStore({})).toBe(true);
    expect(isProgressStore({ 'l:a': rec(1) })).toBe(true);
    expect(isProgressStore({ 'l:a': { ...rec(1), extra: 1 } })).toBe(false);
    expect(isProgressStore({ 'no-colon': rec(1) })).toBe(false);
    expect(isProgressStore({ 'l:a': rec(1, 'missed', 1, 2) })).toBe(false);
    expect(isProgressStore(JSON.parse('{"__proto__":{"seen":1,"firstTryMisses":0,"last":"missed","lastSeenAt":0}}'))).toBe(false);
    expect(isProgressStore([])).toBe(false);
    expect(isProgressStore(null)).toBe(false);
  });
});

describe('parseProgressFile', () => {
  const store: ProgressStore = { 'l:a': rec(1, 'reviewed', 2, 1), 'l:b': rec(2, 'firstTry') };
  const items = JSON.parse(buildProgressFile(store)).items as unknown;

  it('reads the items of a file that buildProgressFile wrote', () => {
    expect(parseProgressFile(buildProgressFile(store))).toEqual(store);
  });

  it('returns null for a wrong format', () => {
    expect(parseProgressFile(JSON.stringify({ format: 'other-format', version: 1, items }))).toBeNull();
  });

  it('returns null for a wrong version', () => {
    expect(parseProgressFile(JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: 2, items }))).toBeNull();
    expect(parseProgressFile(JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: '1', items }))).toBeNull();
  });

  it('returns null for an extra key at the top level or in a record', () => {
    expect(parseProgressFile(JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: 1, items, extra: true }))).toBeNull();
    const extraField = { 'l:a': { ...rec(1), note: 'x' } };
    expect(parseProgressFile(JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: 1, items: extraField }))).toBeNull();
  });

  it('returns null for text that is not JSON', () => {
    expect(parseProgressFile('')).toBeNull();
    expect(parseProgressFile('{')).toBeNull();
    expect(parseProgressFile('not json')).toBeNull();
  });

  it('returns null for text longer than PROGRESS_FILE_MAX', () => {
    expect(parseProgressFile(' '.repeat(PROGRESS_FILE_MAX + 1))).toBeNull();
  });
});
