// Feature: shop-challenge, Property 5: Bundle total and Suggestions are within the rules and deterministic
//
// For generated Offered_Item lists, selections and `recommend` blocks, with the `from` answer
// present or absent, the state stored by `recommendOutcomeNodeType.enter` is checked clause by
// clause against design Property 5, and against an expected value computed by an independent model
// written here (it does not call `suggestItems` or `bundleResult`). The attempt state is built
// directly: `nodeState[from]` holds the `collectionSelect` node state with the Offered_Items, and
// `answers[from]` holds the selected IDs in a shuffled order. A passing run is evidence for the
// property over the generated inputs, not a proof.
//
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6, 8.7**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng, type AttemptState, type Env, type JsonValue } from '@dreame/runtime';
import { recommendOutcomeNodeType, type RecommendConfig, type RecommendOutcomeConfig } from '../src/node-types/recommendOutcome.ts';
import type { BundleLine, CollectionSelectNodeState, ItemSnapshot } from '../src/node-types/bundle-rules.ts';
import { itemIdArb, recommendArb } from './shop-arbitraries.ts';

const NUM_RUNS = 200;
const FROM = 'pick';
const RESULT = 'result';
const TAG_POOL = ['gift', 'sweet', 'eco', 'large'] as const;

/** Small prices with many ties, sometimes large ones (Item price limit 0–100,000,000). */
const priceArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 20 }) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 100_000_000 }) },
);

function snapshotArb(id: string): fc.Arbitrary<ItemSnapshot> {
  return fc
    .record({
      name: fc.string({ minLength: 1, maxLength: 80 }),
      price: priceArb,
      tags: fc.uniqueArray(fc.oneof(fc.constantFrom(...TAG_POOL), fc.string({ minLength: 1, maxLength: 32 })), { maxLength: 8 }),
      emoji: fc.option(fc.constantFrom('☕', '🎁', '🕯️'), { nil: undefined }),
    })
    .map(({ emoji, ...rest }): ItemSnapshot => (emoji === undefined ? { id, ...rest } : { id, ...rest, emoji }));
}

/** 0–24 Offered_Items with unique IDs, in config order. */
const offeredArb: fc.Arbitrary<ItemSnapshot[]> = fc
  .uniqueArray(itemIdArb, { maxLength: 24 })
  .chain((ids) =>
    ids.length === 0 ? fc.constant<ItemSnapshot[]>([]) : fc.tuple(...ids.map((id) => snapshotArb(id))).map((items) => [...items]),
  );

interface Case {
  readonly offered: readonly ItemSnapshot[];
  readonly currency: string;
  /** `undefined`: the `from` answer is absent. Otherwise the selected IDs in a shuffled order. */
  readonly answer: readonly string[] | undefined;
  readonly recommend: RecommendConfig | undefined;
}

const caseArb: fc.Arbitrary<Case> = offeredArb.chain((offered) =>
  fc.record({
    offered: fc.constant(offered),
    currency: fc.constantFrom('USD', 'EUR', 'NGN'),
    answer: fc.option(
      fc.shuffledSubarray(
        offered.map((item) => item.id),
        { minLength: 0 },
      ),
      { nil: undefined },
    ),
    recommend: recommendArb([...TAG_POOL]),
  }),
);

function configFor(recommend: RecommendConfig | undefined): RecommendOutcomeConfig {
  const base = { title: 'Your bundle', body: 'Here it is.', from: FROM };
  return recommend === undefined ? base : { ...base, recommend };
}

function stateFor(c: Case): AttemptState {
  const source: CollectionSelectNodeState = { occasion: null, currency: c.currency, items: c.offered };
  return {
    activityId: 'shop-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'finished',
    currentNodeId: RESULT,
    vars: {},
    answers: c.answer === undefined ? {} : { [FROM]: [...c.answer] },
    nodeState: { [FROM]: structuredClone(source) as unknown as JsonValue },
    path: [
      { nodeId: FROM, at: 0 },
      { nodeId: RESULT, at: 1 },
    ],
    transitions: 1,
    events: [],
    startedAt: 0,
    updatedAt: 1,
  };
}

function env(): Env {
  return { now: 1, rng: createRng(7), variables: new Map() };
}

/** The expected line: `emoji` only when the Item has one. */
function modelLine(item: ItemSnapshot): BundleLine {
  return item.emoji === undefined
    ? { id: item.id, name: item.name, price: item.price }
    : { id: item.id, name: item.name, price: item.price, emoji: item.emoji };
}

function modelMeets(item: ItemSnapshot, rec: RecommendConfig): boolean {
  for (const clause of rec.where ?? []) {
    if (clause.op === 'includes' && !item.tags.includes(clause.value)) return false;
    if (clause.op === 'lte' && !(item.price <= clause.value)) return false;
    if (clause.op === 'gte' && !(item.price >= clause.value)) return false;
  }
  return true;
}

