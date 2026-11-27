// Example tests for the app shell and routes (design C15, Testing Strategy "Example tests",
// Requirements 18.3–18.9, 18.11–18.16). `App` has no `demos` prop, so the invalid-manifest and
// lesson-ended cases render `PlayDemoRoute` with a test-only demo list inside the same `Routes` shape.
// These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { writeJson, type StorageBackend } from '@dreame/storage';
import { App } from '../src/app/App.tsx';
import { Footer } from '../src/app/Footer.tsx';
import { LandingView } from '../src/app/LandingView.tsx';
import { PlayDemoRoute } from '../src/app/PlayDemoRoute.tsx';
import { ProgressProvider } from '../src/app/ProgressProvider.tsx';
import { SAVED_TEXT } from '../src/app/save-status-text.ts';
import type { DemoEntry } from '../src/demos.ts';
import { isLessonEnded } from '../src/lesson-end.ts';
import { PROGRESS_KEY_NAME, PROGRESS_VERSION, progressKey } from '../src/progress.ts';
import fractions from '../../../activities/practice-fractions.json';

const LICENSE_URL = 'https://github.com/ChukwuebukaHenrey/my-kiro-win/blob/main/LICENSE';
const REPO_URL = 'https://github.com/ChukwuebukaHenrey/my-kiro-win';
const SHOP_URL = 'https://my-kiro-win-shop-challenge.vercel.app/';
const AUDIENCE =
  'Practice lessons for tutors and lesson creators: learners answer a question, read why, and every question missed on the first try comes back in a review round.';
const DEVICE_ONLY = 'Progress is saved on this device only — export to keep it';
const PRACTICE_ONLY = 'For practice only. The answers are part of this page, so it is not suited to graded tests.';
const STORAGE_NOTE = 'This browser is not saving progress. You can still practise and export your results.';

/** An in-memory Storage_Backend. */
function memoryBackend(): StorageBackend & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
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

