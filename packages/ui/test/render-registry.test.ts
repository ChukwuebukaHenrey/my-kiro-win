import { describe, expect, it } from 'vitest';
import { createRenderRegistry, type RenderEntry, type RenderModule } from '../src/render.ts';

// Plain functions stand in for views; the registry only stores and returns them.
const viewA: RenderModule = () => 'a';
const viewB: RenderModule = () => 'b';
const viewC: RenderModule = () => 'c';

const entries: readonly RenderEntry[] = [
  { type: 'content', Render: viewA },
  { type: 'choice', Render: viewB },
  { type: 'outcome', Render: viewC },
];

describe('createRenderRegistry (Requirements 12.2, 12.3)', () => {
  it('returns the module registered for each of three types', () => {
    const registry = createRenderRegistry(entries);
    expect(registry.get('content')).toBe(viewA);
    expect(registry.get('choice')).toBe(viewB);
    expect(registry.get('outcome')).toBe(viewC);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('lists types in entry order', () => {
    expect(createRenderRegistry(entries).types()).toEqual(['content', 'choice', 'outcome']);
    expect(createRenderRegistry([...entries].reverse()).types()).toEqual([
      'outcome',
      'choice',
      'content',
    ]);
  });

  it('throws an Error naming the duplicate type', () => {
    const build = (): unknown =>
      createRenderRegistry([...entries, { type: 'choice', Render: viewC }]);
    expect(build).toThrow(Error);
    expect(build).toThrow('createRenderRegistry: duplicate node type "choice"');
  });

  it('does not resolve inherited object names', () => {
    const registry = createRenderRegistry(entries);
    expect(registry.get('__proto__')).toBeUndefined();
    expect(registry.get('toString')).toBeUndefined();
    expect(registry.get('constructor')).toBeUndefined();
  });
});
