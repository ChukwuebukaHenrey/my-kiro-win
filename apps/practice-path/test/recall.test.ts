// Example tests for the `recall` node type (design C6, Testing Strategy "Example tests"):
// descriptor fields, `answerType`, schema limits at both sides of each bound with the precompiled
// validators, closed objects, `validate` steps 1–4 (`blank-text`, `duplicate-option-id`,
// `dangling-ref`, `duplicate-item-id`), `enter` and `reduce`. The Wiring_Hook wrote the first
// `validate` and `reduce` tests; tasks 6.2 and 6.5 completed the file. These tests are evidence
// for the cases listed, not a proof of correctness.

import { describe, expect, it } from 'vitest';
import {
  validateManifest,
  type Diagnostic,
  type DiagnosticCode,
  type Effect,
  type GraphCtx,
  type Manifest,
  type Stage,
  type ValidationResult,
} from '@dreame/schema';
import { createRng, type AttemptState, type Env } from '@dreame/runtime';
import { RECALL_LIMITS, recallNodeType, type RecallConfig } from '../src/node-types/recall.ts';
import { readRecallNodeState } from '../src/node-types/practice-state.ts';
import { practiceProfile } from '../src/profile.ts';
import { response_recall } from '../generated/practice-path.validators.js';

const cfg: RecallConfig = {
  itemId: 'q1',
  prompt: 'What is 1/2 + 1/4?',
  options: [
    { id: 'a', label: '3/4' },
    { id: 'b', label: '2/6' },
    { id: 'c', label: '1/8' },
  ],
  correctOptionId: 'a',
  explanation: 'Write 1/2 as 2/4, then add: 2/4 + 1/4 = 3/4.',
  maxRetries: 1,
  topic: 'fractions',
};

function diag(code: DiagnosticCode, path: string): Diagnostic {
  return { severity: 'error', stage: 'conditions', code, path, message: code };
}

/** Stub context: `checkText` reports blank text, so the paths of the calls are visible. */
function ctx(nodePath: string): GraphCtx {
  return {
    manifest: { nodes: [] } as unknown as Manifest,
    nodePath,
    variables: new Map(),
    checkEffect: (_effect: Effect, _path: string) => [],
    checkHttpsUrl: (_url: string, _path: string) => [],
    checkText: (text: string, path: string) => (text.trim() === '' ? [diag('blank-text', path)] : []),
    isUpstream: () => true,
  };
}

