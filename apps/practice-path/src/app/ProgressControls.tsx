// ProgressControls (design C15 "ProgressControls", D67; Requirements 13.1, 13.3–13.5, 13.7, 19.1).
// Export, import and clear of the Progress_Store; the file input is the only input element of this file.

import { useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { useProgress, type ImportOutcome } from './ProgressProvider.tsx';

export const IMPORT_TOO_LARGE_TEXT = 'This file is larger than 64 KB, so it was not loaded.';
export const IMPORT_INVALID_TEXT = 'This file is not a Practice Path progress file, so it was not loaded.';
export const CLEAR_QUESTION_TEXT = 'Clear all progress saved on this device?';

export function importMessage(outcome: ImportOutcome): string {
  if (outcome.kind === 'too-large') return IMPORT_TOO_LARGE_TEXT;
  if (outcome.kind === 'invalid') return IMPORT_INVALID_TEXT;
  return `Progress loaded: ${outcome.count} questions.`;
}

export function ProgressControls(): ReactNode {
  const progress = useProgress();
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const inputId = useId();
  const questionId = useId();

  async function onImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    const outcome = await progress.importFile(file);
    setMessage(importMessage(outcome));
    // Lets the same file be chosen again.
    input.value = '';
  }

  return (
    <div className="pp-progress-controls">
      <button type="button" className="dr-button" onClick={() => progress.exportFile()}>
        Export progress
      </button>
      <label htmlFor={inputId} className="pp-import-label">
        Import progress
      </label>
      <input id={inputId} type="file" accept="application/json,.json" onChange={(e) => void onImport(e)} />
      <p className="pp-progress-message" role="status">
        {message}
      </p>
      {confirming ? (
        <div role="group" aria-labelledby={questionId} className="pp-confirm">
          <p id={questionId}>{CLEAR_QUESTION_TEXT}</p>
          <button
            type="button"
            className="dr-button"
            onClick={() => {
              progress.clear();
              setConfirming(false);
            }}
          >
            Yes, clear
          </button>
          <button type="button" className="dr-button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="dr-button" onClick={() => setConfirming(true)}>
          Clear progress
        </button>
      )}
    </div>
  );
}
