// Shown in place of the player when a demo's `validUntil` is earlier than the device date
// (design C12, Requirement 13.7, Brief B11).
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface OfferEndedViewProps {
  /** The manifest's `validUntil`, `YYYY-MM-DD`. */
  readonly validUntil: string;
}

export function OfferEndedView({ validUntil }: OfferEndedViewProps): ReactNode {
  return (
    <section className="dr-node">
      <h1 className="dr-heading">This offer has ended</h1>
      <p className="dr-body">
        The seller set this offer to end on {validUntil}. The end date is checked on this device only.
      </p>
      <Link to="/">Back to home</Link>
    </section>
  );
}
