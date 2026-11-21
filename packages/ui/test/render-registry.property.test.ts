import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRenderRegistry, type RenderEntry, type RenderModule } from '../src/render.ts';

// Names that would resolve to inherited values on a plain object, plus core type names.
const specialNames = [
  '__proto__',
  'toString',
  'constructor',
  'hasOwnProperty',
  'valueOf',
  'content',
  'choice',
  'outcome',
  '',
] as const;

// A small pool mixed with free strings, so generated lists repeat names often.
const nameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...specialNames),
  fc.string({ maxLength: 8 }),
);

// One distinct function per entry, so `toBe` checks identity of the given module.
function toEntries(names: readonly string[]): { entries: RenderEntry[]; modules: RenderModule[] } {
  const modules: RenderModule[] = names.map((_, i) => () => i);
  const entries: RenderEntry[] = names.map((type, i) => ({ type, Render: modules[i]! }));
  return { entries, modules };
}

/** The first name in entry order that already appeared earlier, or `undefined`. */
function firstRepeat(names: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) return name;
    seen.add(name);
  }
  return undefined;
}

describe('Feature: ui-renderer, Property 6: The render registry returns what it was given', () => {
  // **Validates: Requirements 12.2, 12.3**
  it('returns each given module, undefined for other names, and types() in entry order', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(nameArb, { maxLength: 12 }),
        fc.array(nameArb, { maxLength: 12 }),
        (names, probes) => {
          const { entries, modules } = toEntries(names);
          const registry = createRenderRegistry(entries);

          names.forEach((name, i) => {
            expect(registry.get(name)).toBe(modules[i]);
          });
          for (const probe of [...probes, ...specialNames]) {
            if (!names.includes(probe)) expect(registry.get(probe)).toBeUndefined();
          }
          expect(registry.types()).toEqual(names);
          expect(Object.isFrozen(registry.types())).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  // **Validates: Requirements 12.3**
  it('throws an Error naming the repeated type exactly when a name repeats', () => {
    fc.assert(
      fc.property(fc.array(nameArb, { maxLength: 12 }), (names) => {
        const { entries } = toEntries(names);
        const repeat = firstRepeat(names);
        if (repeat === undefined) {
          expect(() => createRenderRegistry(entries)).not.toThrow();
          return;
        }
        let thrown: unknown;
        try {
          createRenderRegistry(entries);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toBe(`createRenderRegistry: duplicate node type "${repeat}"`);
      }),
      { numRuns: 200 },
    );
  });
});
