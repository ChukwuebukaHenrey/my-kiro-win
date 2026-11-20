// Pure reducer (design Component 2, Requirement 15).
// Time comes only from the injected `Clock` and randomness only from `env.rng`, which is rebuilt
// from `state.rngState` on every step, so a reload resumes the same sequence (Brief B6, B7).
// No function here modifies its inputs; every accepted step returns a new state object.

import type { ManifestNode, NodeId, Scalar, ValidManifest, VarDecl } from '@dreame/schema';
import { evaluateCond } from './conditions.ts';
import type { AnyNodeType } from './node-type.ts';
import type { Profile } from './profile.ts';
import { createRng } from './rng.ts';
import type { Action, AttemptState, Clock, Env, RuntimeEvent } from './state.ts';

export interface Runtime {
  readonly profile: Profile;
  readonly manifest: ValidManifest;
  readonly nodes: ReadonlyMap<NodeId, ManifestNode>;
  readonly variables: ReadonlyMap<string, VarDecl>;
}

export type ActionRejection = 'not-playing' | 'unknown-action' | 'wrong-node' | 'invalid-response';

/**
 * Builds the node and variable lookup maps (Req 15.1). Throws an `Error` when a node uses a type
 * that `profile` does not register, which cannot happen for a manifest validated against `profile`.
 */
export function createRuntime(profile: Profile, manifest: ValidManifest): Runtime {
  const nodes = new Map<NodeId, ManifestNode>();
  for (const node of manifest.nodes) {
    if (profile.registry.get(node.type) === undefined) {
      throw new Error(`createRuntime: node "${node.id}" uses type "${node.type}", which profile "${profile.id}" does not register`);
    }
    nodes.set(node.id, node);
  }
  const variables = new Map<string, VarDecl>();
  for (const decl of manifest.variables) variables.set(decl.id, decl);
  return { profile, manifest, nodes, variables };
}

function nodeAt(rt: Runtime, id: NodeId): { node: ManifestNode; type: AnyNodeType } {
  const node = rt.nodes.get(id);
  const type = node === undefined ? undefined : rt.profile.registry.get(node.type);
  if (node === undefined || type === undefined) {
    // Unreachable for a validated manifest; a throw here marks a bug in the caller.
    throw new Error(`reducer: no node or node type for "${id}"`);
  }
  return { node, type };
}

/**
 * Sets `currentNodeId` to `id`, applies the terminal status and event, then calls the node type's
 * `enter` (Req 15.8, 15.9). `status` and `events` for the limit fallback are set by the caller.
 */
function enterNode(rt: Runtime, s: AttemptState, id: NodeId, env: Env, viaLimit: boolean): AttemptState {
  const { node, type } = nodeAt(rt, id);
  let next: AttemptState = { ...s, currentNodeId: id };
  if (type.terminal && !viaLimit) {
    const event: RuntimeEvent = { type: 'finished', at: env.now, outcomeId: id };
    next = { ...next, status: 'finished', events: [...next.events, event] };
  }
  return type.enter === undefined ? next : type.enter(node.config, next, env);
}

/** Req 15.2. Throws a `RangeError` unless `seed` is a uint32. */
export function createAttempt(rt: Runtime, seed: number, clock: Clock): AttemptState {
  const rng = createRng(seed);
  const env: Env = { now: clock.now, rng, variables: rt.variables };
  const m = rt.manifest;
  const vars: Record<string, Scalar> = {};
  for (const decl of m.variables) vars[decl.id] = decl.initial;
  const initial: AttemptState = {
    activityId: m.activityId,
    manifestVersion: m.version,
    seed,
    rngState: seed,
    status: 'playing',
    currentNodeId: m.entryNodeId,
    vars,
    answers: {},
    nodeState: {},
    path: [{ nodeId: m.entryNodeId, at: clock.now }],
    transitions: 0,
    events: [],
    startedAt: clock.now,
    updatedAt: clock.now,
  };
  const entered = enterNode(rt, initial, m.entryNodeId, env, false);
  return { ...entered, rngState: rng.state, updatedAt: clock.now };
}

/** Returns the first matching rejection in the Req 15.3 order, or `null` for an accepted action. */
export function checkAction(rt: Runtime, s: AttemptState, a: Action): ActionRejection | null {
  if (s.status !== 'playing') return 'not-playing';
  if (typeof a !== 'object' || a === null || (a as { type?: unknown }).type !== 'respond') return 'unknown-action';
  if (a.nodeId !== s.currentNodeId) return 'wrong-node';
  const { node, type } = nodeAt(rt, s.currentNodeId);
  if (!rt.profile.validateResponse(node.type, a.response)) return 'invalid-response';
  if (!type.isValidResponse(node.config, a.response)) return 'invalid-response';
  return null;
}

/**
 * One step (Req 15.4–15.10). A rejected action returns `s` itself. Otherwise the node type's
 * `reduce` runs, then the first edge whose `when` is absent or true is taken, or the fallback
 * outcome when `transitions + 1` would exceed `limits.maxTransitions`.
 */
export function reduce(rt: Runtime, s: AttemptState, a: Action, clock: Clock): AttemptState {
  if (checkAction(rt, s, a) !== null) return s;
  const rng = createRng(s.rngState);
  const env: Env = { now: clock.now, rng, variables: rt.variables };
  const { node, type } = nodeAt(rt, s.currentNodeId);

  const answered = type.reduce(node.config, s, a.response, env);
  const edge = node.edges.find((e) => e.when === undefined || evaluateCond(e.when, answered));
  if (edge === undefined) {
    // Unreachable for a validated manifest: the last edge of a non-terminal node has no `when`.
    throw new Error(`reduce: node "${node.id}" has no matching edge`);
  }

  const limits = rt.manifest.limits;
  let routed: AttemptState;
  if (answered.transitions + 1 > limits.maxTransitions) {
    const outcomeId = rt.manifest.fallbackOutcomeId;
    const event: RuntimeEvent = { type: 'limit_reached', at: clock.now, fromNodeId: s.currentNodeId, outcomeId };
    const limited: AttemptState = {
      ...answered,
      status: 'limit_reached',
      events: [...answered.events, event],
      path: [...answered.path, { nodeId: outcomeId, at: clock.now }],
    };
    routed = enterNode(rt, limited, outcomeId, env, true);
  } else {
    const moved: AttemptState = {
      ...answered,
      transitions: answered.transitions + 1,
      path: [...answered.path, { nodeId: edge.to, at: clock.now }],
    };
    routed = enterNode(rt, moved, edge.to, env, false);
  }
  return { ...routed, rngState: rng.state, updatedAt: clock.now };
}
