// View for the `choice` node type (design C7, Requirements 7.1, 7.2, 7.4, 10.1–10.8).
import { useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { ChoiceConfig, ChoiceResponse } from '@dreame/node-types';
import { orderedOptions } from '../choice-order.ts';
import type { RenderProps } from '../render.ts';

/**
 * A native radio group named by `prompt`, one row per option in display order, an inline error
 * and a submit button. Arrow keys move the selection through the native radio group. Enter on an
 * option submits once: `preventDefault()` stops the browser's implicit form submission.
 * `onRespond({ optionId })` is called at most once per mount; `NodeRenderer` keys the view by
 * node ID, so the flag resets on a new node.
 */
export function ChoiceNodeView({ cfg, onRespond, nodeState }: RenderProps<ChoiceConfig, ChoiceResponse>): ReactNode {
  const groupName = useId();
  const legendId = useId();
  const errorId = useId();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [showError, setShowError] = useState(false);
  const responded = useRef(false);

  const submit = (): void => {
    if (responded.current) return;
    if (selected === undefined) {
      setShowError(true);
      return;
    }
    responded.current = true;
    onRespond({ optionId: selected });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit();
  };

  const select = (event: ChangeEvent<HTMLInputElement>): void => {
    setSelected(event.currentTarget.value);
    setShowError(false);
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  };

  return (
    <form className="dr-node dr-choice" noValidate onSubmit={onSubmit}>
      <fieldset role="radiogroup" aria-labelledby={legendId} aria-describedby={showError ? errorId : undefined}>
        <legend id={legendId}>{cfg.prompt}</legend>
        {orderedOptions(cfg, nodeState).map((option) => (
          <label key={option.id} className="dr-option">
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={selected === option.id}
              onChange={select}
              onKeyDown={submitOnEnter}
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
      <button type="submit" className="dr-button dr-button-primary">
        Submit
      </button>
    </form>
  );
}
