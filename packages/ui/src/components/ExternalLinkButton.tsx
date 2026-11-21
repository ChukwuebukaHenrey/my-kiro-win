// CTA link with a visible destination and a confirmation step (design C8, Requirement 8).
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeLink } from '../link.ts';

export interface ExternalLinkButtonProps {
  readonly label: string;
  readonly url: string;
}

const AUTHOR_NOTE = "Added by the activity's author, not verified by this app.";
const BLOCKED_NOTE = 'This link was blocked because it is not a safe https link.';

/**
 * Safe `https:` URL: a button that shows the destination host, then a confirm group with an
 * anchor (`target="_blank"`, `rel="noopener noreferrer"`) and a "Stay here" button.
 * Any other URL: the label and a blocked note, with no anchor and no button.
 */
export function ExternalLinkButton({ label, url }: ExternalLinkButtonProps): ReactNode {
  const link = useMemo(() => describeLink(url), [url]);
  const destId = useId();
  const confirmTextId = useId();
  const [confirming, setConfirming] = useState(false);
  const pendingFocus = useRef<'anchor' | 'button' | null>(null);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus moves only after a switch the player asked for, never on the first render.
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'anchor') anchorRef.current?.focus();
    else if (target === 'button') buttonRef.current?.focus();
  }, [confirming]);

  if (!link.safe) {
    return (
      <div className="dr-link">
        <p>{label}</p>
        <p className="dr-notice">{BLOCKED_NOTE}</p>
      </div>
    );
  }

  const confirm = (): void => {
    pendingFocus.current = 'anchor';
    setConfirming(true);
  };
  const stay = (): void => {
    pendingFocus.current = 'button';
    setConfirming(false);
  };

  return (
    <div className="dr-link">
      {confirming ? (
        <div role="group" aria-labelledby={confirmTextId}>
          <p id={confirmTextId}>You are leaving this page for {link.host}.</p>
          <a ref={anchorRef} href={url} target="_blank" rel="noopener noreferrer" className="dr-button">
            Open {link.host}
          </a>
          <button type="button" className="dr-button" onClick={stay}>
            Stay here
          </button>
        </div>
      ) : (
        <>
          <button
            ref={buttonRef}
            type="button"
            className="dr-button dr-button-primary"
            aria-describedby={destId}
            onClick={confirm}
          >
            {label}
          </button>
          <p id={destId}>Opens {link.host}</p>
        </>
      )}
      <p className="dr-note">{AUTHOR_NOTE}</p>
    </div>
  );
}
