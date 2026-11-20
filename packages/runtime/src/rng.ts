// Seeded random number generator (mulberry32, 32-bit state).
// The state lives in the attempt, so a reload or replay resumes the same sequence (Brief B6, B7).

const UINT32_RANGE = 2 ** 32;
const MAX_UINT32 = UINT32_RANGE - 1;
const MULBERRY32_INCREMENT = 0x6d2b79f5;

export interface SeededRng {
  /** Next value in 0 … 2^32 − 1. */
  nextUint32(): number;
  /** Next value in [0, 1). */
  nextFloat(): number;
  /** Next integer in 0 … maxExclusive − 1; `RangeError` unless maxExclusive is an integer in 1 … 2^32. */
  nextInt(maxExclusive: number): number;
  /** Fisher–Yates shuffle of a copy of `items`; `items` is not changed. */
  shuffle<T>(items: readonly T[]): T[];
  /** Current uint32 state; `createRng(rng.state)` continues the same sequence. */
  readonly state: number;
}

function isUint32(value: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_UINT32;
}

export function createRng(state: number): SeededRng {
  if (!isUint32(state)) {
    throw new RangeError(`RNG state must be a uint32, got ${String(state)}`);
  }
  let s = state;

  function nextUint32(): number {
    s = (s + MULBERRY32_INCREMENT) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  function nextFloat(): number {
    return nextUint32() / UINT32_RANGE;
  }

  function nextInt(maxExclusive: number): number {
    if (
      typeof maxExclusive !== 'number' ||
      !Number.isInteger(maxExclusive) ||
      maxExclusive < 1 ||
      maxExclusive > UINT32_RANGE
    ) {
      throw new RangeError(`nextInt bound must be an integer from 1 to 2^32, got ${String(maxExclusive)}`);
    }
    // nextFloat() ≤ 1 − 2^-32, so the product stays below maxExclusive.
    return Math.floor(nextFloat() * maxExclusive);
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = nextInt(i + 1);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  return {
    nextUint32,
    nextFloat,
    nextInt,
    shuffle,
    get state(): number {
      return s;
    },
  };
}
