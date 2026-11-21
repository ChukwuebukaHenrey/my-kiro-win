// Property test for text rendering in the two shop views (design Property 14, sections C9, C10;
// Requirements 10.2, 10.11, 11.1, 11.2, 11.4). Generated strings, including markup, stay within
// the config schema limits of design C7 and C8 and are non-blank where `blank-text` applies.
// A passing run is evidence for this property over the generated strings, not a proof.
import { cleanup, render, within } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AttemptState, JsonValue } from '@dreame/runtime';
import { formatPrice } from '../src/format.ts';
import type { BundleLine } from '../src/node-types/bundle-rules.ts';
import { selectNodeState, type CollectionSelectConfig, type SelectItem } from '../src/node-types/collectionSelect.ts';
import { bundleResult, type RecommendOutcomeConfig } from '../src/node-types/recommendOutcome.ts';
import { CollectionSelectNodeView } from '../src/views/CollectionSelectNodeView.tsx';
import { RecommendOutcomeNodeView } from '../src/views/RecommendOutcomeNodeView.tsx';
import { itemIdArb, SAFE_CONTACT_URLS } from './shop-arbitraries.ts';

const NUM_RUNS = 100;
const TIMEOUT_MS = 120_000;
const PICK = 'pick';

// Markup fragments whose tags must never become elements, mixed with text that HTML parsing
// would change (entities, line breaks, quotes). Same list as ui-renderer Property 2.
const MARKUP_FRAGMENTS = [
  '<b>x</b>',
  '<img src=x>',
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '<i>',
  '</p>',
  '<a href="https://example.com/">a</a>',
  '<svg onload=alert(1)>',
  '<iframe src="https://example.com/">',
  '&amp;',
  '&lt;b&gt;',
  '\n',
  '\r\n',
  '  ',
  '"',
  "'",
] as const;

/** Tag names the markup fragments name; none of them may appear in a rendered view. */
const MARKUP_TAGS = ['b', 'img', 'script', 'i', 'a', 'svg', 'iframe'] as const;

const markupStringArb = fc
  .array(fc.oneof(fc.constantFrom(...MARKUP_FRAGMENTS), fc.string({ maxLength: 6 })), { maxLength: 6 })
  .map((parts) => parts.join(''));

/**
 * Strings of at most `maxLength` UTF-16 code units (so also at most `maxLength` code points, as
 * the schema counts), at least `minLength` long, and not only whitespace when `nonBlank` is set.
 */
function textArb(maxLength: number, opts: { readonly minLength?: number; readonly nonBlank?: boolean } = {}): fc.Arbitrary<string> {
  const minLength = opts.minLength ?? 0;
  const short = Math.min(20, maxLength);
  return fc
    .oneof(
      markupStringArb,
      fc.string({ maxLength: Math.min(40, maxLength) }),
      fc.string({ unit: 'grapheme', maxLength: short }),
      fc.string({ unit: 'binary', maxLength: short }),
    )
    .map((s) => s.slice(0, maxLength))
    .filter((s) => s.length >= minLength && (opts.nonBlank !== true || s.trim() !== ''));
}

/** Whitespace handling of the accessible name computation (dom-accessibility-api): trim, then collapse runs. */
function accName(s: string): string {
  return s.trim().replace(/\s\s+/g, ' ');
}

/** Fails when the view created an element named by the generated markup. */
function expectNoMarkupElements(container: HTMLElement): void {
  for (const tag of MARKUP_TAGS) expect(container.querySelector(tag)).toBeNull();
}

