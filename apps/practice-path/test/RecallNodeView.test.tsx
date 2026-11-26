// Example tests for RecallNodeView (design C12, Testing Strategy "Example tests",
// Requirements 15.1–15.9). These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import { RecallNodeView } from '../src/views/RecallNodeView.tsx';
import type { RecallConfig, RecallResponse } from '../src/node-types/recall.ts';

const cfg: RecallConfig = {
  itemId: 'capital',
  prompt: 'What is the capital of France?',
  options: [
    { id: 'lyon', label: 'Lyon' },
    { id: 'paris', label: 'Paris' },
    { id: 'nice', label: 'Nice' },
  ],
  correctOptionId: 'paris',
  explanation: 'Paris has been the capital since 987.',
  maxRetries: 1,
};

function setup(c: RecallConfig = cfg, nodeState: JsonValue | undefined = undefined) {
  const user = userEvent.setup();
  const onRespond = vi.fn<(r: RecallResponse) => void>();
  const view = render(<RecallNodeView cfg={c} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
  const rerender = (rejections: number): void => {
    view.rerender(<RecallNodeView cfg={c} onRespond={onRespond} nodeState={nodeState} rejections={rejections} />);
  };
  return { user, onRespond, container: view.container, rerender };
}

function radio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name }) as HTMLInputElement;
}

function radioLabels(): string[] {
  return screen.getAllByRole('radio').map((r) => r.parentElement?.textContent ?? '');
}

function feedback(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.pp-feedback');
}

describe('RecallNodeView', () => {
  it('names the group by the prompt and shows one radio per option in config order', () => {
    setup();
    expect(screen.getByRole('radiogroup', { name: cfg.prompt })).toBeTruthy();
    expect(radioLabels()).toEqual(['Lyon', 'Paris', 'Nice']);
  });

  it('shows the options in the stored order when shuffle is set', () => {
    setup({ ...cfg, shuffle: true }, { order: ['nice', 'lyon', 'paris'] });
    expect(radioLabels()).toEqual(['Nice', 'Lyon', 'Paris']);
  });

  it('shows a linked error and records no Try when Check is pressed with no selection', async () => {
    const { user, container } = setup();
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const error = screen.getByText('Choose an answer first.');
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe(error.id);
    expect(feedback(container)).toBeNull();
    expect(radio('Lyon').disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('shows Correct, the explanation and Continue after a correct Try, and focuses the feedback', async () => {
    const { user, container } = setup();
    await user.click(radio('Paris'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const fb = feedback(container);
    expect(fb?.textContent).toContain('Correct');
    expect(fb?.textContent).toContain(cfg.explanation);
    expect(document.activeElement).toBe(fb);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getAllByRole('radio').every((r) => (r as HTMLInputElement).disabled)).toBe(true);
  });

  it('shows the retry text after a wrong Try with Tries left, without the explanation or the answer', async () => {
    const { user, container } = setup();
    await user.click(radio('Lyon'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const fb = feedback(container);
    expect(fb?.textContent).toContain('Not quite. Try again.');
    expect(fb?.textContent).toContain('1 try left');
    expect(fb?.textContent).not.toContain(cfg.explanation);
    expect(fb?.textContent).not.toContain('Paris');
    expect(container.textContent).not.toContain(cfg.explanation);
    expect(document.activeElement).toBe(fb);
    expect(radio('Lyon').disabled).toBe(true);
    expect(radio('Lyon').checked).toBe(false);
    expect(radio('Paris').disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('shows Not this time, the answer and the explanation after a wrong last Try', async () => {
    const { user, container, onRespond } = setup();
    await user.click(radio('Lyon'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(radio('Nice'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const fb = feedback(container);
    expect(fb?.textContent).toContain('Not this time');
    expect(fb?.textContent).toContain('The answer is: Paris');
    expect(fb?.textContent).toContain(cfg.explanation);
    expect(document.activeElement).toBe(fb);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onRespond).toHaveBeenCalledWith({ tries: ['lyon', 'nice'] });
  });

  it('calls onRespond once on Continue and again only after rejections changes', async () => {
    const { user, onRespond, rerender } = setup();
    await user.click(radio('Lyon'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(radio('Paris'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const cont = screen.getByRole('button', { name: 'Continue' });
    await user.click(cont);
    await user.click(cont);
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenLastCalledWith({ tries: ['lyon', 'paris'] });
    rerender(1);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onRespond).toHaveBeenCalledTimes(2);
  });

  it('picks an option with the arrow keys and checks it with Enter', async () => {
    const { user, container } = setup();
    await user.click(radio('Lyon'));
    await user.keyboard('{ArrowDown}');
    expect(radio('Paris').checked).toBe(true);
    await user.keyboard('{Enter}');
    expect(feedback(container)?.textContent).toContain('Correct');
  });
});
