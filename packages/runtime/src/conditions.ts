// Condition evaluator (design Component 2, Requirement 13.1–13.3, 13.5).
// Pure functions: they read the attempt state and never write to it.

import type { AnswerValue, Cond, Ref, Scalar } from '@dreame/schema';
import type { AttemptState } from './state.ts';

/**
 * Reads the value a ref points at. Lookups use `Object.hasOwn` only, so a missing key
 * reads as `undefined` and inherited keys such as `__proto__` or `constructor` are never read.
 */
export function readRef(ref: Ref, s: AttemptState): AnswerValue | undefined {
  if (Object.hasOwn(ref, 'answer')) {
    const id = (ref as { answer: string }).answer;
    return Object.hasOwn(s.answers, id) ? s.answers[id] : undefined;
  }
  if (Object.hasOwn(ref, 'var')) {
    const id = (ref as { var: string }).var;
    return Object.hasOwn(s.vars, id) ? s.vars[id] : undefined;
  }
  return undefined;
}

function evaluateLeaf(op: 'eq' | 'gte' | 'lte' | 'includes', current: AnswerValue, value: Scalar): boolean {
  switch (op) {
    case 'eq':
      return current === value;
    case 'gte':
      // Stage 7 type checks give `gte`/`lte` a number ref and a number value.
      return typeof current === 'number' && typeof value === 'number' && current >= value;
    case 'lte':
      return typeof current === 'number' && typeof value === 'number' && current <= value;
    case 'includes':
      return Array.isArray(current) && (current as readonly Scalar[]).includes(value);
  }
}

/**
 * Evaluates a condition against the attempt state: `not` negates `arg`, `and` is `every`
 * over `args`, `or` is `some`, and a leaf whose ref reads `undefined` is `false`.
 * Recursion depth is bounded by the schema's nesting limit of 8.
 */
export function evaluateCond(cond: Cond, s: AttemptState): boolean {
  switch (cond.op) {
    case 'not':
      return !evaluateCond(cond.arg, s);
    case 'and':
      return cond.args.every((c) => evaluateCond(c, s));
    case 'or':
      return cond.args.some((c) => evaluateCond(c, s));
    case 'eq':
    case 'gte':
    case 'lte':
    case 'includes': {
      const current = readRef(cond.ref, s);
      if (current === undefined) return false;
      return evaluateLeaf(cond.op, current, cond.value);
    }
  }
}
