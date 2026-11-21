// Component tests for ActivityPlayer (design C10, Requirements 13.1–13.5).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { coreProfile } from '@dreame/node-types';
import { validateManifest, type Manifest, type ValidManifest } from '@dreame/schema';
import { ActivityPlayer } from '../src/components/ActivityPlayer.tsx';
import { coreViews, ContentNodeView, OutcomeNodeView } from '../src/core-views.ts';
import { createRenderRegistry, type RenderProps } from '../src/render.ts';

// Imported as a module: under jsdom, `import.meta.url` is not a file URL, so `readFileSync` cannot locate it.
import demoJson from '../../../activities/core-demo-study-break.json';

function demoManifest(): ValidManifest {
  const result = validateManifest(demoJson, coreProfile);
  if (!result.ok) throw new Error(`demo manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

function counterClock(): () => number {
  let t = 1000;
  return () => (t += 1000);
}

function player(): HTMLElement {
  const section = document.querySelector('section.dr-player');
  if (!(section instanceof HTMLElement)) throw new Error('no player section');
  return section;
}

describe('ActivityPlayer', () => {
  it('shows the start node on mount and does not move focus (Requirements 13.1, 13.5)', () => {
    render(<ActivityPlayer profile={coreProfile} manifest={demoManifest()} seed={42} views={coreViews} now={counterClock()} />);
    expect(player().getAttribute('data-node-id')).toBe('intro');
    expect(player().tabIndex).toBe(-1);
    expect(screen.getByRole('heading', { level: 2, name: 'Plan your study break' })).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });

  it('moves focus to the container for a choice node and to the h2 of the reached outcome (Requirements 13.2, 13.3, 13.5)', async () => {
    const user = userEvent.setup();
    render(<ActivityPlayer profile={coreProfile} manifest={demoManifest()} seed={42} views={coreViews} now={counterClock()} />);

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(player().getAttribute('data-node-id')).toBe('feeling');
    expect(document.activeElement).toBe(player());

    await user.click(screen.getByRole('radio', { name: 'Tired and a bit foggy' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(player().getAttribute('data-node-id')).toBe('breakLength');
    expect(document.activeElement).toBe(player());

    await user.click(screen.getByRole('radio', { name: 'About 30 minutes' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(player().getAttribute('data-node-id')).toBe('longBreak');
    const heading = screen.getByRole('heading', { level: 2, name: 'Take a proper rest' });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the step-limit note and the fallback outcome when maxTransitions is exceeded (Requirement 13.4)', async () => {
    const base: Manifest = {
      schemaVersion: 1,
      profile: 'core',
      activityId: 'limit-check',
      version: 1,
      requires: { content: 1, choice: 1, outcome: 1 },
      entryNodeId: 'intro',
      fallbackOutcomeId: 'stopped',
      limits: { maxNodes: 10, maxTransitions: 2 },
      variables: [],
      nodes: [
        { id: 'intro', type: 'content', config: { title: 'Welcome', body: 'Two steps.' }, edges: [{ to: 'pick' }] },
        {
          id: 'pick',
          type: 'choice',
          config: { prompt: 'Pick one', options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }] },
          edges: [{ to: 'stopped', when: { op: 'eq', ref: { answer: 'pick' }, value: 'b' } }, { to: 'done' }],
        },
        { id: 'done', type: 'outcome', config: { title: 'Done', body: 'You finished.' }, edges: [] },
        { id: 'stopped', type: 'outcome', config: { title: 'Stopped early', body: 'Fallback outcome.' }, edges: [] },
      ],
      theme: 'default',
    };
    // The validator rejects a limit below the longest path, so check the manifest with a limit of 2
    // and then lower it to 1 by hand to reach the runtime's limit fallback.
    const checked = validateManifest(base, coreProfile);
    if (!checked.ok) throw new Error(`limit manifest is invalid: ${JSON.stringify(checked.diagnostics)}`);
    const limited = { ...checked.manifest, limits: { maxNodes: 10, maxTransitions: 1 } } as ValidManifest;

    const user = userEvent.setup();
    render(<ActivityPlayer profile={coreProfile} manifest={limited} seed={7} views={coreViews} now={counterClock()} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(player().getAttribute('data-node-id')).toBe('pick');
    expect(screen.queryByRole('status')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Option A' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(player().getAttribute('data-node-id')).toBe('stopped');
    expect(screen.getByRole('status').textContent).toBe('This activity stopped because it reached its step limit.');
    expect(screen.getByRole('heading', { level: 2, name: 'Stopped early' })).toBeDefined();
  });

  it('shows the rejection message and stays on the node when a view sends an invalid response', async () => {
    function BadChoiceView({ onRespond }: RenderProps<unknown, unknown>): ReactNode {
      return (
        <button type="button" onClick={() => onRespond({ optionId: 'not-an-option' })}>
          Send bad answer
        </button>
      );
    }
    const views = createRenderRegistry([
      { type: 'content', Render: ContentNodeView },
      { type: 'choice', Render: BadChoiceView },
      { type: 'outcome', Render: OutcomeNodeView },
    ]);

    const user = userEvent.setup();
    render(<ActivityPlayer profile={coreProfile} manifest={demoManifest()} seed={42} views={views} now={counterClock()} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByRole('alert')).toBeNull();
    const before = screen.getByRole('button', { name: 'Send bad answer' });

    await user.click(before);
    expect(player().getAttribute('data-node-id')).toBe('feeling');
    const firstAlert = screen.getByRole('alert');
    expect(firstAlert.textContent).toBe('That answer was not accepted. Please try again.');
    // The view key is the node ID only, so the view stays mounted and focus moves to the alert.
    expect(screen.getByRole('button', { name: 'Send bad answer' })).toBe(before);
    expect(document.activeElement).toBe(firstAlert);

    // A second click is sent again and produces a new alert element that takes focus (Requirement 12.7).
    await user.click(before);
    expect(player().getAttribute('data-node-id')).toBe('feeling');
    const secondAlert = screen.getByRole('alert');
    expect(secondAlert.textContent).toBe('That answer was not accepted. Please try again.');
    expect(secondAlert).not.toBe(firstAlert);
    expect(firstAlert.isConnected).toBe(false);
    expect(document.activeElement).toBe(secondAlert);
  });

  it('removes the alert and moves focus to the next node after an accepted response (Requirement 12.4)', async () => {
    function BadThenGoodChoiceView({ onRespond }: RenderProps<unknown, unknown>): ReactNode {
      return (
        <>
          <button type="button" onClick={() => onRespond({ optionId: 'not-an-option' })}>
            Send bad answer
          </button>
          <button type="button" onClick={() => onRespond({ optionId: 'tired' })}>
            Send good answer
          </button>
        </>
      );
    }
    const views = createRenderRegistry([
      { type: 'content', Render: ContentNodeView },
      { type: 'choice', Render: BadThenGoodChoiceView },
      { type: 'outcome', Render: OutcomeNodeView },
    ]);

    const user = userEvent.setup();
    render(<ActivityPlayer profile={coreProfile} manifest={demoManifest()} seed={42} views={views} now={counterClock()} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Send bad answer' }));
    expect(document.activeElement).toBe(screen.getByRole('alert'));

    await user.click(screen.getByRole('button', { name: 'Send good answer' }));
    expect(player().getAttribute('data-node-id')).toBe('breakLength');
    expect(screen.queryByRole('alert')).toBeNull();
    // The stub view has no h2, so focus goes to the container.
    expect(document.activeElement).toBe(player());
  });
});
