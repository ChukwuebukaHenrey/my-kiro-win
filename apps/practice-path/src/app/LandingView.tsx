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
    <section className="dr-node pp-landing">
      <p className="pp-eyebrow">Practice that brings back what you missed</p>
      <h1 className="dr-heading">Practice Path</h1>
      <p className="dr-body pp-lead">
        Practice lessons for tutors and lesson creators: learners answer a question, read why, and every question
        missed on the first try comes back in a review round.
      </p>
      <ul className="pp-demos">
        {links.map((link) => (
          <li key={link.id}>
            <Link className="pp-demo-card" to={`/play/demo/${link.id}`}>
              {link.title}
            </Link>
            {link.lesson !== null ? (
              <span className="dr-note">
                {' '}
                {dueCount(progress.store, link.lesson.activityId, link.lesson.itemIds)} to review on this device
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="pp-section-title">How it works</h2>
      <ol className="pp-steps">
        <li>
          <span className="pp-step-title">Answer</span>
          <span className="dr-note">One question at a time, with a second try.</span>
        </li>
        <li>
          <span className="pp-step-title">Read why</span>
          <span className="dr-note">Each answer comes with a short explanation.</span>
        </li>
        <li>
          <span className="pp-step-title">Review</span>
          <span className="dr-note">Questions you missed come back at the end.</span>
        </li>
      </ol>
      <p className="dr-body">
        The toolkit checks activity definitions against documented structural and supported semantic rules before
        playback.
      </p>
      <p className="pp-trust">No sign-up · No tracking · Open source</p>
      <div className="pp-progress-card">
        <h2 className="pp-section-title">Your progress</h2>
        <p className="dr-note">Progress is saved on this device only — export to keep it</p>
        {progress.backendAvailable ? null : (
          <p className="dr-note">This browser is not saving progress. You can still practise and export your results.</p>
        )}
        <p className="dr-note">For practice only. The answers are part of this page, so it is not suited to graded tests.</p>
        <SaveStatus />
        <ProgressControls />
      </div>
    </section>
  );
}
