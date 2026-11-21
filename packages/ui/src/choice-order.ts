// Display order of `choice` options (design C7, Requirements 10.2, 10.3).

import type { ChoiceConfig } from '@dreame/node-types';

type ChoiceOption = ChoiceConfig['options'][number];

/** The stored `order` of a choice node's state, or `undefined` when it is not an array of strings. */
function storedOrder(nodeState: unknown): string[] | undefined {
  if (typeof nodeState !== 'object' || nodeState === null || !Object.hasOwn(nodeState, 'order')) return undefined;
  const order: unknown = (nodeState as { order: unknown }).order;
  if (!Array.isArray(order) || !order.every((id): id is string => typeof id === 'string')) return undefined;
  return order;
}

/**
 * Options of `cfg` in display order. When `cfg.shuffle` is `true` and `nodeState.order` is a
 * permutation of the option IDs, the options follow that order; otherwise they keep config order,
 * so a missing or damaged state never hides or repeats an option.
 */
export function orderedOptions(cfg: ChoiceConfig, nodeState: unknown): readonly ChoiceOption[] {
  if (cfg.shuffle !== true) return cfg.options;
  const order = storedOrder(nodeState);
  if (order === undefined || order.length !== cfg.options.length) return cfg.options;
  const remaining = [...cfg.options];
  const result: ChoiceOption[] = [];
  for (const id of order) {
    const index = remaining.findIndex((option) => option.id === id);
    if (index === -1) return cfg.options;
    result.push(...remaining.splice(index, 1));
  }
  return result;
}
