// Examples for the pure player reducer (design C10, Requirement 13.2), using the demo manifest.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coreProfile } from '@dreame/node-types';
import { createAttempt, createRuntime, type Runtime } from '@dreame/runtime';
import { validateManifestText } from '@dreame/schema';
import { playerReducer, type PlayerState } from '../src/player-state.ts';

const demoText = readFileSync(
  fileURLToPath(new URL('../../../activities/core-demo-study-break.json', import.meta.url)),
  'utf8',
);

function demoRuntime(): Runtime {
  const result = validateManifestText(demoText, coreProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return createRuntime(coreProfile, result.manifest);
}

function initialState(rt: Runtime): PlayerState {
  return { attempt: createAttempt(rt, 42, { now: 1000 }), rejections: 0, lastRejection: null };
}

describe('playerReducer (Requirement 13.2)', () => {
  it('moves currentNodeId on an accepted response and stamps the event time', () => {
    const rt = demoRuntime();
    const start = initialState(rt);
    expect(start.attempt.currentNodeId).toBe('intro');

    const afterIntro = playerReducer(rt, start, { type: 'respond', response: {}, at: 2000 });
    expect(afterIntro.attempt.currentNodeId).toBe('feeling');
    expect(afterIntro.attempt.updatedAt).toBe(2000);
    expect(afterIntro.rejections).toBe(0);
    expect(afterIntro.lastRejection).toBeNull();

    const afterFeeling = playerReducer(rt, afterIntro, { type: 'respond', response: { optionId: 'tired' }, at: 3000 });
    expect(afterFeeling.attempt.currentNodeId).toBe('breakLength');
    expect(afterFeeling.attempt.answers['feeling']).toBe('tired');
  });

  it('rejects an invalid optionId and keeps the attempt unchanged', () => {
    const rt = demoRuntime();
    const atChoice = playerReducer(rt, initialState(rt), { type: 'respond', response: {}, at: 2000 });
    expect(atChoice.attempt.currentNodeId).toBe('feeling');
    const snapshot = JSON.parse(JSON.stringify(atChoice)) as PlayerState;

    const rejected = playerReducer(rt, atChoice, { type: 'respond', response: { optionId: 'sleepy' }, at: 3000 });
    expect(rejected.attempt).toBe(atChoice.attempt);
    expect(rejected.attempt).toEqual(snapshot.attempt);
    expect(rejected.rejections).toBe(1);
    expect(rejected.lastRejection).toBe('invalid-response');
    expect(atChoice).toEqual(snapshot);
  });
});
