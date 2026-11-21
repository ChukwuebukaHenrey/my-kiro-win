/**
 * Pure Selection and Suggestion rules shared by the shop node types, the
 * views and the tests (design C6). No React, no clock, no randomness.
 */
import type { JsonValue } from '@dreame/runtime';

/** The fields of an Item that the rules read. */
export interface RuleItem {
  readonly id: string;
  readonly price: number;
  readonly tags: readonly string[];
  readonly occasions?: readonly string[];
}

export interface SelectionRules {
  readonly min: number;
  readonly max: number;
  readonly budget: number;
}

/** First broken Selection_Rule, in this order; `null` when the Selection meets every rule. */
export type RuleBreak =
  | { readonly rule: 'unknown-item'; readonly id: string }
  | { readonly rule: 'repeated-item'; readonly id: string }
  | { readonly rule: 'too-few'; readonly missing: number }
  | { readonly rule: 'too-many'; readonly extra: number }
  | { readonly rule: 'over-budget'; readonly over: number };

/** All `items` when `occasion` is `null`; otherwise the Items with no `occasions` list or with `occasion` in it. Config order kept. */
export function offeredItems<T extends RuleItem>(items: readonly T[], occasion: string | null): T[] {
  if (occasion === null) return items.slice();
  return items.filter((item) => item.occasions === undefined || item.occasions.includes(occasion));
}

/** Sum of the prices of the Items whose IDs are in `ids`; IDs not in `items` add nothing. */
export function selectionTotal(items: readonly RuleItem[], ids: readonly string[]): number {
  const picked = new Set(ids);
  let total = 0;
  for (const item of items) {
    if (picked.has(item.id)) total += item.price;
  }
  return total;
}

/**
 * The first broken rule for `ids` against `items` and `rules`, or `null`.
 * For the two ID rules the reported `id` is the first offending entry of
 * `ids` in array order (for `repeated-item`, the first ID seen a second time).
 */
export function checkSelection(
  items: readonly RuleItem[],
  rules: SelectionRules,
  ids: readonly string[],
): RuleBreak | null {
  const known = new Set(items.map((item) => item.id));
  for (const id of ids) {
    if (!known.has(id)) return { rule: 'unknown-item', id };
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return { rule: 'repeated-item', id };
    seen.add(id);
  }
  const n = ids.length;
  if (n < rules.min) return { rule: 'too-few', missing: rules.min - n };
  if (n > rules.max) return { rule: 'too-many', extra: n - rules.max };
  const total = selectionTotal(items, ids);
  if (total > rules.budget) return { rule: 'over-budget', over: total - rules.budget };
  return null;
}

/** Why no Selection of `offered` can meet `rules`, or `null` when one can (Satisfiable). */
export type Unsatisfiable =
  | { readonly reason: 'min-above-max' }
  | { readonly reason: 'too-few-offered'; readonly offered: number }
  | { readonly reason: 'cheapest-over-budget'; readonly cheapest: number };

/**
 * Checks, in order, `min > max`, `offered.length < min`, and whether the sum
 * of the `min` lowest offered prices exceeds `budget`. `cheapest` is that sum.
 */
export function unsatisfiable(offered: readonly RuleItem[], rules: SelectionRules): Unsatisfiable | null {
  if (rules.min > rules.max) return { reason: 'min-above-max' };
  if (offered.length < rules.min) return { reason: 'too-few-offered', offered: offered.length };
  const prices = offered.map((item) => item.price).sort((a, b) => a - b);
  let cheapest = 0;
  for (let i = 0; i < rules.min; i += 1) cheapest += prices[i] ?? 0;
  if (cheapest > rules.budget) return { reason: 'cheapest-over-budget', cheapest };
  return null;
}

export type WhereClause =
  | { readonly op: 'includes'; readonly field: 'tags'; readonly value: string }
  | { readonly op: 'lte' | 'gte'; readonly field: 'price'; readonly value: number };

export interface RecommendRules {
  readonly where?: readonly WhereClause[];
  readonly sortBy: 'priceAsc' | 'priceDesc';
  readonly limit: number;
}

function meets(item: RuleItem, clause: WhereClause): boolean {
  switch (clause.op) {
    case 'includes':
      return item.tags.includes(clause.value);
    case 'lte':
      return item.price <= clause.value;
    case 'gte':
      return item.price >= clause.value;
  }
}

/**
 * Suggestions: Items not in `selected` that meet every clause, stably sorted
 * by price, cut to `limit`. `Array.prototype.sort` is stable (ES2019+), so
 * Items with equal prices keep config order for both `priceAsc` and
 * `priceDesc` (Requirement 8.2).
 */
