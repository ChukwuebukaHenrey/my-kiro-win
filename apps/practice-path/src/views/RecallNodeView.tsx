// View for the `recall` node type (design C12, D55, shop D48, Requirements 15.1–15.9).
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { orderedOptions, type RenderProps } from '@dreame/ui';
import { triesLeft } from '../node-types/practice-rules.ts';
import { readRecallNodeState } from '../node-types/practice-state.ts';
import type { RecallConfig, RecallResponse } from '../node-types/recall.ts';

type Feedback = 'retry' | 'correct' | 'out';

/**
 * A native radio group named by `prompt`, one row per option in display order (`orderedOptions`
 * over the stored order, D55), an inline error, a Check button and a focused feedback element.
 * A wrong Try with Tries left clears the selection, disables the tried option and shows the retry
 * text without the explanation or the correct option. A correct Try, or a wrong last Try, ends the
 * question: every radio is disabled, the result and the explanation are shown, and Continue sends
 * `onRespond({ tries })` with the Tries in the order made. The call happens at most once per
 * mount; the flag resets when `rejections` changes, so the player can continue again after a
 * Rejection without a remount (shop D48).
 */
export function RecallNodeView({
  cfg,
  onRespond,
  nodeState,
  rejections,
}: RenderProps<RecallConfig, RecallResponse>): ReactNode {
  const groupName = useId();
  const legendId = useId();
  const errorId = useId();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [tries, setTries] = useState<readonly string[]>([]);
  const [showError, setShowError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);
  const [checks, setChecks] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const responded = useRef(false);

  useEffect(() => {
    responded.current = false;
  }, [rejections]);

  useEffect(() => {
    if (checks > 0) feedbackRef.current?.focus();
  }, [checks]);

  const options = orderedOptions(cfg, readRecallNodeState(nodeState));
  const left = triesLeft(cfg.maxRetries, tries);
  const correctOption = cfg.options.find((option) => option.id === cfg.correctOptionId);
  const correctLabel = correctOption === undefined ? cfg.correctOptionId : correctOption.label;

  const check = (): void => {
    if (done) return;
    if (selected === undefined) {
      setShowError(true);
      return;
    }
    const next = [...tries, selected];
    setTries(next);
    setShowError(false);
    if (selected === cfg.correctOptionId) {
      setFeedback('correct');
      setDone(true);
    } else if (triesLeft(cfg.maxRetries, next) === 0) {
      setFeedback('out');
      setDone(true);
    } else {
      setFeedback('retry');
      setSelected(undefined);
    }
    setChecks((count) => count + 1);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    check();
  };

  const select = (event: ChangeEvent<HTMLInputElement>): void => {
    setSelected(event.currentTarget.value);
    setShowError(false);
  };

  const checkOnEnter = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    check();
  };

  const finish = (): void => {
    if (responded.current) return;
    responded.current = true;
    onRespond({ tries: [...tries] });
  };

  return (
    <form className="dr-node dr-choice pp-recall" noValidate onSubmit={onSubmit}>
      <fieldset role="radiogroup" aria-labelledby={legendId} aria-describedby={showError ? errorId : undefined}>
        <legend id={legendId}>{cfg.prompt}</legend>
        {options.map((option) => (
          <label key={option.id} className="dr-option">
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={selected === option.id}
              disabled={done || tries.includes(option.id)}
              onChange={select}
              onKeyDown={checkOnEnter}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {showError && (
        <p id={errorId} className="dr-error" role="alert">
          Choose an answer first.
        </p>
      )}
      {!done && (
        <button type="submit" className="dr-button dr-button-primary">
          Check
        </button>
      )}
      {feedback !== null && (
        <div ref={feedbackRef} tabIndex={-1} className="pp-feedback">
          {feedback === 'retry' && (
            <>
              <p>Not quite. Try again.</p>
              <p>{left === 1 ? '1 try left' : `${left} tries left`}</p>
            </>
          )}
          {feedback === 'correct' && (
            <>
              <p>Correct</p>
              <p className="dr-body">{cfg.explanation}</p>
            </>
          )}
          {feedback === 'out' && (
            <>
              <p>Not this time</p>
              <p>The answer is: {correctLabel}</p>
              <p className="dr-body">{cfg.explanation}</p>
            </>
          )}
        </div>
      )}
      {done && (
        <button type="button" className="dr-button dr-button-primary" onClick={finish}>
          Continue
        </button>
      )}
    </form>
  );
}
