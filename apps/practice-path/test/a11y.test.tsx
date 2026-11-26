// Automated axe check for the app (design Testing Strategy "Example tests", ui-renderer D17,
// Requirement 18.20). The scan catches some accessibility errors only; keyboard and
// screen-reader checks by a person are still needed. The axe setup matches
// `apps/shop-challenge/test/a11y.test.tsx`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { validateManifest, type ValidManifest } from '@dreame/schema';
import type { StorageBackend } from '@dreame/storage';
import { ActivityPlayer } from '@dreame/ui';
import { App } from '../src/app/App.tsx';
import { Footer } from '../src/app/Footer.tsx';
import { PlayDemoRoute } from '../src/app/PlayDemoRoute.tsx';
import { ProgressProvider } from '../src/app/ProgressProvider.tsx';
import { SAVED_TEXT, notSavedText, readFailedText } from '../src/app/save-status-text.ts';
import { PROGRESS_KEY_NAME } from '../src/progress.ts';
import { practiceProfile } from '../src/profile.ts';
import type { MasterySummaryConfig } from '../src/node-types/masterySummary.ts';
import type { RecallConfig } from '../src/node-types/recall.ts';
import type { ReviewQueueConfig } from '../src/node-types/reviewQueue.ts';
import { MasterySummaryNodeView } from '../src/views/MasterySummaryNodeView.tsx';
import { RecallNodeView } from '../src/views/RecallNodeView.tsx';
import { ReviewQueueNodeView } from '../src/views/ReviewQueueNodeView.tsx';
import { practiceViews } from '../src/views/registry.ts';

// Imported as a module: under jsdom, `import.meta.url` is not a file URL, so `readFileSync` cannot locate it.
import fractions from '../../../activities/practice-fractions.json';

// WCAG 2.x level A and AA rules. jsdom does not compute layout, so `color-contrast` is disabled;
// `packages/ui/test/tokens.test.ts` checks the contrast of the theme tokens instead.
const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false } },
};

async function violations(container: Element): Promise<axe.Result[]> {
  const result = await axe.run(container, AXE_OPTIONS);
  // Guards against an empty scan: at least one rule must have checked an element.
  expect(result.passes.length).toBeGreaterThan(0);
  return result.violations;
}

