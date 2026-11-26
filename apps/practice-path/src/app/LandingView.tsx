// The landing page at `/` (design C15 view table, Requirements 18.12–18.15, 18.17, 18.21).
// The only toolkit statement is the Brief §0 sentence quoted in `.kiro/steering/product.md`.
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { validateManifest } from '@dreame/schema';
import { DEMOS } from '../demos.ts';
import { practiceProfile } from '../profile.ts';
import { dueCount, lessonItemIds } from '../progress.ts';
import { ProgressControls } from './ProgressControls.tsx';
import { useProgress } from './ProgressProvider.tsx';
import { SaveStatus } from './SaveStatus.tsx';

interface DemoLink {
  readonly id: string;
  readonly title: string;
  /** Activity ID and item IDs of the validated manifest; null when it fails validation. */
  readonly lesson: { readonly activityId: string; readonly itemIds: readonly string[] } | null;
}

export function LandingView(): ReactNode {
  const progress = useProgress();
  const links = useMemo<readonly DemoLink[]>(
    () =>
      DEMOS.map((demo) => {
        const result = validateManifest(demo.json, practiceProfile);
        return {
          id: demo.id,
          title: demo.title,
          lesson: result.ok
            ? { activityId: result.manifest.activityId, itemIds: lessonItemIds(result.manifest) }
            : null,
        };
      }),
    [],
  );

  return (
    <section className="dr-node">
      <h1 className="dr-heading">Practice Path</h1>
      <p className="dr-body">
        Practice lessons for tutors and lesson creators: learners answer a question, read why, and every question
        missed on the first try comes back in a review round.
      </p>
      <p className="dr-body">
        The toolkit checks activity definitions against documented structural and supported semantic rules before
        playback.
      </p>
      <ul className="pp-demos">
        {links.map((link) => (
          <li key={link.id}>
            <Link to={`/play/demo/${link.id}`}>{link.title}</Link>
            {link.lesson !== null ? (
              <span className="dr-note">
                {' '}
                {dueCount(progress.store, link.lesson.activityId, link.lesson.itemIds)} to review on this device
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="pp-trust">No sign-up · No tracking · Open source</p>
      <p className="dr-note">Progress is saved on this device only — export to keep it</p>
      {progress.backendAvailable ? null : (
        <p className="dr-note">This browser is not saving progress. You can still practise and export your results.</p>
      )}
      <p className="dr-note">For practice only. The answers are part of this page, so it is not suited to graded tests.</p>
      <SaveStatus />
      <ProgressControls />
    </section>
  );
}
