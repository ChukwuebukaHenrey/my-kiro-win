// Component tests for InvalidActivityView (design C11, Requirements 7.4, 13.7).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HARD_LIMITS, type Diagnostic } from '@dreame/schema';
import { InvalidActivityView } from '../src/components/InvalidActivityView.tsx';

function diag(message: string, path = ''): Diagnostic {
  return { severity: 'error', stage: 'refs', code: 'dangling-ref', path, message };
}

describe('InvalidActivityView', () => {
  it('shows the heading and each message as text, with markup displayed literally', () => {
    const diagnostics = [diag('Edge points to missing node "end".', '/nodes/0'), diag('<b>x</b>', '/nodes/1')];
    render(<InvalidActivityView diagnostics={diagnostics} actionLabel="Back to home" onAction={() => {}} />);

    expect(screen.getByRole('heading', { level: 2, name: 'This activity cannot be played' })).toBeDefined();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Edge points to missing node "end".', '<b>x</b>']);
    expect(document.querySelector('b')).toBeNull();
  });

  it('lists at most HARD_LIMITS.maxDiagnostics messages', () => {
    const diagnostics = Array.from({ length: 60 }, (_, i) => diag(`Problem ${i}`, `/nodes/${i}`));
    render(<InvalidActivityView diagnostics={diagnostics} actionLabel="Back to home" onAction={() => {}} />);

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(HARD_LIMITS.maxDiagnostics).toBe(50);
    expect(items).toHaveLength(50);
    expect(items[49]?.textContent).toBe('Problem 49');
  });

  it('renders a button with the given label that calls onAction', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<InvalidActivityView diagnostics={[diag('Bad')]} actionLabel="Back to home" onAction={onAction} />);

    const button = screen.getByRole('button', { name: 'Back to home' });
    expect(button.getAttribute('type')).toBe('button');
    await user.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
