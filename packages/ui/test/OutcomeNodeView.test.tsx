// Component tests for OutcomeNodeView (design C7, Requirements 11.1–11.3).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OutcomeResponse } from '@dreame/node-types';
import { OutcomeNodeView } from '../src/views/OutcomeNodeView.tsx';

describe('OutcomeNodeView', () => {
  it('shows the title as a focusable heading and the body with its line breaks', () => {
    render(<OutcomeNodeView cfg={{ title: 'All done', body: 'Line one\nLine two' }} onRespond={() => {}} nodeState={undefined} />);
    const heading = screen.getByRole('heading', { level: 2, name: 'All done' });
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.querySelector('p.dr-body')?.textContent).toBe('Line one\nLine two');
  });

  it('renders a cta through ExternalLinkButton', async () => {
    const user = userEvent.setup();
    render(
      <OutcomeNodeView
        cfg={{ title: 'All done', body: 'Thanks', cta: { label: 'Visit the shop', url: 'https://example.com/shop' } }}
        onRespond={() => {}}
        nodeState={undefined}
      />,
    );
    const button = screen.getByRole('button', { name: 'Visit the shop' });
    expect(screen.getByText('Opens example.com')).toBeDefined();
    expect(screen.getByText("Added by the activity's author, not verified by this app.")).toBeDefined();

    await user.click(button);
    const anchor = screen.getByRole('link', { name: 'Open example.com' });
    expect(anchor.getAttribute('href')).toBe('https://example.com/shop');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders no button and no link without a cta', () => {
    render(<OutcomeNodeView cfg={{ title: 'All done', body: 'Thanks' }} onRespond={() => {}} nodeState={undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('never calls onRespond, including when the cta is used', async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn<(r: OutcomeResponse) => void>();
    render(
      <OutcomeNodeView
        cfg={{ title: 'All done', body: 'Thanks', cta: { label: 'Visit', url: 'https://example.com/' } }}
        onRespond={onRespond}
        nodeState={undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Visit' }));
    await user.click(screen.getByRole('button', { name: 'Stay here' }));
    await user.keyboard('{Enter}');
    expect(onRespond).not.toHaveBeenCalled();
  });
});
