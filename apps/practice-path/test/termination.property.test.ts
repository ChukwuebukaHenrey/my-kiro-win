// Property 8 (design "Correctness Properties"; Architecture Spec §A3 property (a) for the
// practice-path profile). A passing run is evidence for this property over the generated
// manifests, seeds and accepted responses, not a proof.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '@dreame/schema';
import { createRuntime, type AttemptState, type Runtime } from '@dreame/runtime';
import { practiceProfile } from '../src/profile.ts';
import { playPracticeManifest, practiceManifestArb } from './practice-arbitraries.ts';

const NUM_RUNS = 200;

function isTerminalNode(rt: Runtime, id: string): boolean {
  const node = rt.nodes.get(id);
  if (node === undefined) return false;
  return rt.profile.registry.get(node.type)?.terminal === true;
}

describe('Feature: practice-path, Property 8: Practice manifests that pass validation finish within `maxTransitions`', () => {
  // **Validates: Requirements 10.1, 10.4**
  it('Feature: practice-path, Property 8: Practice manifests that pass validation finish within `maxTransitions`', () => {
    const counts = { lesson: { total: 0, valid: 0 }, core: { total: 0, valid: 0 } };
    const failures = new Map<string, number>();
    fc.assert(
      fc.property(
        practiceManifestArb,
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 8 }),
        (manifest, seed, picks) => {
          const kind = manifest.nodes.some((n) => n.type === 'recall') ? 'lesson' : 'core';
          counts[kind].total += 1;
          const result = validateManifest(manifest, practiceProfile);
          if (!result.ok) {
            for (const d of result.diagnostics) {
              if (d.severity !== 'error') continue;
              const key = `${kind} ${d.stage}/${d.code}`;
              failures.set(key, (failures.get(key) ?? 0) + 1);
            }
            return; // the property covers manifests that pass validation
          }
          counts[kind].valid += 1;

          const rt = createRuntime(practiceProfile, result.manifest);
          const maxTransitions = rt.manifest.limits.maxTransitions;
          const states: AttemptState[] = playPracticeManifest(rt, { seed, picks });
          const actions = states.length - 1;
          const last = states[states.length - 1];
          if (last === undefined) throw new Error('playPracticeManifest returned no states');

          expect(actions).toBeLessThanOrEqual(maxTransitions + 1);
          expect(['finished', 'limit_reached']).toContain(last.status);
          expect(isTerminalNode(rt, last.currentNodeId)).toBe(true);
          for (const s of states) {
            expect(s.transitions).toBeGreaterThanOrEqual(0);
            expect(s.transitions).toBeLessThanOrEqual(maxTransitions);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );

    const report = [...failures].map(([key, n]) => `${key} x${n}`).join(', ');
    console.info(
      `Property 8 pass ratio: lesson ${counts.lesson.valid}/${counts.lesson.total}, core ${counts.core.valid}/${counts.core.total}` +
        (report === '' ? '' : `; failing diagnostics: ${report}`),
    );
    // Most generated manifests pass validation, so the property is not checked on an empty set.
    expect(counts.lesson.total).toBeGreaterThan(0);
    expect(counts.core.total).toBeGreaterThan(0);
    expect(counts.lesson.valid / counts.lesson.total, report).toBeGreaterThanOrEqual(0.9);
    expect(counts.core.valid / counts.core.total, report).toBeGreaterThanOrEqual(0.9);
  }, 170_000);
});
