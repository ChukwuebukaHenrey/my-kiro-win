import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Effect, VarDecl } from '@dreame/schema';
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

type NumberDecl = Extract<VarDecl, { type: 'number' }>;

/** Reference fold for Property 13: `set` stores the value; `add` sums, then clamps with ±Number.MAX_VALUE for a missing bound. */
function referenceFold(decl: NumberDecl, start: number, effects: readonly Effect[]): number {
  const lo = decl.min ?? -Number.MAX_VALUE;
  const hi = decl.max ?? Number.MAX_VALUE;
  let v = start;
  for (const e of effects) {
    if (e.op === 'set') {
      v = e.value as number;
    } else {
      const sum = v + e.value;
      v = sum > hi ? hi : sum < lo ? lo : sum;
    }
  }
  return v;
}

const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
const sorted = (xs: number[]): number[] => [...xs].sort((a, b) => a - b);
const triple = fc.oneof(fc.tuple(finite, finite, finite), fc.tuple(fc.integer(), fc.integer(), fc.integer())).map(sorted);
const pair = fc.oneof(fc.tuple(finite, finite), fc.tuple(fc.integer(), fc.integer())).map(sorted);

// Bounded, min-only, max-only and unbounded declarations, with min ≤ initial ≤ max.
const numberDeclArb: fc.Arbitrary<NumberDecl> = fc.oneof(
  triple.map(([min, initial, max]): NumberDecl => ({ id: 'x', type: 'number', initial: initial!, min: min!, max: max! })),
  pair.map(([min, initial]): NumberDecl => ({ id: 'x', type: 'number', initial: initial!, min: min! })),
  pair.map(([initial, max]): NumberDecl => ({ id: 'x', type: 'number', initial: initial!, max: max! })),
  finite.map((initial): NumberDecl => ({ id: 'x', type: 'number', initial })),
);

const addValueArb = fc.oneof(
  finite,
  fc.integer({ min: -1000, max: 1000 }),
  fc.constantFrom(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE / 2, -Number.MAX_VALUE / 2),
);

const caseArb = numberDeclArb.chain((decl) => {
  const inRange = fc.double({
    noNaN: true,
    min: decl.min ?? -Number.MAX_VALUE,
    max: decl.max ?? Number.MAX_VALUE,
  });
  const effectArb: fc.Arbitrary<Effect> = fc.oneof(
    { arbitrary: addValueArb.map((value): Effect => ({ op: 'add', var: 'x', value })), weight: 3 },
    { arbitrary: inRange.map((value): Effect => ({ op: 'set', var: 'x', value })), weight: 1 },
  );
  return fc.record({
    decl: fc.constant(decl),
    start: inRange,
    effects: fc.array(effectArb, { minLength: 1, maxLength: 12 }),
  });
});

// Feature: runtime-core, Property 13: `add` effects are clamped to the declared range
// **Validates: Requirements 13.4, 13.6, 15.12**
// A passing run is evidence for this property over the generated cases, not a proof.
describe('Feature: runtime-core, Property 13: `add` effects are clamped to the declared range', () => {
  it('Feature: runtime-core, Property 13: `add` effects are clamped to the declared range', () => {
    fc.assert(
      fc.property(caseArb, ({ decl, start, effects }) => {
        const vars = new Map<string, VarDecl>([['x', decl]]);
        const s = deepFreeze(makeState({ x: start }));
        const snapshot = structuredClone(s);
        const next = applyEffects(effects, s, vars);
        const actual = next.vars.x;
        expect(actual).toBe(referenceFold(decl, start, effects));
        expect(typeof actual === 'number' && Number.isFinite(actual)).toBe(true);
        const n = actual as number;
        expect(n >= (decl.min ?? -Number.MAX_VALUE) && n <= (decl.max ?? Number.MAX_VALUE)).toBe(true);
        expect(Object.keys(next.vars)).toEqual(['x']);
        expect(s).toEqual(snapshot);
      }),
      { numRuns: 300 },
    );
  });
});
