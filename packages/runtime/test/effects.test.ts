import { describe, expect, it } from 'vitest';
import type { VarDecl } from '@dreame/schema';
import { applyEffects, clampToDecl } from '../src/effects.ts';
import type { AttemptState } from '../src/state.ts';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function makeState(vars: AttemptState['vars']): AttemptState {
  return {
    activityId: 'demo',
    manifestVersion: 1,
    seed: 1,
    rngState: 1,
    status: 'playing',
    currentNodeId: 'start',
    vars,
    answers: {},
    nodeState: {},
    path: [{ nodeId: 'start', at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

const decls: ReadonlyMap<string, VarDecl> = new Map<string, VarDecl>([
  ['score', { id: 'score', type: 'number', initial: 0, min: 0, max: 10 }],
  ['free', { id: 'free', type: 'number', initial: 0 }],
  ['done', { id: 'done', type: 'boolean', initial: false }],
  ['mood', { id: 'mood', type: 'enum', initial: 'calm', values: ['calm', 'happy'] }],
]);

const initial = { score: 5, free: 0, done: false, mood: 'calm' };

describe('applyEffects', () => {
  it('set stores the value', () => {
    const s = makeState(initial);
    const next = applyEffects(
      [
        { op: 'set', var: 'done', value: true },
        { op: 'set', var: 'mood', value: 'happy' },
        { op: 'set', var: 'score', value: 2 },
      ],
      s,
      decls,
    );
    expect(next.vars).toEqual({ score: 2, free: 0, done: true, mood: 'happy' });
  });

  it('add stores the sum', () => {
    const next = applyEffects([{ op: 'add', var: 'score', value: 3 }], makeState(initial), decls);
    expect(next.vars.score).toBe(8);
  });

  it('add is clamped at max', () => {
    const next = applyEffects([{ op: 'add', var: 'score', value: 100 }], makeState(initial), decls);
    expect(next.vars.score).toBe(10);
  });

  it('add is clamped at min', () => {
    const next = applyEffects([{ op: 'add', var: 'score', value: -100 }], makeState(initial), decls);
    expect(next.vars.score).toBe(0);
  });

  it('an unbounded add of Number.MAX_VALUE twice stays finite', () => {
    const effects = [
      { op: 'add', var: 'free', value: Number.MAX_VALUE },
      { op: 'add', var: 'free', value: Number.MAX_VALUE },
    ] as const;
    const up = applyEffects(effects, makeState(initial), decls);
    expect(up.vars.free).toBe(Number.MAX_VALUE);
    const down = applyEffects(
      effects.map((e) => ({ ...e, value: -e.value })),
      makeState(initial),
      decls,
    );
    expect(down.vars.free).toBe(-Number.MAX_VALUE);
  });

  it('applies effects in order', () => {
    const s = makeState(initial);
    // 5 + 10 clamps to 10, then 10 − 3 = 7; the other order would give 2 + 10 → 10.
    const ordered = applyEffects(
      [
        { op: 'add', var: 'score', value: 10 },
        { op: 'add', var: 'score', value: -3 },
      ],
      s,
      decls,
    );
    expect(ordered.vars.score).toBe(7);
    const setThenAdd = applyEffects(
      [
        { op: 'set', var: 'score', value: 1 },
        { op: 'add', var: 'score', value: 2 },
      ],
      s,
      decls,
    );
    expect(setThenAdd.vars.score).toBe(3);
  });

  it('returns a new state and leaves a deep-frozen input unchanged', () => {
    const s = deepFreeze(makeState(initial));
    const snapshot = structuredClone(s);
    const next = applyEffects(
      [
        { op: 'add', var: 'score', value: 1 },
        { op: 'set', var: 'done', value: true },
      ],
      s,
      decls,
    );
    expect(next).not.toBe(s);
    expect(next.vars).not.toBe(s.vars);
    expect(s).toEqual(snapshot);
    expect(next).toEqual({ ...snapshot, vars: { ...snapshot.vars, score: 6, done: true } });
  });
});

describe('clampToDecl', () => {
  it('uses the declared bounds and ±Number.MAX_VALUE for missing ones', () => {
    expect(clampToDecl(11, { id: 'x', type: 'number', initial: 0, max: 10 })).toBe(10);
    expect(clampToDecl(-1, { id: 'x', type: 'number', initial: 0, min: 0 })).toBe(0);
    expect(clampToDecl(4, { id: 'x', type: 'number', initial: 0, min: 0, max: 10 })).toBe(4);
    expect(clampToDecl(Number.POSITIVE_INFINITY, { id: 'x', type: 'number', initial: 0 })).toBe(Number.MAX_VALUE);
    expect(clampToDecl(Number.NEGATIVE_INFINITY, { id: 'x', type: 'number', initial: 0 })).toBe(-Number.MAX_VALUE);
  });
});
