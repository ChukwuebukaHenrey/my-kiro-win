// View for the `collectionSelect` node type (design C9, D29, D30, Requirements 10, 12.5, 12.6).
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { JsonValue } from '@dreame/runtime';
import type { RenderProps } from '@dreame/ui';
import { formatPrice, hintText } from '../format.ts';
import {
  budgetStatus,
  checkSelection,
  readSelectNodeState,
  selectionTotal,
  type BudgetStatus,
} from '../node-types/bundle-rules.ts';
import type { CollectionSelectConfig, CollectionSelectResponse, SelectItem } from '../node-types/collectionSelect.ts';

const STATUS_TEXT: Readonly<Record<BudgetStatus, string>> = {
  under: 'Under budget',
  close: 'Close to budget',
  over: 'Over budget',
};

/**
 * The Items to show, in config order: the config Items whose IDs are in the stored
 * Offered_Items snapshot (D30). A missing or damaged node state shows every config Item,
 * so a damaged state never hides a product.
 */
function shownItems(cfg: CollectionSelectConfig, nodeState: JsonValue | undefined): readonly SelectItem[] {
  const state = readSelectNodeState(nodeState);
  if (state === null) return cfg.items;
  const offered = new Set(state.items.map((item) => item.id));
  return cfg.items.filter((item) => offered.has(item.id));
}

/**
 * A native checkbox group named by `prompt`, one row per shown Item, a bundle bar with a polite
 * live region (count against `max`, total against `budget`, budget status), a hint for the first
 * broken Selection_Rule, an inline error and a submit button. Cards stay enabled in every state
 * (D29); the rules are checked on submit. `onRespond({ itemIds })` is called at most once per
 * mount, with `itemIds` in config order; `NodeRenderer` keys the view by node ID, so the flag
 * resets on a new node. The flag also resets when `rejections` changes, so the player can submit
 * again after a Rejection; the picks are kept.
 */
export function CollectionSelectNodeView({
  cfg,
  onRespond,
  nodeState,
  rejections,
}: RenderProps<CollectionSelectConfig, CollectionSelectResponse>): ReactNode {
  const legendId = useId();
  const hintId = useId();
  const errorId = useId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [showError, setShowError] = useState(false);
  const responded = useRef(false);

  useEffect(() => {
    responded.current = false;
  }, [rejections]);

  const shown = shownItems(cfg, nodeState);
  const itemIds = shown.filter((item) => selected.has(item.id)).map((item) => item.id);
  const broken = checkSelection(shown, cfg, itemIds);
  const hint = hintText(broken, cfg.currency);
  const total = selectionTotal(shown, itemIds);
  const statusText = STATUS_TEXT[budgetStatus(total, cfg.budget)];
  const describedIds: string[] = [];
  if (hint !== null) describedIds.push(hintId);
  if (showError) describedIds.push(errorId);
  const describedBy = describedIds.length > 0 ? describedIds.join(' ') : undefined;

  const toggle = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value, checked } = event.currentTarget;
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
    setShowError(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (responded.current) return;
    if (broken !== null) {
      setShowError(true);
      return;
    }
    responded.current = true;
    onRespond({ itemIds });
  };

  return (
    <form className="dr-node shop-select" noValidate onSubmit={submit}>
      <fieldset aria-describedby={describedBy}>
        <legend id={legendId}>{cfg.prompt}</legend>
        {cfg.pricesAsOf !== undefined && (
          <p className="dr-note">Prices as of {cfg.pricesAsOf}. The seller's page has the current prices.</p>
        )}
        <ul className="shop-products">
          {shown.map((item) => (
            <li key={item.id}>
              <label className="dr-option shop-product">
                <input type="checkbox" value={item.id} checked={selected.has(item.id)} onChange={toggle} />
                {item.emoji !== undefined && (
                  <span className="shop-emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                )}{' '}
                <span className="shop-product-name">{item.name}</span>{' '}
                <span className="shop-product-price">{formatPrice(item.price, cfg.currency)}</span>
                {item.tags.length > 0 && (
                  <>
                    {' '}
                    <span className="shop-tags">{item.tags.join(', ')}</span>
                  </>
                )}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="shop-bundle-bar">
        <p aria-live="polite">
          {`${itemIds.length} of ${cfg.max} items · Total ${formatPrice(total, cfg.currency)} of ${formatPrice(cfg.budget, cfg.currency)} · ${statusText}`}
        </p>
        {hint !== null && (
          <p id={hintId} className="shop-hint">
            {hint}
          </p>
        )}
      </div>
      {showError && (
        <p id={errorId} className="dr-error" role="alert">
          {hint === null ? 'Your bundle does not meet the rules yet.' : `Your bundle does not meet the rules yet. ${hint}`}
        </p>
      )}
      <button type="submit" className="dr-button dr-button-primary">
        {cfg.continueLabel ?? 'Continue'}
      </button>
    </form>
  );
}
