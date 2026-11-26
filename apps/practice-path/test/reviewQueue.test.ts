// Example tests for the `reviewQueue` node type (design C7, Testing Strategy "Example tests"):
// descriptor fields, `answerType`, schema limits at both sides of each bound with the precompiled
// validators (including a repeated `from` entry), closed objects, the `validate` diagnostics on
// whole manifests, `enter` / `reduce` on hand-built attempt states, and `isValidResponse` on a
// repeated `itemId`. The Wiring_Hook wrote the first `validate`, `enter` and `reduce` tests;
// task 7.2 completed the file. These tests are evidence for the cases listed, not a proof of
// correctness.

import { describe, expect, it } from 'vitest';
import { validateManifest, type DiagnosticCode, type Stage, type ValidationResult } from '@dreame/schema';
import { createRng, type AttemptState, type Env } from '@dreame/runtime';
import { REVIEW_LIMITS, reviewQueueNodeType, type ReviewQueueConfig } from '../src/node-types/reviewQueue.ts';
import { readReviewQueueState } from '../src/node-types/practice-state.ts';
import { practiceProfile } from '../src/profile.ts';
import { response_reviewQueue } from '../generated/practice-path.validators.js';

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/** A manifest under construction: plain JSON that a test edits before validation. */
type Draft = Record<string, any>;

/** JSON Pointer of the `reviewQueue` config in the base manifest. */
const RQ = '/nodes/1/config';

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

/** Valid base, passing every stage: r1 (recall) → rq (reviewQueue) → done (outcome). */
function base(): Draft {
  return {
    schemaVersion: 1,
    profile: 'practice-path',
    activityId: 'practice-review-queue',
    version: 1,
    requires: { recall: 1, reviewQueue: 1, outcome: 1 },
    entryNodeId: 'r1',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      { id: 'r1', type: 'recall', config: recallConfig('q1'), edges: [{ to: 'rq' }] },
      { id: 'rq', type: 'reviewQueue', config: { title: 'Review', from: ['r1'] }, edges: [{ to: 'done' }] },
      { id: 'done', type: 'outcome', config: { title: 'Done', body: 'Lesson finished.' }, edges: [] },
    ],
    theme: 'default',
  };
}

/** The base manifest after `edit` of the `reviewQueue` config and of the manifest. */
function build(edit: (c: Draft, m: Draft) => void = () => {}): Draft {
  const m = base();
  edit(m.nodes[1].config as Draft, m);
  return m;
}

/**
 * `n` recall nodes r1 → r2 → … → rn → rq, with the item IDs q1 … qn, and `from` naming all of
 * them in order. The `reviewQueue` node stays at index 1, so `RQ` still points at its config.
 */
function setFrom(c: Draft, m: Draft, n: number): void {
  const ids = Array.from({ length: n }, (_, i) => `r${i + 1}`);
  const extra = ids.slice(1).map((id, i) => ({
    id,
    type: 'recall',
    config: recallConfig(`q${i + 2}`),
    edges: [{ to: ids[i + 2] ?? 'rq' }],
  }));
  m.nodes[0].edges = [{ to: ids[1] ?? 'rq' }];
  m.nodes.push(...extra);
  m.limits = { maxNodes: n + 2, maxTransitions: n + 1 };
  c.from = ids;
}

type Row = [Stage, DiagnosticCode, 'error' | 'warning', string];

function rows(result: ValidationResult): Row[] {
  return result.diagnostics.map((d) => [d.stage, d.code, d.severity, d.path]);
}

function validate(m: unknown): ValidationResult {
  return validateManifest(m, practiceProfile);
}

function expectPass(m: Draft): void {
  const result = validate(m);
  expect(rows(result)).toEqual([]);
  expect(result.ok).toBe(true);
}

/** Stage 1 fails with `schema/schema` diagnostics only, one of them at `path`. */
function expectSchemaFail(m: Draft, path: string): void {
  const result = validate(m);
  expect(result.ok).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
  for (const d of result.diagnostics) expect([d.stage, d.code, d.severity]).toEqual(['schema', 'schema', 'error']);
  expect(result.diagnostics.map((d) => d.path)).toContain(path);
}

