// Property 4 (design "Correctness Properties"): the `select-unsatisfiable` check of
// `collectionSelect` (design C7 step 5) against an exhaustive subset search written here without
// `bundle-rules.ts`. A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateManifest, type Diagnostic, type Manifest } from '@dreame/schema';
import type { ChoiceConfig } from '@dreame/node-types';
import type { CollectionSelectConfig, SelectItem } from '../src/node-types/collectionSelect.ts';
import { shopProfile } from '../src/profile.ts';
import { itemIdArb, occasionChoiceArb, occasionsListArb } from './shop-arbitraries.ts';

const NUM_RUNS = 200;

const OCC = 'occ';
const PICK = 'pick';
const DONE = 'done';

/** `[occ (choice) →] pick (collectionSelect) → done (outcome)`, following `selectManifest` in collectionSelect.property.test.ts. */
function selectManifest(cfg: CollectionSelectConfig, choice: ChoiceConfig | null): Manifest {
  const pick = { id: PICK, type: 'collectionSelect', config: cfg, edges: [{ to: DONE }] };
  const done = { id: DONE, type: 'outcome', config: { title: 'Thanks', body: 'Your bundle is ready.' }, edges: [] };
  const occ = choice === null ? [] : [{ id: OCC, type: 'choice', config: choice, edges: [{ to: PICK }] }];
  return {
    schemaVersion: 1,
    profile: 'shop-challenge',
    activityId: 'shop-satisfiable-property',
    version: 1,
    requires: choice === null ? { collectionSelect: 1, outcome: 1 } : { choice: 1, collectionSelect: 1, outcome: 1 },
    entryNodeId: choice === null ? PICK : OCC,
    fallbackOutcomeId: DONE,
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [...occ, pick, done],
    theme: 'default',
  } as Manifest;
}

interface Case {
  readonly cfg: CollectionSelectConfig;
  readonly choice: ChoiceConfig | null;
}

/** One Item with small prices so budgets near the cheapest totals are common. */
function itemArb(id: string, optionIds: readonly string[]): fc.Arbitrary<SelectItem> {
  return fc
    .record({
      name: fc.constantFrom('Mug', 'Candle', 'Card', 'Tea', 'Socks'),
      price: fc.integer({ min: 0, max: 50 }),
      occasions: optionIds.length === 0 ? fc.constant(undefined) : fc.option(occasionsListArb(optionIds), { nil: undefined }),
    })
    .map(({ name, price, occasions }): SelectItem => ({
      id,
      name,
      price,
      tags: [],
      ...(occasions === undefined ? {} : { occasions }),
    }));
}

/** Configs with 1–10 Items, with or without an Occasion_Source; `min` may exceed `max`. */
const caseArb: fc.Arbitrary<Case> = fc.option(occasionChoiceArb, { nil: null }).chain((choice) => {
  const optionIds = choice === null ? [] : choice.options.map((o) => o.id);
  return fc
    .uniqueArray(itemIdArb, { minLength: 1, maxLength: 10 })
    .chain((ids) =>
      fc.record({
        items: fc.tuple(...ids.map((id) => itemArb(id, optionIds))),
        min: fc.integer({ min: 1, max: 6 }),
        max: fc.integer({ min: 1, max: 6 }),
        budget: fc.integer({ min: 1, max: 150 }),
      }),
    )
    .map(({ items, min, max, budget }): Case => ({
      choice,
      cfg: {
        prompt: 'Build a bundle.',
        items: [...items],
        min,
        max,
        budget,
        currency: 'USD',
        ...(choice === null ? {} : { occasionFrom: OCC }),
      },
    }));
});

/** Offered_Items for `v` (`null`: no Occasion_Source): Items with no `occasions`, or with `v` in it. */
function offeredFor(items: readonly SelectItem[], v: string | null): SelectItem[] {
  return items.filter((i) => v === null || i.occasions === undefined || i.occasions.includes(v));
}

/** Exhaustive search: is there a subset of `offered` with size in [min, max] and price total ≤ budget? */
function someSubsetMeetsRules(offered: readonly SelectItem[], cfg: CollectionSelectConfig): boolean {
  const n = offered.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let count = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) {
        count += 1;
        total += offered[i]?.price ?? 0;
      }
    }
    if (count >= cfg.min && count <= cfg.max && total <= cfg.budget) return true;
  }
  return false;
}

function prefixFor(v: string | null): string {
  return v === null ? 'No bundle can meet the rules:' : `No bundle can meet the rules for occasion "${v}":`;
}

/** The occasion values named by `select-unsatisfiable` diagnostics, mapped by message prefix. */
function reportedValues(diagnostics: readonly Diagnostic[], values: readonly (string | null)[]): (string | null)[] {
  const out: (string | null)[] = [];
  for (const d of diagnostics) {
    if (d.code !== 'select-unsatisfiable') continue;
    const matches = values.filter((v) => d.message.startsWith(prefixFor(v)));
    expect(matches, `select-unsatisfiable message names no single value: ${d.message}`).toHaveLength(1);
    out.push(matches[0] ?? null);
  }
  return out;
}

describe('Feature: shop-challenge, Property 4: The select-unsatisfiable check agrees with an exhaustive search', () => {
  // **Validates: Requirements 5.11, 5.13**
  it('validateManifest reports select-unsatisfiable for exactly the occasion values with no subset that meets the rules', () => {
    let passed = 0;
    let failed = 0;
    fc.assert(
      fc.property(caseArb, ({ cfg, choice }) => {
        const values: (string | null)[] = choice === null ? [null] : choice.options.map((o) => o.id);
        const expected = values.filter((v) => !someSubsetMeetsRules(offeredFor(cfg.items, v), cfg));

        const result = validateManifest(selectManifest(cfg, choice), shopProfile);

        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        const others = errors.filter((d) => d.code !== 'select-unsatisfiable');
        expect(others.map((d) => `${d.stage}/${d.code} at ${d.path}: ${d.message}`)).toEqual([]);
        for (const d of errors) expect(d.path).toBe(`/nodes/${choice === null ? 0 : 1}/config`);
        // Diagnostics come back sorted, so compare the named values in option order, once each.
        const reported = reportedValues(errors, values);
        expect(reported).toHaveLength(new Set(reported).size);
        expect(values.filter((v) => reported.includes(v))).toEqual(expected);
        expect(result.ok).toBe(expected.length === 0);
        if (result.ok) passed += 1;
        else failed += 1;
      }),
      { numRuns: NUM_RUNS },
    );
    // Both outcomes occur, so the run says something about satisfiable and unsatisfiable configs.
    expect(passed).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
  });
});
