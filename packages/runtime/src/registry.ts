// Node-type registry (Req 14.1, 14.2): lookup by type name, in registration order.

import type { AnyNodeType } from './node-type.ts';

export interface Registry {
  get(type: string): AnyNodeType | undefined;
  list(): readonly AnyNodeType[];
}

/** Throws an `Error` when two node types share a name. */
export function createRegistry(types: readonly AnyNodeType[]): Registry {
  const byName = new Map<string, AnyNodeType>();
  for (const t of types) {
    if (byName.has(t.type)) {
      throw new Error(`createRegistry: duplicate node type name "${t.type}"`);
    }
    byName.set(t.type, t);
  }
  const listed: readonly AnyNodeType[] = Object.freeze([...types]);
  return {
    get: (type: string): AnyNodeType | undefined => byName.get(type),
    list: (): readonly AnyNodeType[] => listed,
  };
}
