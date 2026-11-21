// Play test for the bundled Demo_Manifest (design C16 "Play test", C12 `src/demos.ts`;
// Requirements 13.4, 17.4, 17.5, 17.9). These tests are evidence for the cases listed, not a
// proof of correctness.

import { describe, expect, it } from 'vitest';
import { validateManifest, type ValidManifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type AttemptState, type Runtime } from '@dreame/runtime';
import { shopProfile } from '../src/profile.ts';
import { DEMOS, findDemo } from '../src/demos.ts';
import { readBundleResult } from '../src/node-types/bundle-rules.ts';
import giftBundle from '../../../activities/shop-gift-bundle.json';

function validDemo(json: unknown): ValidManifest {
  const result = validateManifest(json, shopProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

/** Sends `response` to the current node after `checkAction` accepts it, as the player does. */
function respond(rt: Runtime, s: AttemptState, response: unknown, now: number): AttemptState {
  const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
  expect(checkAction(rt, s, action)).toBeNull();
  return reduce(rt, s, action, { now });
}

describe('shop-gift-bundle Demo_Manifest', () => {
  it('passes validation with the shop profile (Requirement 17.4)', () => {
    const result = validateManifest(giftBundle, shopProfile);
    expect(result.ok ? [] : result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('finishes at result with the chosen bundle and a total of 16 (Requirement 17.9)', () => {
    const rt = createRuntime(shopProfile, validDemo(giftBundle));
    let s = createAttempt(rt, 1, { now: 0 });
    expect(s.currentNodeId).toBe('intro');

    s = respond(rt, s, {}, 1000);
    expect(s.currentNodeId).toBe('pick-occasion');
    s = respond(rt, s, { optionId: 'birthday' }, 2000);
    expect(s.currentNodeId).toBe('pick');
    s = respond(rt, s, { itemIds: ['chocolate', 'card'] }, 3000);

    expect(s.status).toBe('finished');
    expect(s.currentNodeId).toBe('result');
    expect(s.answers['pick']).toEqual(['chocolate', 'card']);

    const bundle = readBundleResult(s.nodeState['result']);
    if (bundle === null) throw new Error('no bundle result node state at "result"');
    expect(bundle.selection.map((line) => line.id)).toEqual(['chocolate', 'card']);
    expect(bundle.total).toBe(16);
    expect(bundle.currency).toBe('USD');
  });

  it('has no validUntil, or one of 2027-12-31 or later (Requirement 17.5)', () => {
    const validUntil: unknown = Object.hasOwn(giftBundle, 'validUntil')
      ? (giftBundle as Readonly<Record<string, unknown>>)['validUntil']
      : undefined;
    if (validUntil !== undefined) {
      expect(typeof validUntil).toBe('string');
      expect(String(validUntil) >= '2027-12-31').toBe(true);
    }
  });
});

describe('DEMOS and findDemo (Requirement 13.4)', () => {
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
