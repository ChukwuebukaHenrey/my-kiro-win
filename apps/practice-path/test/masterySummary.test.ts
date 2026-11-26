// Example tests for the `masterySummary` node type (design C8, Testing Strategy "Example tests"):
// descriptor fields, `answerType`, the response rule, schema limits at both sides of each bound
// with the precompiled validators (including the Tutor_Share_Link URL pattern), the `validate`
// diagnostics on whole manifests, a direct `validate` call with the shared `checkHttpsUrl`, and
// `enter` / `reduce` on hand-built attempt states. The Wiring_Hook wrote the first `validate`,
// `enter` and `reduce` tests; task 8.2 completed the file. These tests are evidence for the cases
// listed, not a proof of correctness.

import { describe, expect, it } from 'vitest';
import {
  checkHttpsUrl,
  validateManifest,
  type DiagnosticCode,
  type GraphCtx,
  type Manifest,
  type Stage,
  type ValidationResult,
} from '@dreame/schema';
import { createRng, type AttemptState, type Env } from '@dreame/runtime';
import {
  TUTOR_SHARE_URL_PATTERN,
  masterySummaryNodeType,
  type MasterySummaryConfig,
} from '../src/node-types/masterySummary.ts';
import { readMasteryResult } from '../src/node-types/practice-state.ts';
import { practiceProfile } from '../src/profile.ts';
import { response_masterySummary } from '../generated/practice-path.validators.js';

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/** A manifest under construction: plain JSON that a test edits before validation. */
type Draft = Record<string, any>;

/** JSON Pointer of the `masterySummary` config in the base manifest. */
const MS = '/nodes/2/config';

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

/** Valid base, passing every stage: r1 (recall) → rq (reviewQueue) → ms (masterySummary). */
function base(): Draft {
  return {
    schemaVersion: 1,
    profile: 'practice-path',
    activityId: 'practice-mastery-summary',
    version: 1,
    requires: { recall: 1, reviewQueue: 1, masterySummary: 1 },
    entryNodeId: 'r1',
    fallbackOutcomeId: 'ms',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      { id: 'r1', type: 'recall', config: recallConfig('q1'), edges: [{ to: 'rq' }] },
      { id: 'rq', type: 'reviewQueue', config: { title: 'Review', from: ['r1'] }, edges: [{ to: 'ms' }] },
      {
        id: 'ms',
        type: 'masterySummary',
        config: {
          title: 'Your results',
          body: 'Well done.',
          from: 'rq',
          tutorShare: { label: 'Send result to tutor', url: 'https://wa.me/12125550142' },
        },
        edges: [],
      },
    ],
    theme: 'default',
  };
}

type Edit = (c: Draft, m: Draft) => void;

/** The base manifest after `edit` of the `masterySummary` config and of the manifest. */
function build(edit: Edit = () => {}): Draft {
  const m = base();
  edit(m.nodes[2].config as Draft, m);
  return m;
}

function validate(m: unknown): ValidationResult {
  return validateManifest(m, practiceProfile);
}

type Row = [Stage, DiagnosticCode, 'error' | 'warning', string];

