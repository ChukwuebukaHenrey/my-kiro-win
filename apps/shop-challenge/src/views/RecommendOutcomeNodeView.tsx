// View for the `recommendOutcome` node type (design C10, C8b, D54, Requirement 11).
import { useId, type ReactNode } from 'react';
import type { JsonValue } from '@dreame/runtime';
import { ExternalLinkButton, type RenderProps } from '@dreame/ui';
import { channelFor } from '../contact/channels.ts';
import { formatPrice } from '../format.ts';
import { readBundleResult, type BundleLine, type BundleResultState } from '../node-types/bundle-rules.ts';
import type { RecommendOutcomeConfig, RecommendOutcomeResponse } from '../node-types/recommendOutcome.ts';

/**
 * The stored bundle result, read only through `readBundleResult`. A missing or misshapen
 * state, or a currency code that `Intl.NumberFormat` rejects, counts as no result, so a
 * damaged state never breaks the page.
 */
function readResult(nodeState: JsonValue | undefined): BundleResultState | null {
  const result = readBundleResult(nodeState);
  if (result === null || result.currency === null) return result;
  try {
    formatPrice(0, result.currency);
  } catch {
    return null;
  }
  return result;
}

function LineRows({ lines, currency }: { readonly lines: readonly BundleLine[]; readonly currency: string }): ReactNode {
  return (
    <ul>
      {lines.map((line, i) => (
        <li key={`${i}-${line.id}`}>
          {line.emoji !== undefined && (
            <span className="shop-emoji" aria-hidden="true">
              {line.emoji}
            </span>
          )}{' '}
          <span className="shop-product-name">{line.name}</span>{' '}
          <span className="shop-product-price">{formatPrice(line.price, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Heading, body text (line breaks kept by `.dr-body`), the chosen bundle with its lines and
 * total (or "No bundle was chosen."), the optional `whyText`, the Suggestions when there are any,
 * and one `ExternalLinkButton` per Contact_Link in config order, with a "via <name>" note when
 * `channelFor` names a Contact_Channel. Manifest strings are text children only. A result page
 * ends the attempt, so this view has no control that calls `onRespond`.
 */
export function RecommendOutcomeNodeView({
  cfg,
  nodeState,
}: RenderProps<RecommendOutcomeConfig, RecommendOutcomeResponse>): ReactNode {
  const bundleId = useId();
  const suggestId = useId();
  const result = readResult(nodeState);
  const currency = result?.currency ?? null;
  const selection = result !== null && currency !== null ? result.selection : [];
  const suggestions = result !== null && currency !== null ? result.suggestions : [];
  const contacts = cfg.contacts ?? [];

  return (
    <div className="dr-node shop-result">
      <h2 className="dr-heading" tabIndex={-1}>
        {cfg.title}
      </h2>
      <p className="dr-body">{cfg.body}</p>
      {selection.length === 0 || result === null || currency === null ? (
        <p className="dr-note">No bundle was chosen.</p>
      ) : (
        <section aria-labelledby={bundleId}>
          <h3 id={bundleId}>Your bundle</h3>
          <LineRows lines={selection} currency={currency} />
          <p className="shop-total">Total {formatPrice(result.total, currency)}</p>
        </section>
      )}
      {cfg.whyText !== undefined && <p className="shop-why">{cfg.whyText}</p>}
      {suggestions.length > 0 && currency !== null && (
        <section aria-labelledby={suggestId}>
          <h3 id={suggestId}>You might also like</h3>
          <LineRows lines={suggestions} currency={currency} />
        </section>
      )}
      {contacts.length > 0 && (
        <ul className="shop-contacts">
          {contacts.map((contact, i) => {
            const channel = channelFor(contact.url);
            return (
              <li key={i}>
                <ExternalLinkButton label={contact.label} url={contact.url} />
                {channel !== undefined && <span className="dr-note">via {channel.name}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
