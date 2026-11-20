// Runtime node type: the `@dreame/schema` descriptor plus response checking, `enter` and `reduce`.
// `Render` is added by the Day 5 UI module (Decision D9).

import type { NodeTypeDescriptor } from '@dreame/schema';
import type { AttemptState, Env } from './state.ts';

export interface NodeType<C = unknown, R = unknown> extends NodeTypeDescriptor<C> {
  /** Runs after the precompiled `responseSchema` check. */
  isValidResponse(cfg: C, r: unknown): r is R;
  /** `s.currentNodeId` is the entered node. */
  enter?(cfg: C, s: AttemptState, env: Env): AttemptState;
  /** Brief §3 signature; `s.currentNodeId` is the responding node. */
  reduce(cfg: C, s: AttemptState, r: R, env: Env): AttemptState;
}

/** A registry holds node types with different `C` and `R`. */
export type AnyNodeType = NodeType<any, any>;
