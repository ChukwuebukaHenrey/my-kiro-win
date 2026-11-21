// Automated axe check (design D17, Testing Strategy, Requirements 7.1, 7.2).
// The scan catches some accessibility errors only; keyboard and screen-reader checks by a person are still needed.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { coreProfile } from '@dreame/node-types';
import { validateManifest, type Diagnostic, type ValidManifest } from '@dreame/schema';
import { ActivityPlayer } from '../src/components/ActivityPlayer.tsx';
import { ExternalLinkButton } from '../src/components/ExternalLinkButton.tsx';
import { InvalidActivityView } from '../src/components/InvalidActivityView.tsx';
import { coreViews } from '../src/core-views.ts';
import { ChoiceNodeView } from '../src/views/ChoiceNodeView.tsx';
import { ContentNodeView } from '../src/views/ContentNodeView.tsx';
import { OutcomeNodeView } from '../src/views/OutcomeNodeView.tsx';

// Imported as a module: under jsdom, `import.meta.url` is not a file URL, so `readFileSync` cannot locate it.
import demoJson from '../../../activities/core-demo-study-break.json';

// WCAG 2.x level A and AA rules. jsdom does not compute layout, so `color-contrast` is disabled;
// `tokens.test.ts` checks the contrast of the theme tokens instead.
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
  const result = validateManifest(demoJson, coreProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

function counterClock(): () => number {
  let t = 1000;
  return () => (t += 1000);
}

const URL_SAFE = 'https://shop.example.com/bundles?ref=quiz';

describe('axe check (WCAG 2.x A and AA, color-contrast disabled)', () => {
  it('ContentNodeView has no violations', async () => {
    const { container } = render(
      <ContentNodeView cfg={{ title: 'Study break', body: 'Line one\nLine two' }} onRespond={() => {}} nodeState={undefined} />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it('ChoiceNodeView has no violations, before and after the no-selection message', async () => {
    const user = userEvent.setup();
    const cfg = { prompt: 'Pick a snack', options: [{ id: 'apple', label: 'Apple' }, { id: 'bread', label: 'Bread' }] };
    const { container } = render(<ChoiceNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />);
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('OutcomeNodeView with a cta has no violations', async () => {
    const { container } = render(
      <OutcomeNodeView
        cfg={{ title: 'All done', body: 'Thanks', cta: { label: 'Visit the shop', url: URL_SAFE } }}
        onRespond={() => {}}
        nodeState={undefined}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it('ExternalLinkButton in the confirm state has no violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExternalLinkButton label="See the bundle" url={URL_SAFE} />);
    await user.click(screen.getByRole('button', { name: 'See the bundle' }));
    expect(screen.getByRole('link', { name: 'Open shop.example.com' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('ActivityPlayer has no violations on each node of one path through the demo', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ActivityPlayer profile={coreProfile} manifest={demoManifest()} seed={42} views={coreViews} now={counterClock()} />,
    );
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole('radio', { name: 'Tired and a bit foggy' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('radio', { name: 'About 30 minutes' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Take a proper rest' })).toBeDefined();
    expect(await violations(container)).toEqual([]);
  });

  it('InvalidActivityView has no violations', async () => {
    const diagnostics: Diagnostic[] = [
      { severity: 'error', stage: 'refs', code: 'dangling-ref', path: '/nodes/0', message: 'Edge points to missing node "end".' },
    ];
    const { container } = render(
      <InvalidActivityView diagnostics={diagnostics} actionLabel="Back to home" onAction={() => {}} />,
    );
    expect(await violations(container)).toEqual([]);
  });
});