function state(nodeState: AttemptState['nodeState'] = {}): AttemptState {
  return {
    activityId: 'practice-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId: 'r1',
    vars: {},
    answers: {},
    nodeState,
    path: [{ nodeId: 'r1', at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/** A manifest under construction: plain JSON that a test edits before validation. */
type Draft = Record<string, any>;

/** JSON Pointer of the `recall` config in the base manifest. */
const CFG = '/nodes/0/config';

/** Valid base, passing every stage: r1 (recall) → done (outcome). */
function base(): Draft {
  return {
    schemaVersion: 1,
    profile: 'practice-path',
    activityId: 'practice-recall-limits',
    version: 1,
    requires: { recall: 1, outcome: 1 },
    entryNodeId: 'r1',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      { id: 'r1', type: 'recall', config: structuredClone(cfg), edges: [{ to: 'done' }] },
      { id: 'done', type: 'outcome', config: { title: 'Done', body: 'Lesson finished.' }, edges: [] },
    ],
    theme: 'default',
  };
}

/** The base manifest after `edit` of the `recall` config and of the manifest. */
function build(edit: (c: Draft, m: Draft) => void = () => {}): Draft {
  const m = base();
  edit(m.nodes[0].config as Draft, m);
  return m;
}

/** A string of `n` code units that matches `NODE_ID_PATTERN` when `1 <= n <= 64`. */
function id(n: number): string {
  return n === 0 ? '' : 'i' + 'a'.repeat(n - 1);
}

/** `n` options with the IDs `o0`, `o1`, …; the first one is correct. */
function setOptions(c: Draft, n: number): void {
  c.options = Array.from({ length: n }, (_, i) => ({ id: `o${i}`, label: `Option ${i}` }));
  c.correctOptionId = 'o0';
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

describe('recall descriptor', () => {
  it('has type recall, version 1 and is not terminal', () => {
    expect(recallNodeType.type).toBe('recall');
    expect(recallNodeType.version).toBe(1);
    expect(recallNodeType.terminal).toBe(false);
  });

  it('answerType is the enum correct, incorrect', () => {
    expect(recallNodeType.answerType(cfg)).toEqual({ kind: 'enum', values: ['correct', 'incorrect'] });
  });

  it('RECALL_LIMITS match design C6', () => {
    expect(RECALL_LIMITS).toEqual({ minOptions: 2, maxOptions: 5, maxRetries: 3, maxTries: 4 });
  });
});

// ---------------------------------------------------------------------------
// Config schema limits (precompiled validateManifest)
// ---------------------------------------------------------------------------

describe('recall config schema limits', () => {
  it('the base manifest passes every stage', () => {
    expectPass(base());
  });

  // [bound, edit inside the bound, edit just outside it, path of the schema diagnostic]
  it.each<[string, Edit, Edit, string]>([
    ['itemId ≤ 64', (c) => (c.itemId = id(64)), (c) => (c.itemId = id(65)), `${CFG}/itemId`],
    ['itemId ≥ 1', (c) => (c.itemId = id(1)), (c) => (c.itemId = id(0)), `${CFG}/itemId`],
    ['option id ≤ 64', (c) => (c.options[1].id = id(64)), (c) => (c.options[1].id = id(65)), `${CFG}/options/1/id`],
    ['option id ≥ 1', (c) => (c.options[1].id = id(1)), (c) => (c.options[1].id = id(0)), `${CFG}/options/1/id`],
    [
      'correctOptionId ≤ 64',
      (c) => {
        c.options[0].id = id(64);
        c.correctOptionId = id(64);
      },
      (c) => (c.correctOptionId = id(65)),
      `${CFG}/correctOptionId`,
    ],
    [
      'correctOptionId ≥ 1',
      (c) => {
        c.options[0].id = id(1);
        c.correctOptionId = id(1);
      },
      (c) => (c.correctOptionId = id(0)),
      `${CFG}/correctOptionId`,
    ],
    ['prompt ≤ 500', (c) => (c.prompt = 'p'.repeat(500)), (c) => (c.prompt = 'p'.repeat(501)), `${CFG}/prompt`],
    ['option label ≤ 200', (c) => (c.options[0].label = 'l'.repeat(200)), (c) => (c.options[0].label = 'l'.repeat(201)), `${CFG}/options/0/label`],
    ['explanation ≤ 1000', (c) => (c.explanation = 'e'.repeat(1000)), (c) => (c.explanation = 'e'.repeat(1001)), `${CFG}/explanation`],
    ['topic ≤ 60', (c) => (c.topic = 't'.repeat(60)), (c) => (c.topic = 't'.repeat(61)), `${CFG}/topic`],
    ['topic ≥ 1', (c) => (c.topic = 't'), (c) => (c.topic = ''), `${CFG}/topic`],
    [
      `options ≥ ${RECALL_LIMITS.minOptions}`,
      (c) => setOptions(c, RECALL_LIMITS.minOptions),
      (c) => setOptions(c, RECALL_LIMITS.minOptions - 1),
      `${CFG}/options`,
    ],
    [
      `options ≤ ${RECALL_LIMITS.maxOptions}`,
      (c) => setOptions(c, RECALL_LIMITS.maxOptions),
      (c) => setOptions(c, RECALL_LIMITS.maxOptions + 1),
      `${CFG}/options`,
    ],
    ['maxRetries ≥ 0', (c) => (c.maxRetries = 0), (c) => (c.maxRetries = -1), `${CFG}/maxRetries`],
    [
      `maxRetries ≤ ${RECALL_LIMITS.maxRetries}`,
      (c) => (c.maxRetries = RECALL_LIMITS.maxRetries),
      (c) => (c.maxRetries = RECALL_LIMITS.maxRetries + 1),
      `${CFG}/maxRetries`,
    ],
    ['maxRetries integer', (c) => (c.maxRetries = 1), (c) => (c.maxRetries = 1.5), `${CFG}/maxRetries`],
  ])('%s: inside passes, outside fails the schema', (_bound, inside, outside, path) => {
    expectPass(build(inside));
    expectSchemaFail(build(outside), path);
  });

  it('accepts shuffle true and false and no topic', () => {
    expectPass(build((c) => (c.shuffle = true)));
    expectPass(build((c) => (c.shuffle = false)));
    expectPass(build((c) => delete c.topic));
  });

  it('rejects an extra key in the config', () => {
    expectSchemaFail(build((c) => (c.extra = 1)), CFG);
  });

  it('rejects an extra key in an option', () => {
    expectSchemaFail(build((c) => (c.options[0].extra = 1)), `${CFG}/options/0`);
  });
});

// ---------------------------------------------------------------------------
// Response schema limits (precompiled response_recall)
// ---------------------------------------------------------------------------

describe('response_recall', () => {
  /** `n` distinct Try entries. */
  const tries = (n: number) => Array.from({ length: n }, (_, i) => `o${i}`);

  it('tries: 0 entries fail and 1 passes', () => {
    expect(response_recall({ tries: tries(0) })).toBe(false);
    expect(response_recall({ tries: tries(1) })).toBe(true);
  });

  it(`tries: ${RECALL_LIMITS.maxTries} entries pass and ${RECALL_LIMITS.maxTries + 1} fail`, () => {
    expect(response_recall({ tries: tries(RECALL_LIMITS.maxTries) })).toBe(true);
    expect(response_recall({ tries: tries(RECALL_LIMITS.maxTries + 1) })).toBe(false);
  });

  it('tries entries: 64 code units pass and 65 fail', () => {
    expect(response_recall({ tries: ['x'.repeat(64)] })).toBe(true);
    expect(response_recall({ tries: ['x'.repeat(65)] })).toBe(false);
  });

  it('rejects a missing tries list and a non-string entry', () => {
    expect(response_recall({})).toBe(false);
    expect(response_recall({ tries: [1] })).toBe(false);
  });

  it('rejects an extra key in the response', () => {
    expect(response_recall({ tries: ['a'], extra: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate (step 1)
// ---------------------------------------------------------------------------

describe('recall validate', () => {
  it('reports no diagnostic for non-blank prompt, labels and explanation', () => {
    expect(recallNodeType.validate(cfg, ctx('/nodes/0'))).toEqual([]);
  });

  it('reports blank-text at the prompt, each blank option label and the explanation', () => {
    const blank: RecallConfig = {
      ...cfg,
      prompt: '  ',
      options: [cfg.options[0]!, { id: 'b', label: '' }, cfg.options[2]!],
      explanation: '\n',
    };
    const paths = recallNodeType.validate(blank, ctx('/nodes/0')).map((d) => `${d.code} ${d.path}`);
    expect(paths).toEqual([
      'blank-text /nodes/0/config/prompt',
      'blank-text /nodes/0/config/options/1/label',
      'blank-text /nodes/0/config/explanation',
    ]);
  });

  it.each<[string, Edit, string]>([
    ['prompt', (c) => (c.prompt = '   '), `${CFG}/prompt`],
    ['option label', (c) => (c.options[1].label = ''), `${CFG}/options/1/label`],
    ['explanation', (c) => (c.explanation = ' '), `${CFG}/explanation`],
  ])('validateManifest reports conditions/blank-text at a blank %s', (_field, edit, path) => {
    const result = validate(build(edit));
    expect(rows(result)).toEqual([['conditions', 'blank-text', 'error', path]]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate (steps 2–4), through validateManifest
// ---------------------------------------------------------------------------

describe('recall validate graph checks', () => {
  it('reports duplicate-option-id at the later option of a repeated option ID', () => {
    const result = validate(build((c) => (c.options[1].id = 'a')));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        stage: 'conditions',
        code: 'duplicate-option-id',
        path: `${CFG}/options/1/id`,
        message: 'Option ID "a" is used more than once in this question.',
        nodeId: 'r1',
      },
    ]);
  });

  it('reports dangling-ref when correctOptionId names no option', () => {
    const result = validate(build((c) => (c.correctOptionId = 'z')));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        stage: 'conditions',
        code: 'dangling-ref',
        path: `${CFG}/correctOptionId`,
        message: 'correctOptionId "z" names no option of this question.',
        nodeId: 'r1',
      },
    ]);
  });

  it('reports duplicate-item-id on the later of two recall nodes with one itemId, naming the earlier node', () => {
    const m = build((_c, draft) => {
      draft.nodes[0].edges = [{ to: 'r2' }];
      draft.nodes.splice(1, 0, { id: 'r2', type: 'recall', config: structuredClone(cfg), edges: [{ to: 'done' }] });
    });
    const result = validate(m);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        stage: 'conditions',
        code: 'duplicate-item-id',
        path: '/nodes/1/config/itemId',
        message: 'Item ID "q1" is already used by node "r1".',
        nodeId: 'r2',
      },
    ]);
  });

  it('reports no graph diagnostic for two recall nodes with different itemIds', () => {
    expectPass(
      build((_c, draft) => {
        draft.nodes[0].edges = [{ to: 'r2' }];
        draft.nodes.splice(1, 0, { id: 'r2', type: 'recall', config: { ...structuredClone(cfg), itemId: 'q2' }, edges: [{ to: 'done' }] });
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// enter and reduce
// ---------------------------------------------------------------------------

describe('recall enter', () => {
  it('with shuffle true stores an order that is a permutation of the option IDs', () => {
    const s = state();
    const next = recallNodeType.enter!({ ...cfg, shuffle: true }, s, env());
    const stored = readRecallNodeState(next.nodeState['r1']);
    expect(stored).not.toBeNull();
    expect(stored?.item).toBeUndefined();
    expect([...(stored?.order ?? [])].sort()).toEqual(['a', 'b', 'c']);
    expect(s.nodeState).toEqual({});
  });

  it('without shuffle, or with shuffle false, returns the state unchanged', () => {
    const s = state();
    expect(recallNodeType.enter!(cfg, s, env())).toBe(s);
    expect(recallNodeType.enter!({ ...cfg, shuffle: false }, s, env())).toBe(s);
    expect(s.nodeState).toEqual({});
  });
});

describe('recall reduce', () => {
  it('stores the First_Try_Result as the answer and the Item_Snapshot as the node state', () => {
    const s = state();
    const next = recallNodeType.reduce(cfg, s, { tries: ['b', 'a'] }, env());
    expect(next.answers['r1']).toBe('incorrect');
    expect(next.nodeState['r1']).toEqual({
      item: {
        itemId: 'q1',
        topic: 'fractions',
        prompt: cfg.prompt,
        options: cfg.options,
        correctOptionId: 'a',
        explanation: cfg.explanation,
        tries: ['b', 'a'],
        firstTry: 'incorrect',
      },
    });
    expect(readRecallNodeState(next.nodeState['r1'])).not.toBeNull();
    expect(s.answers).toEqual({});
    expect(s.nodeState).toEqual({});
  });

  it('stores correct for a correct first Try and keeps the order that enter stored', () => {
    const next = recallNodeType.reduce(cfg, state({ r1: { order: ['c', 'a', 'b'] } }), { tries: ['a'] }, env());
    expect(next.answers['r1']).toBe('correct');
    const stored = readRecallNodeState(next.nodeState['r1']);
    expect(stored?.order).toEqual(['c', 'a', 'b']);
    expect(stored?.item?.firstTry).toBe('correct');
  });

  it('leaves topic out of the snapshot when the config has none', () => {
    const { topic: _topic, ...noTopic } = cfg;
    const next = recallNodeType.reduce(noTopic, state(), { tries: ['a'] }, env());
    expect(Object.hasOwn(readRecallNodeState(next.nodeState['r1'])?.item ?? {}, 'topic')).toBe(false);
  });
});