function rows(result: ValidationResult): Row[] {
  return result.diagnostics.map((d) => [d.stage, d.code, d.severity, d.path]);
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

/** Sets the Tutor_Share_Link target URL. */
const shareUrl = (url: string): Edit => (c) => (c.tutorShare.url = url);

// ---------------------------------------------------------------------------
// Descriptor, answer type and response rule
// ---------------------------------------------------------------------------

const cfg: MasterySummaryConfig = { title: 'Your results', body: 'Well done.', from: 'rq' };

describe('masterySummary descriptor', () => {
  it('has type masterySummary, version 1 and is terminal', () => {
    expect(masterySummaryNodeType.type).toBe('masterySummary');
    expect(masterySummaryNodeType.version).toBe(1);
    expect(masterySummaryNodeType.terminal).toBe(true);
  });

  it('answerType returns null', () => {
    expect(masterySummaryNodeType.answerType(cfg)).toBeNull();
  });

  it('TUTOR_SHARE_URL_PATTERN matches design C8', () => {
    expect(TUTOR_SHARE_URL_PATTERN).toBe('^https://wa\\.me/[0-9]{6,15}$');
  });
});

describe('masterySummary response', () => {
  it('response_masterySummary accepts the empty object and rejects an extra key', () => {
    expect(response_masterySummary({})).toBe(true);
    expect(response_masterySummary({ extra: 1 })).toBe(false);
  });

  it('isValidResponse follows the outcome rule: an object passes, a non-object fails', () => {
    expect(masterySummaryNodeType.isValidResponse(cfg, {})).toBe(true);
    expect(masterySummaryNodeType.isValidResponse(cfg, null)).toBe(false);
    expect(masterySummaryNodeType.isValidResponse(cfg, [])).toBe(false);
    expect(masterySummaryNodeType.isValidResponse(cfg, 'x')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Config schema limits (precompiled validateManifest)
// ---------------------------------------------------------------------------

describe('masterySummary config schema limits', () => {
  it('the base manifest passes every stage', () => {
    expectPass(base());
  });

  it('passes without tutorShare', () => {
    expectPass(build((c) => delete c.tutorShare));
  });

  // [bound, edit inside the bound, edit just outside it, path of the schema diagnostic]
  it.each<[string, Edit, Edit, string]>([
    ['title ≤ 120', (c) => (c.title = 't'.repeat(120)), (c) => (c.title = 't'.repeat(121)), `${MS}/title`],
    ['body ≤ 2000', (c) => (c.body = 'b'.repeat(2000)), (c) => (c.body = 'b'.repeat(2001)), `${MS}/body`],
    [
      'tutorShare.label ≤ 60',
      (c) => (c.tutorShare.label = 'l'.repeat(60)),
      (c) => (c.tutorShare.label = 'l'.repeat(61)),
      `${MS}/tutorShare/label`,
    ],
    ['tutorShare.url ≥ 6 digits', shareUrl('https://wa.me/123456'), shareUrl('https://wa.me/12345'), `${MS}/tutorShare/url`],
    [
      'tutorShare.url ≤ 15 digits',
      shareUrl(`https://wa.me/${'1'.repeat(15)}`),
      shareUrl(`https://wa.me/${'1'.repeat(16)}`),
      `${MS}/tutorShare/url`,
    ],
  ])('%s: inside passes, outside fails the schema', (_bound, inside, outside, path) => {
    expectPass(build(inside));
    expectSchemaFail(build(outside), path);
  });

  it('rejects an http: tutorShare.url', () => {
    expectSchemaFail(build(shareUrl('http://wa.me/12125550142')), `${MS}/tutorShare/url`);
  });

  it('rejects a tutorShare.url on another host', () => {
    expectSchemaFail(build(shareUrl('https://example.com/12125550142')), `${MS}/tutorShare/url`);
  });

  it('rejects an extra key in the config and in tutorShare', () => {
    expectSchemaFail(build((c) => (c.extra = 1)), MS);
    expectSchemaFail(build((c) => (c.tutorShare.extra = 1)), `${MS}/tutorShare`);
  });
});

// ---------------------------------------------------------------------------
// validate, through validateManifest
// ---------------------------------------------------------------------------

describe('masterySummary validate', () => {
  it('passes the base manifest', () => {
    const result = validate(build());
    expect(rows(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reports dangling-ref when from names no node', () => {
    const result = validate(build((c) => (c.from = 'nope')));
    expect(rows(result)).toEqual([['conditions', 'dangling-ref', 'error', `${MS}/from`]]);
    expect(result.diagnostics[0]?.nodeId).toBe('ms');
    expect(result.ok).toBe(false);
  });

  it('reports type-mismatch when from names a recall node', () => {
    const result = validate(build((c) => (c.from = 'r1')));
    expect(rows(result)).toEqual([['conditions', 'type-mismatch', 'error', `${MS}/from`]]);
    expect(result.ok).toBe(false);
  });

  it('reports answer-not-upstream when a path to the summary skips the reviewQueue node', () => {
    const m = build((_c, draft) => {
      draft.nodes[0].edges = [{ to: 'ms', when: { op: 'eq', ref: { answer: 'r1' }, value: 'correct' } }, { to: 'rq' }];
    });
    const result = validate(m);
    expect(rows(result)).toEqual([['conditions', 'answer-not-upstream', 'error', `${MS}/from`]]);
    expect(result.diagnostics[0]?.message).toBe(
      'from names node "rq", which is not on every path from entryNodeId to this node.',
    );
    expect(result.ok).toBe(false);
  });

  it('reports blank-text for a blank title', () => {
    const result = validate(build((c) => (c.title = '   ')));
    expect(rows(result)).toEqual([['conditions', 'blank-text', 'error', `${MS}/title`]]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate, called directly with the shared checkHttpsUrl
// ---------------------------------------------------------------------------

describe('masterySummary validate with a test GraphCtx', () => {
  /** Holds the `rq` reviewQueue node; `checkText` passes and every node is upstream. */
  function ctx(): GraphCtx {
    const nodes = [
      { id: 'r1', type: 'recall', config: {}, edges: [] },
      { id: 'rq', type: 'reviewQueue', config: {}, edges: [] },
    ];
    return {
      manifest: { nodes } as unknown as Manifest,
      nodePath: '/nodes/2',
      variables: new Map(),
      checkEffect: () => [],
      checkHttpsUrl,
      checkText: () => [],
      isUpstream: () => true,
    };
  }

  it('an https wa.me URL gives no diagnostics', () => {
    const c: MasterySummaryConfig = { ...cfg, tutorShare: { label: 'Send', url: 'https://wa.me/12125550142' } };
    expect(masterySummaryNodeType.validate(c, ctx())).toEqual([]);
  });

  it('an http: URL gives conditions/unsafe-url at /config/tutorShare/url', () => {
    // The schema stage rejects this URL first in validateManifest, so only a direct call reaches it.
    const c: MasterySummaryConfig = { ...cfg, tutorShare: { label: 'Send', url: 'http://wa.me/12125550142' } };
    expect(masterySummaryNodeType.validate(c, ctx()).map((d) => [d.stage, d.code, d.severity, d.path])).toEqual([
      ['conditions', 'unsafe-url', 'error', '/nodes/2/config/tutorShare/url'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// enter and reduce
// ---------------------------------------------------------------------------

function state(nodeState: AttemptState['nodeState']): AttemptState {
  return {
    activityId: 'practice-mastery-summary',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'finished',
    currentNodeId: 'ms',
    vars: {},
    answers: {},
    nodeState,
    path: [{ nodeId: 'ms', at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

const EMPTY = { items: [], counts: { firstTry: 0, reviewed: 0, missed: 0 }, missedTopics: [], nextReview: [] };

describe('masterySummary enter and reduce', () => {
  it('enter stores the Mastery_Result of the from node', () => {
    const s0 = state({
      rq: {
        items: [
          { itemId: 'q1', topic: 'fractions', prompt: 'Q1', firstTry: 'correct' },
          { itemId: 'q2', topic: 'percent', prompt: 'Q2', firstTry: 'incorrect' },
          { itemId: 'q3', topic: 'percent', prompt: 'Q3', firstTry: 'incorrect' },
          { itemId: 'q4', prompt: 'Q4', firstTry: 'incorrect' },
          { itemId: 'q5', topic: 'decimals', prompt: 'Q5', firstTry: 'incorrect' },
        ],
        queue: [],
        results: [
          { itemId: 'q2', result: 'correct' },
          { itemId: 'q3', result: 'incorrect' },
          { itemId: 'q4', result: 'incorrect' },
        ],
      },
    });
    const s1 = masterySummaryNodeType.enter?.(cfg, s0, env()) ?? s0;
    expect(readMasteryResult(s1.nodeState['ms'])).toEqual({
      items: [
        { itemId: 'q1', topic: 'fractions', prompt: 'Q1', result: 'firstTry' },
        { itemId: 'q2', topic: 'percent', prompt: 'Q2', result: 'reviewed' },
        { itemId: 'q3', topic: 'percent', prompt: 'Q3', result: 'missed' },
        { itemId: 'q4', prompt: 'Q4', result: 'missed' },
        { itemId: 'q5', topic: 'decimals', prompt: 'Q5', result: 'missed' },
      ],
      counts: { firstTry: 1, reviewed: 1, missed: 3 },
      missedTopics: ['percent', 'decimals'],
      nextReview: ['q2', 'q3', 'q4', 'q5'],
    });
    expect(s0.nodeState['ms']).toBeUndefined();
  });

  it('enter without a from state stores no items, all counts 0 and empty lists', () => {
    const s1 = masterySummaryNodeType.enter?.(cfg, state({}), env()) ?? state({});
    expect(s1.nodeState['ms']).toEqual(EMPTY);
  });

  it('enter with a damaged from state stores the empty Mastery_Result', () => {
    const s1 = masterySummaryNodeType.enter?.(cfg, state({ rq: { items: 'damaged' } }), env()) ?? state({});
    expect(s1.nodeState['ms']).toEqual(EMPTY);
  });

  it('reduce returns the state unchanged', () => {
    const s0 = state({ rq: { items: [], queue: [] } });
    expect(masterySummaryNodeType.reduce(cfg, s0, {}, env())).toBe(s0);
  });
});