export function suggestItems<T extends RuleItem>(
  items: readonly T[],
  selected: readonly string[],
  rec: RecommendRules,
): T[] {
  const picked = new Set(selected);
  const where = rec.where ?? [];
  const kept = items.filter((item) => !picked.has(item.id) && where.every((clause) => meets(item, clause)));
  const sign = rec.sortBy === 'priceAsc' ? 1 : -1;
  kept.sort((a, b) => sign * (a.price - b.price));
  return kept.slice(0, Math.max(0, rec.limit));
}

/** Budget status of Requirement 10.5, computed with integers: `total * 5 <= budget * 4` is "under". */
export type BudgetStatus = 'under' | 'close' | 'over';

/**
 * "under" at or below 80% of `budget`, "close" above 80% and at most 100%,
 * "over" above `budget`. Integer comparisons only; with totals up to
 * 2,400,000,000 and budgets up to 1,000,000,000 the products stay below 2^53.
 */
export function budgetStatus(total: number, budget: number): BudgetStatus {
  if (total * 5 <= budget * 4) return 'under';
  if (total <= budget) return 'close';
  return 'over';
}

/** `s.nodeState[<collectionSelect node>]`, written by `enter` and again by `reduce` (design "Data Models"). */
export interface CollectionSelectNodeState {
  /** `null`: no `occasionFrom`, or its answer is missing. */
  readonly occasion: string | null;
  /** `cfg.currency`. */
  readonly currency: string;
  /** The Offered_Items for `occasion`, in config order. */
  readonly items: readonly ItemSnapshot[];
}

export interface ItemSnapshot {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly tags: readonly string[];
  readonly emoji?: string;
}

/** `s.nodeState[<recommendOutcome node>]`, written by `enter`. */
export interface BundleResultState {
  readonly selection: readonly BundleLine[];
  /** Sum of the selection prices. */
  readonly total: number;
  /** `null` only when the `from` node has no node state. */
  readonly currency: string | null;
  readonly suggestions: readonly BundleLine[];
}

export interface BundleLine {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly emoji?: string;
}

type JsonObject = { readonly [k: string]: JsonValue };

function asObject(value: JsonValue | undefined): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value;
}

/** The own property `key` of `obj`, or `undefined`; inherited keys such as `__proto__` are never read. */
function own(obj: JsonObject, key: string): JsonValue | undefined {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function isNumber(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readStrings(value: JsonValue | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    out.push(entry);
  }
  return out;
}

/** A fresh BundleLine, or `null`. `emoji` is copied only when it is an own string property. */
function readLine(value: JsonValue | undefined): BundleLine | null {
  const obj = asObject(value);
  if (obj === null) return null;
  const id = own(obj, 'id');
  const name = own(obj, 'name');
  const price = own(obj, 'price');
  const emoji = own(obj, 'emoji');
  if (typeof id !== 'string' || typeof name !== 'string' || !isNumber(price)) return null;
  if (emoji === undefined) return { id, name, price };
  if (typeof emoji !== 'string') return null;
  return { id, name, price, emoji };
}

function readSnapshot(value: JsonValue | undefined): ItemSnapshot | null {
  const line = readLine(value);
  const obj = asObject(value);
  if (line === null || obj === null) return null;
  const tags = readStrings(own(obj, 'tags'));
  if (tags === null) return null;
  const { id, name, price } = line;
  return line.emoji === undefined ? { id, name, price, tags } : { id, name, price, tags, emoji: line.emoji };
}

function readList<T>(value: JsonValue | undefined, read: (entry: JsonValue) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const entry of value) {
    const item = read(entry);
    if (item === null) return null;
    out.push(item);
  }
  return out;
}

/** The value as a CollectionSelectNodeState when every field has the right JSON type, else `null`. */
export function readSelectNodeState(value: JsonValue | undefined): CollectionSelectNodeState | null {
  const obj = asObject(value);
  if (obj === null) return null;
  const occasion = own(obj, 'occasion');
  const currency = own(obj, 'currency');
  if (occasion === undefined || (occasion !== null && typeof occasion !== 'string')) return null;
  if (typeof currency !== 'string') return null;
  const items = readList(own(obj, 'items'), readSnapshot);
  if (items === null) return null;
  return { occasion, currency, items };
}

/**
 * The value as a BundleResultState when every field has the right JSON type
 * and `currency` is a string whenever `selection` is not empty, else `null`.
 */
export function readBundleResult(value: JsonValue | undefined): BundleResultState | null {
  const obj = asObject(value);
  if (obj === null) return null;
  const total = own(obj, 'total');
  const currency = own(obj, 'currency');
  if (!isNumber(total)) return null;
  if (currency === undefined || (currency !== null && typeof currency !== 'string')) return null;
  const selection = readList(own(obj, 'selection'), readLine);
  const suggestions = readList(own(obj, 'suggestions'), readLine);
  if (selection === null || suggestions === null) return null;
  if (selection.length > 0 && currency === null) return null;
  return { selection, total, currency, suggestions };
}
