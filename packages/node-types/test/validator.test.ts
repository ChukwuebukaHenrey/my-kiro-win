// Example tests for `validateManifest` against the `core` profile: one manifest per diagnostic
// code of the design table "Stage and severity of each code" (the CLI-only `parse` codes excepted),
// plus the boundary and cross-stage cases of task 5.6. Each case is the valid base manifest with a
// targeted edit. These tests are evidence for the cases listed, not a proof of correctness.

import { describe, expect, it } from 'vitest';
import {
  HARD_LIMITS,
  validateManifest,
  type DiagnosticCode,
  type ProfileDescriptor,
  type Stage,
  type StandaloneValidate,
  type ValidationResult,
} from '@dreame/schema';
import { coreProfile } from '../src/index.ts';

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** A manifest under construction: plain JSON that a test edits before validation. */
type Draft = Record<string, any>;

/** Condition leaf `answer(q1) eq value`. */
function answerEq(node: string, value: unknown): Draft {
  return { op: 'eq', ref: { answer: node }, value };
}

/**
 * Valid base: intro (content) → q1 (choice) → good (outcome) when q1 = a, else → done (outcome).
 * `done` is the fallback outcome and is reached by q1's unconditional last edge. The q1 edge
 * condition reads q1's own answer.
 */
function base(): Draft {
  return {
    schemaVersion: 1,
    profile: 'core',
    activityId: 'validator-demo',
    version: 1,
    requires: { content: 1, choice: 1, outcome: 1 },
    entryNodeId: 'intro',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [{ id: 'score', type: 'number', initial: 0, min: 0, max: 10 }],
    nodes: [
      { id: 'intro', type: 'content', config: { body: 'Hello' }, edges: [{ to: 'q1' }] },
      {
        id: 'q1',
        type: 'choice',
        config: {
          prompt: 'Pick one',
          options: [
            { id: 'a', label: 'Alpha', effects: [{ op: 'add', var: 'score', value: 1 }] },
            { id: 'b', label: 'Beta' },
          ],
        },
        edges: [{ to: 'good', when: answerEq('q1', 'a') }, { to: 'done' }],
      },
      { id: 'good', type: 'outcome', config: { title: 'Good', body: 'Well done' }, edges: [] },
      { id: 'done', type: 'outcome', config: { title: 'Done', body: 'Bye' }, edges: [] },
    ],
    theme: 'default',
  };
}

/** The base manifest after `edit`. */
function build(edit: (m: Draft) => void = () => {}): Draft {
  const m = base();
  edit(m);
  return m;
}

/** Index of the node with `id` in `m.nodes`. */
function at(m: Draft, id: string): number {
  const i = (m.nodes as Draft[]).findIndex((n) => n.id === id);
  if (i < 0) throw new Error(`no node ${id}`);
  return i;
}

function node(m: Draft, id: string): Draft {
  return m.nodes[at(m, id)] as Draft;
}

/** A condition of nesting depth `depth`: `depth - 1` `not` wrappers around one leaf. */
function nested(depth: number): Draft {
  let cond = answerEq('q1', 'a');
  for (let d = 1; d < depth; d++) cond = { op: 'not', arg: cond };
  return cond;
}

/**
 * A manifest of `count` nodes: intro → c1 → … → q1 → good | done, with caps at the hard limits.
 */
