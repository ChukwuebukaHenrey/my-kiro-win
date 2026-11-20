// Variable effects (design Component 2, Req 13.4–13.6).
// Stage 7 `checkEffect` has already checked each effect against its declaration,
// so `set` values have the declared type and range and `add` targets a number variable.

import type { Effect, Scalar, VarDecl } from '@dreame/schema';
import type { AttemptState } from './state.ts';

type NumberVarDecl = Extract<VarDecl, { type: 'number' }>;

/**
 * Clamps `value` to the declared `[min, max]`. A missing bound is replaced by
 * `-Number.MAX_VALUE` or `Number.MAX_VALUE`, so the result stays finite (Req 13.6).
 */
export function clampToDecl(value: number, decl: NumberVarDecl): number {
  const min = decl.min ?? -Number.MAX_VALUE;
  const max = decl.max ?? Number.MAX_VALUE;
  if (value > max) return max;
  if (value < min) return min;
  return value;
}

/** Applies `effects` in order and returns a new state; `s` is not modified (Req 13.4, 13.5). */
export function applyEffects(
  effects: readonly Effect[],
  s: AttemptState,
  vars: ReadonlyMap<string, VarDecl>,
): AttemptState {
  if (effects.length === 0) return s;
  const next: Record<string, Scalar> = { ...s.vars };
  for (const effect of effects) {
    if (effect.op === 'set') {
      next[effect.var] = effect.value;
      continue;
    }
    const decl = vars.get(effect.var);
    const current = Object.hasOwn(next, effect.var) ? next[effect.var] : undefined;
    if (decl?.type !== 'number' || typeof current !== 'number') {
      // Unreachable for a validated manifest; a throw here marks a bug in the caller.
      throw new TypeError(`add effect on non-number variable "${effect.var}"`);
    }
    next[effect.var] = clampToDecl(current + effect.value, decl);
  }
  return { ...s, vars: next };
}
