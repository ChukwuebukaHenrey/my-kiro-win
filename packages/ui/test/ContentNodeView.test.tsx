// Component tests for ContentNodeView (design C7, Requirements 7.1, 7.2, 7.4, 9.1–9.3).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContentResponse } from '@dreame/node-types';
import { ContentNodeView } from '../src/views/ContentNodeView.tsx';

describe('ContentNodeView', () => {
  it('shows the title as a focusable heading, the body with its line breaks, and "Continue" by default', () => {
    render(
      <ContentNodeView cfg={{ title: 'Study break', body: 'Line one\nLine two' }} onRespond={() => {}} nodeState={undefined} />,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Study break' });
    expect(heading.getAttribute('tabindex')).toBe('-1');
    const body = document.querySelector('p.dr-body');
    expect(body?.textContent).toBe('Line one\nLine two');
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.getAttribute('type')).toBe('button');
  });

  it('renders no heading when title is absent and uses the given continueLabel', () => {
    render(<ContentNodeView cfg={{ body: 'Hello', continueLabel: 'Next page' }} onRespond={() => {}} nodeState={undefined} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('calls onRespond once with {} on the first click and not again on a second click', async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn<(r: ContentResponse) => void>();
    render(<ContentNodeView cfg={{ body: 'Hello' }} onRespond={onRespond} nodeState={undefined} />);
    const button = screen.getByRole('button', { name: 'Continue' });

    await user.click(button);
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith({});

    await user.click(button);
    expect(onRespond).toHaveBeenCalledTimes(1);
  });

  it('works from the keyboard', async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn<(r: ContentResponse) => void>();
    render(<ContentNodeView cfg={{ body: 'Hello' }} onRespond={onRespond} nodeState={undefined} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
    await user.keyboard('{Enter}');
    expect(onRespond).toHaveBeenCalledTimes(1);
  });

  it('displays markup in manifest strings as text', () => {
    render(
      <ContentNodeView
        cfg={{ title: '<i>t</i>', body: '<b>x</b>', continueLabel: '<u>go</u>' }}
        onRespond={() => {}}
        nodeState={undefined}
      />,
    );
    expect(screen.getByText('<b>x</b>')).toBeDefined();
    expect(screen.getByRole('heading', { name: '<i>t</i>' })).toBeDefined();
    expect(screen.getByRole('button', { name: '<u>go</u>' })).toBeDefined();
    expect(document.querySelector('b, i, u')).toBeNull();
  });
});
