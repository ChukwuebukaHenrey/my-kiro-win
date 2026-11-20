// Property 1 (design "Correctness Properties"; Architecture Spec §A3 property (a)).
// A passing run is evidence for this property over the generated manifests, not a proof.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AttemptState, Runtime } from '@dreame/runtime';
import { acceptedResponseArb, playManifest, runtimeFor, validManifestArb } from './arbitraries.ts';

function isTerminalNode(rt: Runtime, id: string): boolean {
  const node = rt.nodes.get(id);
  if (node === undefined) return false;
  return rt.profile.registry.get(node.type)?.terminal === true;
}

describe('Feature: runtime-core, Property 1: Valid manifests reach an outcome within maxTransitions', () => {
  /**
   * **Validates: Requirements 15.12, 15.15**
   */
  it('Feature: runtime-core, Property 1: Valid manifests reach an outcome within maxTransitions', () => {
    fc.assert(
      fc.property(validManifestArb, fc.integer({ min: 0, max: 0xffffffff }), fc.gen(), (manifest, seed, g) => {
        const rt = runtimeFor(manifest);
        const maxTransitions = rt.manifest.limits.maxTransitions;
        const states: AttemptState[] = playManifest(rt, {
          seed,
          choose: (s) => g(acceptedResponseArb, rt, s),
        });
        const actions = states.length - 1;
        const last = states[states.length - 1];
        if (last === undefined) throw new Error('playManifest returned no states');

        expect(actions).toBeLessThanOrEqual(maxTransitions + 1);
        expect(last.status).not.toBe('playing');
        expect(isTerminalNode(rt, last.currentNodeId)).toBe(true);
        for (const s of states) {
          expect(s.transitions).toBeGreaterThanOrEqual(0);
          expect(s.transitions).toBeLessThanOrEqual(maxTransitions);
        }
      }),
      { numRuns: 100 },
    );
    // Each run validates and plays a manifest of up to 12 nodes; 100 runs exceed Vitest's 5 s default.
  }, 120_000);
});

function isUint32(x: unknown): boolean {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
}

/** Checks every `AttemptState` invariant in design Data Models (Req 15.12) for one state. */
function expectAttemptInvariants(rt: Runtime, s: AttemptState): void {
  const { manifest } = rt;
  // Plain JSON: `toStrictEqual` also fails on `undefined` properties and on `-0` becoming `0`.
  expect(JSON.parse(JSON.stringify(s))).toStrictEqual(s);
  expect(isUint32(s.seed)).toBe(true);
  expect(isUint32(s.rngState)).toBe(true);
  expect(s.transitions).toBeGreaterThanOrEqual(0);
  expect(s.transitions).toBeLessThanOrEqual(manifest.limits.maxTransitions);
  expect(s.path.length).toBeGreaterThan(0);
  expect(s.path[s.path.length - 1]?.nodeId).toBe(s.currentNodeId);
  expect(rt.nodes.has(s.currentNodeId)).toBe(true);
  expect(s.status === 'playing').toBe(!isTerminalNode(rt, s.currentNodeId));
  if (s.status === 'limit_reached') expect(s.currentNodeId).toBe(manifest.fallbackOutcomeId);

  expect(Object.keys(s.vars).sort()).toStrictEqual(manifest.variables.map((v) => v.id).sort());
  for (const decl of manifest.variables) {
    const value = s.vars[decl.id];
    if (decl.type === 'number') {
      expect(typeof value).toBe('number');
      const n = value as number;
      expect(Number.isFinite(n)).toBe(true);
      if (decl.min !== undefined) expect(n).toBeGreaterThanOrEqual(decl.min);
      if (decl.max !== undefined) expect(n).toBeLessThanOrEqual(decl.max);
    } else if (decl.type === 'boolean') {
      expect(typeof value).toBe('boolean');
    } else {
      expect(typeof value).toBe('string');
      expect(decl.values).toContain(value);
    }
  }
}

describe('Feature: runtime-core, Property 7: AttemptState invariants hold after every step', () => {
  /**
   * **Validates: Requirements 15.2, 15.8, 15.12**
   */
  it('Feature: runtime-core, Property 7: AttemptState invariants hold after every step', () => {
    fc.assert(
      fc.property(validManifestArb, fc.integer({ min: 0, max: 0xffffffff }), fc.gen(), (manifest, seed, g) => {
        const rt = runtimeFor(manifest);
        const states = playManifest(rt, { seed, choose: (s) => g(acceptedResponseArb, rt, s) });
        const first = states[0];
        if (first === undefined) throw new Error('playManifest returned no states');

        // Req 15.2: the initial state from `createAttempt`.
        expect(first.seed).toBe(seed);
        expect(first.currentNodeId).toBe(rt.manifest.entryNodeId);
        expect(first.transitions).toBe(0);
        for (const decl of rt.manifest.variables) expect(first.vars[decl.id]).toBe(decl.initial);

        for (const s of states) {
          expectAttemptInvariants(rt, s);
          expect(s.seed).toBe(seed);
          // Req 15.8: a terminal reached other than through the limit has status `finished`.
          if (s.status === 'finished') {
            expect(s.events.some((e) => e.type === 'finished')).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
