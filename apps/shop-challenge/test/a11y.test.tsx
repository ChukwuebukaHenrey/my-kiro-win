// Automated axe check for the app (design Testing Strategy "Example tests", ui-renderer D17,
// Requirement 13.13). The scan catches some accessibility errors only; keyboard and
// screen-reader checks by a person are still needed. The axe setup matches
// `packages/ui/test/a11y.test.tsx`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { JsonValue } from '@dreame/runtime';
import { validateManifest, type ValidManifest } from '@dreame/schema';
import { ActivityPlayer } from '@dreame/ui';
import { App } from '../src/app/App.tsx';
import { Footer } from '../src/app/Footer.tsx';
import { PlayDemoRoute } from '../src/app/PlayDemoRoute.tsx';
import { shopProfile } from '../src/profile.ts';
import type { CollectionSelectConfig } from '../src/node-types/collectionSelect.ts';
import type { RecommendOutcomeConfig } from '../src/node-types/recommendOutcome.ts';
import { CollectionSelectNodeView } from '../src/views/CollectionSelectNodeView.tsx';
import { RecommendOutcomeNodeView } from '../src/views/RecommendOutcomeNodeView.tsx';
import { shopViews } from '../src/views/registry.ts';

// Imported as a module: under jsdom, `import.meta.url` is not a file URL, so `readFileSync` cannot locate it.
import giftBundle from '../../../activities/shop-gift-bundle.json';

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

function demoManifest(): ValidManifest {
  const result = validateManifest(giftBundle, shopProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

function counterClock(): () => number {
  let t = 1000;
  return () => (t += 1000);
}

/** The page shell of `App` (main and footer) around `children`. */
function Shell({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="shop-app">
      <main className="shop-main">{children}</main>
      <Footer />
    </div>
  );
}

function renderApp(path: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const selectCfg: CollectionSelectConfig = {
  prompt: 'Build a gift bundle',
  items: [
    { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' },
    { id: 'candle', name: 'Candle', price: 18, tags: ['home'] },
    { id: 'card', name: 'Card', price: 4, tags: [] },
  ],
  min: 2,
  max: 3,
  budget: 30,
  currency: 'USD',
  pricesAsOf: '2026-11-01',
};

const outcomeCfg: RecommendOutcomeConfig = {
  title: 'Your gift bundle',
  body: 'Nice picks.\nHere is your bundle.',
  from: 'pick',
  whyText: 'These fit your budget.',
  recommend: { sortBy: 'priceAsc', limit: 1 },
  contacts: [
    { label: 'Order on WhatsApp', url: 'https://wa.me/12125550142' },
    { label: 'Visit the shop', url: 'https://example.com/shop' },
  ],
};

// The bundle result node state as the runtime stores it for the selection Mug + Card.
const outcomeState: JsonValue = {
  selection: [
    { id: 'mug', name: 'Mug', price: 12, emoji: '☕' },
    { id: 'card', name: 'Card', price: 4 },
  ],
  total: 16,
  currency: 'USD',
  suggestions: [{ id: 'candle', name: 'Candle', price: 18 }],
};

describe('app axe check (WCAG 2.x A and AA, color-contrast disabled)', () => {
  it('the landing view has no violations', async () => {
    const { container } = renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Shop Challenge' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
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

  it('the offer-ended view has no violations', async () => {
    const ended = { ...giftBundle, validUntil: '2000-01-01' };
    const { container } = render(
      <MemoryRouter initialEntries={['/play/demo/ended']}>
        <Shell>
          <Routes>
            <Route
              path="/play/demo/:id"
              element={<PlayDemoRoute demos={[{ id: 'ended', title: 'Ended demo', json: ended }]} />}
            />
          </Routes>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'This offer has ended' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('CollectionSelectNodeView has no violations, before and after the inline message', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CollectionSelectNodeView cfg={selectCfg} onRespond={() => {}} nodeState={undefined} rejections={0} />,
    );
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('checkbox', { name: (n) => n.includes('Mug') }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('RecommendOutcomeNodeView has no violations, before and after a confirm step', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RecommendOutcomeNodeView cfg={outcomeCfg} onRespond={() => {}} nodeState={outcomeState} rejections={0} />,
    );
    expect(screen.getByRole('region', { name: 'Your bundle' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'You might also like' })).toBeDefined();
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Order on WhatsApp' }));
    expect(screen.getByRole('link', { name: 'Open wa.me' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('the player has no violations on each node of the Demo_Manifest', async () => {
    const user = userEvent.setup();
    // The PlayDemoRoute layout with a fixed seed, so the run is the same every time.
    const { container } = render(
      <Shell>
        <h1 className="dr-heading">Gift bundle challenge</h1>
        <ActivityPlayer profile={shopProfile} manifest={demoManifest()} seed={42} views={shopViews} now={counterClock()} />
      </Shell>,
    );
    const nodeId = (): string | null | undefined => container.querySelector('.dr-player')?.getAttribute('data-node-id');

    expect(nodeId()).toBe('intro');
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(nodeId()).toBe('pick-occasion');
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('radio', { name: 'A birthday' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(nodeId()).toBe('pick');
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'See my bundle' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('checkbox', { name: (n) => n.includes('Chocolate box') }));
    await user.click(screen.getByRole('checkbox', { name: (n) => n.includes('Greeting card') }));
    await user.click(screen.getByRole('button', { name: 'See my bundle' }));
    expect(nodeId()).toBe('result');
    expect(screen.getByRole('heading', { level: 2, name: 'Your gift bundle' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });
});
