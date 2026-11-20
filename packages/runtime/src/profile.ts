// Profile builder (Req 14.3, 14.4): binds node types to their precompiled validators.

import type { ProfileDescriptor, StandaloneValidate } from '@dreame/schema';
import type { AnyNodeType } from './node-type.ts';
import { createRegistry } from './registry.ts';
import type { Registry } from './registry.ts';

export interface Profile extends ProfileDescriptor {
  readonly nodeTypes: readonly AnyNodeType[];
  readonly registry: Registry;
  /** Calls the precompiled response validator of `type`; `false` for an unregistered type. */
  validateResponse(type: string, response: unknown): boolean;
}

/** Throws an `Error` on duplicate node type names or a node type without a response validator. */
export function defineProfile(input: {
  id: string;
  nodeTypes: readonly AnyNodeType[];
  validateSchema: StandaloneValidate;
  responseValidators: Readonly<Record<string, StandaloneValidate>>;
}): Profile {
  const registry = createRegistry(input.nodeTypes);
  const validators = new Map<string, StandaloneValidate>();
  for (const t of input.nodeTypes) {
    // Own properties only, so names such as `toString` or `__proto__` never pick up inherited values.
    const fn = Object.hasOwn(input.responseValidators, t.type) ? input.responseValidators[t.type] : undefined;
    if (typeof fn !== 'function') {
      throw new Error(`defineProfile: node type "${t.type}" has no response validator in profile "${input.id}"`);
    }
    validators.set(t.type, fn);
  }
  return {
    id: input.id,
    nodeTypes: registry.list(),
    validateSchema: input.validateSchema,
    registry,
    validateResponse(type: string, response: unknown): boolean {
      const fn = validators.get(type);
      return fn !== undefined && fn(response) === true;
    },
  };
}
