// Pure player reducer for ActivityPlayer (design C10, Requirement 13.2).
// The time of each response is read in the event handler and carried in the event, so this
// module reads no clock and no randomness, and never modifies its inputs.

import { checkAction, reduce } from '@dreame/runtime';
import type { Action, ActionRejection, AttemptState, Runtime } from '@dreame/runtime';

export interface PlayerState {
  readonly attempt: AttemptState;
  /** Number of responses `checkAction` rejected; part of the view key, so a rejection remounts the view. */
  readonly rejections: number;
  readonly lastRejection: ActionRejection | null;
}

export type PlayerEvent = { readonly type: 'respond'; readonly response: unknown; readonly at: number };

/**
 * Applies one player event. The response is checked against the current node with `checkAction`;
 * an accepted response is passed to `reduce` with `{ now: event.at }`. A rejected response leaves
 * the attempt unchanged, increments `rejections` and records the rejection code.
 */
export function playerReducer(rt: Runtime, ps: PlayerState, event: PlayerEvent): PlayerState {
  const action: Action = { type: 'respond', nodeId: ps.attempt.currentNodeId, response: event.response };
  const rejection = checkAction(rt, ps.attempt, action);
  if (rejection !== null) {
    return { ...ps, rejections: ps.rejections + 1, lastRejection: rejection };
  }
  return { ...ps, attempt: reduce(rt, ps.attempt, action, { now: event.at }) };
}
