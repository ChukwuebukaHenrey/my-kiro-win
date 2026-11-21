import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  checkSelection,
  offeredItems,
  readBundleResult,
  readSelectNodeState,
  selectionTotal,
  suggestItems,
  unsatisfiable,
  type RuleItem,
  type SelectionRules,
} from '../src/node-types/bundle-rules.ts';
import { formatPrice, hintText } from '../src/format.ts';
import type { JsonValue } from '@dreame/runtime';

const items: readonly RuleItem[] = [
  { id: 'mug', price: 12, tags: ['kitchen'] },
  { id: 'card', price: 3, tags: ['paper'], occasions: ['birthday'] },
  { id: 'candle', price: 12, tags: ['home'], occasions: ['wedding'] },
  { id: 'tea', price: 8, tags: ['kitchen', 'food'], occasions: ['birthday', 'wedding'] },
];

const rules: SelectionRules = { min: 2, max: 3, budget: 30 };

describe('checkSelection', () => {
  it('reports unknown-item first, with the unknown ID', () => {
    expect(checkSelection(items, rules, ['mug', 'nope', 'mug'])).toEqual({ rule: 'unknown-item', id: 'nope' });
  });

  it('reports repeated-item before the count rules', () => {
    expect(checkSelection(items, rules, ['mug', 'mug'])).toEqual({ rule: 'repeated-item', id: 'mug' });
  });

  it('reports too-few with the number missing', () => {
    expect(checkSelection(items, rules, [])).toEqual({ rule: 'too-few', missing: 2 });
    expect(checkSelection(items, rules, ['card'])).toEqual({ rule: 'too-few', missing: 1 });
  });

  it('reports too-many with the extra count before over-budget', () => {
    expect(checkSelection(items, { min: 1, max: 2, budget: 10 }, ['mug', 'candle', 'tea', 'card'])).toEqual({
      rule: 'too-many',
      extra: 2,
    });
  });

  it('reports over-budget with the amount over', () => {
    expect(checkSelection(items, { min: 2, max: 3, budget: 20 }, ['mug', 'candle'])).toEqual({
      rule: 'over-budget',
      over: 4,
    });
  });

  it('returns null when every rule is met, including a total equal to the budget', () => {
    expect(checkSelection(items, rules, ['mug', 'tea'])).toBeNull();
    expect(checkSelection(items, { min: 2, max: 2, budget: 24 }, ['mug', 'candle'])).toBeNull();
  });
});

describe('selectionTotal', () => {
  it('adds the prices of the named Items and ignores unknown IDs', () => {
    expect(selectionTotal(items, ['mug', 'tea', 'nope'])).toBe(20);
    expect(selectionTotal(items, [])).toBe(0);
  });
});

describe('unsatisfiable', () => {
  it('reports min-above-max', () => {
    expect(unsatisfiable(items, { min: 3, max: 2, budget: 100 })).toEqual({ reason: 'min-above-max' });
  });

  it('reports too-few-offered with the offered count', () => {
    expect(unsatisfiable(items, { min: 5, max: 6, budget: 100 })).toEqual({ reason: 'too-few-offered', offered: 4 });
  });

  it('reports cheapest-over-budget with the sum of the min lowest prices', () => {
    expect(unsatisfiable(items, { min: 3, max: 3, budget: 22 })).toEqual({
      reason: 'cheapest-over-budget',
      cheapest: 23,
    });
  });

  it('returns null for a Satisfiable config', () => {
    expect(unsatisfiable(items, { min: 3, max: 3, budget: 23 })).toBeNull();
  });
});

describe('offeredItems', () => {
  it('returns all Items in config order for a null occasion', () => {
    const result = offeredItems(items, null);
    expect(result.map((i) => i.id)).toEqual(['mug', 'card', 'candle', 'tea']);
    expect(result).not.toBe(items);
  });

  it('keeps Items without occasions and Items listing the occasion, in config order', () => {
    expect(offeredItems(items, 'birthday').map((i) => i.id)).toEqual(['mug', 'card', 'tea']);
    expect(offeredItems(items, 'wedding').map((i) => i.id)).toEqual(['mug', 'candle', 'tea']);
  });
});

