// Property test for RecallNodeView responses (design Property 17, section C12).
// The expected Tries come from an independent model of the Try_Rules written in this file
// (`maxRetries + 1` Tries allowed; a correct Try or the last allowed Try ends the question).
// A passing run is evidence for the property over the generated inputs, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import { response_recall } from '../generated/practice-path.validators.js';
import { recallNodeType, type RecallConfig, type RecallResponse } from '../src/node-types/recall.ts';
import { RecallNodeView } from '../src/views/RecallNodeView.tsx';
import { recallConfigArb } from './practice-arbitraries.ts';

type Step = { readonly kind: 'pick'; readonly index: number } | { readonly kind: 'check' };

/** 0–12 option picks (indexes reduced modulo the radio count) and Check activations. */
const stepsArb: fc.Arbitrary<Step[]> = fc.array(
  fc.oneof(
    fc.nat({ max: 9 }).map((index): Step => ({ kind: 'pick', index })),
    fc.constant<Step>({ kind: 'check' }),
  ),
  { maxLength: 12 },
);

interface Case {
  readonly cfg: RecallConfig;
  readonly nodeState: JsonValue | undefined;
  readonly steps: readonly Step[];
  readonly continues: number;
}

const caseArb: fc.Arbitrary<Case> = recallConfigArb.chain((cfg) => {
  const ids = cfg.options.map((option) => option.id);
  const n = ids.length;
  const storedOrder: fc.Arbitrary<JsonValue | undefined> =
    cfg.shuffle === true
      ? fc.option(
          fc.shuffledSubarray(ids, { minLength: n, maxLength: n }).map((order): JsonValue => ({ order })),
          { nil: undefined },
        )
      : fc.constant(undefined);
  return fc.record({
    cfg: fc.constant(cfg),
    nodeState: storedOrder,
    steps: stepsArb,
    continues: fc.integer({ min: 1, max: 3 }),
  });
});

function runCase({ cfg, nodeState, steps, continues }: Case): void {
  const responses: RecallResponse[] = [];
  const onRespond = (r: RecallResponse): void => {
    responses.push(r);
  };
  try {
    const { container } = render(<RecallNodeView cfg={cfg} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.length).toBe(cfg.options.length);
    const allowed = cfg.maxRetries + 1;

    // Model of the Try_Rules.
    const tries: string[] = [];
    let selected: string | undefined;
    let done = false;

    for (const step of steps) {
      if (step.kind === 'pick') {
        const radio = radios[step.index % radios.length];
        if (radio === undefined) throw new Error('No radio to pick.');
        // A disabled option cannot be picked; skip it, as a player could not activate it.
        if (!radio.disabled) {
          fireEvent.click(radio);
          selected = radio.value;
        }
      } else {
        const check = container.querySelector<HTMLButtonElement>('button[type="submit"]');
        expect(check === null).toBe(done);
        if (check !== null) {
          fireEvent.click(check);
          if (selected !== undefined) {
            tries.push(selected);
            if (selected === cfg.correctOptionId || tries.length >= allowed) done = true;
            else selected = undefined;
          }
        }
      }

      // Each tried option is disabled.
      for (const radio of radios) {
        if (tries.includes(radio.value)) expect(radio.disabled).toBe(true);
      }
      // While Tries remain after a wrong Try: only the retry text, no explanation, no answer.
      if (!done && tries.length > 0) {
        const feedback = container.querySelector('.pp-feedback');
        if (feedback === null) throw new Error('No feedback after a wrong Try.');
        const left = allowed - tries.length;
        expect([...feedback.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
          'Not quite. Try again.',
          left === 1 ? '1 try left' : `${left} tries left`,
        ]);
        expect(container.querySelector('.dr-body')).toBeNull();
      }
      expect(responses.length).toBe(0);
    }

    for (let i = 0; i < continues; i += 1) {
      const cont = container.querySelector<HTMLButtonElement>('button[type="button"]');
      expect(cont === null).toBe(!done);
      if (cont !== null) fireEvent.click(cont);
    }

    expect(responses.length).toBe(done ? 1 : 0);
    const response = responses[0];
    if (response !== undefined) {
      expect(response).toEqual({ tries });
      expect(recallNodeType.isValidResponse(cfg, response)).toBe(true);
      expect(response_recall(response)).toBe(true);
    }
  } finally {
    cleanup();
  }
}

describe('Feature: practice-path, Property 17: The recall view sends only valid responses', () => {
  // **Validates: Requirements 15.4, 15.7, 15.8, 15.10**
  it(
    'disables tried options, hides the answer while Tries remain, and responds at most once with the Tries in order',
    () => {
      fc.assert(fc.property(caseArb, runCase), { numRuns: 100 });
    },
    170_000,
  );
});
