// Looks up a node's view by type name and renders it (design C9, Requirements 12.4, 12.5).
import type { ReactNode } from 'react';
import type { JsonValue } from '@dreame/runtime';
import type { ManifestNode } from '@dreame/schema';
import type { RenderRegistry } from '../render.ts';

export interface NodeRendererProps {
  readonly node: ManifestNode;
  readonly nodeState: JsonValue | undefined;
  readonly views: RenderRegistry;
  readonly onRespond: (response: unknown) => void;
  /** Changes force a remount of the view; the player passes `${nodeId}#${rejections}`. */
  readonly viewKey: string;
}

/**
 * Renders the registered view for `node.type` with the node's `config` and `nodeState`.
 * An unregistered type shows an alert naming the type, rendered as text, and no view.
 */
export function NodeRenderer({ node, nodeState, views, onRespond, viewKey }: NodeRendererProps): ReactNode {
  const Render = views.get(node.type);
  if (Render === undefined) {
    return (
      <p className="dr-error" role="alert">
        This activity has a step of type "{node.type}" that this app cannot show.
      </p>
    );
  }
  return <Render key={viewKey} cfg={node.config} nodeState={nodeState} onRespond={onRespond} />;
}
