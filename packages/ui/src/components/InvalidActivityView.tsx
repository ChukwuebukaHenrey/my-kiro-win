// Shown in place of the player when a manifest fails validation (design C11, Requirements 7.4, 13.7).
import type { ReactNode } from 'react';
import { HARD_LIMITS, type Diagnostic } from '@dreame/schema';

export interface InvalidActivityViewProps {
  readonly diagnostics: readonly Diagnostic[];
  readonly actionLabel: string;
  readonly onAction: () => void;
}

/**
 * A heading, one list item per diagnostic message (as text, at most `HARD_LIMITS.maxDiagnostics`)
 * and a button whose label and action the app supplies.
 */
export function InvalidActivityView({ diagnostics, actionLabel, onAction }: InvalidActivityViewProps): ReactNode {
  const shown = diagnostics.slice(0, HARD_LIMITS.maxDiagnostics);
  return (
    <section className="dr-node">
      <h2 className="dr-heading" tabIndex={-1}>
        This activity cannot be played
      </h2>
      <ul>
        {shown.map((d, i) => (
          // Messages can repeat, so the index is part of the key.
          <li key={`${i}:${d.code}:${d.path}`}>{d.message}</li>
        ))}
      </ul>
      <button type="button" className="dr-button" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  );
}
