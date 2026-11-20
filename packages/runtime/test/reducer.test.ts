import { describe, expect, it } from 'vitest';
import type { Manifest, ManifestNode } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce } from '../src/reducer.ts';
import type { Runtime } from '../src/reducer.ts';
import { createRng } from '../src/rng.ts';
import type { Action, AttemptState } from '../src/state.ts';
import { asValidManifest, fixtureProfile } from './fixtures/node-types.ts';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

// q1 edges: value >= 5 -> high; value >= 0 -> q2; otherwise -> low. A value of 7 matches the
// first two edges, so it shows that the first match wins. Every edge reads q1's own answer.
const nodes: ManifestNode[] = [
  {
    id: 'q1',
    type: 'step',
    config: {},
    edges: [
      { to: 'high', when: { op: 'gte', ref: { answer: 'q1' }, value: 5 } },
      { to: 'q2', when: { op: 'gte', ref: { answer: 'q1' }, value: 0 } },
      { to: 'low' },
    ],
  },
  { id: 'q2', type: 'step', config: {}, edges: [{ to: 'high' }] },
  { id: 'high', type: 'end', config: {}, edges: [] },
  { id: 'low', type: 'end', config: {}, edges: [] },
  { id: 'limit', type: 'end', config: {}, edges: [] },
];

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    schemaVersion: 1,
    profile: 'core',
    activityId: 'demo',
    version: 3,
    requires: { step: 1, end: 1 },
    entryNodeId: 'q1',
    fallbackOutcomeId: 'limit',
    limits: { maxNodes: 10, maxTransitions: 5 },
    variables: [
      { id: 'score', type: 'number', initial: 2, min: 0, max: 10 },
      { id: 'mood', type: 'enum', initial: 'calm', values: ['calm', 'busy'] },
    ],
    nodes,
    theme: 'default',
    ...overrides,
  };
}

function runtime(overrides: Partial<Manifest> = {}): Runtime {
  return createRuntime(fixtureProfile(), asValidManifest(manifest(overrides)));
}

const SEED = 12345;
const t0 = { now: 100 };
const t1 = { now: 200 };
const t2 = { now: 300 };

function respond(nodeId: string, value: unknown): Action {
  return { type: 'respond', nodeId, response: value };
}

describe('createRuntime', () => {
  it('builds node and variable lookup maps', () => {
    const rt = runtime();
    expect([...rt.nodes.keys()]).toEqual(['q1', 'q2', 'high', 'low', 'limit']);
    expect(rt.variables.get('score')?.initial).toBe(2);
  });

  it('throws on a node type the profile does not register', () => {
    const bad = [...nodes, { id: 'odd', type: 'mystery', config: {}, edges: [] }];
    expect(() => runtime({ nodes: bad })).toThrow(/mystery/);
  });
});

describe('createAttempt', () => {
  it('sets the initial fields and calls the entry node type enter with createRng(seed)', () => {
    const s = createAttempt(runtime(), SEED, t0);
    const rng = createRng(SEED);
    const drawn = rng.nextUint32();
    expect(s).toEqual({
      activityId: 'demo',
      manifestVersion: 3,
      seed: SEED,
      rngState: rng.state,
      status: 'playing',
      currentNodeId: 'q1',
      vars: { score: 2, mood: 'calm' },
      answers: {},
      nodeState: { q1: drawn },
      path: [{ nodeId: 'q1', at: 100 }],
      transitions: 0,
      events: [],
      startedAt: 100,
      updatedAt: 100,
    });
    expect(s.rngState).not.toBe(SEED);
  });

  it('finishes at once on a terminal entry node, and rngState equals seed without enter', () => {
    const s = createAttempt(runtime({ entryNodeId: 'high' }), SEED, t0);
    expect(s.status).toBe('finished');
    expect(s.currentNodeId).toBe('high');
    expect(s.events).toEqual([{ type: 'finished', at: 100, outcomeId: 'high' }]);
    expect(s.rngState).toBe(SEED);
    expect(s.transitions).toBe(0);
  });
});

describe('checkAction and rejected actions', () => {
  const rt = runtime();
  const s = createAttempt(rt, SEED, t0);

  it('returns null for an accepted action', () => {
    expect(checkAction(rt, s, respond('q1', { value: 1 }))).toBeNull();
  });

  it('rejects any action once the attempt is not playing', () => {
    const done = reduce(rt, s, respond('q1', { value: 7 }), t1);
    expect(done.status).toBe('finished');
    // not-playing comes first even for an action that would also be unknown.
    expect(checkAction(rt, done, { type: 'skip' } as unknown as Action)).toBe('not-playing');
    const a = respond('high', {});
    expect(checkAction(rt, done, a)).toBe('not-playing');
    expect(reduce(rt, done, a, t2)).toBe(done);
  });

  it('rejects an unknown action type and a non-object action', () => {
    for (const a of [{ type: 'skip', nodeId: 'q1', response: { value: 1 } }, null, 'respond', 42]) {
      const action = a as unknown as Action;
      expect(checkAction(rt, s, action)).toBe('unknown-action');
      expect(reduce(rt, s, action, t1)).toBe(s);
    }
  });

  it('rejects an action for another node', () => {
    const a = respond('q2', { value: 1 });
    expect(checkAction(rt, s, a)).toBe('wrong-node');
    expect(reduce(rt, s, a, t1)).toBe(s);
  });

  it('rejects a response that fails the precompiled validator or isValidResponse', () => {
    // { value: 'x' } fails the validator; { value: 1.5 } passes it but fails isValidResponse.
    for (const response of [{ value: 'x' }, { value: 1, extra: true }, { value: 1.5 }, null]) {
      const a = respond('q1', response);
      expect(checkAction(rt, s, a)).toBe('invalid-response');
      expect(reduce(rt, s, a, t1)).toBe(s);
    }
  });
});

