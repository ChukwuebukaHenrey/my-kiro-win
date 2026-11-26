// Play test for the bundled Demo_Lesson (design C18 "Play test", C15 `src/demos.ts`;
// Requirements 18.4, 22.4, 22.5, 22.10). These tests are evidence for the cases listed, not a
// proof of correctness.

import { describe, expect, it } from 'vitest';
import { validateManifest, type ValidManifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type AttemptState, type Runtime } from '@dreame/runtime';
import { practiceProfile } from '../src/profile.ts';
import { DEMOS, findDemo } from '../src/demos.ts';
import { readMasteryResult, readReviewQueueState } from '../src/node-types/practice-state.ts';
import fractions from '../../../activities/practice-fractions.json';

function validDemo(json: unknown): ValidManifest {
  const result = validateManifest(json, practiceProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

/** Sends `response` to the current node after `checkAction` accepts it, as the player does. */
function respond(rt: Runtime, s: AttemptState, response: unknown, now: number): AttemptState {
  const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
  expect(checkAction(rt, s, action)).toBeNull();
  return reduce(rt, s, action, { now });
}

describe('practice-fractions Demo_Lesson', () => {
  it('passes validation with the practice profile (Requirement 22.4)', () => {
    const result = validateManifest(fractions, practiceProfile);
    expect(result.ok ? [] : result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('has 6-8 recall nodes, one reviewQueue from every recall node, one masterySummary from it (Requirement 22.4)', () => {
    const recallIds = fractions.nodes.filter((n) => n.type === 'recall').map((n) => n.id);
    expect(recallIds.length).toBeGreaterThanOrEqual(6);
    expect(recallIds.length).toBeLessThanOrEqual(8);

    const reviews = fractions.nodes.filter((n) => n.type === 'reviewQueue');
    expect(reviews).toHaveLength(1);
    const review = reviews[0]!;
    const reviewFrom: unknown = (review.config as Readonly<Record<string, unknown>>)['from'];
    expect(Array.isArray(reviewFrom) ? [...(reviewFrom as unknown[])].sort() : reviewFrom).toEqual([...recallIds].sort());

    const summaries = fractions.nodes.filter((n) => n.type === 'masterySummary');
    expect(summaries).toHaveLength(1);
    expect((summaries[0]!.config as Readonly<Record<string, unknown>>)['from']).toBe(review.id);
  });

  it('plays to result with Queue fractions-1 and fractions-4 and counts 4/1/1 (Requirement 22.10)', () => {
    const rt = createRuntime(practiceProfile, validDemo(fractions));
    let s = createAttempt(rt, 1, { now: 0 });
    expect(s.currentNodeId).toBe('intro');

    let now = 1000;
    s = respond(rt, s, {}, now);
    for (const id of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) {
      expect(s.currentNodeId).toBe(id);
      now += 1000;
      // Every Demo_Lesson recall node has correct option `a`; `b` is a wrong option.
      s = respond(rt, s, { tries: id === 'q1' || id === 'q4' ? ['b', 'a'] : ['a'] }, now);
    }

    expect(s.currentNodeId).toBe('review');
    const queueState = readReviewQueueState(s.nodeState['review']);
    if (queueState === null) throw new Error('no review queue node state at "review"');
    expect(queueState.queue.map((item) => item.itemId)).toEqual(['fractions-1', 'fractions-4']);

    now += 1000;
    s = respond(
      rt,
      s,
      {
        answers: [
          { itemId: 'fractions-1', optionId: 'a' },
          { itemId: 'fractions-4', optionId: 'b' },
        ],
      },
      now,
    );

    expect(s.status).toBe('finished');
    expect(s.currentNodeId).toBe('result');
    const mastery = readMasteryResult(s.nodeState['result']);
    if (mastery === null) throw new Error('no mastery result node state at "result"');
    expect(mastery.counts).toEqual({ firstTry: 4, reviewed: 1, missed: 1 });
  });

  it('has no validUntil, or one of 2027-12-31 or later (Requirement 22.5)', () => {
    const validUntil: unknown = Object.hasOwn(fractions, 'validUntil')
      ? (fractions as Readonly<Record<string, unknown>>)['validUntil']
      : undefined;
    if (validUntil !== undefined) {
      expect(typeof validUntil).toBe('string');
      expect(String(validUntil) >= '2027-12-31').toBe(true);
    }
  });
});

describe('DEMOS and findDemo (Requirement 18.4)', () => {
  it('lists each demo under its manifest activityId', () => {
    expect(DEMOS.length).toBeGreaterThan(0);
    for (const demo of DEMOS) {
      expect(validDemo(demo.json).activityId).toBe(demo.id);
      expect(findDemo(demo.id)).toBe(demo);
    }
  });

  it('returns undefined for inherited keys and missing IDs', () => {
    expect(findDemo('__proto__')).toBeUndefined();
    expect(findDemo('toString')).toBeUndefined();
    expect(findDemo('constructor')).toBeUndefined();
    expect(findDemo(undefined)).toBeUndefined();
    expect(findDemo('no-such-demo')).toBeUndefined();
  });
});
