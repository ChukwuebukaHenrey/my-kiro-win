// View for the `content` node type (design C7, Requirements 7.1, 7.2, 7.4, 9.1–9.3).
import { useEffect, useRef, type ReactNode } from 'react';
import type { ContentConfig, ContentResponse } from '@dreame/node-types';
import type { RenderProps } from '../render.ts';

/**
 * Optional heading, body text (line breaks kept by `.dr-body`) and a continue button.
 * Manifest strings are rendered as text children only. `onRespond({})` is called at most
 * once per mount; `NodeRenderer` keys the view by node ID, so the flag resets on a new node.
 * The flag also resets when `rejections` changes, so the player can continue after a Rejection.
 */
export function ContentNodeView({ cfg, onRespond, rejections }: RenderProps<ContentConfig, ContentResponse>): ReactNode {
  const responded = useRef(false);

  useEffect(() => {
    responded.current = false;
  }, [rejections]);

  const respond = (): void => {
    if (responded.current) return;
    responded.current = true;
    onRespond({});
  };

  return (
    <div className="dr-node dr-content">
      {cfg.title !== undefined && (
        <h2 className="dr-heading" tabIndex={-1}>
          {cfg.title}
        </h2>
      )}
      <p className="dr-body">{cfg.body}</p>
      <button type="button" className="dr-button dr-button-primary" onClick={respond}>
        {cfg.continueLabel ?? 'Continue'}
      </button>
    </div>
  );
}
