// View for the `masterySummary` node type (design C14, Requirements 17.1–17.9).
import { useId, type ReactNode } from 'react';
import { checkHttpsUrl } from '@dreame/schema';
import { ExternalLinkButton, type RenderProps } from '@dreame/ui';
import type { MasterySummaryConfig, MasterySummaryResponse } from '../node-types/masterySummary.ts';
import { readMasteryResult, type ItemResult, type MasteryResult } from '../node-types/practice-state.ts';
import { tutorShareLink } from '../share.ts';

/** Display text for each Item_Result (Requirement 17.3). */
export const RESULT_TEXT: Readonly<Record<ItemResult, string>> = {
  firstTry: 'Right on the first try',
  reviewed: 'Right in review',
  missed: 'Still to learn',
};

function shareUrlFor(cfg: MasterySummaryConfig, result: MasteryResult): string | null {
  if (cfg.tutorShare === undefined) return null;
  const link = tutorShareLink(cfg.tutorShare.url, cfg.title, result);
  return checkHttpsUrl(link, '').length === 0 ? link : null;
}

/**
 * The result page: heading, body (line breaks kept by `.dr-body`), the First_Try and after-review
 * scores, each item with its result text, the Missed_Topics when there are any, the
 * Next_Review_Set (or "Nothing to review next time.") and one `ExternalLinkButton` for the
 * Tutor_Share_Link when `tutorShare` is set and the link passes `checkHttpsUrl`. A missing or
 * damaged node state shows a note and no share button. Node state is read only through
 * `readMasteryResult`. A result page ends the attempt, so no control calls `onRespond`.
 */
export function MasterySummaryNodeView({
  cfg,
  nodeState,
}: RenderProps<MasterySummaryConfig, MasterySummaryResponse>): ReactNode {
  const itemsId = useId();
  const topicsId = useId();
  const nextId = useId();
  const result = readMasteryResult(nodeState);

  if (result === null) {
    return (
      <div className="dr-node dr-outcome pp-summary">
        <h2 className="dr-heading" tabIndex={-1}>
          {cfg.title}
        </h2>
        <p className="dr-body">{cfg.body}</p>
        <p className="dr-note">No results to show for this attempt.</p>
      </div>
    );
  }

  const n = result.items.length;
  const { counts } = result;
  const shareUrl = shareUrlFor(cfg, result);
  const nextPrompts = result.nextReview.map((itemId) => {
    const item = result.items.find((entry) => entry.itemId === itemId);
    return { itemId, prompt: item === undefined ? itemId : item.prompt };
  });

  return (
    <div className="dr-node dr-outcome pp-summary">
      <h2 className="dr-heading" tabIndex={-1}>
        {cfg.title}
      </h2>
      <p className="dr-body">{cfg.body}</p>
      <div className="pp-stats">
        <p className="pp-stat">
          First try: {counts.firstTry} of {n}
        </p>
        <p className="pp-stat">
          After review: {counts.firstTry + counts.reviewed} of {n}
        </p>
      </div>
      <section aria-labelledby={itemsId}>
        <h3 id={itemsId}>Your answers</h3>
        <ul className="pp-results">
          {result.items.map((item, i) => (
            <li key={i}>
              <span>{item.prompt}</span>{' '}
              <span className={`pp-result pp-result-${item.result}`}>{RESULT_TEXT[item.result]}</span>
            </li>
          ))}
        </ul>
      </section>
      {result.missedTopics.length > 0 && (
        <section aria-labelledby={topicsId}>
          <h3 id={topicsId}>Topics to practise</h3>
          <ul>
            {result.missedTopics.map((topic, i) => (
              <li key={i}>{topic}</li>
            ))}
          </ul>
        </section>
      )}
      {nextPrompts.length > 0 ? (
        <section aria-labelledby={nextId}>
          <h3 id={nextId}>Review next time</h3>
          <ul>
            {nextPrompts.map((entry, i) => (
              <li key={i}>{entry.prompt}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p>Nothing to review next time.</p>
      )}
      {shareUrl !== null && cfg.tutorShare !== undefined && (
        <ExternalLinkButton label={cfg.tutorShare.label} url={shareUrl} />
      )}
    </div>
  );
}