/** An in-memory Storage_Backend; `quota` makes every write throw a QuotaExceededError. */
function memoryBackend(initial?: string, quota = false): StorageBackend {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PROGRESS_KEY_NAME, initial);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (quota) throw new DOMException('full', 'QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function demoManifest(): ValidManifest {
  const result = validateManifest(fractions, practiceProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

function counterClock(): () => number {
  let t = 1000;
  return () => (t += 1000);
}

function renderApp(path: string, backend: StorageBackend | null = memoryBackend()): ReturnType<typeof render> {
  return render(
    <ProgressProvider backend={backend}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ProgressProvider>,
  );
}

/** The page shell of `App` (main and footer) around `children`. */
function Shell({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <ProgressProvider backend={memoryBackend()}>
      <MemoryRouter>
        <div className="pp-app">
          <main className="pp-main">{children}</main>
          <Footer />
        </div>
      </MemoryRouter>
    </ProgressProvider>
  );
}

const CORRECT_LABELS = ['3/6', '1/2', '0.75', '20', '60%', '5/6'];

/** Plays the Demo_Lesson in the app with every first answer correct, up to the result node. */
async function playToResult(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Start' }));
  for (const label of CORRECT_LABELS) {
    await user.click(screen.getByRole('radio', { name: label }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
  }
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

const recallCfg: RecallConfig = {
  itemId: 'q1',
  prompt: 'What is 1/2 of 1/2?',
  options: [
    { id: 'a', label: '1/4' },
    { id: 'b', label: '1/2' },
  ],
  correctOptionId: 'a',
  explanation: 'Half of a half is a quarter.',
  maxRetries: 1,
};

const reviewCfg: ReviewQueueConfig = { title: 'Review', from: ['q1'] };

const summaryCfg: MasterySummaryConfig = { title: 'Your results', body: 'Done.', from: 'review' };

describe('app axe check (WCAG 2.x A and AA, color-contrast disabled)', () => {
  it('the landing view has no violations, with and without a Storage_Backend', async () => {
    const first = renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Practice Path' })).toBeDefined();
    expect(await violations(first.container)).toEqual([]);
    first.unmount();

    const second = renderApp('/', null);
    expect(await violations(second.container)).toEqual([]);
  });

  it('the not-found view has no violations, for an unknown path and an unknown demo ID', async () => {
    const first = renderApp('/x');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeDefined();
    expect(await violations(first.container)).toEqual([]);
    first.unmount();

    const second = renderApp('/play/demo/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeDefined();
    expect(await violations(second.container)).toEqual([]);
  });

  it('the lesson-ended view has no violations', async () => {
    const ended = { ...fractions, validUntil: '2000-01-01' };
    const routed = render(
      <ProgressProvider backend={memoryBackend()}>
        <MemoryRouter initialEntries={['/play/demo/ended']}>
          <div className="pp-app">
            <main className="pp-main">
              <Routes>
                <Route
                  path="/play/demo/:id"
                  element={<PlayDemoRoute demos={[{ id: 'ended', title: 'Ended demo', json: ended }]} />}
                />
              </Routes>
            </main>
            <Footer />
          </div>
        </MemoryRouter>
      </ProgressProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'This lesson has ended' })).toBeDefined();
    expect(await violations(routed.container)).toEqual([]);
  });

  it('the Save_Status has no violations in its saved state', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/play/demo/practice-fractions');
    await playToResult(user);
    expect(screen.getByRole('status').textContent).toBe(SAVED_TEXT);
    expect(await violations(container)).toEqual([]);
  });

  it('the Save_Status has no violations in its not-saved state', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/play/demo/practice-fractions', memoryBackend(undefined, true));
    await playToResult(user);
    expect(screen.getByRole('status').textContent).toBe(`${notSavedText('quota')} Export progress`);
    expect(await violations(container)).toEqual([]);
  });

  it('the Save_Status has no violations in its read-failed state', async () => {
    const { container } = renderApp('/play/demo/practice-fractions', memoryBackend('{not json'));
    expect(screen.getByRole('status').textContent).toBe(readFailedText('corrupt'));
    expect(await violations(container)).toEqual([]);
  });

  it('RecallNodeView has no violations, before and after the inline message and each feedback', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RecallNodeView cfg={recallCfg} onRespond={() => {}} nodeState={undefined} rejections={0} />,
    );
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('radio', { name: '1/2' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Not quite. Try again.')).toBeDefined();
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('radio', { name: '1/4' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct')).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('ReviewQueueNodeView has no violations with an empty queue', async () => {
    const { container } = render(
      <ReviewQueueNodeView cfg={reviewCfg} onRespond={() => {}} nodeState={undefined} rejections={0} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Review' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('MasterySummaryNodeView has no violations with no results', async () => {
    // Inside the app shell: the view alone has no element any WCAG rule checks, so the scan would be empty.
    const { container } = render(
      <Shell>
        <MasterySummaryNodeView cfg={summaryCfg} onRespond={() => {}} nodeState={undefined} rejections={0} />
      </Shell>,
    );
    expect(screen.getByText('No results to show for this attempt.')).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('the player has no violations on each node of the Demo_Lesson', async () => {
    const user = userEvent.setup();
    // The PlayDemoRoute layout with a fixed seed, so the run is the same every time.
    const { container } = render(
      <Shell>
        <h1 className="dr-heading">Fractions and percentages</h1>
        <ActivityPlayer
          profile={practiceProfile}
          manifest={demoManifest()}
          seed={42}
          views={practiceViews}
          now={counterClock()}
        />
      </Shell>,
    );
    const nodeId = (): string | null | undefined => container.querySelector('.dr-player')?.getAttribute('data-node-id');

    expect(nodeId()).toBe('intro');
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // q1: missed on the first try, then answered; q2: out of tries. Both join the review queue.
    expect(nodeId()).toBe('q1');
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole('radio', { name: '2/3' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('radio', { name: '3/6' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(nodeId()).toBe('q2');
    await user.click(screen.getByRole('radio', { name: '2/8' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('radio', { name: '1/8' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Not this time')).toBeDefined();
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    for (const [i, label] of ['0.75', '20', '60%', '5/6'].entries()) {
      expect(nodeId()).toBe(`q${i + 3}`);
      expect(await violations(container)).toEqual([]);
      await user.click(screen.getByRole('radio', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Check' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }

    expect(nodeId()).toBe('review');
    expect(screen.getByText('2 questions to review')).toBeDefined();
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    for (const label of ['3/6', '1/2']) {
      expect(await violations(container)).toEqual([]);
      await user.click(screen.getByRole('radio', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Check' }));
      expect(await violations(container)).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }

    expect(nodeId()).toBe('result');
    expect(await violations(container)).toEqual([]);
  });
});
