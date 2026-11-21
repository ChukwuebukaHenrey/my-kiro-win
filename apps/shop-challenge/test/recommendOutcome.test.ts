// Example tests for the `recommendOutcome` node type (design C8, Data Models, Testing Strategy
// "Example tests"): descriptor fields, `answerType`, schema limits at both sides of each bound with
// the precompiled validators, closed objects, each `validate` diagnostic and its path, the import
// rule of Requirement 7.12, and `reduce` and `enter`. The Wiring_Hook wrote the first `validate`,
// `reduce` and `enter` tests; task 8.3 completed the file. These tests are evidence for the cases
// listed, not a proof of correctness.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkHttpsUrl,
  validateManifest,
  type Diagnostic,
  type DiagnosticCode,
  type Effect,
  type GraphCtx,
  type Manifest,
  type Stage,
  type ValidationResult,
} from '@dreame/schema';
import { createRng, type AttemptState, type Env, type JsonValue } from '@dreame/runtime';
import { recommendOutcomeNodeType, type RecommendOutcomeConfig } from '../src/node-types/recommendOutcome.ts';
import { SELECT_LIMITS } from '../src/node-types/collectionSelect.ts';
import { shopProfile } from '../src/profile.ts';
import { response_recommendOutcome } from '../generated/shop-challenge.validators.js';

const cfg: RecommendOutcomeConfig = {
  title: 'Your bundle',
  body: 'Here is what you picked.',
  from: 'pick',
  recommend: { sortBy: 'priceAsc', limit: 2 },
  contacts: [
    { label: 'WhatsApp', url: 'https://wa.me/12125550142' },
    { label: 'Telegram', url: 'https://t.me/dreame_demo_shop' },
  ],
};

const NODE = '/nodes/2';

function diag(code: DiagnosticCode, path: string): Diagnostic {
  return { severity: 'error', stage: 'conditions', code, path, message: code };
}

/**
 * Stub context: `checkText` reports blank text and `checkHttpsUrl` reports any URL that does not
 * start with `https://`, so the paths of the calls are visible. The manifest holds the `pick`
 * collectionSelect node and the `intro` content node.
 */
function ctx(upstream = true): GraphCtx {
  const nodes = [
    { id: 'intro', type: 'content', config: { title: 'Hi', body: 'Welcome' }, edges: [] },
    { id: 'pick', type: 'collectionSelect', config: {}, edges: [] },
  ];
  return {
    manifest: { nodes } as unknown as Manifest,
    nodePath: NODE,
    variables: new Map(),
    checkEffect: (_effect: Effect, _path: string) => [],
    checkHttpsUrl: (url: string, path: string) => (url.startsWith('https://') ? [] : [diag('unsafe-url', path)]),
    checkText: (text: string, path: string) => (text.trim() === '' ? [diag('blank-text', path)] : []),
    isUpstream: () => upstream,
  };
}

