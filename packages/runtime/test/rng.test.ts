import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
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

describe('Property 10', () => {
  // **Validates: Requirements 12.3, 12.4, 12.6**
  const uint32 = fc.integer({ min: 0, max: 2 ** 32 - 1 });
  const bound = fc.oneof(
    fc.integer({ min: 1, max: 2 ** 32 }),
    fc.constantFrom(1, 2, 2 ** 31, 2 ** 32 - 1, 2 ** 32),
  );
  const runs = { numRuns: 200 };

  it('Feature: runtime-core, Property 10: Seeded RNG is reproducible and in range (same seed, same sequence)', () => {
    fc.assert(
      fc.property(uint32, fc.integer({ min: 1, max: 64 }), (seed, count) => {
        expect(draw(seed, count)).toEqual(draw(seed, count));
      }),
      runs,
    );
  });

  it('Feature: runtime-core, Property 10: Seeded RNG is reproducible and in range (nextUint32, nextFloat and nextInt ranges)', () => {
    fc.assert(
      fc.property(uint32, fc.array(bound, { minLength: 1, maxLength: 32 }), (seed, bounds) => {
        const rng = createRng(seed);
        for (const n of bounds) {
          const u = rng.nextUint32();
          expect(Number.isInteger(u) && u >= 0 && u <= 2 ** 32 - 1).toBe(true);
          const f = rng.nextFloat();
          expect(f >= 0 && f < 1).toBe(true);
          const k = rng.nextInt(n);
          expect(Number.isInteger(k) && k >= 0 && k < n).toBe(true);
        }
      }),
      runs,
    );
  });

  it('Feature: runtime-core, Property 10: Seeded RNG is reproducible and in range (shuffle is a permutation and leaves input unchanged)', () => {
    fc.assert(
      fc.property(uint32, fc.array(fc.integer(), { maxLength: 40 }), (seed, items) => {
        const before = items.slice();
        const input = Object.freeze(items.slice());
        const shuffled = createRng(seed).shuffle(input);
        expect(shuffled).not.toBe(input);
        expect(input).toEqual(before);
        const byValue = (a: number, b: number): number => a - b;
        expect(shuffled.slice().sort(byValue)).toEqual(before.slice().sort(byValue));
        expect(createRng(seed).shuffle(input)).toEqual(shuffled);
      }),
      runs,
    );
  });

  it('Feature: runtime-core, Property 10: Seeded RNG is reproducible and in range (resuming from state continues the sequence)', () => {
    fc.assert(
      fc.property(uint32, fc.integer({ min: 0, max: 64 }), fc.integer({ min: 1, max: 32 }), (seed, skip, count) => {
        const rng = createRng(seed);
        for (let i = 0; i < skip; i++) rng.nextUint32();
        const resumed = createRng(rng.state);
        const fromOriginal = Array.from({ length: count }, () => rng.nextUint32());
        const fromResumed = Array.from({ length: count }, () => resumed.nextUint32());
        expect(fromResumed).toEqual(fromOriginal);
        expect(fromOriginal).toEqual(draw(seed, skip + count).slice(skip));
      }),
      runs,
    );
  });
});
