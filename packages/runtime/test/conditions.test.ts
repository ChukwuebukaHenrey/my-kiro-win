import { describe, expect, it } from 'vitest';
import type { Cond } from '@dreame/schema';
import { evaluateCond, readRef } from '../src/conditions.ts';
import type { AttemptState } from '../src/state.ts';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

function makeState(overrides: Partial<AttemptState> = {}): AttemptState {
  return deepFreeze({
    activityId: 'demo',
    manifestVersion: 1,
    seed: 1,
    rngState: 1,
    status: 'playing',
    currentNodeId: 'q1',
    vars: { score: 5, vip: true, tier: 'gold' },
    answers: { q1: 'opt_a', picks: ['red', 'blue'] },
    nodeState: {},
    path: [{ nodeId: 'q1', at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
    ...overrides,
  });
}

const T: Cond = { op: 'eq', ref: { var: 'vip' }, value: true };
const F: Cond = { op: 'eq', ref: { var: 'vip' }, value: false };

describe('readRef', () => {
  it('reads answers and variables', () => {
    const s = makeState();
    expect(readRef({ answer: 'q1' }, s)).toBe('opt_a');
    expect(readRef({ answer: 'picks' }, s)).toEqual(['red', 'blue']);
    expect(readRef({ var: 'score' }, s)).toBe(5);
  });

  it('reads a missing answer or variable as undefined', () => {
    const s = makeState();
    expect(readRef({ answer: 'q9' }, s)).toBeUndefined();
    expect(readRef({ var: 'missing' }, s)).toBeUndefined();
  });

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'never reads the inherited key %s',
    (key) => {
      const s = makeState();
      expect(readRef({ answer: key }, s)).toBeUndefined();
      expect(readRef({ var: key }, s)).toBeUndefined();
    },
  );

  it('ignores keys that exist only on the prototype chain', () => {
    const answers = Object.create({ q2: 'inherited' }) as Record<string, string>;
    const vars = Object.create({ score: 99 }) as Record<string, number>;
    const s = makeState({ answers, vars });
    expect(readRef({ answer: 'q2' }, s)).toBeUndefined();
    expect(readRef({ var: 'score' }, s)).toBeUndefined();
    expect(evaluateCond({ op: 'eq', ref: { answer: 'q2' }, value: 'inherited' }, s)).toBe(false);
  });
});

describe('evaluateCond', () => {
  const s = makeState();

  it('eq compares with ===', () => {
    expect(evaluateCond({ op: 'eq', ref: { answer: 'q1' }, value: 'opt_a' }, s)).toBe(true);
    expect(evaluateCond({ op: 'eq', ref: { answer: 'q1' }, value: 'opt_b' }, s)).toBe(false);
    expect(evaluateCond({ op: 'eq', ref: { var: 'score' }, value: '5' }, s)).toBe(false);
  });

  it('gte compares ref >= value', () => {
    expect(evaluateCond({ op: 'gte', ref: { var: 'score' }, value: 5 }, s)).toBe(true);
    expect(evaluateCond({ op: 'gte', ref: { var: 'score' }, value: 6 }, s)).toBe(false);
  });

  it('lte compares ref <= value', () => {
    expect(evaluateCond({ op: 'lte', ref: { var: 'score' }, value: 5 }, s)).toBe(true);
    expect(evaluateCond({ op: 'lte', ref: { var: 'score' }, value: 4 }, s)).toBe(false);
  });

  it('includes checks whether the ref array contains value', () => {
    expect(evaluateCond({ op: 'includes', ref: { answer: 'picks' }, value: 'blue' }, s)).toBe(true);
    expect(evaluateCond({ op: 'includes', ref: { answer: 'picks' }, value: 'green' }, s)).toBe(false);
  });

  it('and is every over args', () => {
    expect(evaluateCond({ op: 'and', args: [T, T] }, s)).toBe(true);
    expect(evaluateCond({ op: 'and', args: [T, F] }, s)).toBe(false);
  });

  it('or is some over args', () => {
    expect(evaluateCond({ op: 'or', args: [F, T] }, s)).toBe(true);
    expect(evaluateCond({ op: 'or', args: [F, F] }, s)).toBe(false);
  });

  it('not negates arg', () => {
    expect(evaluateCond({ op: 'not', arg: F }, s)).toBe(true);
    expect(evaluateCond({ op: 'not', arg: T }, s)).toBe(false);
  });

  it.each(['eq', 'gte', 'lte', 'includes'] as const)(
    'a %s leaf whose answer is missing is false',
    (op) => {
      const leaf: Cond = { op, ref: { answer: 'q9' }, value: op === 'includes' ? 'red' : 0 };
      expect(evaluateCond(leaf, s)).toBe(false);
      // The leaf itself is false, so its negation is true.
      expect(evaluateCond({ op: 'not', arg: leaf }, s)).toBe(true);
    },
  );

  it('a leaf on __proto__ or constructor is false', () => {
    expect(evaluateCond({ op: 'eq', ref: { answer: '__proto__' }, value: 'x' }, s)).toBe(false);
    expect(evaluateCond({ op: 'eq', ref: { var: 'constructor' }, value: 'x' }, s)).toBe(false);
  });

  it('leaves a deep-frozen input state deep-equal to its value before the call', () => {
    const before = structuredClone(s);
    const cond: Cond = {
      op: 'and',
      args: [
        { op: 'or', args: [F, { op: 'gte', ref: { var: 'score' }, value: 1 }] },
        { op: 'not', arg: { op: 'includes', ref: { answer: 'picks' }, value: 'green' } },
      ],
    };
    expect(Object.isFrozen(s.answers)).toBe(true);
    expect(evaluateCond(cond, s)).toBe(true);
    expect(s).toEqual(before);
  });
});
