// View for the `reviewQueue` node type (design C13, shop D48, Requirements 16.1–16.7).
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { RenderProps } from '@dreame/ui';
import { readReviewQueueState } from '../node-types/practice-state.ts';
import type { ReviewAnswer, ReviewQueueConfig, ReviewQueueResponse } from '../node-types/reviewQueue.ts';

const DEFAULT_EMPTY_TEXT = 'Nothing to review. Every question was right on the first try.';

/**
 * The review round: an intro with the Queue size and a Start button, then one Queue Item at a
 * time with a native radio group (snapshot prompt and options, snapshot order) and one Try. After
 * Check the radios are disabled and the feedback element states the result, the correct option
 * and the explanation; Next moves on, and Next on the last Item sends `onRespond({ answers })`
 * with one entry per Queue Item in Queue order. With no node state, a damaged one or an empty
 * Queue, the view shows `emptyText` (or the default text) and a Continue that sends
 * `{ answers: [] }`. Each call happens at most once per mount; the flag resets when `rejections`
 * changes (shop D48). Node state is read only through `readReviewQueueState`.
 */
export function ReviewQueueNodeView({
  cfg,
  onRespond,
  nodeState,
  rejections,
}: RenderProps<ReviewQueueConfig, ReviewQueueResponse>): ReactNode {
  const groupName = useId();
  const legendId = useId();
  const errorId = useId();
  const [step, setStep] = useState(-1);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [showError, setShowError] = useState(false);
  const [answers, setAnswers] = useState<readonly ReviewAnswer[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const responded = useRef(false);

  useEffect(() => {
    responded.current = false;
  }, [rejections]);

  useEffect(() => {
    if (step >= 0) headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (checked) feedbackRef.current?.focus();
  }, [checked]);

  const state = readReviewQueueState(nodeState);
  const queue = state === null ? [] : state.queue;
  const n = queue.length;

  const respond = (list: readonly ReviewAnswer[]): void => {
    if (responded.current) return;
    responded.current = true;
    onRespond({ answers: list.map((entry) => ({ itemId: entry.itemId, optionId: entry.optionId })) });
  };

  if (n === 0) {
    return (
      <div className="dr-node pp-review">
        <h2>{cfg.title}</h2>
        <p className="dr-body">{cfg.emptyText ?? DEFAULT_EMPTY_TEXT}</p>
        <button type="button" className="dr-button dr-button-primary" onClick={() => respond([])}>
          Continue
        </button>
      </div>
    );
  }

  if (step < 0 || step >= n) {
    return (
      <div className="dr-node pp-review">
        <h2 tabIndex={-1}>{cfg.title}</h2>
        {cfg.intro !== undefined && <p className="dr-body">{cfg.intro}</p>}
        <p>{n === 1 ? '1 question to review' : `${n} questions to review`}</p>
        <button type="button" className="dr-button dr-button-primary" onClick={() => setStep(0)}>
          Start
        </button>
      </div>
    );
  }

  const item = queue[step];
  if (item === undefined) return null;
  const answer = answers.find((entry) => entry.itemId === item.itemId);
  const isCorrect = answer !== undefined && answer.optionId === item.correctOptionId;
  const correctOption = item.options.find((option) => option.id === item.correctOptionId);
  const correctLabel = correctOption === undefined ? item.correctOptionId : correctOption.label;

  const check = (): void => {
    if (checked) return;
    if (selected === undefined) {
      setShowError(true);
      return;
    }
    setAnswers([...answers, { itemId: item.itemId, optionId: selected }]);
    setShowError(false);
    setChecked(true);
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

  const next = (): void => {
    if (step === n - 1) {
      respond(answers);
      return;
    }
    setSelected(undefined);
    setChecked(false);
    setShowError(false);
    setStep(step + 1);
  };

  return (
    <div className="dr-node pp-review">
      <h3 ref={headingRef} tabIndex={-1} className="pp-review-count">
        Question {step + 1} of {n}
      </h3>
      {/* Visual progress; the heading above already says the same, so screen readers skip it. */}
      <progress className="pp-progress" aria-hidden="true" value={step + 1} max={n} />
      <form className="dr-choice" noValidate onSubmit={onSubmit}>
        <fieldset role="radiogroup" aria-labelledby={legendId} aria-describedby={showError ? errorId : undefined}>
          <legend id={legendId}>{item.prompt}</legend>
          {item.options.map((option) => (
            <label key={option.id} className="dr-option">
              <input
                type="radio"
                name={groupName}
                value={option.id}
                checked={selected === option.id}
                disabled={checked}
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
        {!checked && (
          <button type="submit" className="dr-button dr-button-primary">
            Check
          </button>
        )}
        {checked && (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            className={`pp-feedback ${isCorrect ? 'pp-feedback-correct' : 'pp-feedback-out'}`}
          >
            <p>{isCorrect ? 'Correct' : 'Not this time'}</p>
            <p>The answer is: {correctLabel}</p>
            <p className="dr-body">{item.explanation}</p>
          </div>
        )}
        {checked && (
          <button type="button" className="dr-button dr-button-primary" onClick={next}>
            Next
          </button>
        )}
      </form>
    </div>
  );
}
