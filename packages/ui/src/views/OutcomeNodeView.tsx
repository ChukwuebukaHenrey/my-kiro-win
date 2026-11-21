// View for the `outcome` node type (design C7, Requirements 7.1, 7.2, 7.4, 11.1–11.3).
import type { ReactNode } from 'react';
import type { OutcomeConfig, OutcomeResponse } from '@dreame/node-types';
import type { RenderProps } from '../render.ts';
import { ExternalLinkButton } from '../components/ExternalLinkButton.tsx';

/**
 * Heading, body text (line breaks kept by `.dr-body`) and, when the config has a `cta`,
 * an `ExternalLinkButton`. Manifest strings are rendered as text children only. An outcome
 * ends the attempt, so this view has no control that calls `onRespond`.
 */
export function OutcomeNodeView({ cfg }: RenderProps<OutcomeConfig, OutcomeResponse>): ReactNode {
  return (
    <div className="dr-node dr-outcome">
      <h2 className="dr-heading" tabIndex={-1}>
        {cfg.title}
      </h2>
      <p className="dr-body">{cfg.body}</p>
      {cfg.cta !== undefined && <ExternalLinkButton label={cfg.cta.label} url={cfg.cta.url} />}
    </div>
  );
}