type Edit = (c: Draft, m: Draft) => void;

// ---------------------------------------------------------------------------
// Descriptor and answer type
// ---------------------------------------------------------------------------

describe('reviewQueue descriptor', () => {
  it('has type reviewQueue, version 1 and is not terminal', () => {
    expect(reviewQueueNodeType.type).toBe('reviewQueue');
    expect(reviewQueueNodeType.version).toBe(1);
    expect(reviewQueueNodeType.terminal).toBe(false);
  });

  it('answerType returns null', () => {
    expect(reviewQueueNodeType.answerType({ title: 'Review', from: ['r1'] })).toBeNull();
  });

  it('REVIEW_LIMITS match design C7', () => {
    expect(REVIEW_LIMITS).toEqual({ maxFrom: 24 });
  });
});

// ---------------------------------------------------------------------------
// Config schema limits (precompiled validateManifest)
// ---------------------------------------------------------------------------

describe('reviewQueue config schema limits', () => {
  it('the base manifest passes every stage', () => {
    expectPass(base());
  });

  // [bound, edit inside the bound, edit just outside it, path of the schema diagnostic]
  it.each<[string, Edit, Edit, string]>([
    ['from ≥ 1', (c, m) => setFrom(c, m, 1), (c) => (c.from = []), `${RQ}/from`],
    [
      `from ≤ ${REVIEW_LIMITS.maxFrom}`,
      (c, m) => setFrom(c, m, REVIEW_LIMITS.maxFrom),
      (c, m) => setFrom(c, m, REVIEW_LIMITS.maxFrom + 1),
      `${RQ}/from`,
    ],
    ['title ≤ 120', (c) => (c.title = 't'.repeat(120)), (c) => (c.title = 't'.repeat(121)), `${RQ}/title`],
    ['intro ≤ 500', (c) => (c.intro = 'i'.repeat(500)), (c) => (c.intro = 'i'.repeat(501)), `${RQ}/intro`],
    ['emptyText ≤ 300', (c) => (c.emptyText = 'e'.repeat(300)), (c) => (c.emptyText = 'e'.repeat(301)), `${RQ}/emptyText`],
  ])('%s: inside passes, outside fails the schema', (_bound, inside, outside, path) => {
    expectPass(build(inside));
    expectSchemaFail(build(outside), path);
  });

  it("rejects a repeated from entry: from: ['q1', 'q1']", () => {
    expectSchemaFail(build((c) => (c.from = ['q1', 'q1'])), `${RQ}/from`);
  });

  it('rejects a from entry that is not a node ID', () => {
    expectSchemaFail(build((c) => (c.from = ['not an id'])), `${RQ}/from/0`);
  });

  it('rejects an extra key in the config', () => {
    expectSchemaFail(build((c) => (c.extra = 1)), RQ);
  });
});

// ---------------------------------------------------------------------------
// Response schema limits (precompiled response_reviewQueue)
// ---------------------------------------------------------------------------

