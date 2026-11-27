// Plays a bundled Demo_Lesson at `/play/demo/:id` (design C15 "PlayDemoRoute",
// Requirements 18.4–18.8, 18.11). The manifest is validated in the browser before playback.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { AttemptState } from '@dreame/runtime';
import { validateManifest } from '@dreame/schema';
import { ActivityPlayer, InvalidActivityView } from '@dreame/ui';
import { DEMOS, findDemo, type DemoEntry } from '../demos.ts';
import { isLessonEnded, localDateString } from '../lesson-end.ts';
import { practiceProfile } from '../profile.ts';
import { practiceViews } from '../views/registry.ts';
import { LessonEndedView } from './LessonEndedView.tsx';
import { NotFoundView } from './NotFoundView.tsx';
import { useProgress } from './ProgressProvider.tsx';
import { SaveStatus } from './SaveStatus.tsx';

export interface PlayDemoRouteProps {
  /** The demos to look up; defaults to the bundled `DEMOS`. Tests pass other lists. */
  readonly demos?: readonly DemoEntry[];
}

function newSeed(): number {
  // A one-element array always has index 0.
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/** Step 1: look up the demo by ID in a `Map`, so `__proto__` or `toString` never match. */
export function PlayDemoRoute({ demos = DEMOS }: PlayDemoRouteProps): ReactNode {
  const { id } = useParams();
  const byId = useMemo(() => new Map(demos.map((demo) => [demo.id, demo])), [demos]);
  const demo = demos === DEMOS ? findDemo(id) : id === undefined ? undefined : byId.get(id);
  if (demo === undefined) return <NotFoundView />;
  // A new key per demo gives each demo its own validation result, seed and run count.
  return <DemoPlay key={demo.id} demo={demo} />;
}

interface DemoPlayProps {
  readonly demo: DemoEntry;
}

/** Steps 2–5: validate, check the lesson end date, play, then show the save status and "Practice again". */
function DemoPlay({ demo }: DemoPlayProps): ReactNode {
  const navigate = useNavigate();
  const progress = useProgress();
  const result = useMemo(() => validateManifest(demo.json, practiceProfile), [demo]);
  const [seed, setSeed] = useState(newSeed);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);

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
  const manifest = result.manifest;
  if (isLessonEnded(manifest.validUntil, localDateString(new Date()))) {
    return <LessonEndedView validUntil={manifest.validUntil ?? ''} />;
  }

  const finish = (attempt: AttemptState): void => {
    progress.recordAttempt(manifest, attempt);
    setFinished(true);
  };
  const practiceAgain = (): void => {
    setRun((n) => n + 1);
    setSeed(newSeed());
    setFinished(false);
  };

  return (
    <>
      <h1 className="dr-heading">{demo.title}</h1>
      <p>
        <Link to="/">Back to home</Link>
      </p>
      <ActivityPlayer
        key={`${demo.id}#${run}`}
        profile={practiceProfile}
        manifest={manifest}
        seed={seed}
        views={practiceViews}
        onFinish={finish}
      />
      {finished || progress.status.kind === 'read-failed' ? <SaveStatus /> : null}
      {finished ? (
        <>
          <button type="button" className="dr-button" onClick={practiceAgain}>
            Practice again
          </button>
          <p>
            <Link to="/">Back to home</Link>
          </p>
        </>
      ) : null}
    </>
  );
}
