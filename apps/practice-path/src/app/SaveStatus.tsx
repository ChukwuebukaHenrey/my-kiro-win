// SaveStatus (design C15 "SaveStatus"; Requirements 18.9, 18.10, 18.21).
// Shows the Save_Status of ProgressProvider; `idle` renders nothing.

import type { ReactNode } from 'react';
import { useProgress } from './ProgressProvider.tsx';
import { SAVED_TEXT, notSavedText, readFailedText } from './save-status-text.ts';

export function SaveStatus(): ReactNode {
  const progress = useProgress();
  const status = progress.status;
  if (status.kind === 'idle') return null;
  if (status.kind === 'saved') {
    return (
      <p className="pp-save-status" role="status">
        {SAVED_TEXT}
      </p>
    );
  }
  if (status.kind === 'read-failed') {
    return (
      <p className="pp-save-status" role="status">
        {readFailedText(status.error)}
      </p>
    );
  }
  return (
    <p className="pp-save-status" role="status">
      {notSavedText(status.error)}{' '}
      <button type="button" onClick={() => progress.exportFile()}>
        Export progress
      </button>
    </p>
  );
}
