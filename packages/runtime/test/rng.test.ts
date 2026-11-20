import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng.ts';

// Reference mulberry32 written out step by step with BigInt arithmetic modulo 2^32,
// so it does not share Math.imul or int32 coercion with the implementation.
const M32 = 2n ** 32n;
const mod32 = (x: bigint): bigint => ((x % M32) + M32) % M32;

function referenceMulberry32(seed: number, count: number): number[] {
  let a = BigInt(seed);
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    // Step 1: advance the state by the Weyl increment.
    a = mod32(a + 0x6d2b79f5n);
    let t = a;
    // Step 2: t = (t ^ (t >>> 15)) * (t | 1) mod 2^32.
    t = mod32((t ^ (t >> 15n)) * (t | 1n));
    // Step 3: t = t ^ (t + (t ^ (t >>> 7)) * (t | 61)) mod 2^32.
    const mixed = mod32(t + mod32((t ^ (t >> 7n)) * (t | 61n)));
    t = t ^ mixed;
    // Step 4: output t ^ (t >>> 14) as an unsigned 32-bit value.
    out.push(Number(mod32(t ^ (t >> 14n))));
  }
  return out;
}

function draw(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.nextUint32());
}

describe('createRng', () => {
  it.each([0, 1, 2 ** 32 - 1])('matches the reference mulberry32 for seed %d', (seed) => {
    expect(draw(seed, 16)).toEqual(referenceMulberry32(seed, 16));
  });

  it('nextFloat divides the next uint32 by 2^32', () => {
    const expected = referenceMulberry32(1, 4).map((u) => u / 2 ** 32);
    const rng = createRng(1);
    expect(Array.from({ length: 4 }, () => rng.nextFloat())).toEqual(expected);
  });

  it.each([-1, 1.5, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY])(
    'throws RangeError for state %d',
    (state) => {
      expect(() => createRng(state)).toThrow(RangeError);
    },
  );

  it.each([0, 2 ** 32 + 1, -1, 1.5, Number.NaN])('nextInt throws RangeError for %d', (n) => {
    const rng = createRng(7);
    expect(() => rng.nextInt(n)).toThrow(RangeError);
  });

  it('nextInt accepts the bounds 1 and 2^32', () => {
    const rng = createRng(7);
    expect(rng.nextInt(1)).toBe(0);
    const [, second] = referenceMulberry32(7, 2);
    expect(rng.nextInt(2 ** 32)).toBe(second);
  });

  it('continues the same sequence from createRng(rng.state)', () => {
    const rng = createRng(12345);
    for (let i = 0; i < 5; i++) rng.nextUint32();
    const resumed = createRng(rng.state);
    const fromOriginal = Array.from({ length: 8 }, () => rng.nextUint32());
    const fromResumed = Array.from({ length: 8 }, () => resumed.nextUint32());
    expect(fromResumed).toEqual(fromOriginal);
    expect(fromOriginal).toEqual(referenceMulberry32(12345, 13).slice(5));
  });

  it('state is a uint32 after wrapping past 2^32 − 1', () => {
    const rng = createRng(2 ** 32 - 1);
    rng.nextUint32();
    expect(rng.state).toBe((2 ** 32 - 1 + 0x6d2b79f5) % 2 ** 32);
  });

  it('shuffle returns a permutation of a copy and leaves the input unchanged', () => {
    const items = Object.freeze(['a', 'b', 'c', 'd', 'e']);
    const shuffled = createRng(3).shuffle(items);
    expect(shuffled).not.toBe(items);
    expect([...shuffled].sort()).toEqual([...items]);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(createRng(3).shuffle(items)).toEqual(shuffled);
  });
});