describe('response_reviewQueue', () => {
  /** `n` answers with distinct item IDs. */
  const answers = (n: number) => Array.from({ length: n }, (_, i) => ({ itemId: `q${i}`, optionId: 'a' }));

  it('answers: 0 entries pass', () => {
    expect(response_reviewQueue({ answers: answers(0) })).toBe(true);
  });

  it(`answers: ${REVIEW_LIMITS.maxFrom} entries pass and ${REVIEW_LIMITS.maxFrom + 1} fail`, () => {
    expect(response_reviewQueue({ answers: answers(REVIEW_LIMITS.maxFrom) })).toBe(true);
    expect(response_reviewQueue({ answers: answers(REVIEW_LIMITS.maxFrom + 1) })).toBe(false);
  });

  it('itemId and optionId: 64 code units pass and 65 fail', () => {
    expect(response_reviewQueue({ answers: [{ itemId: 'x'.repeat(64), optionId: 'y'.repeat(64) }] })).toBe(true);
    expect(response_reviewQueue({ answers: [{ itemId: 'x'.repeat(65), optionId: 'a' }] })).toBe(false);
    expect(response_reviewQueue({ answers: [{ itemId: 'q1', optionId: 'y'.repeat(65) }] })).toBe(false);
  });

  it('rejects a missing answers list and a non-string field', () => {
    expect(response_reviewQueue({})).toBe(false);
    expect(response_reviewQueue({ answers: [{ itemId: 1, optionId: 'a' }] })).toBe(false);
  });

  it('rejects an extra key in an answer', () => {
    expect(response_reviewQueue({ answers: [{ itemId: 'q1', optionId: 'a', extra: 1 }] })).toBe(false);
  });

  it('rejects an extra key in the response', () => {
    expect(response_reviewQueue({ answers: [], extra: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate, through validateManifest
// ---------------------------------------------------------------------------

describe('reviewQueue validate', () => {
  it('passes a manifest whose from entries name upstream recall nodes', () => {
    expectPass(base());
  });

  it('reports dangling-ref for a from entry that names no node', () => {
    const result = validate(build((c) => (c.from = ['r1', 'missing'])));
    expect(rows(result)).toEqual([['conditions', 'dangling-ref', 'error', `${RQ}/from/1`]]);
    expect(result.diagnostics[0]?.nodeId).toBe('rq');
    expect(result.diagnostics[0]?.message).toContain('from entry "missing"');
    expect(result.ok).toBe(false);
  });

  it('reports type-mismatch for a from entry that names a content node', () => {
    const m = build((c, draft) => {
      draft.requires.content = 1;
      draft.nodes[0].edges = [{ to: 'c1' }];
      draft.nodes.push({ id: 'c1', type: 'content', config: { body: 'Read this first.' }, edges: [{ to: 'rq' }] });
      c.from = ['r1', 'c1'];
    });
    const result = validate(m);
    expect(rows(result)).toEqual([['conditions', 'type-mismatch', 'error', `${RQ}/from/1`]]);
    expect(result.diagnostics[0]?.nodeId).toBe('rq');
    expect(result.diagnostics[0]?.message).toContain('from entry "c1"');
    expect(result.ok).toBe(false);
  });

  it('reports type-mismatch for a from entry that names an outcome node', () => {
    const result = validate(build((c) => (c.from = ['done'])));
    expect(rows(result)).toEqual([['conditions', 'type-mismatch', 'error', `${RQ}/from/0`]]);
  });

  it('reports answer-not-upstream for a recall node after the review step', () => {
    const m = build((_c, draft) => {
      draft.entryNodeId = 'rq';
      draft.nodes[1].edges = [{ to: 'r1' }];
      draft.nodes[0].edges = [{ to: 'done' }];
    });
    const result = validate(m);
    expect(rows(result)).toEqual([['conditions', 'answer-not-upstream', 'error', `${RQ}/from/0`]]);
    expect(result.diagnostics[0]?.nodeId).toBe('rq');
    expect(result.diagnostics[0]?.message).toContain('from entry "r1"');
    expect(result.ok).toBe(false);
  });

  it('reports blank-text for a blank title', () => {
    const result = validate(build((c) => (c.title = '   ')));
    expect(rows(result)).toEqual([['conditions', 'blank-text', 'error', `${RQ}/title`]]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enter, reduce and isValidResponse
// ---------------------------------------------------------------------------

function snapshot(itemId: string, firstTry: 'correct' | 'incorrect') {
  return {
    itemId,
    prompt: `Question ${itemId}`,
    options: [
      { id: 'a', label: 'Right' },
      { id: 'b', label: 'Wrong' },
    ],
    correctOptionId: 'a',
    explanation: 'Option a is right.',
    tries: firstTry === 'correct' ? ['a'] : ['b', 'a'],
    firstTry,
  };
}

function state(nodeState: AttemptState['nodeState']): AttemptState {
  return {
    activityId: 'practice-review-queue',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId: 'rq',
    vars: {},
    answers: {},
    nodeState,
    path: [{ nodeId: 'rq', at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

const cfg: ReviewQueueConfig = { title: 'Review', from: ['r1', 'r2', 'r3'] };

describe('reviewQueue enter and reduce', () => {
  const s0 = state({ r1: { item: snapshot('q1', 'incorrect') }, r2: { item: snapshot('q2', 'correct') } });

  it('enter stores the summaries and the first-try misses in from order', () => {
    const entered = reviewQueueNodeType.enter?.(cfg, s0, env());
    const stored = readReviewQueueState(entered?.nodeState['rq']);
    expect(stored).toEqual({
      items: [
        { itemId: 'q1', prompt: 'Question q1', firstTry: 'incorrect' },
        { itemId: 'q2', prompt: 'Question q2', firstTry: 'correct' },
      ],
      queue: [snapshot('q1', 'incorrect')],
    });
    expect(s0.nodeState['rq']).toBeUndefined();
  });

  it('enter with no Recall snapshot stores empty items and queue', () => {
    // r1 has no state, r2 has a recall state without an Item_Snapshot, r3 holds a damaged value.
    const s = state({ r2: { order: ['b', 'a'] }, r3: { item: 'damaged' } });
    const entered = reviewQueueNodeType.enter?.(cfg, s, env());
    expect(entered?.nodeState['rq']).toEqual({ items: [], queue: [] });
    expect(readReviewQueueState(entered?.nodeState['rq'])).toEqual({ items: [], queue: [] });
  });

  it('reduce stores one Review_Result per Queue Item and writes no answer', () => {
    const entered = reviewQueueNodeType.enter?.(cfg, s0, env()) ?? s0;
    const next = reviewQueueNodeType.reduce(cfg, entered, { answers: [{ itemId: 'q1', optionId: 'a' }] }, env());
    expect(readReviewQueueState(next.nodeState['rq'])?.results).toEqual([{ itemId: 'q1', result: 'correct' }]);
    expect(next.answers).toEqual({});
  });

  it('reduce without enter recomputes the Queue; a missing answer gives incorrect', () => {
    const next = reviewQueueNodeType.reduce(cfg, s0, { answers: [] }, env());
    const stored = readReviewQueueState(next.nodeState['rq']);
    expect(stored?.items).toEqual([
      { itemId: 'q1', prompt: 'Question q1', firstTry: 'incorrect' },
      { itemId: 'q2', prompt: 'Question q2', firstTry: 'correct' },
    ]);
    expect(stored?.queue).toEqual([snapshot('q1', 'incorrect')]);
    expect(stored?.results).toEqual([{ itemId: 'q1', result: 'incorrect' }]);
  });

  it('reduce ignores answers for unknown Item_IDs', () => {
    const entered = reviewQueueNodeType.enter?.(cfg, s0, env()) ?? s0;
    const next = reviewQueueNodeType.reduce(
      cfg,
      entered,
      {
        answers: [
          { itemId: 'zz', optionId: 'a' },
          { itemId: 'q2', optionId: 'a' },
          { itemId: 'q1', optionId: 'b' },
        ],
      },
      env(),
    );
    expect(readReviewQueueState(next.nodeState['rq'])?.results).toEqual([{ itemId: 'q1', result: 'incorrect' }]);
  });
});

describe('reviewQueue isValidResponse', () => {
  it('accepts answers with distinct itemIds and an empty answers list', () => {
    expect(reviewQueueNodeType.isValidResponse(cfg, { answers: [] })).toBe(true);
    expect(
      reviewQueueNodeType.isValidResponse(cfg, {
        answers: [
          { itemId: 'q1', optionId: 'a' },
          { itemId: 'q2', optionId: 'b' },
        ],
      }),
    ).toBe(true);
  });

  it('returns false for a repeated itemId', () => {
    expect(
      reviewQueueNodeType.isValidResponse(cfg, {
        answers: [
          { itemId: 'q1', optionId: 'b' },
          { itemId: 'q1', optionId: 'a' },
        ],
      }),
    ).toBe(false);
  });
});