function attemptAt(answers: AttemptState['answers'], nodeState: AttemptState['nodeState']): AttemptState {
  return {
    activityId: 'shop-text',
    manifestVersion: 1,
    seed: 1,
    rngState: 1,
    status: 'playing',
    currentNodeId: PICK,
    vars: {},
    answers,
    nodeState,
    path: [{ nodeId: PICK, at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

/** The `collectionSelect` node state that `enter` stores (no occasion), as a JSON value. */
function selectStateJson(cfg: CollectionSelectConfig): JsonValue {
  const ns = selectNodeState(cfg, attemptAt({}, {}));
  return {
    occasion: ns.occasion,
    currency: ns.currency,
    items: ns.items.map((item) => {
      const base = { id: item.id, name: item.name, price: item.price, tags: [...item.tags] };
      return item.emoji === undefined ? base : { ...base, emoji: item.emoji };
    }),
  };
}

function lineJson(line: BundleLine): JsonValue {
  const base = { id: line.id, name: line.name, price: line.price };
  return line.emoji === undefined ? base : { ...base, emoji: line.emoji };
}

// ---------------------------------------------------------------------------
// Generators (limits of design C7 and C8)
// ---------------------------------------------------------------------------

const currencyArb = fc.constantFrom('USD', 'EUR', 'NGN', 'GBP');

function itemArb(id: string): fc.Arbitrary<SelectItem> {
  return fc
    .record({
      name: textArb(80, { nonBlank: true }),
      price: fc.integer({ min: 0, max: 1000 }),
      tags: fc.array(textArb(32, { minLength: 1 }), { maxLength: 3 }),
      emoji: fc.option(textArb(16, { minLength: 1 }), { nil: undefined }),
    })
    .map(({ emoji, ...rest }): SelectItem => ({ id, ...rest, ...(emoji === undefined ? {} : { emoji }) }));
}

/** 1–4 Items with unique IDs; `min: 1`, `max` the Item count and `budget` at least the sum of prices. */
const itemsArb: fc.Arbitrary<SelectItem[]> = fc
  .uniqueArray(itemIdArb, { minLength: 1, maxLength: 4 })
  .chain((ids) => fc.tuple(...ids.map((id) => itemArb(id))));

const selectCfgArb: fc.Arbitrary<CollectionSelectConfig> = fc
  .record({
    prompt: textArb(500, { nonBlank: true }),
    items: itemsArb,
    currency: currencyArb,
    pricesAsOf: fc.option(fc.constantFrom('2026-11-21', '2025-01-31'), { nil: undefined }),
    continueLabel: fc.option(textArb(40), { nil: undefined }),
  })
  .map(({ prompt, items, currency, pricesAsOf, continueLabel }): CollectionSelectConfig => ({
    prompt,
    items,
    min: 1,
    max: items.length,
    budget: Math.max(1, items.reduce((sum, item) => sum + item.price, 0)),
    currency,
    ...(pricesAsOf === undefined ? {} : { pricesAsOf }),
    ...(continueLabel === undefined ? {} : { continueLabel }),
  }));

interface ResultCase {
  readonly selectCfg: CollectionSelectConfig;
  readonly cfg: RecommendOutcomeConfig;
  readonly itemIds: readonly string[];
}

const resultCaseArb: fc.Arbitrary<ResultCase> = selectCfgArb.chain((selectCfg) =>
  fc
    .record({
      picked: fc.subarray(selectCfg.items.map((item) => item.id)),
      title: textArb(120, { nonBlank: true }),
      body: textArb(2000),
      whyText: fc.option(textArb(300), { nil: undefined }),
      recommend: fc.option(
        fc.record({ sortBy: fc.constantFrom('priceAsc' as const, 'priceDesc' as const), limit: fc.integer({ min: 1, max: 8 }) }),
        { nil: undefined },
      ),
      contacts: fc.option(
        fc.array(fc.record({ label: textArb(60, { nonBlank: true }), url: fc.constantFrom(...SAFE_CONTACT_URLS) }), { maxLength: 3 }),
        { nil: undefined },
      ),
    })
    .map(({ picked, title, body, whyText, recommend, contacts }): ResultCase => ({
      selectCfg,
      itemIds: picked,
      cfg: {
        title,
        body,
        from: PICK,
        ...(whyText === undefined ? {} : { whyText }),
        ...(recommend === undefined ? {} : { recommend }),
        ...(contacts === undefined ? {} : { contacts }),
      },
    })),
);

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkSelectView(cfg: CollectionSelectConfig): void {
  try {
    const { container } = render(
      <CollectionSelectNodeView cfg={cfg} onRespond={() => {}} nodeState={selectStateJson(cfg)} rejections={0} />,
    );
    expect(container.querySelector('legend')?.textContent).toBe(cfg.prompt);
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe(cfg.continueLabel ?? 'Continue');
    if (cfg.pricesAsOf !== undefined) {
      expect(container.querySelector('fieldset > .dr-note')?.textContent ?? '').toContain(cfg.pricesAsOf);
    }

    const rows = [...container.querySelectorAll<HTMLLIElement>('ul.shop-products > li')];
    expect(rows).toHaveLength(cfg.items.length);
    // Accessible names as Testing Library computes them, keyed by checkbox element.
    const names = new Map<Element, string>();
    within(container).queryAllByRole('checkbox', {
      hidden: true,
      name: (name, element) => {
        names.set(element, name);
        return true;
      },
    });
    cfg.items.forEach((item, i) => {
      const row = rows[i];
      if (row === undefined) throw new Error(`No row for Item ${i}.`);
      const price = formatPrice(item.price, cfg.currency);
      expect(row.querySelector('.shop-product-name')?.textContent).toBe(item.name);
      expect(row.querySelector('.shop-product-price')?.textContent).toBe(price);
      const tags = row.querySelector('.shop-tags');
      if (item.tags.length === 0) {
        expect(tags).toBeNull();
      } else {
        expect(tags?.textContent).toBe(item.tags.join(', '));
        for (const tag of item.tags) expect(tags?.textContent ?? '').toContain(tag);
      }
      const emoji = row.querySelector('.shop-emoji');
      if (item.emoji === undefined) {
        expect(emoji).toBeNull();
      } else {
        expect(emoji?.textContent).toBe(item.emoji);
        expect(emoji?.getAttribute('aria-hidden')).toBe('true');
      }
      const box = row.querySelector('input[type="checkbox"]');
      if (box === null) throw new Error(`No checkbox for Item ${i}.`);
      const name = names.get(box) ?? '';
      expect(name).toContain(accName(item.name));
      expect(name).toContain(accName(price));
    });
    expectNoMarkupElements(container);
  } finally {
    cleanup();
  }
}

/** The `section` whose `h3` reads `heading`, or `null`. */
function sectionByHeading(container: HTMLElement, heading: string): HTMLElement | null {
  return [...container.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === heading) ?? null;
}

function expectLines(section: HTMLElement | null, lines: readonly BundleLine[], currency: string): void {
  if (lines.length === 0) {
    expect(section).toBeNull();
    return;
  }
  if (section === null) throw new Error('Expected a section with lines.');
  const rows = [...section.querySelectorAll<HTMLLIElement>('li')];
  expect(rows).toHaveLength(lines.length);
  lines.forEach((line, i) => {
    const row = rows[i];
    expect(row?.querySelector('.shop-product-name')?.textContent).toBe(line.name);
    expect(row?.querySelector('.shop-product-price')?.textContent).toBe(formatPrice(line.price, currency));
    const emoji = row?.querySelector('.shop-emoji') ?? null;
    if (line.emoji === undefined) expect(emoji).toBeNull();
    else expect(emoji?.textContent).toBe(line.emoji);
  });
}

function checkResultView({ selectCfg, cfg, itemIds }: ResultCase): void {
  const result = bundleResult(cfg, attemptAt({ [PICK]: [...itemIds] }, { [PICK]: selectStateJson(selectCfg) }));
  const nodeState: JsonValue = {
    selection: result.selection.map(lineJson),
    total: result.total,
    currency: result.currency,
    suggestions: result.suggestions.map(lineJson),
  };
  try {
    const { container } = render(<RecommendOutcomeNodeView cfg={cfg} onRespond={() => {}} nodeState={nodeState} rejections={0} />);
    expect(container.querySelector('h2')?.textContent).toBe(cfg.title);
    expect(container.querySelector('p.dr-body')?.textContent).toBe(cfg.body);
    const why = container.querySelector('.shop-why');
    if (cfg.whyText === undefined) expect(why).toBeNull();
    else expect(why?.textContent).toBe(cfg.whyText);

    expectLines(sectionByHeading(container, 'Your bundle'), result.selection, selectCfg.currency);
    expectLines(sectionByHeading(container, 'You might also like'), result.suggestions, selectCfg.currency);

    const contacts = cfg.contacts ?? [];
    const items = [...container.querySelectorAll<HTMLLIElement>('ul.shop-contacts > li')];
    expect(items).toHaveLength(contacts.length);
    contacts.forEach((contact, i) => {
      // A safe URL renders the link button, which holds the label, as the first child of `.dr-link`.
      expect(items[i]?.querySelector('.dr-link')?.firstElementChild?.textContent).toBe(contact.label);
    });
    expectNoMarkupElements(container);
  } finally {
    cleanup();
  }
}

describe('Feature: shop-challenge, Property 14: Shop views show manifest strings as text', () => {
  // **Validates: Requirements 10.2, 10.11, 11.1, 11.2, 11.4**
  it(
    'collectionSelect: prompt, Item names, tags, emoji and continueLabel are text, and each checkbox name holds the name and price',
    () => {
      fc.assert(fc.property(selectCfgArb, checkSelectView), { numRuns: NUM_RUNS });
      cleanup();
    },
    TIMEOUT_MS,
  );

  it(
    'recommendOutcome: title, body, whyText, line and Suggestion names and contact labels are text',
    () => {
      fc.assert(fc.property(resultCaseArb, checkResultView), { numRuns: NUM_RUNS });
      cleanup();
    },
    TIMEOUT_MS,
  );

  it('shows <b>x</b> and <img src=x> literally in every field of both views', () => {
    const b = '<b>x</b>';
    const img = '<img src=x>';
    const selectCfg: CollectionSelectConfig = {
      prompt: b,
      items: [
        { id: 'one', name: img, price: 12, tags: [b, img], emoji: b },
        { id: 'two', name: b, price: 4, tags: [img], emoji: img },
        { id: 'three', name: `${b} ${img}`, price: 7, tags: [] },
      ],
      min: 1,
      max: 3,
      budget: 23,
      currency: 'USD',
      pricesAsOf: '2026-11-21',
      continueLabel: img,
    };
    checkSelectView(selectCfg);
    checkResultView({
      selectCfg,
      itemIds: ['one', 'two'],
      cfg: {
        title: img,
        body: `${b}\n${img}`,
        from: PICK,
        whyText: b,
        recommend: { sortBy: 'priceAsc', limit: 2 },
        contacts: [
          { label: b, url: 'https://wa.me/12125550142' },
          { label: img, url: 'https://t.me/dreame_demo_shop' },
        ],
      },
    });
  });
});
