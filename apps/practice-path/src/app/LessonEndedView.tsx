// Shown in place of the player when a lesson's `validUntil` is earlier than the device date
// (design C15, Requirement 18.7).
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface LessonEndedViewProps {
  /** The manifest's `validUntil`, `YYYY-MM-DD`. */
  readonly validUntil: string;
}

export function LessonEndedView({ validUntil }: LessonEndedViewProps): ReactNode {
  return (
    <section className="dr-node">
      <h1 className="dr-heading">This lesson has ended</h1>
      <p className="dr-body">
        The lesson author set this lesson to end on {validUntil}. The end date is checked on this device only.
      </p>
      <Link to="/">Back to home</Link>
    </section>
  );
}