function sized(count: number): Draft {
  return build((m) => {
    m.limits = { maxNodes: HARD_LIMITS.maxNodes, maxTransitions: HARD_LIMITS.maxTransitions };
    const fillers = count - 4;
    const chain: Draft[] = [];
    for (let i = 1; i <= fillers; i++) {
      chain.push({ id: `c${i}`, type: 'content', config: { body: `Page ${i}` }, edges: [{ to: i === fillers ? 'q1' : `c${i + 1}` }] });
    }
    if (fillers > 0) node(m, 'intro').edges = [{ to: 'c1' }];
    m.nodes.splice(1, 0, ...chain);
  });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

type Row = [Stage, DiagnosticCode, 'error' | 'warning', string];

function rows(result: ValidationResult): Row[] {
  return result.diagnostics.map((d) => [d.stage, d.code, d.severity, d.path]);
}

function validate(m: unknown, profile: ProfileDescriptor = coreProfile): ValidationResult {
  return validateManifest(m, profile);
}

/** The result fails with exactly the given diagnostics, in order. */
function expectFail(result: ValidationResult, ...expected: Row[]): void {
  expect(rows(result)).toEqual(expected);
  expect(result.ok).toBe(false);
}

/**
 * `core` with a schema that accepts any `limits` integers, so that the stage-2 caps on
 * `limits.maxNodes` and `limits.maxTransitions` can be reached. The `core` schema already caps
 * both fields at the hard limits, so stage 1 reports them first with the real profile.
 */
const looseLimitsSchema: StandaloneValidate = Object.assign(
  (data: unknown): boolean => {
    const m = data as Draft;
    const clamped = { ...m, limits: { maxNodes: 1, maxTransitions: 0 } };
    const ok = coreProfile.validateSchema(clamped);
    looseLimitsSchema.errors = coreProfile.validateSchema.errors;
    return ok && Number.isInteger(m.limits?.maxNodes) && Number.isInteger(m.limits?.maxTransitions);
  },
  { errors: undefined as StandaloneValidate['errors'] },
);
const looseLimitsProfile: ProfileDescriptor = { ...coreProfile, validateSchema: looseLimitsSchema };

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

describe('base manifest', () => {
  it('passes every stage with no diagnostics', () => {
    const result = validate(base());
    expect(rows(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stages 1–2
// ---------------------------------------------------------------------------

describe('stage 1: schema', () => {
  it('schema: a field of the wrong shape', () => {
    expectFail(validate(build((m) => (m.version = 0))), ['schema', 'schema', 'error', '/version']);
  });

  it('unknown-node-type: a node type that the profile does not have', () => {
    expectFail(
      validate(build((m) => (node(m, 'intro').type = 'quiz'))),
      ['schema', 'unknown-node-type', 'error', '/nodes/0'],
    );
  });

  it('profile-mismatch: the manifest names another profile', () => {
    expectFail(validate(build((m) => (m.profile = 'shop'))), ['schema', 'profile-mismatch', 'error', '/profile']);
  });

  it('cond-too-deep: depth 8 passes and depth 9 fails at the when path', () => {
    const depth8 = validate(build((m) => (node(m, 'q1').edges[0].when = nested(8))));
    expect(rows(depth8)).toEqual([]);
    expect(depth8.ok).toBe(true);
    expectFail(
      validate(build((m) => (node(m, 'q1').edges[0].when = nested(9)))),
      ['schema', 'cond-too-deep', 'error', '/nodes/1/edges/0/when'],
    );
  });

  it('200 nodes pass the schema and 201 fail it', () => {
    const m200 = sized(200);
    expect(m200.nodes).toHaveLength(200);
    const ok = validate(m200);
    expect(rows(ok)).toEqual([]);
    expect(ok.ok).toBe(true);

    const m201 = sized(201);
    expect(m201.nodes).toHaveLength(201);
    expectFail(validate(m201), ['schema', 'schema', 'error', '/nodes']);
  });
});

describe('stage 2: caps', () => {
  it('node-cap: more nodes than limits.maxNodes', () => {
    expectFail(validate(build((m) => (m.limits.maxNodes = 3))), ['caps', 'node-cap', 'error', '/nodes']);
  });

  it('node-cap: limits.maxNodes above the hard limit', () => {
    const m = build((d) => (d.limits.maxNodes = HARD_LIMITS.maxNodes + 1));
    expectFail(validate(m), ['schema', 'schema', 'error', '/limits/maxNodes']);
    expectFail(validate(m, looseLimitsProfile), ['caps', 'node-cap', 'error', '/limits/maxNodes']);
  });

  it('transition-cap: limits.maxTransitions above the hard limit', () => {
    const m = build((d) => (d.limits.maxTransitions = HARD_LIMITS.maxTransitions + 1));
    expectFail(validate(m), ['schema', 'schema', 'error', '/limits/maxTransitions']);
    expectFail(validate(m, looseLimitsProfile), ['caps', 'transition-cap', 'error', '/limits/maxTransitions']);
  });
});

// ---------------------------------------------------------------------------
// Stages 3–4
// ---------------------------------------------------------------------------

/** Base without q1 and good: intro → done. Uses content and outcome only. */
function withoutChoice(m: Draft): void {
  m.nodes = [
    { id: 'intro', type: 'content', config: { body: 'Hello' }, edges: [{ to: 'done' }] },
    { id: 'done', type: 'outcome', config: { title: 'Done', body: 'Bye' }, edges: [] },
  ];
}

describe('stage 3: ids', () => {
  it('duplicate-node-id: two nodes share an id', () => {
    expectFail(
      validate(build((m) => m.nodes.push({ ...node(m, 'done') }))),
      ['ids', 'duplicate-node-id', 'error', '/nodes/4/id'],
    );
  });

  it('duplicate-var-id: two variables share an id', () => {
    expectFail(
      validate(build((m) => m.variables.push({ id: 'score', type: 'boolean', initial: false }))),
      ['ids', 'duplicate-var-id', 'error', '/variables/1/id'],
    );
  });
});

describe('stage 4: refs', () => {
  it.each<[string, (m: Draft) => void, string]>([
    ['an edge to', (m) => (node(m, 'intro').edges[0].to = 'nowhere'), '/nodes/0/edges/0/to'],
    ['entryNodeId', (m) => (m.entryNodeId = 'nowhere'), '/entryNodeId'],
    ['fallbackOutcomeId', (m) => (m.fallbackOutcomeId = 'nowhere'), '/fallbackOutcomeId'],
    ['an answer ref', (m) => (node(m, 'q1').edges[0].when = answerEq('nowhere', 'a')), '/nodes/1/edges/0/when/ref/answer'],
  ])('dangling-ref: %s names no node', (_name, edit, path) => {
    expectFail(validate(build(edit)), ['refs', 'dangling-ref', 'error', path]);
  });

  it('undeclared-var: a var ref names no declared variable', () => {
    expectFail(
      validate(build((m) => (node(m, 'q1').edges[0].when = { op: 'gte', ref: { var: 'lives' }, value: 1 }))),
      ['refs', 'undeclared-var', 'error', '/nodes/1/edges/0/when/ref/var'],
    );
  });

  it('requires-missing: a used node type is not in requires', () => {
    expectFail(validate(build((m) => delete m.requires.choice)), ['refs', 'requires-missing', 'error', '/requires']);
  });

  it('requires-version: requires asks for a version the profile does not support', () => {
    expectFail(validate(build((m) => (m.requires.content = 2))), ['refs', 'requires-version', 'error', '/requires/content']);
  });

  it('requires-unknown: requires names a node type that is not in the profile', () => {
    expectFail(validate(build((m) => (m.requires.quiz = 1))), ['refs', 'requires-unknown', 'error', '/requires/quiz']);
  });

  it('requires-unused alone gives ok: true with one warning', () => {
    const result = validate(build(withoutChoice));
    expect(rows(result)).toEqual([['refs', 'requires-unused', 'warning', '/requires/choice']]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stages 5–6
// ---------------------------------------------------------------------------

describe('stage 5: dag', () => {
  it('cycle: q1 links back to intro', () => {
    expectFail(
      validate(build((m) => (node(m, 'q1').edges[0].to = 'intro'))),
      ['dag', 'cycle', 'error', '/nodes/1/edges/0'],
    );
  });
});

describe('stage 6: terminal', () => {
  it('dead-end: a content node with no edges (which also has no path to a terminal node)', () => {
    expectFail(
      validate(build((m) => (node(m, 'good').type = 'content'))),
      ['terminal', 'no-terminal-reachable', 'error', '/nodes/2'],
      ['terminal', 'dead-end', 'error', '/nodes/2/edges'],
    );
  });

  it('terminal-has-edges: an outcome with an edge', () => {
    expectFail(
      validate(build((m) => (node(m, 'done').edges = [{ to: 'good' }]))),
      ['terminal', 'terminal-has-edges', 'error', '/nodes/3/edges'],
    );
  });

  it('last-edge-conditional: the last edge has a when', () => {
    expectFail(
      validate(build((m) => (node(m, 'q1').edges = [{ to: 'done' }, { to: 'good', when: answerEq('q1', 'a') }]))),
      ['terminal', 'last-edge-conditional', 'error', '/nodes/1/edges/1/when'],
    );
  });

  it('fallback-not-terminal: fallbackOutcomeId names a choice node', () => {
    expectFail(
      validate(build((m) => (m.fallbackOutcomeId = 'q1'))),
      ['terminal', 'fallback-not-terminal', 'error', '/fallbackOutcomeId'],
    );
  });

  it('unreachable-node: an outcome that no edge reaches', () => {
    expectFail(
      validate(build((m) => m.nodes.push({ id: 'extra', type: 'outcome', config: { title: 'X', body: 'Y' }, edges: [] }))),
      ['terminal', 'unreachable-node', 'error', '/nodes/4'],
    );
  });

  it('no-terminal-reachable: a node with edges whose only path ends in a dead end', () => {
    expectFail(
      validate(
        build((m) => {
          Object.assign(node(m, 'good'), { type: 'content', edges: [{ to: 'stuck' }] });
          m.nodes.push({ id: 'stuck', type: 'content', config: { body: 'Stuck' }, edges: [] });
        }),
      ),
      ['terminal', 'no-terminal-reachable', 'error', '/nodes/2'],
      ['terminal', 'no-terminal-reachable', 'error', '/nodes/4'],
      ['terminal', 'dead-end', 'error', '/nodes/4/edges'],
    );
  });

  it('limit-below-longest-path: maxTransitions 1 fails and 2 passes for a longest path of 2 edges', () => {
    expectFail(
      validate(build((m) => (m.limits.maxTransitions = 1))),
      ['terminal', 'limit-below-longest-path', 'error', '/limits/maxTransitions'],
    );
    const result = validate(build((m) => (m.limits.maxTransitions = 2)));
    expect(rows(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stage 7 and cross-stage cases
// ---------------------------------------------------------------------------

/**
 * intro → q1 only when score ≥ 1, else straight to q2; q1 → q2; q2's edge reads q1's answer.
 * q1 is off the path intro → q2. Node order: intro, q1, good, done, q2.
 */
function q1OffPath(m: Draft): void {
  node(m, 'intro').edges = [{ to: 'q1', when: { op: 'gte', ref: { var: 'score' }, value: 1 } }, { to: 'q2' }];
  node(m, 'q1').edges = [{ to: 'q2' }];
  m.nodes.push({
    id: 'q2',
    type: 'choice',
    config: { prompt: 'Again?', options: [{ id: 'y', label: 'Yes' }, { id: 'n', label: 'No' }] },
    edges: [{ to: 'good', when: answerEq('q1', 'a') }, { to: 'done' }],
  });
}

describe('stage 7: conditions', () => {
  it.each<[string, Draft]>([
    ['eq with a value outside the enum answer values', answerEq('q1', 'z')],
    ['gte on an enum answer', { op: 'gte', ref: { answer: 'q1' }, value: 1 }],
    ['includes on a number variable', { op: 'includes', ref: { var: 'score' }, value: 'a' }],
  ])('type-mismatch: %s', (_name, when) => {
    expectFail(
      validate(build((m) => (node(m, 'q1').edges[0].when = when))),
      ['conditions', 'type-mismatch', 'error', '/nodes/1/edges/0/when'],
    );
  });

  it('ref-not-answerable: an answer ref to a content node', () => {
    expectFail(
      validate(build((m) => (node(m, 'q1').edges[0].when = answerEq('intro', 'a')))),
      ['conditions', 'ref-not-answerable', 'error', '/nodes/1/edges/0/when/ref/answer'],
    );
  });

  it('answer-not-upstream: an answer ref to a node off some path', () => {
    expectFail(
      validate(build(q1OffPath)),
      ['conditions', 'answer-not-upstream', 'error', '/nodes/4/edges/0/when/ref/answer'],
    );
  });

  it('an edge condition on the holding node\'s own answer passes', () => {
    const m = base();
    expect(node(m, 'q1').edges[0].when.ref).toEqual({ answer: 'q1' });
    const result = validate(m);
    expect(rows(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('var-decl-invalid: a number initial above its max', () => {
    expectFail(
      validate(build((m) => (m.variables[0].initial = 11))),
      ['conditions', 'var-decl-invalid', 'error', '/variables/0/initial'],
    );
  });

  it('effect-invalid: a set effect above the variable max', () => {
    expectFail(
      validate(build((m) => (node(m, 'q1').config.options[0].effects = [{ op: 'set', var: 'score', value: 11 }]))),
      ['conditions', 'effect-invalid', 'error', '/nodes/1/config/options/0/effects/0'],
    );
  });

  it('invalid-date: validUntil is not a calendar date', () => {
    const ok = validate(build((m) => (m.validUntil = '2028-02-29')));
    expect(rows(ok)).toEqual([]);
    expect(ok.ok).toBe(true);
    expectFail(validate(build((m) => (m.validUntil = '2027-02-29'))), ['conditions', 'invalid-date', 'error', '/validUntil']);
  });

  it('blank-text: a whitespace-only content body', () => {
    expectFail(
      validate(build((m) => (node(m, 'intro').config.body = '   '))),
      ['conditions', 'blank-text', 'error', '/nodes/0/config/body'],
    );
  });

  it('duplicate-option-id: two choice options share an id', () => {
    expectFail(
      validate(build((m) => (node(m, 'q1').config.options[1].id = 'a'))),
      ['conditions', 'duplicate-option-id', 'error', '/nodes/1/config/options/1/id'],
    );
  });

  it('unsafe-url: an https CTA to a link shortener', () => {
    expectFail(
      validate(build((m) => (node(m, 'done').config.cta = { label: 'Go', url: 'https://bit.ly/x' }))),
      ['conditions', 'unsafe-url', 'error', '/nodes/3/config/cta/url'],
    );
  });
});

describe('across stages', () => {
  it('a later-stage error keeps an earlier requires-unused warning', () => {
    expectFail(
      validate(
        build((m) => {
          withoutChoice(m);
          node(m, 'intro').config.body = ' ';
        }),
      ),
      ['refs', 'requires-unused', 'warning', '/requires/choice'],
      ['conditions', 'blank-text', 'error', '/nodes/0/config/body'],
    );
  });

  it('a stage-3 error skips stages 4–7', () => {
    expectFail(
      validate(
        build((m) => {
          m.nodes.push({ ...node(m, 'done') }); // ids
          node(m, 'intro').edges[0].to = 'nowhere'; // refs
          node(m, 'q1').edges[0].to = 'intro'; // dag
          m.limits.maxTransitions = 0; // terminal
          node(m, 'good').config.title = ''; // conditions
          m.validUntil = '2027-13-01'; // conditions
        }),
      ),
      ['ids', 'duplicate-node-id', 'error', '/nodes/4/id'],
    );
  });
});
