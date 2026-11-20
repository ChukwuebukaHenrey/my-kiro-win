// Checks for the demo manifest and the broken fixture (Requirement 19.1, 19.6, 19.7).
// These tests are evidence for the cases listed and the property tested, not a proof of correctness.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateManifestText, type Manifest } from '@dreame/schema';
import { coreProfile } from '../src/index.ts';
import { acceptedResponseArb, playManifest, runtimeFor } from './arbitraries.ts';

function readRepoFile(relativeToRepoRoot: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8');
}

const demoText = readRepoFile('activities/core-demo-study-break.json');
const fixtureText = readRepoFile('activities/fixtures/broken-dangling-edge.json');
const productSteering = readRepoFile('.kiro/steering/product.md');

/** Quoted phrases from the "Do not use …" line of the Claim rules in product.md. */
function bannedPhrases(steering: string): string[] {
  const line = steering.split(/\r?\n/).find((l) => l.startsWith('- Do not use "'));
  if (line === undefined) return [];
  return [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? '').filter((p) => p.length > 0);
}

describe('demo manifest and broken fixture', () => {
  it('validates the demo manifest with no diagnostics (Req 19.1)', () => {
    const result = validateManifestText(demoText, coreProfile);
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reports exactly one error, refs/dangling-ref, for the broken fixture (Req 19.7)', () => {
    const result = validateManifestText(fixtureText, coreProfile);
    expect(result.ok).toBe(false);
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.map((d) => `${d.stage}/${d.code}`)).toEqual(['refs/dangling-ref']);
  });

  it('contains no banned phrase in the demo manifest (Req 19.6)', () => {
    const phrases = bannedPhrases(productSteering);
    expect(phrases.length).toBeGreaterThan(0);
    const lower = demoText.toLowerCase();
    for (const phrase of phrases) {
      expect(lower.includes(phrase.toLowerCase()), `demo manifest contains banned phrase "${phrase}"`).toBe(false);
    }
  });
});

describe('Feature: runtime-core, Demo: The demo manifest finishes at an outcome for any seed and accepted responses', () => {
  /**
   * **Validates: Requirements 19.1**
   */
  it('Feature: runtime-core, Demo: The demo manifest finishes at an outcome for any seed and accepted responses', () => {
    const rt = runtimeFor(JSON.parse(demoText) as Manifest);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.gen(), (seed, g) => {
        const states = playManifest(rt, { seed, choose: (s) => g(acceptedResponseArb, rt, s) });
        const last = states[states.length - 1];
        if (last === undefined) throw new Error('playManifest returned no states');
        expect(last.status).toBe('finished');
        expect(rt.nodes.get(last.currentNodeId)?.type).toBe('outcome');
      }),
      { numRuns: 100 },
    );
    // 100 played attempts exceed Vitest's 5 s default on slower machines, as in Property 1.
  }, 120_000);
});
