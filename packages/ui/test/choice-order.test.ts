import { describe, expect, it } from 'vitest';
import type { ChoiceConfig } from '@dreame/node-types';
import { orderedOptions } from '../src/choice-order.ts';

function config(shuffle?: boolean): ChoiceConfig {
  return {
    prompt: 'Pick one',
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    ...(shuffle === undefined ? {} : { shuffle }),
  };
}

const ids = (cfg: ChoiceConfig, nodeState: unknown): string[] => orderedOptions(cfg, nodeState).map((o) => o.id);

describe('orderedOptions', () => {
  it('keeps config order when shuffle is absent or false, even with a stored order', () => {
    expect(ids(config(), { order: ['c', 'a', 'b'] })).toEqual(['a', 'b', 'c']);
    expect(ids(config(false), { order: ['c', 'a', 'b'] })).toEqual(['a', 'b', 'c']);
  });

  it('uses the stored order when shuffle is true and order is a permutation', () => {
    const cfg = config(true);
    const result = orderedOptions(cfg, { order: ['c', 'a', 'b'] });
    expect(result.map((o) => o.id)).toEqual(['c', 'a', 'b']);
    expect(result[0]).toBe(cfg.options[2]);
  });

  it.each([
    ['missing nodeState', undefined],
    ['null nodeState', null],
    ['nodeState without order', {}],
    ['partial order', { order: ['c', 'a'] }],
    ['duplicated order', { order: ['a', 'a', 'b'] }],
    ['order with an unknown ID', { order: ['a', 'b', 'x'] }],
    ['order with a non-string entry', { order: ['a', 'b', 3] }],
    ['non-array order', { order: 'cab' }],
    ['order inherited, not own', Object.create({ order: ['c', 'a', 'b'] }) as unknown],
  ])('falls back to config order for %s', (_name, nodeState) => {
    expect(ids(config(true), nodeState)).toEqual(['a', 'b', 'c']);
  });
});
