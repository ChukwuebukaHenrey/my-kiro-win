// Plays a bundled Demo_Manifest at `/play/demo/:id` (design C12 "PlayDemoRoute",
// Requirements 13.4–13.7). The manifest is validated in the browser before playback.
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { validateManifest } from '@dreame/schema';
import { ActivityPlayer, InvalidActivityView } from '@dreame/ui';
import { DEMOS, type DemoEntry } from '../demos.ts';
import { isOfferEnded, localDateString } from '../offer.ts';
import { shopProfile } from '../profile.ts';
import { shopViews } from '../views/registry.ts';
import { NotFoundView } from './NotFoundView.tsx';
import { OfferEndedView } from './OfferEndedView.tsx';

export interface PlayDemoRouteProps {
  /** The demos to look up; defaults to the bundled `DEMOS`. Tests pass other lists. */
  readonly demos?: readonly DemoEntry[];
}

/** Step 1: look up the demo by ID in a `Map`, so `__proto__` or `toString` never match. */
export function PlayDemoRoute({ demos = DEMOS }: PlayDemoRouteProps): ReactNode {
  const { id } = useParams();
  const byId = useMemo(() => new Map(demos.map((demo) => [demo.id, demo])), [demos]);
  const demo = id === undefined ? undefined : byId.get(id);
  if (demo === undefined) return <NotFoundView />;
  // A new key per demo gives each demo its own validation result and seed.
  return <DemoPlay key={demo.id} demo={demo} />;
}

interface DemoPlayProps {
  readonly demo: DemoEntry;
}

/** Steps 2–4: validate, check the offer end date, then play. */
function DemoPlay({ demo }: DemoPlayProps): ReactNode {
  const navigate = useNavigate();
  const result = useMemo(() => validateManifest(demo.json, shopProfile), [demo]);
  // A new uint32 per mount; a one-element array always has index 0.
  const [seed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0);

  if (!result.ok) {
    return (
      <InvalidActivityView
        diagnostics={result.diagnostics}
        actionLabel="Back to home"
        onAction={() => {
          void navigate('/');
        }}
      />
    );
  }
  const { validUntil } = result.manifest;
  if (validUntil !== undefined && isOfferEnded(validUntil, localDateString(new Date()))) {
    return <OfferEndedView validUntil={validUntil} />;
  }
  return (
    <>
      <h1 className="dr-heading">{demo.title}</h1>
      <ActivityPlayer key={demo.id} profile={shopProfile} manifest={result.manifest} seed={seed} views={shopViews} />
    </>
  );
}
