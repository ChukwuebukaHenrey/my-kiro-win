// Example tests for the app shell and routes (design C12, Testing Strategy "Example tests",
// Requirements 13.3–13.9). `App` has no `demos` prop, so the invalid-manifest and offer-ended
// cases render `PlayDemoRoute` with a test-only demo list inside the same `Routes` shape.
// These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { App } from '../src/app/App.tsx';
import { LandingView } from '../src/app/LandingView.tsx';
import { PlayDemoRoute } from '../src/app/PlayDemoRoute.tsx';
import type { DemoEntry } from '../src/demos.ts';
import { isOfferEnded } from '../src/offer.ts';
import giftBundle from '../../../activities/shop-gift-bundle.json';

const LICENSE_URL = 'https://github.com/ChukwuebukaHenrey/my-kiro-win/blob/main/LICENSE';
const REPO_URL = 'https://github.com/ChukwuebukaHenrey/my-kiro-win';
const PRACTICE_PATH_URL = 'https://my-kiro-win-practice-path.vercel.app/';
const AUDIENCE =
  "A bundle-builder game for small online sellers, such as Instagram and WhatsApp shops: players pick products within a budget and end at the seller's link.";

function renderApp(path: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** The `App` route shape with `PlayDemoRoute` given a test-only demo list. */
function renderWithDemos(path: string, demos: readonly DemoEntry[]): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/play/demo/:id" element={<PlayDemoRoute demos={demos} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectFooter(): void {
  const footer = screen.getByRole('contentinfo');
  expect(within(footer).getByText('Built with Kiro')).toBeTruthy();
  expect(
    within(footer).getByText('Activities are made by their authors and are not verified by Shop Challenge.'),
  ).toBeTruthy();
  const license = within(footer).getByRole('link', { name: /MIT License/ });
  const repo = within(footer).getByRole('link', { name: /Source on GitHub/ });
  const sister = within(footer).getByRole('link', { name: /Practice Path, the sister app/ });
  expect(license.getAttribute('href')).toBe(LICENSE_URL);
  expect(repo.getAttribute('href')).toBe(REPO_URL);
  expect(sister.getAttribute('href')).toBe(PRACTICE_PATH_URL);
  for (const link of [license, repo, sister]) {
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('(opens in a new tab)');
  }
}

function expectNotFound(): void {
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
}

describe('routes (Requirement 13.3)', () => {
  it('/ shows the app name, the audience sentence, the demo link and the trust text (Requirement 13.8)', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Shop Challenge' })).toBeTruthy();
    expect(screen.getByText(AUDIENCE)).toBeTruthy();
    const demoLink = screen.getByRole('link', { name: 'Gift bundle challenge' });
    expect(demoLink.getAttribute('href')).toBe('/play/demo/shop-gift-bundle');
    expect(screen.getByText('No sign-up · No tracking · Open source')).toBeTruthy();
    expectFooter();
  });

  it('/play/demo/shop-gift-bundle shows the player at intro (Requirement 13.4)', () => {
    const { container } = renderApp('/play/demo/shop-gift-bundle');
    expect(screen.getByRole('heading', { level: 1, name: 'Gift bundle challenge' })).toBeTruthy();
    const player = container.querySelector('.dr-player');
    expect(player?.getAttribute('data-node-id')).toBe('intro');
    expect(screen.getByText('Build a gift bundle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expectFooter();
  });

  it('/play/demo/nope shows "Page not found" with a link to / (Requirement 13.6)', () => {
    const { container } = renderApp('/play/demo/nope');
    expectNotFound();
    expect(container.querySelector('.dr-player')).toBeNull();
    expectFooter();
  });

  it('/x shows "Page not found" with a link to / (Requirement 13.3)', () => {
    renderApp('/x');
    expectNotFound();
    expectFooter();
  });

  it('following "Back to home" from the not-found view shows the landing view', async () => {
    const user = userEvent.setup();
    renderApp('/x');
    await user.click(screen.getByRole('link', { name: 'Back to home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Shop Challenge' })).toBeTruthy();
    expectFooter();
  });
});

describe('PlayDemoRoute with a test-only demo list', () => {
  it('an invalid manifest shows InvalidActivityView with "Back to home" (Requirement 13.5)', async () => {
    const broken = { ...giftBundle, entryNodeId: 'no-such-node' };
    const { container } = renderWithDemos('/play/demo/broken', [{ id: 'broken', title: 'Broken demo', json: broken }]);
    expect(screen.getByRole('heading', { name: 'This activity cannot be played' })).toBeTruthy();
    expect(container.querySelector('.dr-player')).toBeNull();
    const back = screen.getByRole('button', { name: 'Back to home' });

    const user = userEvent.setup();
    await user.click(back);
    expect(screen.getByRole('heading', { level: 1, name: 'Shop Challenge' })).toBeTruthy();
  });

  it('a demo with a past validUntil shows "This offer has ended" (Requirement 13.7)', () => {
    const ended = { ...giftBundle, validUntil: '2000-01-01' };
    const { container } = renderWithDemos('/play/demo/ended', [{ id: 'ended', title: 'Ended demo', json: ended }]);
    expect(screen.getByRole('heading', { level: 1, name: 'This offer has ended' })).toBeTruthy();
    expect(
      screen.getByText('The seller set this offer to end on 2000-01-01. The end date is checked on this device only.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
    expect(container.querySelector('.dr-player')).toBeNull();
  });

  it('a demo with a future validUntil plays at intro', () => {
    const open = { ...giftBundle, validUntil: '2999-12-31' };
    const { container } = renderWithDemos('/play/demo/open', [{ id: 'open', title: 'Open demo', json: open }]);
    expect(container.querySelector('.dr-player')?.getAttribute('data-node-id')).toBe('intro');
  });
});

describe('isOfferEnded (Requirement 13.7)', () => {
  it('is true for a past date, and false for the same day, a future date and no date', () => {
    expect(isOfferEnded('2026-11-20', '2026-11-21')).toBe(true);
    expect(isOfferEnded('2026-11-21', '2026-11-21')).toBe(false);
    expect(isOfferEnded('2026-11-22', '2026-11-21')).toBe(false);
    expect(isOfferEnded(undefined, '2026-11-21')).toBe(false);
  });
});
