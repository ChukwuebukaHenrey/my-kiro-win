import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sortDiagnostics } from '../src/diagnostics.ts';
import type { Diagnostic, DiagnosticCode, Severity, Stage } from '../src/diagnostics.ts';

const STAGE_ORDER: readonly Stage[] = ['parse', 'schema', 'caps', 'ids', 'refs', 'dag', 'terminal', 'conditions'];

// Small pools so that equal keys and exact duplicates are common.
const CODES: readonly DiagnosticCode[] = ['cycle', 'dangling-ref', 'dead-end', 'schema', 'requires-unused', 'blank-text'];
const PATHS: readonly string[] = ['', '/nodes', '/nodes/0', '/nodes/1', '/nodes/10', '/nodes/2/config', '/Nodes', '/n\u00e9', '/\ud83d\ude00'];
const MESSAGES: readonly string[] = ['', 'a', 'b', 'A', 'msg'];
const NODE_IDS: readonly string[] = ['', 'a', 'b', 'start', 'Z'];

const diagnosticArb: fc.Arbitrary<Diagnostic> = fc
  .record({
    severity: fc.constantFrom<Severity>('error', 'warning'),
    stage: fc.constantFrom(...STAGE_ORDER),
    code: fc.constantFrom(...CODES),
    path: fc.oneof(fc.constantFrom(...PATHS), fc.string({ maxLength: 4 })),
    message: fc.oneof(fc.constantFrom(...MESSAGES), fc.string({ maxLength: 4 })),
    nodeId: fc.option(fc.constantFrom(...NODE_IDS), { nil: undefined }),
  })
  .map(({ nodeId, ...rest }): Diagnostic => (nodeId === undefined ? rest : { ...rest, nodeId }));

/** A list that may also repeat the same object reference several times. */
const listArb: fc.Arbitrary<Diagnostic[]> = fc
  .tuple(fc.array(diagnosticArb, { maxLength: 30 }), fc.array(fc.nat(), { maxLength: 10 }))
  .map(([base, repeats]) => (base.length === 0 ? base : [...base, ...repeats.map((i) => base[i % base.length]!)]));

/** The same list together with a random permutation of it. */
const listAndPermutationArb: fc.Arbitrary<[Diagnostic[], Diagnostic[]]> = listArb.chain((list) =>
  fc.tuple(fc.constant(list), fc.shuffledSubarray(list, { minLength: list.length, maxLength: list.length })),
);

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Reference order written from Req 7.9 and the documented tie-breaks, independent of the implementation. */
function referenceCompare(a: Diagnostic, b: Diagnostic): number {
  const byStage = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
  if (byStage !== 0) return byStage;
  for (const [x, y] of [
    [a.path, b.path],
    [a.code, b.code],
    [a.message, b.message],
    [a.severity, b.severity],
  ] as const) {
    const c = cmp(x, y);
    if (c !== 0) return c;
  }
  // Absent nodeId sorts before any present nodeId, including ''.
  if (a.nodeId === undefined || b.nodeId === undefined) {
    return Number(a.nodeId !== undefined) - Number(b.nodeId !== undefined);
  }
  return cmp(a.nodeId, b.nodeId);
}

function countRefs(list: readonly Diagnostic[]): Map<Diagnostic, number> {
  const counts = new Map<Diagnostic, number>();
  for (const d of list) counts.set(d, (counts.get(d) ?? 0) + 1);
  return counts;
}

// Feature: runtime-core, Property 12: Diagnostic sorting is stable and order-independent
// **Validates: Requirements 7.9**
// A passing run is evidence for this property over the generated lists, not a proof.
describe('Feature: runtime-core, Property 12: Diagnostic sorting is stable and order-independent', () => {
  it('returns a sorted copy with the same multiset and leaves the input unchanged', () => {
    fc.assert(
      fc.property(listArb, (list) => {
        const before = [...list];
        const snapshot = structuredClone(list);
        const out = sortDiagnostics(list);

        expect(out).not.toBe(list);
        for (let i = 1; i < out.length; i++) {
          expect(referenceCompare(out[i - 1]!, out[i]!)).toBeLessThanOrEqual(0);
        }
        expect(countRefs(out)).toEqual(countRefs(list));
        expect(out).toHaveLength(list.length);

        expect(list).toHaveLength(before.length);
        list.forEach((d, i) => expect(d).toBe(before[i]));
        expect(list).toStrictEqual(snapshot);
      }),
      { numRuns: 200 },
    );
  });

  it('gives the same output for any permutation of the input', () => {
    fc.assert(
      fc.property(listAndPermutationArb, ([list, permuted]) => {
        expect(sortDiagnostics(permuted)).toStrictEqual(sortDiagnostics(list));
      }),
      { numRuns: 200 },
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(listArb, (list) => {
        const once = sortDiagnostics(list);
        expect(sortDiagnostics(once)).toStrictEqual(once);
      }),
      { numRuns: 200 },
    );
  });

  it('keeps an absent nodeId distinct from an empty nodeId', () => {
    const base = { severity: 'error', stage: 'refs', code: 'dangling-ref', path: '/nodes/0', message: 'm' } as const;
    const withEmpty: Diagnostic = { ...base, nodeId: '' };
    const without: Diagnostic = { ...base };
    expect(sortDiagnostics([withEmpty, without])).toStrictEqual([without, withEmpty]);
    expect(sortDiagnostics([without, withEmpty])).toStrictEqual([without, withEmpty]);
  });
});
