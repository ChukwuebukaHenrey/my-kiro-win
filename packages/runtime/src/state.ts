// Attempt state, actions and the environment passed to node types (design Component 2).
// Every field is plain JSON, so `JSON.parse(JSON.stringify(s))` is deep-equal to `s` (Req 15.12).

import type { AnswerValue, NodeId, Scalar, VarDecl } from '@dreame/schema';
import type { SeededRng } from './rng.ts';

export type Status = 'playing' | 'finished' | 'limit_reached';

export type RuntimeEvent =
  | { type: 'finished'; at: number; outcomeId: NodeId }
  | { type: 'limit_reached'; at: number; fromNodeId: NodeId; outcomeId: NodeId };

export interface AttemptState {
  readonly activityId: string;
  readonly manifestVersion: number;
  /** uint32, stored in the attempt (Brief B6, B7). */
  readonly seed: number;
  /** uint32, advanced only through `env.rng`. */
  readonly rngState: number;
  readonly status: Status;
  readonly currentNodeId: NodeId;
  readonly vars: Readonly<Record<string, Scalar>>;
  readonly answers: Readonly<Record<NodeId, AnswerValue>>;
  /** Per-node presentation data, for example option order. */
  readonly nodeState: Readonly<Record<NodeId, JsonValue>>;
  readonly path: readonly { readonly nodeId: NodeId; readonly at: number }[];
  readonly transitions: number;
  readonly events: readonly RuntimeEvent[];
  readonly startedAt: number;
  readonly updatedAt: number;
}

export type Action = { readonly type: 'respond'; readonly nodeId: NodeId; readonly response: unknown };

export interface Clock {
  readonly now: number;
}

/** Brief §3 env shape, plus the manifest's variable declarations for `applyEffects`. */
export interface Env {
  readonly now: number;
  readonly rng: SeededRng;
  /** `Runtime.variables`; node types pass it to `applyEffects` so `add` effects are clamped. */
  readonly variables: ReadonlyMap<string, VarDecl>;
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
