// Property tests for ChoiceNodeView (design Properties 4 and 5, section C7).
// A passing run is evidence for each property over the generated inputs, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { choiceNodeType, type ChoiceConfig, type ChoiceResponse } from '@dreame/node-types';
import type { JsonValue } from '@dreame/runtime';
import { response_choice } from '../../node-types/generated/core.validators.js';
import { validManifestArb } from '../../node-types/test/arbitraries.ts';
import { ChoiceNodeView } from '../src/views/ChoiceNodeView.tsx';

const ignoreResponse = (_r: ChoiceResponse): void => {};

/** Every `choice` config of a `validManifestArb` manifest, as written or with `shuffle: false`. */
const choiceConfigArb: fc.Arbitrary<ChoiceConfig> = validManifestArb
  .map((m) => m.nodes.filter((node) => node.type === 'choice').map((node) => node.config as ChoiceConfig))
  .filter((configs) => configs.length > 0)
  .chain((configs) => fc.tuple(fc.constantFrom(...configs), fc.boolean()))
  .map(([cfg, forceFalse]) => (forceFalse ? { ...cfg, shuffle: false } : cfg));

function optionIds(cfg: ChoiceConfig): string[] {
  return cfg.options.map((option) => option.id);
}

/** `nodeState` values for `cfg`: valid stored orders, damaged values and `undefined`. */
function nodeStateArb(cfg: ChoiceConfig): fc.Arbitrary<unknown> {
  const ids = optionIds(cfg);
  const permutationArb = fc.shuffledSubarray(ids, { minLength: ids.length, maxLength: ids.length });
  return fc.oneof(
    // Valid stored order, alone or next to other keys.
    permutationArb.map((order) => ({ order })),
    fc.tuple(permutationArb, fc.dictionary(fc.string({ maxLength: 4 }), fc.jsonValue({ maxDepth: 1 }))).map(([order, extra]) => {
      const state: Record<string, unknown> = { ...extra };
      Object.defineProperty(state, 'order', { value: order, enumerable: true, writable: true, configurable: true });
      return state;
    }),
    // Damaged orders: partial, duplicated, an unknown ID, a non-string entry, too long.
    fc.shuffledSubarray(ids, { minLength: 0, maxLength: ids.length - 1 }).map((order) => ({ order })),
    fc.tuple(permutationArb, fc.nat()).map(([order, i]) => {
      const copy = [...order];
      copy[i % copy.length] = copy[(i + 1) % copy.length]!;
      return { order: copy };
    }),
    fc.tuple(permutationArb, fc.nat(), fc.constantFrom('zzUnknown', '', '__proto__')).map(([order, i, id]) => {
      const copy = [...order];
      copy[i % copy.length] = id;
      return { order: copy };
    }),
    fc.tuple(permutationArb, fc.nat(), fc.oneof(fc.integer(), fc.constant(null), fc.boolean())).map(([order, i, value]) => {
      const copy: unknown[] = [...order];
      copy[i % copy.length] = value;
      return { order: copy };
    }),
    fc.tuple(permutationArb, fc.constantFrom(...ids)).map(([order, id]) => ({ order: [...order, id] })),
    // Not an array, inherited rather than own, or no `order` at all.
    fc.jsonValue({ maxDepth: 2 }).filter((v) => !Array.isArray(v)).map((order) => ({ order })),
    permutationArb.map((order) => Object.create({ order }) as unknown),
    fc.jsonValue({ maxDepth: 2 }),
    fc.constantFrom<unknown>(undefined, null, {}, [], 'order', 0),
  );
}

/** Independent statement of the design Property 4 rule: the expected radio values. */
function expectedOrder(cfg: ChoiceConfig, nodeState: unknown): string[] {
  const ids = optionIds(cfg);
  if (cfg.shuffle !== true) return ids;
  if (typeof nodeState !== 'object' || nodeState === null || !Object.hasOwn(nodeState, 'order')) return ids;
  const order: unknown = (nodeState as { order: unknown }).order;
  if (!Array.isArray(order) || order.length !== ids.length) return ids;
  if (!order.every((id) => typeof id === 'string')) return ids;
  const sorted = [...(order as string[])].sort();
  const sortedIds = [...ids].sort();
  return sorted.every((id, i) => id === sortedIds[i]) ? (order as string[]) : ids;
}

function displayedValues(cfg: ChoiceConfig, nodeState: unknown): string[] {
  // The cast lets damaged values through, such as an `order` inherited from the prototype.
  const state = nodeState as JsonValue | undefined;
  const { container, unmount } = render(<ChoiceNodeView cfg={cfg} onRespond={ignoreResponse} nodeState={state} />);
  try {
    return [...container.querySelectorAll('input[type="radio"]')].map((radio) => radio.getAttribute('value') ?? '');
  } finally {
    unmount();
  }
}

