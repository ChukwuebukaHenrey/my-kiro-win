// Property test for ActivityPlayer (design Property 7, section C10).
// A passing run is evidence for the property over the generated inputs, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coreProfile, type ChoiceConfig } from '@dreame/node-types';
import { createRuntime } from '@dreame/runtime';
import { validateManifest, type Manifest, type ValidManifest } from '@dreame/schema';
import { playManifest, validManifestArb } from '../../node-types/test/arbitraries.ts';
import { ActivityPlayer } from '../src/components/ActivityPlayer.tsx';
import { coreViews } from '../src/core-views.ts';

// Imported as a module: under jsdom, `import.meta.url` is not a file URL, so `readFileSync` cannot locate it.
import demoJson from '../../../activities/core-demo-study-break.json';

/** The fixed clock value used by the player and by `playManifest`. */
const NOW = 1_700_000_000_000;
const fixedNow = (): number => NOW;

function validated(m: unknown): ValidManifest {
  const result = validateManifest(m, coreProfile);
  if (!result.ok) throw new Error(`manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

const demoManifest = validated(demoJson);

/** The demo manifest or a `validManifestArb` manifest, plus a uint32 seed and option picks. */
const playArb = fc.record({
  manifest: fc.oneof(fc.constant<Manifest | null>(null), validManifestArb),
  seed: fc.integer({ min: 0, max: 0xffff_ffff }),
  picks: fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 6 }),
});

function player(container: HTMLElement): HTMLElement {
  const section = container.querySelector('section.dr-player');
  if (!(section instanceof HTMLElement)) throw new Error('no player section');
  return section;
}

/**
 * Plays `manifest` through the ActivityPlayer with `fireEvent` and checks, before the first step
 * and after every step, that the displayed node is the `currentNodeId` that `reduce` returns for
 * the same seed, picks and clock. Step `i` uses `picks[i % picks.length]`, as `playManifest` does.
 */
function checkPlay(manifest: ValidManifest, seed: number, picks: readonly number[]): void {
  const rt = createRuntime(coreProfile, manifest);
  const states = playManifest(rt, { seed, picks, startAt: NOW, stepMs: 0 });
  const { container, unmount } = render(
    <ActivityPlayer profile={coreProfile} manifest={manifest} seed={seed} views={coreViews} now={fixedNow} />,
  );
  try {
    for (let step = 0; step < states.length; step++) {
      const expected = states[step]!;
      const section = player(container);
      expect(section.getAttribute('data-node-id')).toBe(expected.currentNodeId);
      expect(section.querySelector('[role="alert"]')).toBeNull();
      const node = rt.nodes.get(expected.currentNodeId);
      if (node === undefined) throw new Error(`no node "${expected.currentNodeId}"`);
      if (expected.status === 'finished') expect(node.type).toBe('outcome');
      if (step === states.length - 1) break;

      if (node.type === 'content') {
        const button = section.querySelector<HTMLButtonElement>('button[type="button"]');
        if (button === null) throw new Error(`no continue button at "${node.id}"`);
        fireEvent.click(button);
      } else if (node.type === 'choice') {
        const options = (node.config as ChoiceConfig).options;
        const pick = picks[step % picks.length]!;
        const wanted = options[pick % options.length]!.id;
        const radio = [...section.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => r.value === wanted);
        if (radio === undefined) throw new Error(`no radio "${wanted}" at "${node.id}"`);
        fireEvent.click(radio);
        const submit = section.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submit === null) throw new Error(`no submit button at "${node.id}"`);
        fireEvent.click(submit);
      } else {
        throw new Error(`unexpected node type "${node.type}" at a playing step`);
      }
    }
  } finally {
    unmount();
  }
}

describe("Feature: ui-renderer, Property 7: The player shows the reducer's node", () => {
  // **Validates: Requirements 13.1, 13.2, 13.3, 13.6**
  it(
    'displays the currentNodeId of reduce after every step, and the reached outcome when finished',
    () => {
      fc.assert(
        fc.property(playArb, ({ manifest, seed, picks }) => {
          checkPlay(manifest === null ? demoManifest : validated(manifest), seed, picks);
        }),
        { numRuns: 150 },
      );
      cleanup();
    },
    120_000,
  );
});
