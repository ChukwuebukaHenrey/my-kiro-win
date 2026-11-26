// Property tests for the `recall` node type (design C6, "Correctness Properties"). The
// Wiring_Hook wrote the first version of this file; task 6.3 replaced its property with
// Property 1, and task 6.4 adds Property 2.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateManifest, type Manifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Runtime } from '@dreame/runtime';
import { RECALL_LIMITS, recallNodeType, type RecallConfig } from '../src/node-types/recall.ts';
import { readRecallNodeState } from '../src/node-types/practice-state.ts';
import { practiceProfile } from '../src/profile.ts';
import { acceptedTriesArb, candidateTriesArb, recallConfigArb } from './practice-arbitraries.ts';

const NUM_RUNS = 200;

const NODE = 'r1';
const DONE = 'done';

/** `r1 (recall) → done (outcome)`, as a practice-path manifest. */
function recallManifest(cfg: RecallConfig): Manifest {
  return {
    schemaVersion: 1,
    profile: 'practice-path',
    activityId: 'practice-recall-property',
    version: 1,
    requires: { recall: 1, outcome: 1 },
    entryNodeId: NODE,
    fallbackOutcomeId: DONE,
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      { id: NODE, type: 'recall', config: cfg, edges: [{ to: DONE }] },
      { id: DONE, type: 'outcome', config: { title: 'Done', body: 'Lesson finished.' }, edges: [] },
    ],
    theme: 'default',
  } as Manifest;
}

function runtimeFor(m: Manifest): Runtime {
  const result = validateManifest(m, practiceProfile);
  if (!result.ok) {
    const d = result.diagnostics[0];
    throw new Error(`recallManifest is not valid: ${d === undefined ? 'no diagnostics' : `${d.stage}/${d.code} at ${d.path}: ${d.message}`}`);
  }
  return createRuntime(practiceProfile, result.manifest);
}

/**
 * Reference model of the response schema and the Try_Rules (Requirements 6.1–6.3), written
 * without `meetsTryRules`: an object whose only own key is `tries`, an array of 1–4 strings of at
 * most 64 code units, every Try names an option, no Try repeats, at most `maxRetries + 1` Tries,
 * and the correct option, when tried, is the last Try; a list without it uses every allowed Try.
 */
function modelAccepts(cfg: RecallConfig, r: unknown): boolean {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return false;
  const keys = Object.keys(r);
  if (keys.length !== 1 || keys[0] !== 'tries') return false;
  const tries: unknown = (r as Record<string, unknown>)['tries'];
  if (!Array.isArray(tries) || tries.length < 1 || tries.length > RECALL_LIMITS.maxTries) return false;
  const list: string[] = [];
  for (const entry of tries as unknown[]) {
    if (typeof entry !== 'string' || entry.length > 64) return false;
    list.push(entry);
  }
  const optionIds = cfg.options.map((option) => option.id);
  if (!list.every((id) => optionIds.includes(id))) return false;
  if (new Set(list).size !== list.length) return false;
  const allowed = cfg.maxRetries + 1;
  if (list.length > allowed) return false;
  const correctAt = list.indexOf(cfg.correctOptionId);
  return correctAt === -1 ? list.length === allowed : correctAt === list.length - 1;
}

/** Candidate responses: Try lists, Try lists with non-string entries, extra keys, a non-array `tries`, and random JSON or values. */
function responseArb(cfg: RecallConfig): fc.Arbitrary<unknown> {
  const tries = candidateTriesArb(cfg);
  return fc.oneof(
    { weight: 8, arbitrary: tries.map((t) => ({ tries: t })) },
    {
      weight: 1,
      arbitrary: fc
        .tuple(tries, fc.array(fc.oneof(fc.integer(), fc.constant(null), fc.boolean(), fc.anything()), { minLength: 1, maxLength: 3 }), fc.nat())
        .map(([t, extra, at]) => {
          const mixed: unknown[] = [...t];
          mixed.splice(at % (t.length + 1), 0, ...extra);
          return { tries: mixed };
        }),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(tries, fc.string(), fc.jsonValue())
        .map(([t, key, value]) => ({ tries: t, [key === 'tries' ? 'extra' : key]: value })),
    },
    { weight: 1, arbitrary: fc.record({ tries: fc.anything() }) },
    { weight: 1, arbitrary: fc.oneof(fc.jsonValue(), fc.anything(), tries) },
  );
}