/** The `App` route shape with `PlayDemoRoute` given a test-only demo list. */
function renderWithDemos(path: string, demos: readonly DemoEntry[]): ReturnType<typeof render> {
  return render(
    <ProgressProvider backend={memoryBackend()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/play/demo/:id" element={<PlayDemoRoute demos={demos} />} />
        </Routes>
        <Footer />
      </MemoryRouter>
    </ProgressProvider>,
  );
}

function expectFooter(): void {
  const footer = screen.getByRole('contentinfo');
  expect(within(footer).getByText('Built with Kiro')).toBeTruthy();
  expect(
    within(footer).getByText('Activities are made by their authors and are not verified by Practice Path.'),
  ).toBeTruthy();
  const links = within(footer).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([LICENSE_URL, REPO_URL, SHOP_URL]);
  for (const link of links) {
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('(opens in a new tab)');
  }
}

function expectNotFound(): void {
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
}

function nodeId(container: HTMLElement): string | null | undefined {
  return container.querySelector('.dr-player')?.getAttribute('data-node-id');
}

const CORRECT_LABELS = ['3/6', '1/2', '0.75', '20', '60%', '5/6'];

describe('routes (Requirement 18.3)', () => {
  it('/ shows the app name, the audience sentence, the demo link with its due count and the notes (Requirements 18.12–18.15)', () => {
    const backend = memoryBackend();
    writeJson(backend, PROGRESS_KEY_NAME, PROGRESS_VERSION, {
      [progressKey('practice-fractions', 'fractions-1')]: { seen: 1, firstTryMisses: 1, last: 'missed', lastSeenAt: 1 },
      [progressKey('practice-fractions', 'fractions-2')]: { seen: 1, firstTryMisses: 1, last: 'reviewed', lastSeenAt: 1 },
    });
    renderApp('/', backend);
    expect(screen.getByRole('heading', { level: 1, name: 'Practice Path' })).toBeTruthy();
    expect(screen.getByText(AUDIENCE)).toBeTruthy();
    const demoLink = screen.getByRole('link', { name: 'Fractions and percentages' });
    expect(demoLink.getAttribute('href')).toBe('/play/demo/practice-fractions');
    expect(demoLink.parentElement?.textContent).toContain('2 to review on this device');
    expect(screen.getByText('No sign-up · No tracking · Open source')).toBeTruthy();
    expect(screen.getByText(DEVICE_ONLY)).toBeTruthy();
    expect(screen.getByText(PRACTICE_ONLY)).toBeTruthy();
    expect(screen.queryByText(STORAGE_NOTE)).toBeNull();
    expectFooter();
  });

  it('/ shows the storage note with a null backend (Requirement 18.15)', () => {
    renderApp('/', null);
    expect(screen.getByText(STORAGE_NOTE)).toBeTruthy();
    expectFooter();
  });

  it('/play/demo/practice-fractions shows the player at intro (Requirement 18.4)', () => {
    const { container } = renderApp('/play/demo/practice-fractions');
    expect(screen.getByRole('heading', { level: 1, name: 'Fractions and percentages' })).toBeTruthy();
    expect(nodeId(container)).toBe('intro');
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expectFooter();
  });

  it('the lesson page has a "Back to home" link to / that shows the landing view with the progress controls', async () => {
    const user = userEvent.setup();
    renderApp('/play/demo/practice-fractions');
    const link = screen.getByRole('link', { name: 'Back to home' });
    expect(link.getAttribute('href')).toBe('/');
    await user.click(link);
    expect(screen.getByRole('heading', { level: 1, name: 'Practice Path' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export progress' })).toBeTruthy();
  });

  it('/play/demo/nope shows "Page not found" with a link to / (Requirement 18.6)', () => {
    const { container } = renderApp('/play/demo/nope');
    expectNotFound();
    expect(container.querySelector('.dr-player')).toBeNull();
    expectFooter();
  });

  it('/x shows "Page not found" with a link to / (Requirement 18.3)', () => {
    renderApp('/x');
    expectNotFound();
    expectFooter();
  });

  it('after the attempt ends the Save_Status reads the saved text and "Practice again" starts at intro (Requirements 18.8, 18.9, 18.11)', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const { container } = renderApp('/play/demo/practice-fractions', backend);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    for (const label of CORRECT_LABELS) {
      await user.click(screen.getByRole('radio', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Check' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
    expect(nodeId(container)).toBe('review');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(nodeId(container)).toBe('result');
    expect(screen.getByRole('status').textContent).toBe(SAVED_TEXT);
    expect(backend.data.has(PROGRESS_KEY_NAME)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Practice again' }));
    expect(nodeId(container)).toBe('intro');
    expect(screen.queryByRole('button', { name: 'Practice again' })).toBeNull();
    expectFooter();
  });
});

describe('PlayDemoRoute with a test-only demo list', () => {
  it('an invalid manifest shows InvalidActivityView with "Back to home" (Requirement 18.5)', async () => {
    const broken = { ...fractions, entryNodeId: 'no-such-node' };
    const { container } = renderWithDemos('/play/demo/broken', [{ id: 'broken', title: 'Broken demo', json: broken }]);
    expect(screen.getByRole('heading', { name: 'This activity cannot be played' })).toBeTruthy();
    expect(container.querySelector('.dr-player')).toBeNull();
    expectFooter();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Practice Path' })).toBeTruthy();
  });

  it('a demo with a past validUntil shows "This lesson has ended" (Requirement 18.7)', () => {
    const ended = { ...fractions, validUntil: '2000-01-01' };
    const { container } = renderWithDemos('/play/demo/ended', [{ id: 'ended', title: 'Ended demo', json: ended }]);
    expect(screen.getByRole('heading', { level: 1, name: 'This lesson has ended' })).toBeTruthy();
    expect(
      screen.getByText('The lesson author set this lesson to end on 2000-01-01. The end date is checked on this device only.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
    expect(container.querySelector('.dr-player')).toBeNull();
    expectFooter();
  });

  it('a demo with a future validUntil plays at intro', () => {
    const open = { ...fractions, validUntil: '2999-12-31' };
    const { container } = renderWithDemos('/play/demo/open', [{ id: 'open', title: 'Open demo', json: open }]);
    expect(nodeId(container)).toBe('intro');
  });
});

describe('isLessonEnded (Requirement 18.7)', () => {
  it('is true for a past date, and false for the same day, a future date and no date', () => {
    expect(isLessonEnded('2026-11-20', '2026-11-21')).toBe(true);
    expect(isLessonEnded('2026-11-21', '2026-11-21')).toBe(false);
    expect(isLessonEnded('2026-11-22', '2026-11-21')).toBe(false);
    expect(isLessonEnded(undefined, '2026-11-21')).toBe(false);
  });
});
