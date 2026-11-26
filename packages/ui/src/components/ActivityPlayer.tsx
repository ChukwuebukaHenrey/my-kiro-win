// Plays one validated manifest (design C10, Requirements 13.1–13.5).
import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { createAttempt, createRuntime } from '@dreame/runtime';
import type { AttemptState, JsonValue, Profile, Runtime } from '@dreame/runtime';
import type { ValidManifest } from '@dreame/schema';
import type { RenderRegistry } from '../render.ts';
import { playerReducer, type PlayerEvent, type PlayerState } from '../player-state.ts';
import { NodeRenderer } from './NodeRenderer.tsx';

export interface ActivityPlayerProps {
  readonly profile: Profile;
  readonly manifest: ValidManifest;
  /** uint32; `createAttempt` throws a `RangeError` otherwise. */
  readonly seed: number;
  readonly views: RenderRegistry;
  /** Time source for the runtime `Clock`; defaults to `Date.now`. */
  readonly now?: () => number;
  /** Called once per mount when the attempt status leaves `playing`, with the attempt state at that point. */
  readonly onFinish?: (attempt: AttemptState) => void;
}

/** Player state plus whether the latest response was rejected, so the message clears on the next accepted step. */
interface PlayerView {
  readonly ps: PlayerState;
  readonly rejected: boolean;
}

function step(rt: Runtime, view: PlayerView, event: PlayerEvent): PlayerView {
  const ps = playerReducer(rt, view.ps, event);
  return { ps, rejected: ps.rejections > view.ps.rejections };
}

/**
 * Creates the runtime and the attempt, shows the current node through `NodeRenderer` and passes
 * each response through `playerReducer`. To play another manifest or seed, remount with a new `key`.
 * Focus moves to the new node's first `h2`, or to the container, only when the node changes after
 * the first render, so an embedded player does not take focus on load.
 */
export function ActivityPlayer({ profile, manifest, seed, views, now = Date.now, onFinish }: ActivityPlayerProps): ReactNode {
  const rt = useMemo(() => createRuntime(profile, manifest), [profile, manifest]);
  const [view, dispatch] = useReducer(
    (current: PlayerView, event: PlayerEvent): PlayerView => step(rt, current, event),
    undefined,
    (): PlayerView => ({
      ps: { attempt: createAttempt(rt, seed, { now: now() }), rejections: 0, lastRejection: null },
      rejected: false,
    }),
  );
  const { attempt, rejections } = view.ps;
  const currentNodeId = attempt.currentNodeId;
  const containerRef = useRef<HTMLElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // The node shown when focus was last handled; equal on the first render (and on a StrictMode
  // effect re-run), so focus stays where it is until the node changes.
  const focusedNodeId = useRef(currentNodeId);
  const onFinishRef = useRef(onFinish);
  const finishReported = useRef(false);

  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useEffect(() => {
    if (attempt.status === 'playing' || finishReported.current) return;
    finishReported.current = true;
    onFinishRef.current?.(attempt);
  }, [attempt]);

  useEffect(() => {
    if (focusedNodeId.current === currentNodeId) return;
    focusedNodeId.current = currentNodeId;
    const container = containerRef.current;
    if (container === null) return;
    const heading = container.querySelector('h2');
    if (heading !== null) heading.focus();
    else container.focus();
  }, [currentNodeId]);

  // Runs after a Rejection; the alert element is new because its key is the rejection count.
  useEffect(() => {
    if (view.rejected) alertRef.current?.focus();
  }, [rejections, view.rejected]);

  const node = rt.nodes.get(currentNodeId);
  if (node === undefined) {
    // Unreachable for a validated manifest: the runtime only moves to existing nodes.
    throw new Error(`ActivityPlayer: no node "${currentNodeId}"`);
  }
  const nodeState: JsonValue | undefined = Object.hasOwn(attempt.nodeState, currentNodeId)
    ? attempt.nodeState[currentNodeId]
    : undefined;
  const onRespond = (response: unknown): void => {
    dispatch({ type: 'respond', response, at: now() });
  };

  return (
    <section className="dr-player" data-node-id={currentNodeId} tabIndex={-1} ref={containerRef}>
      {attempt.status === 'limit_reached' && (
        <p className="dr-notice" role="status">
          This activity stopped because it reached its step limit.
        </p>
      )}
      {view.rejected && (
        <p key={rejections} ref={alertRef} className="dr-error" role="alert" tabIndex={-1}>
          That answer was not accepted. Please try again.
        </p>
      )}
      <NodeRenderer
        node={node}
        nodeState={nodeState}
        views={views}
        onRespond={onRespond}
        viewKey={currentNodeId}
        rejections={rejections}
      />
    </section>
  );
}