describe('suggestItems', () => {
  const pool: readonly RuleItem[] = [
    { id: 'a', price: 5, tags: ['x'] },
    { id: 'b', price: 3, tags: ['x'] },
    { id: 'c', price: 5, tags: ['y'] },
    { id: 'd', price: 3, tags: ['x', 'y'] },
    { id: 'e', price: 9, tags: ['x'] },
  ];

  it('keeps config order on price ties for priceAsc', () => {
    expect(suggestItems(pool, [], { sortBy: 'priceAsc', limit: 8 }).map((i) => i.id)).toEqual([
      'b',
      'd',
      'a',
      'c',
      'e',
    ]);
  });

  it('keeps config order on price ties for priceDesc', () => {
    expect(suggestItems(pool, [], { sortBy: 'priceDesc', limit: 8 }).map((i) => i.id)).toEqual([
      'e',
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  it('drops selected Items, applies every where clause and cuts to limit', () => {
    const result = suggestItems(pool, ['b'], {
      where: [
        { op: 'includes', field: 'tags', value: 'x' },
        { op: 'gte', field: 'price', value: 3 },
        { op: 'lte', field: 'price', value: 5 },
      ],
      sortBy: 'priceAsc',
      limit: 1,
    });
    expect(result.map((i) => i.id)).toEqual(['d']);
  });
});

describe('budgetStatus', () => {
  it('is under at exactly 80% of the budget and close just above it', () => {
    expect(budgetStatus(80, 100)).toBe('under');
    expect(budgetStatus(81, 100)).toBe('close');
    expect(budgetStatus(4, 5)).toBe('under');
    expect(budgetStatus(5, 6)).toBe('close');
  });

  it('is close at exactly 100% of the budget and over just above it', () => {
    expect(budgetStatus(100, 100)).toBe('close');
    expect(budgetStatus(101, 100)).toBe('over');
  });

  it('handles the largest allowed values', () => {
    expect(budgetStatus(800_000_000, 1_000_000_000)).toBe('under');
    expect(budgetStatus(2_400_000_000, 1_000_000_000)).toBe('over');
  });
});

type JsonObject = { [k: string]: JsonValue };

/** Common rejections for both readers: `good` is a well-formed value whose `listKey` entries carry `name`. */
function sharedRejections(
  read: (v: JsonValue | undefined) => unknown,
  good: JsonObject,
  listKey: string,
  field: string,
): void {
  it('returns null for undefined, a non-object and an array', () => {
    expect(read(undefined)).toBeNull();
    expect(read('state')).toBeNull();
    expect(read(7)).toBeNull();
    expect(read(null)).toBeNull();
    expect(read([good])).toBeNull();
  });

  it('returns null for a missing field and a wrong field type', () => {
    const { [field]: _dropped, ...missing } = good;
    expect(read(missing)).toBeNull();
    expect(read({ ...good, [field]: true })).toBeNull();
  });

  it('returns null when a list entry has a numeric name', () => {
    const list = good[listKey];
    if (!Array.isArray(list) || typeof list[0] !== 'object' || list[0] === null || Array.isArray(list[0])) {
      throw new Error('fixture needs an object entry');
    }
    expect(read({ ...good, [listKey]: [{ ...list[0], name: 5 }] })).toBeNull();
  });

  it('returns null when the fields sit only under an own __proto__ key', () => {
    const value = JSON.parse(`{"__proto__": ${JSON.stringify(good)}}`) as JsonObject;
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(read(value)).toBeNull();
  });
}

describe('readSelectNodeState', () => {
  const mug = { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' };
  const card = { id: 'card', name: 'Card', price: 3, tags: [] };
  const list = [mug, card];
  const good: JsonObject = { occasion: 'birthday', currency: 'NGN', items: list };

  it('accepts a well-formed value and returns a fresh copy without undefined fields', () => {
    const result = readSelectNodeState(good);
    expect(result).toEqual(good);
    expect(result?.items).not.toBe(list);
    expect(result?.items[0]).not.toBe(mug);
    expect(result?.items[0]?.tags).not.toBe(mug.tags);
    expect(Object.keys(result?.items[1] ?? {})).toEqual(['id', 'name', 'price', 'tags']);
    expect(readSelectNodeState({ ...good, occasion: null })?.occasion).toBeNull();
  });

  it('returns null for a non-string tag and a non-string emoji', () => {
    expect(readSelectNodeState({ ...good, items: [{ id: 'a', name: 'A', price: 1, tags: [1] }] })).toBeNull();
    expect(readSelectNodeState({ ...good, items: [{ id: 'a', name: 'A', price: 1, tags: [], emoji: 1 }] })).toBeNull();
  });

  sharedRejections(readSelectNodeState, good, 'items', 'currency');
});

describe('readBundleResult', () => {
  const selection = [{ id: 'mug', name: 'Mug', price: 12, emoji: '☕' }];
  const card = { id: 'card', name: 'Card', price: 3 };
  const good: JsonObject = { selection, total: 12, currency: 'NGN', suggestions: [card] };

  it('accepts a well-formed value and returns a fresh copy without undefined fields', () => {
    const result = readBundleResult(good);
    expect(result).toEqual(good);
    expect(result?.selection).not.toBe(selection);
    expect(result?.suggestions[0]).not.toBe(card);
    expect(Object.keys(result?.suggestions[0] ?? {})).toEqual(['id', 'name', 'price']);
  });

  it('accepts a null currency only with an empty selection', () => {
    expect(readBundleResult({ selection: [], total: 0, currency: null, suggestions: [] })).toEqual({
      selection: [],
      total: 0,
      currency: null,
      suggestions: [],
    });
    expect(readBundleResult({ ...good, currency: null })).toBeNull();
  });

  sharedRejections(readBundleResult, good, 'selection', 'total');
});

describe('formatPrice', () => {
  it('formats whole US dollars without decimals', () => {
    expect(formatPrice(12, 'USD')).toBe('$12');
    expect(formatPrice(12, 'USD')).toBe('$12');
  });
});

describe('hintText', () => {
  it('names the count to add or remove, singular and plural', () => {
    expect(hintText({ rule: 'too-few', missing: 1 }, 'USD')).toBe('Add 1 more item');
    expect(hintText({ rule: 'too-few', missing: 2 }, 'USD')).toBe('Add 2 more items');
    expect(hintText({ rule: 'too-many', extra: 1 }, 'USD')).toBe('Remove 1 item');
    expect(hintText({ rule: 'too-many', extra: 2 }, 'USD')).toBe('Remove 2 items');
  });

  it('names the formatted amount over budget', () => {
    expect(hintText({ rule: 'over-budget', over: 2 }, 'USD')).toBe('$2 over budget');
  });

  it('is null for no break and for the two ID rules', () => {
    expect(hintText(null, 'USD')).toBeNull();
    expect(hintText({ rule: 'unknown-item', id: 'nope' }, 'USD')).toBeNull();
    expect(hintText({ rule: 'repeated-item', id: 'mug' }, 'USD')).toBeNull();
  });
});