/** Eligible Items: offered, not selected, meeting every `where` clause, in config order. */
function modelEligible(c: Case, rec: RecommendConfig, answer: readonly string[]): ItemSnapshot[] {
  return c.offered.filter((item) => !answer.includes(item.id) && modelMeets(item, rec));
}

/** Insertion sort by price in the `sortBy` direction, ties by config index, then the first `limit`. */
function modelSuggestions(c: Case): BundleLine[] {
  if (c.recommend === undefined || c.answer === undefined) return [];
  const rec = c.recommend;
  const dir = rec.sortBy === 'priceAsc' ? 1 : -1;
  const indexed = modelEligible(c, rec, c.answer).map((item) => ({ item, at: c.offered.indexOf(item) }));
  const sorted: { item: ItemSnapshot; at: number }[] = [];
  for (const entry of indexed) {
    let k = sorted.length;
    while (k > 0) {
      const prev = sorted[k - 1];
      if (prev === undefined) break;
      const before = dir * (prev.item.price - entry.item.price) < 0 || (prev.item.price === entry.item.price && prev.at < entry.at);
      if (before) break;
      k -= 1;
    }
    sorted.splice(k, 0, entry);
  }
  return sorted.slice(0, rec.limit).map((e) => modelLine(e.item));
}

function modelResult(c: Case) {
  const selection = c.answer === undefined ? [] : c.offered.filter((item) => c.answer?.includes(item.id)).map(modelLine);
  let total = 0;
  for (const entry of selection) total += entry.price;
  return { selection, total, currency: c.currency, suggestions: modelSuggestions(c) };
}

interface Stored {
  readonly selection: readonly BundleLine[];
  readonly total: number;
  readonly currency: string | null;
  readonly suggestions: readonly BundleLine[];
}

function stored(s: AttemptState): Stored {
  return s.nodeState[RESULT] as unknown as Stored;
}

const enter = recommendOutcomeNodeType.enter;
if (enter === undefined) throw new Error('recommendOutcome has no enter hook');

describe('recommendOutcomeNodeType.enter (property)', () => {
  it('Feature: shop-challenge, Property 5: Bundle total and Suggestions are within the rules and deterministic', () => {
    fc.assert(
      fc.property(caseArb, (c) => {
        const cfg = configFor(c.recommend);
        const out = stored(enter(cfg, stateFor(c), env()));
        const offeredIds = c.offered.map((item) => item.id);
        const answer = c.answer ?? [];

        // Selection lines: the selected Items in config order, with their names and prices.
        const selectedInOrder = c.offered.filter((item) => answer.includes(item.id));
        expect(out.selection.map((l) => l.id)).toEqual(selectedInOrder.map((item) => item.id));
        out.selection.forEach((l, i) => {
          expect([l.name, l.price]).toEqual([selectedInOrder[i]?.name, selectedInOrder[i]?.price]);
        });

        // `total` equals the sum of the stored line prices.
        expect(out.total).toBe(out.selection.reduce((sum, l) => sum + l.price, 0));

        // Suggestions: Offered_Items, none in the selection, meeting every `where` clause.
        for (const l of out.suggestions) {
          const item = c.offered.find((i) => i.id === l.id);
          expect(item).toBeDefined();
          expect(answer).not.toContain(l.id);
          if (item !== undefined && c.recommend !== undefined) expect(modelMeets(item, c.recommend)).toBe(true);
        }
        expect(new Set(out.suggestions.map((l) => l.id)).size).toBe(out.suggestions.length);

        if (c.recommend === undefined || c.answer === undefined) {
          // Empty without a `recommend` block, and empty when the `from` answer is absent.
          expect(out.suggestions).toEqual([]);
        } else {
          // Ordered by price in the `sortBy` order, ties in config order.
          const dir = c.recommend.sortBy === 'priceAsc' ? 1 : -1;
          for (let i = 1; i < out.suggestions.length; i++) {
            const a = out.suggestions[i - 1];
            const b = out.suggestions[i];
            if (a === undefined || b === undefined) continue;
            expect(dir * (b.price - a.price)).toBeGreaterThanOrEqual(0);
            if (a.price === b.price) expect(offeredIds.indexOf(a.id)).toBeLessThan(offeredIds.indexOf(b.id));
          }
          // Exactly min(limit, eligible count).
          const eligible = modelEligible(c, c.recommend, c.answer).length;
          expect(out.suggestions.length).toBe(Math.min(c.recommend.limit, eligible));
        }

        if (c.answer === undefined) {
          expect([out.selection, out.total, out.suggestions]).toEqual([[], 0, []]);
        }

        // The whole stored state equals the independent model (including the absent `emoji` keys).
        expect(out).toStrictEqual(modelResult(c));

        // A second call with equal inputs returns a deep-equal state.
        const again = enter(configFor(c.recommend), stateFor(c), env());
        expect(stored(again)).toStrictEqual(out);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