describe('Feature: ui-renderer, Property 4: Choice options keep a defined order', () => {
  // **Validates: Requirements 10.1, 10.2, 10.3**
  it(
    'shows a permutation of the option IDs: the stored order when shuffle is true and it is a permutation, else config order',
    () => {
      fc.assert(
        fc.property(
          choiceConfigArb.chain((cfg) => fc.tuple(fc.constant(cfg), nodeStateArb(cfg))),
          ([cfg, nodeState]) => {
            const values = displayedValues(cfg, nodeState);
            expect([...values].sort()).toEqual(optionIds(cfg).sort());
            expect(values).toEqual(expectedOrder(cfg, nodeState));
          },
        ),
        { numRuns: 200 },
      );
      cleanup();
    },
    120_000,
  );

  it('follows a stored permutation only when shuffle is true', () => {
    const cfg: ChoiceConfig = {
      prompt: 'Pick one',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
    };
    const state = { order: ['c', 'a', 'b'] };
    expect(displayedValues({ ...cfg, shuffle: true }, state)).toEqual(['c', 'a', 'b']);
    expect(displayedValues(cfg, state)).toEqual(['a', 'b', 'c']);
    expect(displayedValues({ ...cfg, shuffle: true }, { order: ['c', 'c', 'b'] })).toEqual(['a', 'b', 'c']);
    expect(displayedValues({ ...cfg, shuffle: true }, Object.create(state))).toEqual(['a', 'b', 'c']);
  });
});

type SubmitAttempt = 'click' | 'enter';

/**
 * Renders the view, selects the option at `selectedIndex` of `cfg.options`, makes each submit
 * attempt in turn (a click on the submit button, or Enter on the selected radio) and returns
 * every response passed to `onRespond`.
 */
function submitResponses(
  cfg: ChoiceConfig,
  nodeState: unknown,
  selectedIndex: number,
  attempts: readonly SubmitAttempt[],
): unknown[] {
  const responses: unknown[] = [];
  const onRespond = (r: ChoiceResponse): void => {
    responses.push(r);
  };
  // The cast lets damaged values through, such as an `order` inherited from the prototype.
  const state = nodeState as JsonValue | undefined;
  const { container, unmount } = render(<ChoiceNodeView cfg={cfg} onRespond={onRespond} nodeState={state} />);
  try {
    const wanted = cfg.options[selectedIndex]!.id;
    const radio = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => r.value === wanted);
    if (radio === undefined) throw new Error(`No radio has the value "${wanted}".`);
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button === null || button.textContent !== 'Submit') throw new Error('No submit button labelled "Submit".');
    fireEvent.click(radio);
    expect(radio.checked).toBe(true);
    for (const attempt of attempts) {
      if (attempt === 'click') fireEvent.click(button);
      else fireEvent.keyDown(radio, { key: 'Enter', code: 'Enter' });
    }
    return responses;
  } finally {
    unmount();
  }
}

describe('Feature: ui-renderer, Property 5: A choice submission yields one valid response', () => {
  // **Validates: Requirements 10.5, 10.8, 10.9**
  it(
    'calls onRespond exactly once with { optionId } of the selected option, valid for isValidResponse and response_choice',
    () => {
      fc.assert(
        fc.property(
          choiceConfigArb.chain((cfg) =>
            fc.tuple(
              fc.constant(cfg),
              nodeStateArb(cfg),
              fc.nat({ max: cfg.options.length - 1 }),
              fc.array(fc.constantFrom<SubmitAttempt>('click', 'enter'), { minLength: 1, maxLength: 4 }),
            ),
          ),
          ([cfg, nodeState, selectedIndex, attempts]) => {
            const responses = submitResponses(cfg, nodeState, selectedIndex, attempts);
            expect(responses).toEqual([{ optionId: cfg.options[selectedIndex]!.id }]);
            const response = responses[0];
            expect(choiceNodeType.isValidResponse(cfg, response)).toBe(true);
            expect(response_choice(response)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
      cleanup();
    },
    120_000,
  );

  it('submits once for a click followed by Enter and for repeated Enter', () => {
    const cfg: ChoiceConfig = {
      prompt: 'Pick one',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    };
    expect(submitResponses(cfg, undefined, 1, ['click', 'enter'])).toEqual([{ optionId: 'b' }]);
    expect(submitResponses(cfg, undefined, 0, ['enter', 'enter', 'enter', 'enter'])).toEqual([{ optionId: 'a' }]);
  });
});
