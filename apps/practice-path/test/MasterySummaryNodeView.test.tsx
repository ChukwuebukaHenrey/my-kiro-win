// Example tests for MasterySummaryNodeView (design C14, Testing Strategy "Example tests",
// Requirements 17.1–17.8). These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import { MasterySummaryNodeView } from '../src/views/MasterySummaryNodeView.tsx';
import type { MasterySummaryConfig, MasterySummaryResponse } from '../src/node-types/masterySummary.ts';
import type { MasteryResult } from '../src/node-types/practice-state.ts';
import { tutorShareLink } from '../src/share.ts';

const NOTE = 'No results to show for this attempt.';
const SHARE_URL = 'https://wa.me/2348012345678';
const cfg: MasterySummaryConfig = { title: 'Fractions check', body: 'Well done.\nHere is how it went.', from: 'rq' };
const shareCfg: MasterySummaryConfig = { ...cfg, tutorShare: { label: 'Send to my tutor', url: SHARE_URL } };

const mixed: MasteryResult = {
  items: [
    { itemId: 'q1', topic: 'Halves', prompt: 'What is 1/2 of 4?', result: 'firstTry' },
    { itemId: 'q2', topic: 'Thirds', prompt: 'What is 1/3 of 9?', result: 'reviewed' },
    { itemId: 'q3', topic: 'Quarters', prompt: 'What is 1/4 of 8?', result: 'missed' },
  ],
  counts: { firstTry: 1, reviewed: 1, missed: 1 },
  missedTopics: ['Thirds', 'Quarters'],
  nextReview: ['q2', 'q3'],
};

const perfect: MasteryResult = {
  items: [
    { itemId: 'q1', prompt: 'What is 1/2 of 4?', result: 'firstTry' },
    { itemId: 'q2', prompt: 'What is 1/3 of 9?', result: 'firstTry' },
  ],
  counts: { firstTry: 2, reviewed: 0, missed: 0 },
  missedTopics: [],
  nextReview: [],
};

function setup(nodeState: JsonValue | undefined, c: MasterySummaryConfig = cfg) {
  const user = userEvent.setup();
  const onRespond = vi.fn<(r: MasterySummaryResponse) => void>();
  const view = render(<MasterySummaryNodeView cfg={c} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
  return { user, onRespond, container: view.container };
}

describe('MasterySummaryNodeView', () => {
  it('shows the heading and keeps body line breaks in .dr-body', () => {
    const { container } = setup(mixed as unknown as JsonValue);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Fractions check');
    expect(container.querySelector('.dr-body')?.textContent).toBe('Well done.\nHere is how it went.');
  });

  it('shows the First_Try and after-review scores', () => {
    setup(mixed as unknown as JsonValue);
    expect(screen.getByText('First try: 1 of 3')).toBeTruthy();
    expect(screen.getByText('After review: 2 of 3')).toBeTruthy();
  });

  it('lists each item with its prompt and result text', () => {
    setup(mixed as unknown as JsonValue);
    const items = within(screen.getByRole('region', { name: 'Your answers' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'What is 1/2 of 4? Right on the first try',
      'What is 1/3 of 9? Right in review',
      'What is 1/4 of 8? Still to learn',
    ]);
  });

  it('shows the Topics and Review next time sections when there are misses', () => {
    setup(mixed as unknown as JsonValue);
    const topics = within(screen.getByRole('region', { name: 'Topics to practise' })).getAllByRole('listitem');
    expect(topics.map((li) => li.textContent)).toEqual(['Thirds', 'Quarters']);
    const next = within(screen.getByRole('region', { name: 'Review next time' })).getAllByRole('listitem');
    expect(next.map((li) => li.textContent)).toEqual(['What is 1/3 of 9?', 'What is 1/4 of 8?']);
    expect(screen.queryByText('Nothing to review next time.')).toBeNull();
  });

  it('shows no Topics heading and "Nothing to review next time." when every item was right first time', () => {
    setup(perfect as unknown as JsonValue);
    expect(screen.getByText('First try: 2 of 2')).toBeTruthy();
    expect(screen.getByText('After review: 2 of 2')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Topics to practise' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Review next time' })).toBeNull();
    expect(screen.getByText('Nothing to review next time.')).toBeTruthy();
  });

  it('shows the wa.me host and a confirm step, then an anchor with the Tutor_Share_Link', async () => {
    const { user } = setup(mixed as unknown as JsonValue, shareCfg);
    expect(screen.getByText('Opens wa.me')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Send to my tutor' }));
    expect(screen.getByRole('group', { name: 'You are leaving this page for wa.me.' })).toBeTruthy();
    const anchor = screen.getByRole('link', { name: 'Open wa.me' });
    expect(anchor.getAttribute('href')).toBe(tutorShareLink(SHARE_URL, 'Fractions check', mixed));
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows no share button without tutorShare', () => {
    setup(mixed as unknown as JsonValue);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Opens wa.me')).toBeNull();
  });

  const noResult: ReadonlyArray<[string, JsonValue | undefined]> = [
    ['a missing state', undefined],
    ['a damaged state', { items: 'broken', counts: {}, missedTopics: [], nextReview: [] }],
  ];
  for (const [label, state] of noResult) {
    it(`shows title, body and the note, and no share button, for ${label}`, () => {
      const { container } = setup(state, shareCfg);
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Fractions check');
      expect(container.querySelector('.dr-body')?.textContent).toBe('Well done.\nHere is how it went.');
      expect(screen.getByText(NOTE)).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByText(/First try:/)).toBeNull();
    });
  }

  it('has no control that calls onRespond', async () => {
    const { user, onRespond } = setup(mixed as unknown as JsonValue, shareCfg);
    await user.click(screen.getByRole('button', { name: 'Send to my tutor' }));
    await user.click(screen.getByRole('button', { name: 'Stay here' }));
    for (const button of screen.getAllByRole('button')) await user.click(button);
    expect(onRespond).not.toHaveBeenCalled();
  });
});
