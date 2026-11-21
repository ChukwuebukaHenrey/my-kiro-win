// Property test for CollectionSelectNodeView responses (design Property 12, section C9).
// The node state comes from `selectNodeState`, as `enter` stores it. The expected outcome comes
// from an independent model of the checked set and the Selection_Rules written in this file.
// A passing run is evidence for the property over the generated inputs, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AttemptState, JsonValue } from '@dreame/runtime';
import { response_collectionSelect } from '../generated/shop-challenge.validators.js';
import {
  collectionSelectNodeType,
  selectNodeState,
  type CollectionSelectConfig,
  type CollectionSelectResponse,
  type SelectItem,
} from '../src/node-types/collectionSelect.ts';
import { CollectionSelectNodeView } from '../src/views/CollectionSelectNodeView.tsx';
import { itemIdArb, selectConfigArb } from './shop-arbitraries.ts';

const OCC = 'occ';
const PICK = 'pick';

function attemptAt(answers: AttemptState['answers']): AttemptState {
  return {
    activityId: 'shop-property',
    manifestVersion: 1,
    seed: 1,
    rngState: 1,
    status: 'playing',
    currentNodeId: PICK,
    vars: {},
    answers,
    nodeState: {},
    path: [{ nodeId: PICK, at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

/** The node state that `enter` stores for `answers`, as a JSON value. */
function nodeStateFor(cfg: CollectionSelectConfig, answers: AttemptState['answers']): JsonValue {
  const ns = selectNodeState(cfg, attemptAt(answers));
  return {
    occasion: ns.occasion,
    currency: ns.currency,
    items: ns.items.map((item) => {
      const base = { id: item.id, name: item.name, price: item.price, tags: [...item.tags] };
      return item.emoji === undefined ? base : { ...base, emoji: item.emoji };
    }),
  };
}

/** Independent model of the Offered_Items: every Item without an occasion, else those open to it. */
function modelOffered(cfg: CollectionSelectConfig, occasion: string | undefined): SelectItem[] {
  if (occasion === undefined) return [...cfg.items];
  return cfg.items.filter((item) => item.occasions === undefined || item.occasions.includes(occasion));
}

/** Independent model of the Selection_Rules: IDs offered, count in [min, max], total ≤ budget. */
function modelRulesMet(cfg: CollectionSelectConfig, offered: readonly SelectItem[], ids: readonly string[]): boolean {
  const offeredIds = new Set(offered.map((item) => item.id));
  if (!ids.every((id) => offeredIds.has(id))) return false;
  if (ids.length < cfg.min || ids.length > cfg.max) return false;
  let total = 0;
  for (const item of offered) if (ids.includes(item.id)) total += item.price;
  return total <= cfg.budget;
}

type Step = { readonly kind: 'toggle'; readonly index: number } | { readonly kind: 'continue' };

/** 0–30 toggles (indexes reduced modulo the checkbox count) with 1–4 continue activations interleaved. */
const stepsArb: fc.Arbitrary<Step[]> = fc
  .tuple(fc.array(fc.nat({ max: 99 }), { maxLength: 30 }), fc.array(fc.nat({ max: 30 }), { minLength: 1, maxLength: 4 }))
  .map(([toggles, positions]) => {
    const at = positions.map((p) => p % (toggles.length + 1)).sort((a, b) => a - b);
    const steps: Step[] = [];
    let next = 0;
    toggles.forEach((index, i) => {
      while (next < at.length && at[next] === i) {
        steps.push({ kind: 'continue' });
        next += 1;
      }
      steps.push({ kind: 'toggle', index });
    });
    while (next < at.length) {
      steps.push({ kind: 'continue' });
      next += 1;
    }
    return steps;
  });

interface Case {
  readonly cfg: CollectionSelectConfig;
  /** The Occasion_Source answer; `undefined`: no `occasionFrom`, or the answer is missing. */
  readonly occasion: string | undefined;
  readonly steps: readonly Step[];
}

const caseArb: fc.Arbitrary<Case> = fc.oneof(
  fc.record({ cfg: selectConfigArb({ maxItems: 10 }), occasion: fc.constant(undefined), steps: stepsArb }),
  fc.uniqueArray(itemIdArb, { minLength: 2, maxLength: 4 }).chain((optionIds) =>
    fc.record({
      cfg: selectConfigArb({ maxItems: 10, occasion: { nodeId: OCC, optionIds } }),
      occasion: fc.option(fc.constantFrom(...optionIds), { nil: undefined }),
      steps: stepsArb,
    }),
  ),
);

function runCase({ cfg, occasion, steps }: Case): void {
  const answers: AttemptState['answers'] = occasion === undefined ? {} : { [OCC]: occasion };
  const responses: CollectionSelectResponse[] = [];
  const onRespond = (r: CollectionSelectResponse): void => {
    responses.push(r);
  };
  try {
    const { container } = render(
      <CollectionSelectNodeView cfg={cfg} onRespond={onRespond} nodeState={nodeStateFor(cfg, answers)} rejections={0} />,
    );
    const offered = modelOffered(cfg, occasion);
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    // One checkbox per Offered_Item, in config order.
    expect(boxes.map((b) => b.value)).toEqual(offered.map((item) => item.id));
    const fieldset = container.querySelector('fieldset');
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (fieldset === null || button === null) throw new Error('The view has no fieldset or no submit button.');

    const checked = new Set<string>();
    let responded = false;
    for (const step of steps) {
      if (step.kind === 'toggle') {
        const box = boxes[step.index % boxes.length];
        if (box === undefined) throw new Error('No checkbox to toggle.');
        fireEvent.click(box);
        if (checked.has(box.value)) checked.delete(box.value);
        else checked.add(box.value);
        continue;
      }
      const ids = offered.filter((item) => checked.has(item.id)).map((item) => item.id);
      expect(boxes.filter((b) => b.checked).map((b) => b.value)).toEqual(ids);
      const before = responses.length;
      fireEvent.click(button);
      if (responded) {
        expect(responses.length).toBe(before);
      } else if (modelRulesMet(cfg, offered, ids)) {
        expect(responses.length).toBe(1);
        responded = true;
        const response = responses[0];
        expect(response).toEqual({ itemIds: ids });
        expect(collectionSelectNodeType.isValidResponse(cfg, response)).toBe(true);
        expect(response_collectionSelect(response)).toBe(true);
      } else {
        expect(responses.length).toBe(0);
        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        const alertId = alert?.id ?? '';
        expect(alertId).not.toBe('');
        expect((fieldset.getAttribute('aria-describedby') ?? '').split(' ')).toContain(alertId);
      }
    }
    expect(responses.length).toBe(responded ? 1 : 0);
  } finally {
    cleanup();
  }
}

describe('Feature: shop-challenge, Property 12: The selection view sends only valid responses of offered Items', () => {
  // **Validates: Requirements 10.1, 10.7, 10.8, 10.9, 10.12**
  it(
    'responds once, at the first activation that meets the Selection_Rules, with offered IDs in config order',
    () => {
      fc.assert(fc.property(caseArb, runCase), { numRuns: 100 });
    },
    170_000,
  );
});
