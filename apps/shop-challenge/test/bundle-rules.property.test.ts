// Property test for the budget status and the selection hint (shop-challenge
// design "Correctness Properties", Property 13; design C6, D33, D34).
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  budgetStatus,
  checkSelection,
  type BudgetStatus,
  type RuleItem,
  type SelectionRules,
} from '../src/node-types/bundle-rules.ts';
import { formatPrice, hintText } from '../src/format.ts';

const MAX_TOTAL = 2_400_000_000;
const MAX_BUDGET = 1_000_000_000;
const MAX_PRICE = 100_000_000;
const MAX_COUNT = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Exact rational model: total/budget ≤ 4/5 is "under", 4/5 < total/budget ≤ 1 is "close", else "over". */
function expectedStatus(total: number, budget: number): BudgetStatus {
  const t = BigInt(total);
  const b = BigInt(budget);
  if (t * 5n <= b * 4n) return 'under';
  if (t <= b) return 'close';
  return 'over';
}

/** Budgets over the whole D34 range, plus multiples of 5 so that 80% of the budget is an integer. */
const budgetArb = fc.oneof(
  fc.integer({ min: 1, max: MAX_BUDGET }),
  fc.integer({ min: 1, max: MAX_BUDGET / 5 }).map((k) => k * 5),
  fc.integer({ min: 1, max: 20 }),
);

/** Totals at and next to the 80% and 100% thresholds of `budget`. */
const nearThresholdArb = fc
  .record({
    budget: budgetArb,
    which: fc.constantFrom('80%', '100%'),
    delta: fc.integer({ min: -2, max: 2 }),
  })
  .map(({ budget, which, delta }) => {
    const four = budget * 4;
    const base = which === '80%' ? (four - (four % 5)) / 5 : budget;
    return { total: clamp(base + delta, 0, MAX_TOTAL), budget };
  });

const totalBudgetArb = fc.oneof(
  fc.record({ total: fc.integer({ min: 0, max: MAX_TOTAL }), budget: budgetArb }),
  budgetArb.chain((budget) =>
    fc.record({ total: fc.integer({ min: 0, max: Math.min(MAX_TOTAL, budget * 2) }), budget: fc.constant(budget) }),
  ),
  nearThresholdArb,
);

/** Independent USD model for `en-US` with no decimals: "$" and comma groups of three digits. */
function usdModel(amount: number): string {
  return `$${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Independent model of the hint: `null` for the ID rules and for no break; else count below min, above max, total above budget. */
function expectedHint(items: readonly RuleItem[], rules: SelectionRules, ids: readonly string[], currency: string): string | null {
  const prices = new Map<string, number>();
  for (const item of items) prices.set(item.id, item.price);
  if (ids.some((id) => !prices.has(id))) return null;
  if (new Set(ids).size !== ids.length) return null;
  const n = ids.length;
  if (n < rules.min) {
    const missing = rules.min - n;
    return `Add ${missing} more ${missing === 1 ? 'item' : 'items'}`;
  }
  if (n > rules.max) {
    const extra = n - rules.max;
    return `Remove ${extra} ${extra === 1 ? 'item' : 'items'}`;
  }
  let total = 0n;
  for (const id of ids) total += BigInt(prices.get(id) ?? 0);
  const budget = BigInt(rules.budget);
  if (total <= budget) return null;
  const over = Number(total - budget);
  const amount = currency === 'USD' ? usdModel(over) : formatPrice(over, currency);
  return `${amount} over budget`;
}

const priceArb = fc.oneof(fc.integer({ min: 0, max: MAX_PRICE }), fc.integer({ min: 0, max: 50 }));

const itemsArb: fc.Arbitrary<RuleItem[]> = fc
  .uniqueArray(fc.record({ id: fc.string({ minLength: 1, maxLength: 6 }), price: priceArb }), {
    minLength: 1,
    maxLength: MAX_COUNT,
    selector: (r) => r.id,
  })
  .map((list) => list.map(({ id, price }) => ({ id, price, tags: [] })));

function insertAt<T>(list: readonly T[], value: T, pos: number): T[] {
  const at = pos % (list.length + 1);
  return [...list.slice(0, at), value, ...list.slice(at)];
}

/** Mostly subsets of the Item IDs in any order; some with an unknown ID or a repeated ID added. */
function selectionArb(ids: readonly string[]): fc.Arbitrary<string[]> {
  const known = new Set(ids);
  const unknownArb = fc.string({ maxLength: 8 }).filter((s) => !known.has(s));
  return fc.oneof(
    { weight: 6, arbitrary: fc.shuffledSubarray([...ids]) },
    {
      weight: 1,
      arbitrary: fc
        .tuple(fc.shuffledSubarray([...ids]), unknownArb, fc.nat())
        .map(([sel, unknown, pos]) => insertAt(sel, unknown, pos)),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(fc.shuffledSubarray([...ids], { minLength: 1 }), fc.nat(), fc.nat())
        .map(([sel, pick, pos]) => insertAt(sel, sel[pick % sel.length] as string, pos)),
    },
  );
}

/** `min`, `max` and `budget` over the D34 ranges, often next to the selection count and total. */
function rulesArb(n: number, total: number): fc.Arbitrary<SelectionRules> {
  const countArb = fc.oneof(
    fc.integer({ min: 1, max: MAX_COUNT }),
    fc.integer({ min: -1, max: 1 }).map((d) => clamp(n + d, 1, MAX_COUNT)),
  );
  const ruleBudgetArb = fc.oneof(
    fc.integer({ min: 1, max: MAX_BUDGET }),
    fc.integer({ min: -2, max: 2 }).map((d) => clamp(total + d, 1, MAX_BUDGET)),
  );
  return fc.record({ min: countArb, max: countArb, budget: ruleBudgetArb });
}

const caseArb = itemsArb.chain((items) =>
  selectionArb(items.map((item) => item.id)).chain((ids) => {
    let total = 0;
    for (const item of items) if (ids.includes(item.id)) total += item.price;
    return fc.record({
      items: fc.constant(items),
      ids: fc.constant(ids),
      rules: rulesArb(ids.length, total),
      currency: fc.constantFrom('USD', 'USD', 'EUR', 'NGN'),
    });
  }),
);

describe('Feature: shop-challenge, Property 13: Budget status and hint follow the thresholds and rule order', () => {
  it('budgetStatus matches the exact rational comparison at and next to the thresholds', () => {
    const seen = new Set<BudgetStatus>();
    fc.assert(
      fc.property(totalBudgetArb, ({ total, budget }) => {
        const status = budgetStatus(total, budget);
        seen.add(status);
        expect(status).toBe(expectedStatus(total, budget));
      }),
      { numRuns: 1000 },
    );
    expect(seen).toEqual(new Set(['under', 'close', 'over']));
  });

  it('hintText(checkSelection(...)) names the first broken rule, or is null', () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(caseArb, ({ items, ids, rules, currency }) => {
        const hint = hintText(checkSelection(items, rules, ids), currency);
        const expected = expectedHint(items, rules, ids, currency);
        seen.add(expected === null ? 'null' : (expected.split(' ')[0] ?? ''));
        expect(hint).toBe(expected);
      }),
      { numRuns: 300 },
    );
    // First words seen: "Add", "Remove", and a formatted amount such as "$5" (or "€5", "NGN 5"); at least one of each kind.
    expect(seen.has('null')).toBe(true);
    expect(seen.has('Add')).toBe(true);
    expect(seen.has('Remove')).toBe(true);
    expect([...seen].some((w) => w !== 'null' && w !== 'Add' && w !== 'Remove')).toBe(true);
  });
});
