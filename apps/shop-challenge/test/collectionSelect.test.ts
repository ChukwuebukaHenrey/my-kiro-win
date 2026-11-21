// Example tests for the `collectionSelect` node type (design C7, Testing Strategy "Example tests"):
// descriptor fields, `answerType`, schema limits at both sides of each bound with the precompiled
// validators, closed objects, `validate` step 1 (`blank-text`) and `reduce`. The Wiring_Hook wrote
// the first `validate` and `reduce` tests; task 7.2 completed the file. These tests are evidence
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
import { SELECT_LIMITS, collectionSelectNodeType, type CollectionSelectConfig } from '../src/node-types/collectionSelect.ts';
import { shopProfile } from '../src/profile.ts';
import { response_collectionSelect } from '../generated/shop-challenge.validators.js';

const cfg: CollectionSelectConfig = {
  prompt: 'Build a gift bundle',
  items: [
    { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' },
    { id: 'candle', name: 'Candle', price: 9, tags: ['home'], occasions: ['birthday'] },
    { id: 'card', name: 'Card', price: 3, tags: [] },
  ],
  min: 1,
  max: 3,
  budget: 30,
  currency: 'USD',
};

function diag(code: DiagnosticCode, path: string): Diagnostic {
  return { severity: 'error', stage: 'conditions', code, path, message: code };
}

/** `cfg` with the stub context's `occ` choice as its Occasion_Source, so steps 2–5 report nothing. */
const withOcc: CollectionSelectConfig = { ...cfg, occasionFrom: 'occ' };

/**
 * Stub context: `checkText` reports blank text, so the paths of the calls are visible. The manifest
 * holds only the `occ` choice node (options `birthday` and `wedding`), which `isUpstream` accepts.
 */
function ctx(nodePath: string): GraphCtx {
  const occ = {
    id: 'occ',
    type: 'choice',
    config: { prompt: 'Occasion?', options: [{ id: 'birthday', label: 'Birthday' }, { id: 'wedding', label: 'Wedding' }] },
    edges: [],
  };
  return {
    manifest: { nodes: [occ] } as unknown as Manifest,
    nodePath,
    variables: new Map(),
    checkEffect: (_effect: Effect, _path: string) => [],
    checkHttpsUrl: (_url: string, _path: string) => [],
    checkText: (text: string, path: string) => (text.trim() === '' ? [diag('blank-text', path)] : []),
    isUpstream: () => true,
  };
}

function state(answers: AttemptState['answers'] = {}): AttemptState {
  return {
    activityId: 'shop-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId: 'pick',
    vars: {},
    answers,
    nodeState: {},
    path: [{ nodeId: 'pick', at: 0 }],
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

/** JSON Pointer of the `collectionSelect` config in the base manifest. */
const CFG = '/nodes/1/config';

/**
 * Valid base, passing every stage: occ (choice) → pick (collectionSelect, occasionFrom occ) →
 * done (outcome). Every occasion value has a bundle that meets the Selection_Rules.
 */
function base(): Draft {
  return {
    schemaVersion: 1,
    profile: 'shop-challenge',
    activityId: 'shop-select-limits',
    version: 1,
    requires: { choice: 1, collectionSelect: 1, outcome: 1 },
    entryNodeId: 'occ',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      {
        id: 'occ',
        type: 'choice',
        config: {
          prompt: 'What is the occasion?',
          options: [
            { id: 'birthday', label: 'Birthday' },
            { id: 'wedding', label: 'Wedding' },
          ],
        },
        edges: [{ to: 'pick' }],
      },
      { id: 'pick', type: 'collectionSelect', config: { ...structuredClone(cfg), occasionFrom: 'occ' }, edges: [{ to: 'done' }] },
      { id: 'done', type: 'outcome', config: { title: 'Thanks', body: 'Your bundle is ready.' }, edges: [] },
    ],
    theme: 'default',
  };
}

/** The base manifest after `edit` of the manifest and of the `collectionSelect` config. */
function build(edit: (c: Draft, m: Draft) => void = () => {}): Draft {
  const m = base();
  edit(m.nodes[1].config as Draft, m);
  return m;
}

/** A string of `n` code units that matches `NODE_ID_PATTERN` when `1 <= n <= 64`. */
function id(n: number): string {
  return n === 0 ? '' : 'i' + 'a'.repeat(n - 1);
}

/** Renames the Occasion_Source node and points `entryNodeId` and `occasionFrom` at it. */
function renameOcc(c: Draft, m: Draft, newId: string): void {
  m.nodes[0].id = newId;
  m.entryNodeId = newId;
  c.occasionFrom = newId;
}

/** `n` Items without occasions, each of price 1. */
function items(n: number): Draft[] {
  return Array.from({ length: n }, (_, i) => ({ id: `item${i}`, name: `Item ${i}`, price: 1, tags: [] }));
}

type Row = [Stage, DiagnosticCode, 'error' | 'warning', string];

function rows(result: ValidationResult): Row[] {
  return result.diagnostics.map((d) => [d.stage, d.code, d.severity, d.path]);
}

function validate(m: unknown): ValidationResult {
  return validateManifest(m, shopProfile);
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

describe('collectionSelect descriptor', () => {
  it('has type collectionSelect, version 1 and is not terminal', () => {
    expect(collectionSelectNodeType.type).toBe('collectionSelect');
    expect(collectionSelectNodeType.version).toBe(1);
    expect(collectionSelectNodeType.terminal).toBe(false);
  });

  it('answerType is a set of the Item IDs in config order', () => {
    expect(collectionSelectNodeType.answerType(cfg)).toEqual({ kind: 'set', values: ['mug', 'candle', 'card'] });
  });

  it('SELECT_LIMITS match design C7', () => {
    expect(SELECT_LIMITS).toEqual({
      maxItems: 24,
      maxPrice: 100_000_000,
      maxBudget: 1_000_000_000,
      maxPick: 24,
      maxTags: 8,
      maxOccasionsPerItem: 8,
    });
  });
});

// ---------------------------------------------------------------------------
// Config schema limits (precompiled validateManifest)
// ---------------------------------------------------------------------------

describe('collectionSelect config schema limits', () => {
  it('the base manifest passes every stage', () => {
    expectPass(base());
  });

  // [bound, edit inside the bound, edit just outside it, path of the schema diagnostic]
  it.each<[string, Edit, Edit, string]>([
    ['prompt ≤ 500', (c) => (c.prompt = 'p'.repeat(500)), (c) => (c.prompt = 'p'.repeat(501)), `${CFG}/prompt`],
    ['Item id ≤ 64', (c) => (c.items[0].id = id(64)), (c) => (c.items[0].id = id(65)), `${CFG}/items/0/id`],
    ['Item id ≥ 1', (c) => (c.items[0].id = id(1)), (c) => (c.items[0].id = id(0)), `${CFG}/items/0/id`],
    ['occasionFrom ≤ 64', (c, m) => renameOcc(c, m, id(64)), (c) => (c.occasionFrom = id(65)), `${CFG}/occasionFrom`],
    ['occasionFrom ≥ 1', (c, m) => renameOcc(c, m, id(1)), (c) => (c.occasionFrom = id(0)), `${CFG}/occasionFrom`],
    [
      'occasions entry ≤ 64',
      (c, m) => {
        m.nodes[0].config.options[0].id = id(64);
        c.items[1].occasions = [id(64)];
      },
      (c) => (c.items[1].occasions = [id(65)]),
      `${CFG}/items/1/occasions/0`,
    ],
    [
      'occasions entry ≥ 1',
      (c, m) => {
        m.nodes[0].config.options[0].id = id(1);
        c.items[1].occasions = [id(1)];
      },
      (c) => (c.items[1].occasions = [id(0)]),
      `${CFG}/items/1/occasions/0`,
    ],
    [
      `occasions ≤ ${SELECT_LIMITS.maxOccasionsPerItem} entries`,
      (c, m) => {
        const ids = Array.from({ length: 8 }, (_, i) => `occ${i}`);
        m.nodes[0].config.options = ids.map((o) => ({ id: o, label: `Occasion ${o}` }));
        c.items[1].occasions = ids;
      },
      (c) => (c.items[1].occasions = Array.from({ length: 9 }, () => 'birthday')),
      `${CFG}/items/1/occasions`,
    ],
    ['occasions ≥ 1 entry', (c) => (c.items[1].occasions = ['birthday']), (c) => (c.items[1].occasions = []), `${CFG}/items/1/occasions`],
    ['Item name ≤ 80', (c) => (c.items[0].name = 'n'.repeat(80)), (c) => (c.items[0].name = 'n'.repeat(81)), `${CFG}/items/0/name`],
    ['tags entry ≤ 32', (c) => (c.items[0].tags = ['t'.repeat(32)]), (c) => (c.items[0].tags = ['t'.repeat(33)]), `${CFG}/items/0/tags/0`],
    ['tags entry ≥ 1', (c) => (c.items[0].tags = ['t']), (c) => (c.items[0].tags = ['']), `${CFG}/items/0/tags/0`],
    [
      `tags ≤ ${SELECT_LIMITS.maxTags} entries`,
      (c) => (c.items[0].tags = Array.from({ length: 8 }, (_, i) => `t${i}`)),
      (c) => (c.items[0].tags = Array.from({ length: 9 }, (_, i) => `t${i}`)),
      `${CFG}/items/0/tags`,
    ],
    ['emoji ≤ 16', (c) => (c.items[0].emoji = 'e'.repeat(16)), (c) => (c.items[0].emoji = 'e'.repeat(17)), `${CFG}/items/0/emoji`],
    ['emoji ≥ 1', (c) => (c.items[0].emoji = 'e'), (c) => (c.items[0].emoji = ''), `${CFG}/items/0/emoji`],
    ['currency lower case', (c) => (c.currency = 'EUR'), (c) => (c.currency = 'usd'), `${CFG}/currency`],
    ['currency 2 letters', (c) => (c.currency = 'NGN'), (c) => (c.currency = 'US'), `${CFG}/currency`],
    ['currency 4 letters', (c) => (c.currency = 'GBP'), (c) => (c.currency = 'USDX'), `${CFG}/currency`],
    ['pricesAsOf YYYY-MM-DD', (c) => (c.pricesAsOf = '2026-11-21'), (c) => (c.pricesAsOf = '2026-11-1'), `${CFG}/pricesAsOf`],
    ['pricesAsOf order', (c) => (c.pricesAsOf = '2026-01-31'), (c) => (c.pricesAsOf = '31-01-2026'), `${CFG}/pricesAsOf`],
    ['continueLabel ≤ 40', (c) => (c.continueLabel = 'l'.repeat(40)), (c) => (c.continueLabel = 'l'.repeat(41)), `${CFG}/continueLabel`],
    ['price ≥ 0', (c) => (c.items[0].price = 0), (c) => (c.items[0].price = -1), `${CFG}/items/0/price`],
    [
      `price ≤ ${SELECT_LIMITS.maxPrice}`,
      (c) => (c.items[0].price = SELECT_LIMITS.maxPrice),
      (c) => (c.items[0].price = SELECT_LIMITS.maxPrice + 1),
      `${CFG}/items/0/price`,
    ],
    ['price integer', (c) => (c.items[0].price = 12), (c) => (c.items[0].price = 12.5), `${CFG}/items/0/price`],
    [
      'budget ≥ 1',
      (c) => {
        c.budget = 1;
        c.items[2].price = 0;
      },
      (c) => (c.budget = 0),
      `${CFG}/budget`,
    ],
    [
      `budget ≤ ${SELECT_LIMITS.maxBudget}`,
      (c) => (c.budget = SELECT_LIMITS.maxBudget),
      (c) => (c.budget = SELECT_LIMITS.maxBudget + 1),
      `${CFG}/budget`,
    ],
    ['min ≥ 1', (c) => (c.min = 1), (c) => (c.min = 0), `${CFG}/min`],
    [
      `min ≤ ${SELECT_LIMITS.maxPick}`,
      (c) => Object.assign(c, { items: items(24), min: 24, max: 24 }),
      (c) => Object.assign(c, { items: items(24), min: 25, max: 24 }),
      `${CFG}/min`,
    ],
    ['max ≥ 1', (c) => (c.max = 1), (c) => (c.max = 0), `${CFG}/max`],
    [
      `max ≤ ${SELECT_LIMITS.maxPick}`,
      (c) => Object.assign(c, { items: items(24), max: 24 }),
      (c) => Object.assign(c, { items: items(24), max: 25 }),
      `${CFG}/max`,
    ],
    ['items ≥ 1', (c) => (c.items = items(1)), (c) => (c.items = []), `${CFG}/items`],
    [
      `items ≤ ${SELECT_LIMITS.maxItems}`,
      (c) => (c.items = items(SELECT_LIMITS.maxItems)),
      (c) => (c.items = items(SELECT_LIMITS.maxItems + 1)),
      `${CFG}/items`,
    ],
  ])('%s: inside passes, outside fails the schema', (_bound, inside, outside, path) => {
    expectPass(build(inside));
    expectSchemaFail(build(outside), path);
  });

  it('rejects an extra key in the config', () => {
    expectSchemaFail(build((c) => (c.extra = 1)), CFG);
  });

  it('rejects an extra key in an Item', () => {
    expectSchemaFail(build((c) => (c.items[0].extra = 1)), `${CFG}/items/0`);
  });
});

// ---------------------------------------------------------------------------
// Response schema limits (precompiled response_collectionSelect)
// ---------------------------------------------------------------------------

describe('response_collectionSelect', () => {
  it('accepts an empty itemIds list and rejects a missing one', () => {
    expect(response_collectionSelect({ itemIds: [] })).toBe(true);
    expect(response_collectionSelect({})).toBe(false);
  });

  it('itemIds entries: 64 code units pass and 65 fail', () => {
    expect(response_collectionSelect({ itemIds: ['x'.repeat(64)] })).toBe(true);
    expect(response_collectionSelect({ itemIds: ['x'.repeat(65)] })).toBe(false);
  });

  it(`itemIds: ${SELECT_LIMITS.maxPick} entries pass and ${SELECT_LIMITS.maxPick + 1} fail`, () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `item${i}`);
    expect(response_collectionSelect({ itemIds: ids(SELECT_LIMITS.maxPick) })).toBe(true);
    expect(response_collectionSelect({ itemIds: ids(SELECT_LIMITS.maxPick + 1) })).toBe(false);
  });

  it('rejects a non-string entry', () => {
    expect(response_collectionSelect({ itemIds: [1] })).toBe(false);
  });

  it('rejects an extra key in the response', () => {
    expect(response_collectionSelect({ itemIds: ['mug'], extra: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate (step 1) and reduce
// ---------------------------------------------------------------------------

describe('collectionSelect validate', () => {
  it('reports no diagnostic for non-blank prompt and Item names', () => {
    expect(collectionSelectNodeType.validate(withOcc, ctx('/nodes/1'))).toEqual([]);
  });

  it('reports blank-text at the prompt and at each blank Item name', () => {
    const blank: CollectionSelectConfig = {
      ...withOcc,
      prompt: '  ',
      items: [cfg.items[0]!, { ...cfg.items[1]!, name: '' }, cfg.items[2]!],
    };
    const paths = collectionSelectNodeType.validate(blank, ctx('/nodes/1')).map((d) => `${d.code} ${d.path}`);
    expect(paths).toEqual(['blank-text /nodes/1/config/prompt', 'blank-text /nodes/1/config/items/1/name']);
  });

  it('validateManifest reports conditions/blank-text at a blank prompt', () => {
    const result = validate(build((c) => (c.prompt = '   ')));
    expect(rows(result)).toEqual([['conditions', 'blank-text', 'error', `${CFG}/prompt`]]);
    expect(result.ok).toBe(false);
  });

  it('validateManifest reports conditions/blank-text at a blank Item name', () => {
    const result = validate(build((c) => (c.items[1].name = '')));
    expect(rows(result)).toEqual([['conditions', 'blank-text', 'error', `${CFG}/items/1/name`]]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate steps 2–5 (graph checks) through validateManifest
// ---------------------------------------------------------------------------

type Full = [Stage, DiagnosticCode, 'error' | 'warning', string, string | undefined, string];

function full(result: ValidationResult): Full[] {
  return result.diagnostics.map((d) => [d.stage, d.code, d.severity, d.path, d.nodeId, d.message]);
}

/** `validateManifest` fails with exactly the `conditions` diagnostics `[code, path, message]` of node `pick`, in order. */
function expectConditions(m: Draft, expected: [DiagnosticCode, string, string][]): void {
  const result = validate(m);
  expect(full(result)).toEqual(expected.map(([code, path, message]) => ['conditions', code, 'error', path, 'pick', message]));
  expect(result.ok).toBe(false);
}

/** Removes the Occasion_Source link: no `occasionFrom` and no `occasions` lists. */
function noOccasion(c: Draft): void {
  delete c.occasionFrom;
  for (const item of c.items) delete item.occasions;
}

/** Makes node `occ` a `content` node. */
function occAsContent(m: Draft): void {
  m.nodes[0] = { id: 'occ', type: 'content', config: { body: 'Welcome' }, edges: [{ to: 'pick' }] };
  m.requires = { content: 1, collectionSelect: 1, outcome: 1 };
}

describe('collectionSelect validate graph checks', () => {
  it('duplicate-item-id at the second Item with a repeated ID', () => {
    expectConditions(build((c) => (c.items[1].id = 'mug')), [
      ['duplicate-item-id', `${CFG}/items/1`, 'Item ID "mug" is used more than once in this product list.'],
    ]);
  });

  it('dangling-ref at occasionFrom when it names no node', () => {
    expectConditions(build((c) => (c.occasionFrom = 'nowhere')), [
      ['dangling-ref', `${CFG}/occasionFrom`, 'occasionFrom names node "nowhere", which does not exist.'],
    ]);
  });

  it('type-mismatch at occasionFrom when it names a content node', () => {
    expectConditions(build((_c, m) => occAsContent(m)), [
      ['type-mismatch', `${CFG}/occasionFrom`, 'occasionFrom names node "occ" of type "content"; it must name a choice node.'],
    ]);
  });

  it('answer-not-upstream at occasionFrom when the choice comes after the node', () => {
    const m = build((_c, m) => {
      m.entryNodeId = 'pick';
      m.nodes[0].edges = [{ to: 'done' }];
      m.nodes[1].edges = [{ to: 'occ' }];
    });
    expectConditions(m, [
      [
        'answer-not-upstream',
        `${CFG}/occasionFrom`,
        'occasionFrom names node "occ", which is not on every path from entryNodeId to this node.',
      ],
    ]);
  });

  it('dangling-ref at an occasions entry that is not an option of the Occasion_Source', () => {
    const path = `${CFG}/items/1/occasions/0`;
    expectConditions(build((c) => (c.items[1].occasions = ['nope'])), [
      ['dangling-ref', path, `The occasions entry "nope" at ${path} is not an option ID of occasion node "occ".`],
    ]);
  });

  it('dangling-ref at an occasions entry when the config has no occasionFrom', () => {
    const path = `${CFG}/items/1/occasions/0`;
    expectConditions(build((c) => delete c.occasionFrom), [
      ['dangling-ref', path, `The occasions entry "birthday" at ${path} needs occasionFrom, which this config does not set.`],
    ]);
  });

  it.each<[string, Edit]>([
    ['dangling-ref', (c) => (c.occasionFrom = 'nowhere')],
    ['type-mismatch', (_c, m) => occAsContent(m)],
  ])('after %s on occasionFrom, no occasion or satisfiability diagnostic follows', (code, edit) => {
    const result = validate(
      build((c, m) => {
        edit(c, m);
        c.items[0].occasions = ['nope'];
        Object.assign(c, { min: 3, max: 2 });
      }),
    );
    expect(rows(result)).toEqual([['conditions', code, 'error', `${CFG}/occasionFrom`]]);
  });

  it('select-unsatisfiable, min above max: one per occasion value', () => {
    expectConditions(build((c) => Object.assign(c, { min: 3, max: 2 })), [
      ['select-unsatisfiable', CFG, 'No bundle can meet the rules for occasion "birthday": min (3) is greater than max (2).'],
      ['select-unsatisfiable', CFG, 'No bundle can meet the rules for occasion "wedding": min (3) is greater than max (2).'],
    ]);
  });

  it('select-unsatisfiable, min above max, without an occasion', () => {
    expectConditions(
      build((c) => {
        noOccasion(c);
        Object.assign(c, { min: 3, max: 2 });
      }),
      [['select-unsatisfiable', CFG, 'No bundle can meet the rules: min (3) is greater than max (2).']],
    );
  });

  it('select-unsatisfiable, too few offered for one occasion', () => {
    // birthday offers mug, candle and card; wedding offers mug and card.
    expectConditions(build((c) => Object.assign(c, { min: 3, max: 3 })), [
      ['select-unsatisfiable', CFG, 'No bundle can meet the rules for occasion "wedding": only 2 items are offered and min is 3.'],
    ]);
  });

  it('select-unsatisfiable, too few offered, without an occasion', () => {
    expectConditions(
      build((c) => {
        noOccasion(c);
        Object.assign(c, { min: 4, max: 4 });
      }),
      [['select-unsatisfiable', CFG, 'No bundle can meet the rules: only 3 items are offered and min is 4.']],
    );
  });

  it('select-unsatisfiable, cheapest offered items over budget for one occasion', () => {
    // birthday: card 3 + candle 9 = 12 fits; wedding: card 3 + mug 12 = 15 does not.
    expectConditions(build((c) => Object.assign(c, { min: 2, budget: 12 })), [
      [
        'select-unsatisfiable',
        CFG,
        'No bundle can meet the rules for occasion "wedding": the 2 cheapest offered items cost 15 USD, over the budget of 12 USD.',
      ],
    ]);
  });

  it('select-unsatisfiable, cheapest offered items over budget, without an occasion', () => {
    expectConditions(
      build((c) => {
        noOccasion(c);
        Object.assign(c, { min: 2, budget: 11 });
      }),
      [['select-unsatisfiable', CFG, 'No bundle can meet the rules: the 2 cheapest offered items cost 12 USD, over the budget of 11 USD.']],
    );
  });
});

describe('collectionSelect reduce', () => {
  it('stores the picked IDs in config order and the Offered_Items node state', () => {
    const s = state();
    const next = collectionSelectNodeType.reduce(cfg, s, { itemIds: ['card', 'mug'] }, env());
    expect(next.answers['pick']).toEqual(['mug', 'card']);
    expect(next.nodeState['pick']).toEqual({
      occasion: null,
      currency: 'USD',
      items: [
        { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' },
        { id: 'candle', name: 'Candle', price: 9, tags: ['home'] },
        { id: 'card', name: 'Card', price: 3, tags: [] },
      ],
    });
    expect(s.answers).toEqual({});
    expect(s.nodeState).toEqual({});
  });

  it('offers only the Items for the occasion answered upstream', () => {
    const withOccasion: CollectionSelectConfig = { ...cfg, occasionFrom: 'occ' };
    const next = collectionSelectNodeType.reduce(withOccasion, state({ occ: 'wedding' }), { itemIds: ['mug'] }, env());
    expect(next.nodeState['pick']).toEqual({
      occasion: 'wedding',
      currency: 'USD',
      items: [
        { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' },
        { id: 'card', name: 'Card', price: 3, tags: [] },
      ],
    });
  });
});