describe('reduce', () => {
  it('takes the first matching edge, reading the node own answer, and emits finished', () => {
    const rt = runtime();
    const s = createAttempt(rt, SEED, t0);
    const next = reduce(rt, s, respond('q1', { value: 7 }), t1);
    expect(next.answers).toEqual({ q1: 7 });
    expect(next.currentNodeId).toBe('high');
    expect(next.status).toBe('finished');
    expect(next.events).toEqual([{ type: 'finished', at: 200, outcomeId: 'high' }]);
    expect(next.transitions).toBe(1);
    expect(next.path).toEqual([
      { nodeId: 'q1', at: 100 },
      { nodeId: 'high', at: 200 },
    ]);
    expect(next.startedAt).toBe(100);
    expect(next.updatedAt).toBe(200);
    // `high` has no enter, so no number is drawn.
    expect(next.rngState).toBe(s.rngState);
  });

  it('routes on later edges when earlier ones do not match', () => {
    const rt = runtime();
    const s = createAttempt(rt, SEED, t0);
    expect(reduce(rt, s, respond('q1', { value: 1 }), t1).currentNodeId).toBe('q2');
    expect(reduce(rt, s, respond('q1', { value: -1 }), t1).currentNodeId).toBe('low');
  });

  it('calls enter on the entered node with createRng(state.rngState) and updates rngState', () => {
    const rt = runtime();
    const s = createAttempt(rt, SEED, t0);
    const next = reduce(rt, s, respond('q1', { value: 1 }), t1);
    const rng = createRng(s.rngState);
    const drawn = rng.nextUint32();
    expect(next.status).toBe('playing');
    expect(next.nodeState).toEqual({ q1: s.nodeState['q1'], q2: drawn });
    expect(next.rngState).toBe(rng.state);
    expect(next.transitions).toBe(1);
    expect(next.path).toEqual([
      { nodeId: 'q1', at: 100 },
      { nodeId: 'q2', at: 200 },
    ]);
    expect(next.events).toEqual([]);
  });

  it('enters the fallback outcome at maxTransitions 0 without changing transitions', () => {
    const rt = runtime({ limits: { maxNodes: 10, maxTransitions: 0 } });
    const s = createAttempt(rt, SEED, t0);
    const next = reduce(rt, s, respond('q1', { value: 7 }), t1);
    expect(next.currentNodeId).toBe('limit');
    expect(next.status).toBe('limit_reached');
    expect(next.transitions).toBe(0);
    expect(next.answers).toEqual({ q1: 7 });
    expect(next.path).toEqual([
      { nodeId: 'q1', at: 100 },
      { nodeId: 'limit', at: 200 },
    ]);
    // Only the limit event; no finished event for the fallback outcome.
    expect(next.events).toEqual([{ type: 'limit_reached', at: 200, fromNodeId: 'q1', outcomeId: 'limit' }]);
    expect(next.updatedAt).toBe(200);
  });

  it('allows one transition at maxTransitions 1, then enters the fallback outcome', () => {
    const rt = runtime({ limits: { maxNodes: 10, maxTransitions: 1 } });
    const s0 = createAttempt(rt, SEED, t0);
    const s1 = reduce(rt, s0, respond('q1', { value: 1 }), t1);
    expect(s1.currentNodeId).toBe('q2');
    expect(s1.transitions).toBe(1);
    const s2 = reduce(rt, s1, respond('q2', { value: 0 }), t2);
    expect(s2.currentNodeId).toBe('limit');
    expect(s2.status).toBe('limit_reached');
    expect(s2.transitions).toBe(1);
    expect(s2.path.map((p) => p.nodeId)).toEqual(['q1', 'q2', 'limit']);
    expect(s2.events).toEqual([{ type: 'limit_reached', at: 300, fromNodeId: 'q2', outcomeId: 'limit' }]);
  });

  it('leaves deep-frozen inputs unchanged', () => {
    const m = deepFreeze(asValidManifest(manifest()));
    const rt = createRuntime(fixtureProfile(), m);
    const s: AttemptState = deepFreeze(createAttempt(rt, SEED, deepFreeze({ now: 100 })));
    const before = structuredClone(s);
    const action = deepFreeze(respond('q1', { value: 1 }));
    const next = reduce(rt, s, action, deepFreeze({ now: 200 }));
    expect(next).not.toBe(s);
    expect(s).toEqual(before);
    expect(action).toEqual(respond('q1', { value: 1 }));
    expect(m).toEqual(manifest());
  });
});
