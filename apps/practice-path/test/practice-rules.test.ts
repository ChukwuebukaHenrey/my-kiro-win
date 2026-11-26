import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import {
  buildQueue,
  firstTryResult,
  itemResult,
  meetsTryRules,
  reviewResults,
  summarize,
  triesLeft,
  type TryRulesConfig,
} from '../src/node-types/practice-rules.ts';
import type { ItemSnapshot, TryResult } from '../src/node-types/practice-state.ts';
import {
  readMasteryResult,
  readRecallNodeState,
  readReviewQueueState,
} from '../src/node-types/practice-state.ts';

type JsonObject = { [k: string]: JsonValue };
type Reader = (value: JsonValue | undefined) => unknown;

/** A deep copy of `value` with the extra own key `__proto__` added through JSON.parse. */
function withProtoKey(value: JsonObject): JsonObject {
  const text = JSON.stringify(value).replace(/^\{/, '{"__proto__":{"x":1},');
  const out = JSON.parse(text) as JsonObject;
  expect(Object.hasOwn(out, '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  return out;
}

/** The rejections every reader shares. `full` is a well-formed value with at least one field. */
function sharedRejections(read: Reader, full: JsonObject): void {
  it('returns null for undefined, null, a non-object and an array', () => {
    expect(read(undefined)).toBeNull();
    expect(read(null)).toBeNull();
    expect(read('state')).toBeNull();
    expect(read(7)).toBeNull();
    expect(read(true)).toBeNull();
    expect(read([full])).toBeNull();
  });

  it('returns null for an extra key', () => {
    expect(read({ ...full, extra: 1 })).toBeNull();
  });

  it('returns null for an own __proto__ key made with JSON.parse', () => {
    expect(read(withProtoKey(full))).toBeNull();
  });

  it('returns null for an own non-enumerable __proto__ key made with Object.defineProperty', () => {
    const value = structuredClone(full);
    Object.defineProperty(value, '__proto__', { value: {}, enumerable: false, configurable: true, writable: true });
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(read(value)).toBeNull();
  });
}

const fullSnapshot: JsonObject = {
  itemId: 'q1',
  topic: 'fractions',
  prompt: 'What is 1/2 + 1/4?',
  options: [
    { id: 'a', label: '3/4' },
    { id: 'b', label: '2/6' },
  ],
  correctOptionId: 'a',
  explanation: '1/2 is 2/4, and 2/4 + 1/4 is 3/4.',
  tries: ['b', 'a'],
  firstTry: 'incorrect',
};
const { topic: _topic, ...bareSnapshot } = fullSnapshot;

describe('readRecallNodeState', () => {
  const full: JsonObject = { order: ['b', 'a'], item: fullSnapshot };

  it('accepts a well-formed value with every optional field and returns a fresh copy', () => {
    const result = readRecallNodeState(full);
    expect(result).toEqual(full);
    expect(result?.order).not.toBe(full['order']);
    expect(result?.item).not.toBe(fullSnapshot);
    expect(result?.item?.options[0]).not.toBe((fullSnapshot['options'] as JsonValue[])[0]);
  });

  it('accepts a value without its optional fields and leaves them out', () => {
    expect(readRecallNodeState({})).toEqual({});
    expect(Object.keys(readRecallNodeState({}) ?? { x: 1 })).toEqual([]);
    expect(readRecallNodeState({ order: ['a', 'b'] })).toEqual({ order: ['a', 'b'] });
    const result = readRecallNodeState({ item: bareSnapshot });
    expect(result).toEqual({ item: bareSnapshot });
    expect(Object.hasOwn(result?.item ?? {}, 'topic')).toBe(false);
  });

  it('returns null for a missing snapshot field', () => {
    const { prompt: _p, ...noPrompt } = fullSnapshot;
    expect(readRecallNodeState({ item: noPrompt })).toBeNull();
    const { firstTry: _f, ...noFirstTry } = fullSnapshot;
    expect(readRecallNodeState({ item: noFirstTry })).toBeNull();
  });

  it('returns null for a field of the wrong type', () => {
    expect(readRecallNodeState({ order: 'a' })).toBeNull();
    expect(readRecallNodeState({ order: ['a', 1] })).toBeNull();
    expect(readRecallNodeState({ item: null })).toBeNull();
    expect(readRecallNodeState({ item: { ...fullSnapshot, topic: 5 } })).toBeNull();
    expect(readRecallNodeState({ item: { ...fullSnapshot, tries: [1] } })).toBeNull();
    expect(readRecallNodeState({ item: { ...fullSnapshot, firstTry: 'maybe' } })).toBeNull();
    expect(readRecallNodeState({ item: { ...fullSnapshot, options: [{ id: 'a', label: 3 }] } })).toBeNull();
  });

  it('returns null for an extra key in a nested object', () => {
    expect(readRecallNodeState({ item: { ...fullSnapshot, extra: true } })).toBeNull();
    expect(readRecallNodeState({ item: { ...fullSnapshot, options: [{ id: 'a', label: 'A', x: 1 }] } })).toBeNull();
    expect(readRecallNodeState({ item: withProtoKey(fullSnapshot) })).toBeNull();
  });

  sharedRejections(readRecallNodeState, full);
});

describe('readReviewQueueState', () => {
  const summary: JsonObject = { itemId: 'q1', topic: 'fractions', prompt: 'What is 1/2 + 1/4?', firstTry: 'incorrect' };
  const full: JsonObject = {
    items: [summary, { itemId: 'q2', prompt: 'What is 1/3 of 9?', firstTry: 'correct' }],
    queue: [fullSnapshot],
    results: [{ itemId: 'q1', result: 'correct' }],
  };

  it('accepts a well-formed value with every optional field and returns a fresh copy', () => {
    const result = readReviewQueueState(full);
    expect(result).toEqual(full);
    expect(result?.items).not.toBe(full['items']);
    expect(result?.queue[0]).not.toBe(fullSnapshot);
    expect(Object.keys(result?.items[1] ?? {})).toEqual(['itemId', 'prompt', 'firstTry']);
  });

  it('accepts a value without its optional fields and leaves them out', () => {
    const result = readReviewQueueState({ items: [], queue: [] });
    expect(result).toEqual({ items: [], queue: [] });
    expect(Object.hasOwn(result ?? {}, 'results')).toBe(false);
    expect(readReviewQueueState({ items: [summary], queue: [bareSnapshot] })).toEqual({
      items: [summary],
      queue: [bareSnapshot],
    });
  });

  it('returns null for a missing field', () => {
    expect(readReviewQueueState({ queue: [] })).toBeNull();
    expect(readReviewQueueState({ items: [] })).toBeNull();
    expect(readReviewQueueState({ ...full, results: [{ itemId: 'q1' }] })).toBeNull();
  });

  it('returns null for a field of the wrong type', () => {
    expect(readReviewQueueState({ ...full, items: {} })).toBeNull();
    expect(readReviewQueueState({ ...full, queue: [{ ...fullSnapshot, explanation: 1 }] })).toBeNull();
    expect(readReviewQueueState({ ...full, results: null })).toBeNull();
    expect(readReviewQueueState({ ...full, results: [{ itemId: 'q1', result: 'missed' }] })).toBeNull();
    expect(readReviewQueueState({ ...full, items: [{ ...summary, firstTry: true }] })).toBeNull();
  });

  it('returns null for an extra key in a nested object', () => {
    expect(readReviewQueueState({ ...full, items: [{ ...summary, extra: 1 }] })).toBeNull();
    expect(readReviewQueueState({ ...full, results: [{ itemId: 'q1', result: 'correct', extra: 1 }] })).toBeNull();
  });

  sharedRejections(readReviewQueueState, full);
});

describe('readMasteryResult', () => {
  const full: JsonObject = {
    items: [
      { itemId: 'q1', topic: 'fractions', prompt: 'What is 1/2 + 1/4?', result: 'missed' },
      { itemId: 'q2', prompt: 'What is 1/3 of 9?', result: 'firstTry' },
    ],
    counts: { firstTry: 1, reviewed: 0, missed: 1 },
    missedTopics: ['fractions'],
    nextReview: ['q1'],
  };
  const empty: JsonObject = {
    items: [],
    counts: { firstTry: 0, reviewed: 0, missed: 0 },
    missedTopics: [],
    nextReview: [],
  };

  it('accepts a well-formed value with the optional topic and returns a fresh copy', () => {
    const result = readMasteryResult(full);
    expect(result).toEqual(full);
    expect(result?.counts).not.toBe(full['counts']);
    expect(result?.items).not.toBe(full['items']);
  });

  it('accepts a value without the optional topic and leaves it out', () => {
    expect(readMasteryResult(empty)).toEqual(empty);
    const result = readMasteryResult(full);
    expect(Object.keys(result?.items[1] ?? {})).toEqual(['itemId', 'prompt', 'result']);
  });

  it('returns null for a missing field', () => {
    const { counts: _c, ...noCounts } = full;
    expect(readMasteryResult(noCounts)).toBeNull();
    expect(readMasteryResult({ ...full, counts: { firstTry: 1, reviewed: 0 } })).toBeNull();
    expect(readMasteryResult({ ...full, items: [{ itemId: 'q1', prompt: 'P' }] })).toBeNull();
  });

  it('returns null for a field of the wrong type', () => {
    expect(readMasteryResult({ ...full, missedTopics: [1] })).toBeNull();
    expect(readMasteryResult({ ...full, nextReview: 'q1' })).toBeNull();
    expect(readMasteryResult({ ...full, counts: { firstTry: '1', reviewed: 0, missed: 1 } })).toBeNull();
    expect(readMasteryResult({ ...full, counts: { firstTry: 1.5, reviewed: 0, missed: 1 } })).toBeNull();
    expect(readMasteryResult({ ...full, counts: { firstTry: -1, reviewed: 0, missed: 1 } })).toBeNull();
    expect(readMasteryResult({ ...full, items: [{ itemId: 'q1', prompt: 'P', result: 'correct' }] })).toBeNull();
  });

  it('returns null for an extra key in a nested object', () => {
    expect(readMasteryResult({ ...full, counts: { firstTry: 1, reviewed: 0, missed: 1, total: 2 } })).toBeNull();
    expect(readMasteryResult({ ...full, items: [{ itemId: 'q1', prompt: 'P', result: 'missed', x: 1 }] })).toBeNull();
  });

  sharedRejections(readMasteryResult, full);
});

/** A Recall config with options a, b, c, the correct option b and the given Retry_Limit. */
function tryCfg(maxRetries: number): TryRulesConfig {
  return { options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], correctOptionId: 'b', maxRetries };
}

describe('meetsTryRules', () => {
  it('accepts a correct first Try, a correct last Try and a wrong last Try with no Tries left', () => {
    expect(meetsTryRules(tryCfg(0), ['b'])).toBe(true);
    expect(meetsTryRules(tryCfg(0), ['a'])).toBe(true);
    expect(meetsTryRules(tryCfg(1), ['a', 'b'])).toBe(true);
    expect(meetsTryRules(tryCfg(1), ['a', 'c'])).toBe(true);
    expect(meetsTryRules(tryCfg(3), ['a', 'c', 'b'])).toBe(true);
  });

  it('rejects a Try that names no option', () => {
    expect(meetsTryRules(tryCfg(1), ['z'])).toBe(false);
    expect(meetsTryRules(tryCfg(1), ['a', 'z'])).toBe(false);
    expect(meetsTryRules(tryCfg(1), ['__proto__', 'b'])).toBe(false);
  });

  it('rejects a repeated option', () => {
    expect(meetsTryRules(tryCfg(1), ['a', 'a'])).toBe(false);
  });

  it('rejects more than maxRetries + 1 Tries', () => {
    expect(meetsTryRules(tryCfg(2), ['a', 'c', 'b'])).toBe(true);
    expect(meetsTryRules(tryCfg(1), ['a', 'c', 'b'])).toBe(false);
    expect(meetsTryRules(tryCfg(0), ['a', 'b'])).toBe(false);
  });

  it('rejects a correct Try before the last', () => {
    expect(meetsTryRules(tryCfg(1), ['b', 'a'])).toBe(false);
  });

  it('rejects a wrong last Try while Tries are left', () => {
    expect(meetsTryRules(tryCfg(1), ['a'])).toBe(false);
    expect(meetsTryRules(tryCfg(2), ['a', 'c'])).toBe(false);
  });

  it('rejects an empty list of Tries', () => {
    expect(meetsTryRules(tryCfg(0), [])).toBe(false);
    expect(meetsTryRules(tryCfg(3), [])).toBe(false);
  });
});

describe('firstTryResult', () => {
  it('is correct only when the first Try is the correct option', () => {
    expect(firstTryResult('b', ['b'])).toBe('correct');
    expect(firstTryResult('b', ['a', 'b'])).toBe('incorrect');
    expect(firstTryResult('b', ['a'])).toBe('incorrect');
    expect(firstTryResult('b', [])).toBe('incorrect');
  });
});

describe('triesLeft', () => {
  it('is maxRetries + 1 minus the Tries made and never below 0', () => {
    expect(triesLeft(3, [])).toBe(4);
    expect(triesLeft(3, ['a', 'c'])).toBe(2);
    expect(triesLeft(3, ['a', 'c', 'd', 'b'])).toBe(0);
    expect(triesLeft(0, ['a'])).toBe(0);
    for (let maxRetries = 0; maxRetries <= 3; maxRetries += 1) {
      for (let made = 0; made <= 6; made += 1) {
        const left = triesLeft(maxRetries, Array.from({ length: made }, (_, i) => `o${i}`));
        expect(left).toBe(Math.max(0, maxRetries + 1 - made));
        expect(left).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('itemResult', () => {
  it.each<[TryResult, TryResult | undefined, string]>([
    ['correct', undefined, 'firstTry'],
    ['correct', 'correct', 'firstTry'],
    ['correct', 'incorrect', 'firstTry'],
    ['incorrect', 'correct', 'reviewed'],
    ['incorrect', 'incorrect', 'missed'],
    ['incorrect', undefined, 'missed'],
  ])('first Try %s with Review_Result %s gives %s', (firstTry, review, expected) => {
    expect(itemResult(firstTry, review)).toBe(expected);
  });
});

/** An Item_Snapshot with the given Item_ID, correct option and First_Try_Result. */
function snap(itemId: string, firstTry: TryResult, correctOptionId = 'a'): ItemSnapshot {
  return {
    itemId,
    prompt: `Prompt ${itemId}`,
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    correctOptionId,
    explanation: `Explanation ${itemId}`,
    tries: firstTry === 'correct' ? [correctOptionId] : ['z', correctOptionId],
    firstTry,
  };
}

describe('buildQueue', () => {
  it('keeps the first-try misses in the given order and lists each Item_ID once', () => {
    const q1 = snap('q1', 'incorrect');
    const q2 = snap('q2', 'correct');
    const q3 = snap('q3', 'incorrect');
    const q1Again = { ...snap('q1', 'incorrect'), prompt: 'Later copy' };
    const input = [q3, q2, q1, q1Again];
    const queue = buildQueue(input);
    expect(queue.map((s) => s.itemId)).toEqual(['q3', 'q1']);
    expect(queue[1]).toEqual(q1);
    expect(input).toEqual([q3, q2, q1, q1Again]);
  });

  it('gives an empty Queue when no Item was missed on the first Try', () => {
    expect(buildQueue([])).toEqual([]);
    expect(buildQueue([snap('q1', 'correct'), snap('q2', 'correct')])).toEqual([]);
  });
});

describe('reviewResults', () => {
  const queue = [snap('q1', 'incorrect', 'a'), snap('q3', 'incorrect', 'c')];

  it('gives one Review_Result per Queue Item in Queue order and ignores unknown Item_IDs', () => {
    const results = reviewResults(queue, [
      { itemId: 'zz', optionId: 'a' },
      { itemId: 'q3', optionId: 'c' },
      { itemId: 'q1', optionId: 'a' },
    ]);
    expect(results).toEqual([
      { itemId: 'q1', result: 'correct' },
      { itemId: 'q3', result: 'correct' },
    ]);
    expect(Object.keys(results[0] ?? {})).toEqual(['itemId', 'result']);
  });

  it('uses the first answer per Item_ID', () => {
    expect(
      reviewResults(queue, [
        { itemId: 'q1', optionId: 'a' },
        { itemId: 'q1', optionId: 'b' },
      ])[0],
    ).toEqual({ itemId: 'q1', result: 'correct' });
    expect(
      reviewResults(queue, [
        { itemId: 'q1', optionId: 'b' },
        { itemId: 'q1', optionId: 'a' },
      ])[0],
    ).toEqual({ itemId: 'q1', result: 'incorrect' });
  });

  it('gives incorrect for a missing answer and no results for an empty Queue', () => {
    expect(reviewResults(queue, [{ itemId: 'q1', optionId: 'a' }])).toEqual([
      { itemId: 'q1', result: 'correct' },
      { itemId: 'q3', result: 'incorrect' },
    ]);
    expect(reviewResults(queue, [])).toEqual([
      { itemId: 'q1', result: 'incorrect' },
      { itemId: 'q3', result: 'incorrect' },
    ]);
    expect(reviewResults([], [{ itemId: 'q1', optionId: 'a' }])).toEqual([]);
  });

  it('treats the IDs __proto__ and toString as plain IDs', () => {
    const odd = [snap('__proto__', 'incorrect', 'a'), snap('toString', 'incorrect', 'a'), snap('constructor', 'incorrect', 'a')];
    expect(reviewResults(odd, [])).toEqual([
      { itemId: '__proto__', result: 'incorrect' },
      { itemId: 'toString', result: 'incorrect' },
      { itemId: 'constructor', result: 'incorrect' },
    ]);
    expect(
      reviewResults(odd, [
        { itemId: '__proto__', optionId: 'a' },
        { itemId: 'toString', optionId: 'b' },
        { itemId: 'hasOwnProperty', optionId: 'a' },
      ]),
    ).toEqual([
      { itemId: '__proto__', result: 'correct' },
      { itemId: 'toString', result: 'incorrect' },
      { itemId: 'constructor', result: 'incorrect' },
    ]);
    expect(reviewResults([snap('q1', 'incorrect', 'a')], [{ itemId: '__proto__', optionId: 'a' }])).toEqual([
      { itemId: 'q1', result: 'incorrect' },
    ]);
  });
});

describe('summarize', () => {
  it('keeps the topic when it is set', () => {
    const summary = summarize({ ...snap('q1', 'incorrect'), topic: 'fractions' });
    expect(summary).toEqual({ itemId: 'q1', topic: 'fractions', prompt: 'Prompt q1', firstTry: 'incorrect' });
    expect(Object.keys(summary)).toEqual(['itemId', 'topic', 'prompt', 'firstTry']);
  });

  it('leaves the topic out when it is not set', () => {
    const summary = summarize(snap('q2', 'correct'));
    expect(summary).toEqual({ itemId: 'q2', prompt: 'Prompt q2', firstTry: 'correct' });
    expect(Object.hasOwn(summary, 'topic')).toBe(false);
    const explicitUndefined = summarize({ ...snap('q3', 'correct'), topic: undefined });
    expect(Object.hasOwn(explicitUndefined, 'topic')).toBe(false);
  });
});
