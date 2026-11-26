// Example tests for ReviewQueueNodeView (design C13, Testing Strategy "Example tests",
// Requirements 16.1–16.7). These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import { ReviewQueueNodeView } from '../src/views/ReviewQueueNodeView.tsx';
import type { ReviewQueueConfig, ReviewQueueResponse } from '../src/node-types/reviewQueue.ts';

const cfg: ReviewQueueConfig = { title: 'Review', from: ['q1'] };
const DEFAULT_EMPTY = 'Nothing to review. Every question was right on the first try.';

function snapshot(itemId: string, prompt: string, correctOptionId: string): JsonValue {
  return {
    itemId,
    prompt,
    options: [
      { id: 'a', label: `${itemId} A` },
      { id: 'b', label: `${itemId} B` },
    ],
    correctOptionId,
    explanation: `Because of ${itemId}.`,
    tries: ['x'],
    firstTry: 'incorrect',
  };
}

function queueState(ids: readonly string[]): JsonValue {
  return { items: [], queue: ids.map((id, i) => snapshot(id, `Prompt ${i + 1}`, 'a')) };
}

function setup(nodeState: JsonValue | undefined, c: ReviewQueueConfig = cfg) {
  const user = userEvent.setup();
  const onRespond = vi.fn<(r: ReviewQueueResponse) => void>();
  const view = render(<ReviewQueueNodeView cfg={c} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
  return { user, onRespond, container: view.container };
}

function feedback(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.pp-feedback');
}

function radios(): HTMLInputElement[] {
  return screen.getAllByRole('radio') as HTMLInputElement[];
}

describe('ReviewQueueNodeView', () => {
  it('shows "1 question to review" for a one-Item Queue', () => {
    setup(queueState(['q1']));
    expect(screen.getByText('1 question to review')).toBeTruthy();
  });

  it('shows "3 questions to review" and the intro when set', () => {
    setup(queueState(['q1', 'q2', 'q3']), { ...cfg, intro: 'Here is a second look.' });
    expect(screen.getByText('3 questions to review')).toBeTruthy();
    expect(screen.getByText('Here is a second look.')).toBeTruthy();
  });

  it('shows no intro when it is not set', () => {
    const { container } = setup(queueState(['q1']));
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  const emptyCases: ReadonlyArray<[string, JsonValue | undefined]> = [
    ['an empty Queue', queueState([])],
    ['no node state', undefined],
    ['a damaged node state', { items: [], queue: 'broken' }],
  ];
  for (const [label, state] of emptyCases) {
    it(`shows the default text and a Continue that sends no answers once, for ${label}`, async () => {
      const { user, onRespond } = setup(state);
      expect(screen.getByText(DEFAULT_EMPTY)).toBeTruthy();
      const cont = screen.getByRole('button', { name: 'Continue' });
      await user.click(cont);
      await user.click(cont);
      expect(onRespond).toHaveBeenCalledTimes(1);
      expect(onRespond).toHaveBeenCalledWith({ answers: [] });
    });

    it(`shows a custom emptyText and a Continue that sends no answers once, for ${label}`, async () => {
      const { user, onRespond } = setup(state, { ...cfg, emptyText: 'All clear.' });
      expect(screen.getByText('All clear.')).toBeTruthy();
      expect(screen.queryByText(DEFAULT_EMPTY)).toBeNull();
      const cont = screen.getByRole('button', { name: 'Continue' });
      await user.click(cont);
      await user.click(cont);
      expect(onRespond).toHaveBeenCalledTimes(1);
      expect(onRespond).toHaveBeenCalledWith({ answers: [] });
    });
  }

  it('shows a linked message when Check is pressed with no selection', async () => {
    const { user, container } = setup(queueState(['q1']));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const error = screen.getByText('Choose an answer first.');
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe(error.id);
    expect(feedback(container)).toBeNull();
    expect(radios().every((r) => !r.disabled)).toBe(true);
  });

  it('allows one Try per Item: radios are disabled after Check and the feedback shows the result', async () => {
    const { user, container } = setup(queueState(['q1']));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('radio', { name: 'q1 B' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(radios().every((r) => r.disabled)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    const fb = feedback(container);
    expect(fb?.textContent).toContain('Not this time');
    expect(fb?.textContent).toContain('The answer is: q1 A');
    expect(fb?.textContent).toContain('Because of q1.');
  });

  it('focuses each new Item heading and the feedback element, and the last Next sends answers in Queue order', async () => {
    const { user, container, onRespond } = setup(queueState(['q2', 'q1', 'q3']));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const picks = ['q2 A', 'q1 B', 'q3 A'];
    for (let k = 0; k < picks.length; k++) {
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading.textContent).toBe(`Question ${k + 1} of 3`);
      expect(document.activeElement).toBe(heading);
      await user.click(screen.getByRole('radio', { name: picks[k] }));
      await user.click(screen.getByRole('button', { name: 'Check' }));
      expect(document.activeElement).toBe(feedback(container));
      expect(onRespond).not.toHaveBeenCalled();
      const next = screen.getByRole('button', { name: 'Next' });
      await user.click(next);
      if (k === picks.length - 1) await user.click(next);
    }
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith({
      answers: [
        { itemId: 'q2', optionId: 'a' },
        { itemId: 'q1', optionId: 'b' },
        { itemId: 'q3', optionId: 'a' },
      ],
    });
  });
});
