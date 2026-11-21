// Render contract and registry for node views (design C6, Requirement 12).
import type { ReactNode } from 'react';
import type { JsonValue } from '@dreame/runtime';

/** Brief §3 `Render` props plus `nodeState` (D16). */
export interface RenderProps<C = unknown, R = unknown> {
  readonly cfg: C;
  readonly onRespond: (response: R) => void;
  /** `AttemptState.nodeState[currentNodeId]`, or `undefined`. */
  readonly nodeState: JsonValue | undefined;
  /** Number of Rejections so far in this attempt; a change means the last submit was rejected. Absent counts as 0. */
  readonly rejections?: number;
}

/**
 * A view for one node type. `any` lets one registry hold modules with different
 * config and response types, as `AnyNodeType` does in `@dreame/runtime`.
 */
export type RenderModule<C = any, R = any> = (props: RenderProps<C, R>) => ReactNode;

export interface RenderEntry {
  readonly type: string;
  readonly Render: RenderModule;
}

export interface RenderRegistry {
  get(type: string): RenderModule | undefined;
  /** Registered type names in entry order. */
  types(): readonly string[];
}

/**
 * Builds a registry backed by a `Map`, so names such as `__proto__` or `toString`
 * never resolve to inherited values.
 * Throws `Error('createRenderRegistry: duplicate node type "<type>"')` on a repeated name (Requirement 12.3).
 */
export function createRenderRegistry(entries: readonly RenderEntry[]): RenderRegistry {
  const byType = new Map<string, RenderModule>();
  for (const entry of entries) {
    if (byType.has(entry.type)) {
      throw new Error(`createRenderRegistry: duplicate node type "${entry.type}"`);
    }
    byType.set(entry.type, entry.Render);
  }
  const order: readonly string[] = Object.freeze([...byType.keys()]);
  return {
    get: (type: string): RenderModule | undefined => byType.get(type),
    types: (): readonly string[] => order,
  };
}
