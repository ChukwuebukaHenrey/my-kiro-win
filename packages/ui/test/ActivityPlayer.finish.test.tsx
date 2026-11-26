// Component tests for the ActivityPlayer `onFinish` callback (design C11, D61, Requirement 14).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { coreProfile } from '@dreame/node-types';
import type { AttemptState } from '@dreame/runtime';
import { validateManifest, type Manifest, type ValidManifest } from '@dreame/schema';
import { ActivityPlayer } from '../src/components/ActivityPlayer.tsx';
import { coreViews } from '../src/core-views.ts';

// Imported as a module: under jsdom, `import.meta.url` is not a file URL, so `readFileSync` cannot locate it.
import demoJson from '../../../activities/core-demo-study-break.json';

function valid(input: unknown): ValidManifest {
  const result = validateManifest(input, coreProfile);
  if (!result.ok) throw new Error(`manifest is invalid: ${JSON.stringify(result.diagnostics)}`);
  return result.manifest;
}

function counterClock(): () => number {
  let t = 1000;
  return () => (t += 1000);
}

type FinishSpy = ReturnType<typeof vi.fn<(attempt: AttemptState) => void>>;

function finishedAttempt(spy: FinishSpy): AttemptState {
  expect(spy).toHaveBeenCalledTimes(1);
  const call = spy.mock.calls[0];
  if (call === undefined) throw new Error('onFinish was not called');
  return call[0];
}

/** Plays the demo from `intro` to the `longBreak` outcome. */
async function playDemo(): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Start' }));
  await user.click(screen.getByRole('radio', { name: 'Tired and a bit foggy' }));
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  await user.click(screen.getByRole('radio', { name: 'About 30 minutes' }));
  await user.click(screen.getByRole('button', { name: 'Submit' }));
}

describe('ActivityPlayer onFinish', () => {
  it('is not called while the attempt is playing (Requirement 14.3)', async () => {
    const onFinish = vi.fn<(attempt: AttemptState) => void>();
    const user = userEvent.setup();
    render(<ActivityPlayer profile={coreProfile} manifest={valid(demoJson)} seed={42} views={coreViews} now={counterClock()} onFinish={onFinish} />);
    expect(onFinish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('radio', { name: 'Tired and a bit foggy' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('is called once with status finished after the outcome (Requirements 14.1, 14.2)', async () => {
    const onFinish = vi.fn<(attempt: AttemptState) => void>();
    render(<ActivityPlayer profile={coreProfile} manifest={valid(demoJson)} seed={42} views={coreViews} now={counterClock()} onFinish={onFinish} />);
    await playDemo();
    const attempt = finishedAttempt(onFinish);
    expect(attempt.status).toBe('finished');
    expect(attempt.currentNodeId).toBe('longBreak');
  });

  it('is called once under StrictMode (Requirement 14.4)', async () => {
    const onFinish = vi.fn<(attempt: AttemptState) => void>();
    render(
      <StrictMode>
        <ActivityPlayer profile={coreProfile} manifest={valid(demoJson)} seed={42} views={coreViews} now={counterClock()} onFinish={onFinish} />
      </StrictMode>,
    );
    await playDemo();
    expect(finishedAttempt(onFinish).status).toBe('finished');
  });

  it('is called once for a manifest whose entry node is terminal (Requirement 14.1)', () => {
    const manifest: Manifest = {
      schemaVersion: 1,
      profile: 'core',
      activityId: 'terminal-entry',
      version: 1,
      requires: { outcome: 1 },
      entryNodeId: 'done',
      fallbackOutcomeId: 'done',
      limits: { maxNodes: 10, maxTransitions: 2 },
      variables: [],
      nodes: [{ id: 'done', type: 'outcome', config: { title: 'Done', body: 'Nothing to answer.' }, edges: [] }],
      theme: 'default',
    };
    const onFinish = vi.fn<(attempt: AttemptState) => void>();
    render(
      <StrictMode>
        <ActivityPlayer profile={coreProfile} manifest={valid(manifest)} seed={1} views={coreViews} now={counterClock()} onFinish={onFinish} />
      </StrictMode>,
    );
    expect(finishedAttempt(onFinish).status).toBe('finished');
  });

  it('is called once with status limit_reached when maxTransitions is exceeded (Requirement 14.1)', async () => {
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
    // The validator rejects a limit below the longest path, so validate with 2 and lower it to 1 by hand.
    const limited = { ...valid(base), limits: { maxNodes: 10, maxTransitions: 1 } } as ValidManifest;
    const onFinish = vi.fn<(attempt: AttemptState) => void>();
    const user = userEvent.setup();
    render(<ActivityPlayer profile={coreProfile} manifest={limited} seed={7} views={coreViews} now={counterClock()} onFinish={onFinish} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onFinish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: 'Option A' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(finishedAttempt(onFinish).status).toBe('limit_reached');
  });

  it('plays to the end with no error when no onFinish is given (Requirement 14.5)', async () => {
    render(<ActivityPlayer profile={coreProfile} manifest={valid(demoJson)} seed={42} views={coreViews} now={counterClock()} />);
    await playDemo();
    expect(screen.getByRole('heading', { level: 2, name: 'Take a proper rest' })).toBeDefined();
  });
});
