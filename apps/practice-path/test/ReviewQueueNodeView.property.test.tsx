// Property test for ReviewQueueNodeView responses (design Property 18, section C13).
// The node state has the `{ items, queue }` shape that `reviewQueueNodeType.enter` stores, with
// the generated Queue as `queue`. The Queue is capped at 6 Items to keep the DOM work small.
// A passing run is evidence for the property over the generated inputs, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import { response_reviewQueue } from '../generated/practice-path.validators.js';
import type { ItemSnapshot } from '../src/node-types/practice-state.ts';
import { reviewQueueNodeType, type ReviewQueueConfig, type ReviewQueueResponse } from '../src/node-types/reviewQueue.ts';
import { ReviewQueueNodeView } from '../src/views/ReviewQueueNodeView.tsx';
import { queueArb, snapshotJson } from './practice-arbitraries.ts';

const MAX_QUEUE = 6;

interface Case {
  readonly queue: readonly ItemSnapshot[];
  /** One option pick per Queue Item, reduced modulo that Item's option count. */
  readonly picks: readonly number[];
}

const caseArb: fc.Arbitrary<Case> = queueArb
  .filter((queue) => queue.length > 0)
  .map((queue) => queue.slice(0, MAX_QUEUE))
  .chain((queue) =>
    fc.record({
      queue: fc.constant(queue),
      picks: fc.array(fc.nat({ max: 9 }), { minLength: queue.length, maxLength: queue.length }),
    }),
  );

function runCase({ queue, picks }: Case): void {
  const cfg: ReviewQueueConfig = { title: 'Review', from: queue.map((item) => item.itemId) };
  const nodeState: JsonValue = { items: [], queue: queue.map(snapshotJson) };
  const responses: ReviewQueueResponse[] = [];
  const onRespond = (r: ReviewQueueResponse): void => {
    responses.push(r);
  };
  try {
    const { container } = render(<ReviewQueueNodeView cfg={cfg} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
    const n = queue.length;
    const start = container.querySelector<HTMLButtonElement>('button[type="button"]');
    if (start === null) throw new Error('No Start button.');
    fireEvent.click(start);

    const expected: { itemId: string; optionId: string }[] = [];
    for (let k = 0; k < n; k += 1) {
      const item = queue[k];
      const pick = picks[k];
      if (item === undefined || pick === undefined) throw new Error('Case is shorter than the Queue.');
      expect(container.querySelector('h3')?.textContent).toBe(`Question ${k + 1} of ${n}`);
      const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      expect(radios.map((radio) => radio.value)).toEqual(item.options.map((option) => option.id));
      const radio = radios[pick % radios.length];
      if (radio === undefined) throw new Error('No radio to pick.');
      fireEvent.click(radio);
      const check = container.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (check === null) throw new Error('No Check button.');
      fireEvent.click(check);
      expected.push({ itemId: item.itemId, optionId: radio.value });
      expect(responses.length).toBe(0);
      const next = container.querySelector<HTMLButtonElement>('button[type="button"]');
      if (next === null) throw new Error('No Next button after Check.');
      fireEvent.click(next);
      if (k === n - 1) fireEvent.click(next);
    }

    expect(responses.length).toBe(1);
    const response = responses[0];
    expect(response).toEqual({ answers: expected });
    expect(response?.answers.map((answer) => answer.itemId)).toEqual(queue.map((item) => item.itemId));
    expect(reviewQueueNodeType.isValidResponse(cfg, response)).toBe(true);
    expect(response_reviewQueue(response)).toBe(true);
  } finally {
    cleanup();
  }
}

describe('Feature: practice-path, Property 18: The review view sends one answer per Queue Item in Queue order', () => {
  // **Validates: Requirements 16.2, 16.4, 16.8**
  it(
    'shows "Question k of n" for each Item in Queue order and responds once with every Item_ID and the picked option',
    () => {
      fc.assert(fc.property(caseArb, runCase), { numRuns: 100 });
    },
    170_000,
  );
});