function state(answers: AttemptState['answers'] = {}, nodeState: AttemptState['nodeState'] = {}): AttemptState {
  return {
    activityId: 'shop-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'finished',
    currentNodeId: 'result',
    vars: {},
    answers,
    nodeState,
    path: [{ nodeId: 'result', at: 0 }],
    transitions: 1,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

const pickState: JsonValue = {
  occasion: null,
  currency: 'USD',
  items: [
    { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' },
    { id: 'candle', name: 'Candle', price: 9, tags: ['home'] },
    { id: 'card', name: 'Card', price: 3, tags: [] },
    { id: 'tea', name: 'Tea', price: 5, tags: ['kitchen'] },
  ],
};

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/** A manifest under construction: plain JSON that a test edits before validation. */
type Draft = Record<string, any>;

/** JSON Pointer of the `recommendOutcome` config in the base manifest. */
const CFG = `${NODE}/config`;

/**
 * Valid base, passing every stage: occ (choice) → pick (collectionSelect, occasionFrom occ) →
 * result (recommendOutcome, from pick). The `collectionSelect` config is Satisfiable for both
 * occasion values (birthday offers mug, candle, card; wedding offers mug, card; budget 30, min 1).
 */
function base(): Draft {
  return {
    schemaVersion: 1,
    profile: 'shop-challenge',
    activityId: 'shop-result-limits',
    version: 1,
    requires: { choice: 1, collectionSelect: 1, recommendOutcome: 1 },
    entryNodeId: 'occ',
    fallbackOutcomeId: 'result',
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
      {
        id: 'pick',
        type: 'collectionSelect',
        config: {
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
          occasionFrom: 'occ',
        },
        edges: [{ to: 'result' }],
      },
      { id: 'result', type: 'recommendOutcome', config: structuredClone(cfg), edges: [] },
    ],
    theme: 'default',
  };
}

type Edit = (c: Draft, m: Draft) => void;

/** The base manifest after `edit` of the `recommendOutcome` config and of the manifest. */
function build(edit: Edit = () => {}): Draft {
  const m = base();
  edit(m.nodes[2].config as Draft, m);
  return m;
}

/** A string of `n` code units that matches `NODE_ID_PATTERN` when `1 <= n <= 64`. */
function id(n: number): string {
  return n === 0 ? '' : 'i' + 'a'.repeat(n - 1);
}

/** Renames the `collectionSelect` node and points the edge into it and `from` at it. */
function renamePick(c: Draft, m: Draft, newId: string): void {
  m.nodes[1].id = newId;
  m.nodes[0].edges = [{ to: newId }];
  c.from = newId;
}

/** An https URL of exactly `n` code units (`n >= 20`). */
function urlOf(n: number): string {
  const prefix = 'https://example.com/';
  return prefix + 'a'.repeat(n - prefix.length);
}

/** Sets `recommend.where` on the config. */
function where(c: Draft, clauses: Draft[]): void {
  c.recommend = { sortBy: 'priceAsc', limit: 2, where: clauses };
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

type Full = [Stage, DiagnosticCode, 'error' | 'warning', string, string | undefined, string];

/** `validateManifest` fails with exactly one `conditions` error of node `result`: `[code, path, message]`. */
function expectCondition(m: Draft, code: DiagnosticCode, path: string, message: string): void {
  const result = validate(m);
  const full: Full[] = result.diagnostics.map((d) => [d.stage, d.code, d.severity, d.path, d.nodeId, d.message]);
  expect(full).toEqual([['conditions', code, 'error', path, 'result', message]]);
  expect(result.ok).toBe(false);
}

// ---------------------------------------------------------------------------
// Descriptor and answer type
// ---------------------------------------------------------------------------

describe('recommendOutcome descriptor', () => {
  it('has type recommendOutcome, version 1 and is terminal', () => {
    expect(recommendOutcomeNodeType.type).toBe('recommendOutcome');
    expect(recommendOutcomeNodeType.version).toBe(1);
    expect(recommendOutcomeNodeType.terminal).toBe(true);
  });

  it('answerType returns null', () => {
    expect(recommendOutcomeNodeType.answerType(cfg)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Config schema limits (precompiled validateManifest)
// ---------------------------------------------------------------------------

describe('recommendOutcome config schema limits', () => {
  it('the base manifest passes every stage, with the wa.me and t.me Contact_Links', () => {
    const m = base();
    expect(m.nodes[2].config.contacts.map((x: Draft) => x.url)).toEqual([
      'https://wa.me/12125550142',
      'https://t.me/dreame_demo_shop',
    ]);
    expectPass(m);
  });

  it('passes without recommend, whyText and contacts, and with an empty contacts list', () => {
    expectPass(
      build((c) => {
        delete c.recommend;
        delete c.contacts;
      }),
    );
    expectPass(build((c) => (c.contacts = [])));
  });

  it('passes with an empty where list', () => {
    expectPass(build((c) => where(c, [])));
  });

  const W = `${CFG}/recommend/where`;
  const tags = (value: unknown) => ({ op: 'includes', field: 'tags', value });
  const price = (op: string, value: unknown) => ({ op, field: 'price', value });

  // [bound, edit inside the bound, edit just outside it, path of the schema diagnostic]
  it.each<[string, Edit, Edit, string]>([
    ['title ≤ 120', (c) => (c.title = 't'.repeat(120)), (c) => (c.title = 't'.repeat(121)), `${CFG}/title`],
    ['body ≤ 2000', (c) => (c.body = 'b'.repeat(2000)), (c) => (c.body = 'b'.repeat(2001)), `${CFG}/body`],
    ['whyText ≤ 300', (c) => (c.whyText = 'w'.repeat(300)), (c) => (c.whyText = 'w'.repeat(301)), `${CFG}/whyText`],
    ['from ≤ 64', (c, m) => renamePick(c, m, id(64)), (c) => (c.from = id(65)), `${CFG}/from`],
    ['from ≥ 1', (c, m) => renamePick(c, m, id(1)), (c) => (c.from = id(0)), `${CFG}/from`],
    [
      'where ≤ 4 clauses',
      (c) => where(c, [tags('kitchen'), price('lte', 20), price('gte', 0), tags('home')]),
      (c) => where(c, [tags('kitchen'), price('lte', 20), price('gte', 0), tags('home'), tags('x')]),
      W,
    ],
    ['includes value ≤ 32', (c) => where(c, [tags('t'.repeat(32))]), (c) => where(c, [tags('t'.repeat(33))]), `${W}/0`],
    ['includes value ≥ 1', (c) => where(c, [tags('t')]), (c) => where(c, [tags('')]), `${W}/0`],
    ['includes value string', (c) => where(c, [tags('home')]), (c) => where(c, [tags(5)]), `${W}/0`],
    ['lte value ≥ 0', (c) => where(c, [price('lte', 0)]), (c) => where(c, [price('lte', -1)]), `${W}/0`],
    [
      `gte value ≤ ${SELECT_LIMITS.maxPrice}`,
      (c) => where(c, [price('gte', SELECT_LIMITS.maxPrice)]),
      (c) => where(c, [price('gte', SELECT_LIMITS.maxPrice + 1)]),
      `${W}/0`,
    ],
    ['price value integer', (c) => where(c, [price('lte', 5)]), (c) => where(c, [price('lte', 5.5)]), `${W}/0`],
    ['includes only on tags', (c) => where(c, [tags('home')]), (c) => where(c, [{ op: 'includes', field: 'name', value: 'x' }]), `${W}/0`],
    ['lte only on price', (c) => where(c, [price('lte', 5)]), (c) => where(c, [{ op: 'lte', field: 'tags', value: 5 }]), `${W}/0`],
    [
      'sortBy priceAsc or priceDesc',
      (c) => (c.recommend = { sortBy: 'priceDesc', limit: 2 }),
      (c) => (c.recommend = { sortBy: 'name', limit: 2 }),
      `${CFG}/recommend/sortBy`,
    ],
    ['limit ≥ 1', (c) => (c.recommend.limit = 1), (c) => (c.recommend.limit = 0), `${CFG}/recommend/limit`],
    ['limit ≤ 8', (c) => (c.recommend.limit = 8), (c) => (c.recommend.limit = 9), `${CFG}/recommend/limit`],
    ['limit integer', (c) => (c.recommend.limit = 3), (c) => (c.recommend.limit = 2.5), `${CFG}/recommend/limit`],
    [
      'contacts ≤ 3 entries',
      (c) => (c.contacts = [1, 2, 3].map((i) => ({ label: `Shop ${i}`, url: `https://example.com/${i}` }))),
      (c) => (c.contacts = [1, 2, 3, 4].map((i) => ({ label: `Shop ${i}`, url: `https://example.com/${i}` }))),
      `${CFG}/contacts`,
    ],
    ['contact label ≤ 60', (c) => (c.contacts[0].label = 'l'.repeat(60)), (c) => (c.contacts[0].label = 'l'.repeat(61)), `${CFG}/contacts/0/label`],
    ['contact url ≤ 2048', (c) => (c.contacts[0].url = urlOf(2048)), (c) => (c.contacts[0].url = urlOf(2049)), `${CFG}/contacts/0/url`],
    [
      'contact url starts with https://',
      (c) => (c.contacts[0].url = 'https://example.com/shop'),
      (c) => (c.contacts[0].url = 'http://example.com/shop'),
      `${CFG}/contacts/0/url`,
    ],
  ])('%s: inside passes, outside fails the schema', (_bound, inside, outside, path) => {
    expectPass(build(inside));
    expectSchemaFail(build(outside), path);
  });

  it('rejects a where clause with eq', () => {
    expectSchemaFail(build((c) => where(c, [price('eq', 5)])), `${W}/0`);
    expectSchemaFail(build((c) => where(c, [{ op: 'eq', field: 'tags', value: 'home' }])), `${W}/0`);
  });

  it('rejects a contacts list of 4 entries', () => {
    expectSchemaFail(
      build((c) => {
        c.contacts.push({ label: 'Site', url: 'https://example.com/shop' }, { label: 'Help', url: 'https://example.com/help' });
        expect(c.contacts).toHaveLength(4);
      }),
      `${CFG}/contacts`,
    );
  });

  it.each<[string, Edit, string]>([
    ['config', (c) => (c.extra = 1), CFG],
    ['recommend', (c) => (c.recommend.extra = 1), `${CFG}/recommend`],
    ['where clause', (c) => where(c, [{ ...tags('home'), extra: 1 }]), `${W}/0`],
    ['Contact_Link', (c) => (c.contacts[0].extra = 1), `${CFG}/contacts/0`],
  ])('rejects an extra key in the %s', (_where, edit, path) => {
    expectSchemaFail(build(edit), path);
  });
});

// ---------------------------------------------------------------------------
// Response schema (precompiled response_recommendOutcome)
// ---------------------------------------------------------------------------

describe('response_recommendOutcome', () => {
  it('accepts the empty object', () => {
    expect(response_recommendOutcome({})).toBe(true);
  });

  it('rejects an extra key', () => {
    expect(response_recommendOutcome({ extra: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate (stub context)
// ---------------------------------------------------------------------------

describe('recommendOutcomeNodeType.validate', () => {
  it('reports nothing for a valid config', () => {
    expect(recommendOutcomeNodeType.validate(cfg, ctx())).toEqual([]);
  });

  it('checks the title and each Contact_Link URL at its own path', () => {
    const bad: RecommendOutcomeConfig = {
      ...cfg,
      title: '  ',
      contacts: [{ label: 'Shop', url: 'http://wa.me/1' }, { label: 'OK', url: 'https://t.me/x' }],
    };
    expect(recommendOutcomeNodeType.validate(bad, ctx()).map((d) => [d.code, d.path])).toEqual([
      ['blank-text', `${NODE}/config/title`],
      ['unsafe-url', `${NODE}/config/contacts/0/url`],
    ]);
  });

  it('reports dangling-ref, type-mismatch and answer-not-upstream at /config/from', () => {
    const codes = (c: RecommendOutcomeConfig, upstream = true) =>
      recommendOutcomeNodeType.validate(c, ctx(upstream)).map((d) => [d.code, d.path, d.stage, d.severity]);
    const path = `${NODE}/config/from`;
    expect(codes({ ...cfg, from: 'missing' })).toEqual([['dangling-ref', path, 'conditions', 'error']]);
    expect(codes({ ...cfg, from: 'intro' })).toEqual([['type-mismatch', path, 'conditions', 'error']]);
    expect(codes(cfg, false)).toEqual([['answer-not-upstream', path, 'conditions', 'error']]);
  });

  it('with the shared checkHttpsUrl, an http: URL in the first Contact_Link gives conditions/unsafe-url', () => {
    const real: GraphCtx = { ...ctx(), checkHttpsUrl };
    const http: RecommendOutcomeConfig = { ...cfg, contacts: [{ label: 'Shop', url: 'http://wa.me/12125550142' }, cfg.contacts![1]!] };
    expect(recommendOutcomeNodeType.validate(http, real).map((d) => [d.stage, d.code, d.severity, d.path])).toEqual([
      ['conditions', 'unsafe-url', 'error', `${NODE}/config/contacts/0/url`],
    ]);
    expect(recommendOutcomeNodeType.validate(cfg, real)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validate through validateManifest
// ---------------------------------------------------------------------------

describe('recommendOutcome validate through validateManifest', () => {
  const FROM = `${CFG}/from`;

  it('dangling-ref at /config/from when from names no node', () => {
    expectCondition(build((c) => (c.from = 'nowhere')), 'dangling-ref', FROM, 'from names node "nowhere", which does not exist.');
  });

  it('type-mismatch at /config/from when from names a choice node', () => {
    expectCondition(
      build((c) => (c.from = 'occ')),
      'type-mismatch',
      FROM,
      'from names node "occ" of type "choice"; it must name a collectionSelect node.',
    );
  });

  it('answer-not-upstream at /config/from when a path to the result skips the collectionSelect node', () => {
    const m = build((_c, m) => {
      m.nodes[0].edges = [{ to: 'result', when: { op: 'eq', ref: { answer: 'occ' }, value: 'wedding' } }, { to: 'pick' }];
    });
    expectCondition(
      m,
      'answer-not-upstream',
      FROM,
      'from names node "pick", which is not on every path from entryNodeId to this node.',
    );
  });

  it('conditions/blank-text at a blank title', () => {
    expectCondition(build((c) => (c.title = '   ')), 'blank-text', `${CFG}/title`, `The text at ${CFG}/title is empty or only whitespace.`);
  });

  it('an http: URL in the first Contact_Link fails the schema pattern at /config/contacts/0/url before the conditions stage', () => {
    expectSchemaFail(build((c) => (c.contacts[0].url = 'http://wa.me/12125550142')), `${CFG}/contacts/0/url`);
  });

  it('conditions/unsafe-url at /config/contacts/0/url for an https URL that is not a Safe_Url', () => {
    const result = validate(build((c) => (c.contacts[0].url = 'https://bit.ly/shop')));
    expect(rows(result)).toEqual([['conditions', 'unsafe-url', 'error', `${CFG}/contacts/0/url`]]);
    expect(result.diagnostics[0]?.nodeId).toBe('result');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Import rule (Requirement 7.12)
// ---------------------------------------------------------------------------

describe('recommendOutcome.ts imports', () => {
  const file = fileURLToPath(new URL('../src/node-types/recommendOutcome.ts', import.meta.url));
  const text = readFileSync(file, 'utf8');
  const specifiers = [...text.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)';/gm)].map((m) => m[1]);

  it('imports nothing from ../contact/', () => {
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s?.includes('contact/'))).toEqual([]);
    expect(text.includes('contact/')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reduce and enter
// ---------------------------------------------------------------------------

describe('recommendOutcomeNodeType.reduce and enter', () => {
  it('reduce returns the state unchanged', () => {
    const s = state();
    expect(recommendOutcomeNodeType.reduce(cfg, s, {}, env())).toBe(s);
  });

  it('enter stores the selection, total and Suggestions under the current node', () => {
    const s = state({ pick: ['card', 'mug'] }, { pick: pickState });
    const next = recommendOutcomeNodeType.enter!(cfg, s, env());
    expect(next.nodeState['result']).toEqual({
      selection: [
        { id: 'mug', name: 'Mug', price: 12, emoji: '☕' },
        { id: 'card', name: 'Card', price: 3 },
      ],
      total: 15,
      currency: 'USD',
      suggestions: [
        { id: 'tea', name: 'Tea', price: 5 },
        { id: 'candle', name: 'Candle', price: 9 },
      ],
    });
    expect(s.nodeState['result']).toBeUndefined();
  });

  it('enter without a from answer stores an empty selection, total 0 and no Suggestions', () => {
    const next = recommendOutcomeNodeType.enter!(cfg, state({}, { pick: pickState }), env());
    expect(next.nodeState['result']).toEqual({ selection: [], total: 0, currency: 'USD', suggestions: [] });
  });

  it('enter without recommend stores the selection and empty Suggestions', () => {
    const { recommend: _recommend, ...noRecommend } = cfg;
    const next = recommendOutcomeNodeType.enter!(noRecommend, state({ pick: ['candle'] }, { pick: pickState }), env());
    expect(next.nodeState['result']).toEqual({
      selection: [{ id: 'candle', name: 'Candle', price: 9 }],
      total: 9,
      currency: 'USD',
      suggestions: [],
    });
  });
});
