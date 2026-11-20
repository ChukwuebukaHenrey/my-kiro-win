import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { AnswerValue, Cond, Ref, Scalar } from '@dreame/schema';
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

// ---------------------------------------------------------------------------
// Property 9: reference model and generators.
// ---------------------------------------------------------------------------

/** Own-key lookup written independently of `readRef`: only own enumerable keys count. */
function ownValue<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
  return Object.keys(record).includes(key) ? record[key] : undefined;
}

function modelRead(ref: Ref, s: AttemptState): AnswerValue | undefined {
  return 'answer' in ref ? ownValue(s.answers, ref.answer) : ownValue(s.vars, ref.var);
}

/** The leaf variant of `Cond`. Narrow with `'ref' in`: `op` is a union of literals in two variants. */
type LeafCond = Extract<Cond, { ref: unknown }>;

function isLeaf(cond: Cond): cond is LeafCond {
  return 'ref' in cond;
}

/**
 * Direct recursive model of Requirement 13.2 and 13.3.
 * Implementation choice (task 3.3): `gte` and `lte` are `false` unless both the ref value
 * and the condition value are numbers. A valid manifest always gives them numbers (Stage 7
 * type checks), so this only differs from a plain `>=` / `<=` on states a valid manifest
 * cannot produce.
 */
function modelEval(cond: Cond, s: AttemptState): boolean {
  if (cond.op === 'not') return !modelEval(cond.arg, s);
  if (cond.op === 'and') {
    for (const c of cond.args) if (!modelEval(c, s)) return false;
    return true;
  }
  if (cond.op === 'or') {
    for (const c of cond.args) if (modelEval(c, s)) return true;
    return false;
  }
  if (!isLeaf(cond)) throw new Error('unreachable: not, and and or are handled above');
  const current = modelRead(cond.ref, s);
  if (current === undefined) return false;
  const value = cond.value;
  if (cond.op === 'eq') return current === value;
  if (cond.op === 'gte') return typeof current === 'number' && typeof value === 'number' && current >= value;
  if (cond.op === 'lte') return typeof current === 'number' && typeof value === 'number' && current <= value;
  if (!Array.isArray(current)) return false;
  for (const item of current as readonly string[]) if (item === value) return true;
  return false;
}

// Small key and value pools so refs hit present, missing and prototype-like keys often.
const KEYS = ['q1', 'q2', 'score', 'tier', 'missing', '__proto__', 'constructor', 'toString'] as const;
const STRINGS = ['a', 'b', 'gold'] as const;

const keyArb = fc.constantFrom(...KEYS);
const scalarArb: fc.Arbitrary<Scalar> = fc.oneof(
  fc.integer({ min: -3, max: 3 }),
  fc.constantFrom(...STRINGS),
  fc.boolean(),
);
const answerValueArb: fc.Arbitrary<AnswerValue> = fc.oneof(
  scalarArb,
  fc.array(fc.constantFrom(...STRINGS), { maxLength: 3 }),
);

/**
 * Builds a record whose own keys come from `own` (defined as own data properties, so an
 * own `__proto__` key is a real entry) and whose prototype optionally carries `inherited`.
 */
function buildRecord<V>(own: [string, V][], inherited: [string, V][] | null): Record<string, V> {
  const proto: object = inherited === null ? Object.prototype : Object.fromEntries(inherited);
  const record = Object.create(proto) as Record<string, V>;
  for (const [key, value] of own) {
    Object.defineProperty(record, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return record;
}

function recordArb<V>(valueArb: fc.Arbitrary<V>): fc.Arbitrary<Record<string, V>> {
  const entries = fc.uniqueArray(fc.tuple(keyArb, valueArb), { maxLength: 6, selector: ([k]) => k });
  return fc
    .tuple(entries, fc.option(entries, { nil: null }))
    .map(([own, inherited]) => buildRecord(own, inherited));
}

const stateArb: fc.Arbitrary<AttemptState> = fc
  .tuple(recordArb(answerValueArb), recordArb(scalarArb))
  .map(([answers, vars]) => makeState({ answers, vars }));

const refArb: fc.Arbitrary<Ref> = fc.oneof(
  keyArb.map((answer): Ref => ({ answer })),
  keyArb.map((v): Ref => ({ var: v })),
);

const leafArb: fc.Arbitrary<Cond> = fc
  .tuple(fc.constantFrom<'eq' | 'gte' | 'lte' | 'includes'>('eq', 'gte', 'lte', 'includes'), refArb, scalarArb)
  .map(([op, ref, value]): Cond => ({ op, ref, value }));

/** Conditions with at most `depth` levels of nesting; a leaf is one level. */
function condArb(depth: number): fc.Arbitrary<Cond> {
  if (depth <= 1) return leafArb;
  const sub = condArb(depth - 1);
  return fc.oneof(
    { arbitrary: leafArb, weight: 2 },
    { arbitrary: sub.map((arg): Cond => ({ op: 'not', arg })), weight: 1 },
    {
      arbitrary: fc
        .tuple(fc.constantFrom<'and' | 'or'>('and', 'or'), fc.array(sub, { minLength: 1, maxLength: 3 }))
        .map(([op, args]): Cond => ({ op, args })),
      weight: 2,
    },
  );
}

function condDepth(cond: Cond): number {
  if (cond.op === 'not') return 1 + condDepth(cond.arg);
  if (cond.op === 'and' || cond.op === 'or') return 1 + Math.max(0, ...cond.args.map(condDepth));
  return 1;
}

describe('Property 9', () => {
  it('Feature: runtime-core, Property 9: Condition evaluation matches a reference model', () => {
    // **Validates: Requirements 13.1, 13.2, 13.3**
    fc.assert(
      fc.property(condArb(8), stateArb, (cond, s) => {
        expect(condDepth(cond)).toBeLessThanOrEqual(8);
        expect(evaluateCond(cond, s)).toBe(modelEval(cond, s));
        if (isLeaf(cond)) {
          expect(readRef(cond.ref, s)).toBe(modelRead(cond.ref, s));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('reads an own __proto__ or constructor entry but not an inherited one', () => {
    const answers = buildRecord<AnswerValue>([['__proto__', 'own']], [['q2', 'inherited']]);
    const vars = buildRecord<Scalar>([['constructor', 2]], [['score', 9]]);
    const s = makeState({ answers, vars });
    expect(evaluateCond({ op: 'eq', ref: { answer: '__proto__' }, value: 'own' }, s)).toBe(true);
    expect(evaluateCond({ op: 'gte', ref: { var: 'constructor' }, value: 2 }, s)).toBe(true);
    expect(evaluateCond({ op: 'eq', ref: { answer: 'q2' }, value: 'inherited' }, s)).toBe(false);
    expect(evaluateCond({ op: 'lte', ref: { var: 'score' }, value: 9 }, s)).toBe(false);
  });
});