describe('Feature: practice-path, Property 1: Recall response acceptance matches the Try_Rules model', () => {
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.8**
  it('checkAction at a recall node accepts a candidate response exactly when the reference model does', () => {
    let accepted = 0;
    let total = 0;
    fc.assert(
      fc.property(
        recallConfigArb.chain((cfg) =>
          fc.record({ cfg: fc.constant(cfg), seed: fc.integer({ min: 0, max: 0xffffffff }), response: responseArb(cfg) }),
        ),
        ({ cfg, seed, response }) => {
          const rt = runtimeFor(recallManifest(cfg));
          expect(rt.profile.registry.get('recall')).toBe(recallNodeType);
          const s = createAttempt(rt, seed, { now: 0 });
          expect([s.status, s.currentNodeId]).toEqual(['playing', NODE]);
          const expected = modelAccepts(cfg, response);
          const rejection = checkAction(rt, s, { type: 'respond', nodeId: NODE, response });
          expect(rejection).toBe(expected ? null : 'invalid-response');
          total += 1;
          if (expected) accepted += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Both outcomes occur, so the run says something about acceptance and about rejection.
    expect(accepted).toBeGreaterThan(0);
    expect(total - accepted).toBeGreaterThan(0);
  });
});

describe('Feature: practice-path, Property 2: Recall stores the First_Try_Result and an unchanged Item_Snapshot', () => {
  // **Validates: Requirements 5.9, 6.4, 6.5, 6.6, 6.9**
  it('enter then reduce stores the First_Try_Result as the answer and the Item_Snapshot of the config and Tries', () => {
    let correct = 0;
    let shuffled = 0;
    let total = 0;
    fc.assert(
      fc.property(
        recallConfigArb.chain((cfg) =>
          fc.record({ cfg: fc.constant(cfg), seed: fc.integer({ min: 0, max: 0xffffffff }), tries: acceptedTriesArb(cfg) }),
        ),
        ({ cfg, seed, tries }) => {
          const rt = runtimeFor(recallManifest(cfg));
          const optionIds = cfg.options.map((option) => option.id);
          const sent = [...tries];
          const action = { type: 'respond', nodeId: NODE, response: { tries: sent } } as const;

          // enter (inside createAttempt): an `order` only with `shuffle: true`.
          const entered = createAttempt(rt, seed, { now: 0 });
          expect([entered.status, entered.currentNodeId]).toEqual(['playing', NODE]);
          const enteredState = readRecallNodeState(entered.nodeState[NODE]);
          let enteredOrder: string[] | undefined;
          if (cfg.shuffle === true) {
            expect(enteredState).not.toBeNull();
            enteredOrder = enteredState?.order;
            expect(enteredOrder).toBeDefined();
            expect([...(enteredOrder ?? [])].sort()).toEqual([...optionIds].sort());
          } else {
            expect(Object.hasOwn(entered.nodeState, NODE)).toBe(false);
          }

          // reduce: the generated Try list is accepted, so the step runs the recall reduce.
          expect(checkAction(rt, entered, action)).toBeNull();
          const after = reduce(rt, entered, action, { now: 1 });
          expect(after).not.toBe(entered);
          expect(sent).toEqual(tries);

          const firstTry = tries[0] === cfg.correctOptionId ? 'correct' : 'incorrect';
          expect(after.answers[NODE]).toBe(firstTry);
          const answerType = recallNodeType.answerType(cfg);
          expect(answerType?.kind).toBe('enum');
          expect(answerType !== null && answerType.kind === 'enum' ? answerType.values : []).toContain(after.answers[NODE]);

          const stored = readRecallNodeState(after.nodeState[NODE]);
          expect(stored).not.toBeNull();
          expect(stored?.item).toStrictEqual({
            itemId: cfg.itemId,
            ...(cfg.topic === undefined ? {} : { topic: cfg.topic }),
            prompt: cfg.prompt,
            options: cfg.options.map((option) => ({ id: option.id, label: option.label })),
            correctOptionId: cfg.correctOptionId,
            explanation: cfg.explanation,
            tries,
            firstTry,
          });
          if (cfg.shuffle === true) {
            expect(stored?.order).toEqual(enteredOrder);
            expect([...(stored?.order ?? [])].sort()).toEqual([...optionIds].sort());
            shuffled += 1;
          } else {
            expect(stored === null ? true : Object.hasOwn(stored, 'order')).toBe(false);
          }

          total += 1;
          if (firstTry === 'correct') correct += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Both First_Try_Results and both shuffle cases occur, so each branch of the property was run.
    expect(correct).toBeGreaterThan(0);
    expect(total - correct).toBeGreaterThan(0);
    expect(shuffled).toBeGreaterThan(0);
    expect(total - shuffled).toBeGreaterThan(0);
  });
});
