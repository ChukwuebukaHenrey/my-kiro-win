// Component tests for ChoiceNodeView (design C7, Requirements 7.1, 7.2, 10.1, 10.4–10.8).
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChoiceConfig, ChoiceResponse } from '@dreame/node-types';
import { ChoiceNodeView } from '../src/views/ChoiceNodeView.tsx';

const cfg: ChoiceConfig = {
  prompt: 'Pick a snack',
  options: [
    { id: 'apple', label: 'Apple' },
    { id: 'bread', label: 'Bread' },
    { id: 'cheese', label: 'Cheese' },
  ],
};

function setup() {
  const user = userEvent.setup();
  const onRespond = vi.fn<(r: ChoiceResponse) => void>();
  render(<ChoiceNodeView cfg={cfg} onRespond={onRespond} nodeState={undefined} />);
  return { user, onRespond };
}

describe('ChoiceNodeView', () => {
  it('names the radio group by prompt and labels one radio per option', () => {
    setup();
    const group = screen.getByRole('radiogroup', { name: 'Pick a snack' });
    expect(group.tagName).toBe('FIELDSET');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['apple', 'bread', 'cheese']);
    for (const option of cfg.options) {
      expect(screen.getByRole('radio', { name: option.label })).toBeDefined();
    }
    expect(screen.getByRole('button', { name: 'Submit' }).getAttribute('type')).toBe('submit');
  });

  it('moves the selection with the arrow keys', async () => {
    const { user, onRespond } = setup();
    await user.click(screen.getByRole('radio', { name: 'Apple' }));
    expect((screen.getByRole('radio', { name: 'Apple' }) as HTMLInputElement).checked).toBe(true);

    await user.keyboard('{ArrowDown}');
    expect((screen.getByRole('radio', { name: 'Bread' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: 'Apple' }) as HTMLInputElement).checked).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRespond).toHaveBeenCalledWith({ optionId: 'bread' });
  });

  it('calls onRespond once with { optionId } when submitted with a selection', async () => {
    const { user, onRespond } = setup();
    await user.click(screen.getByRole('radio', { name: 'Cheese' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith({ optionId: 'cheese' });
  });

  it('submits once when Enter is pressed on the selected option', async () => {
    const { user, onRespond } = setup();
    await user.click(screen.getByRole('radio', { name: 'Apple' }));
    await user.keyboard('{Enter}');
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith({ optionId: 'apple' });
  });

  it('cancels the default action of Enter on an option', () => {
    setup();
    const radio = screen.getByRole('radio', { name: 'Apple' });
    fireEvent.click(radio);
    // fireEvent returns false when a handler called preventDefault().
    expect(fireEvent.keyDown(radio, { key: 'Enter' })).toBe(false);
  });

  it('shows a linked message and does not respond when submitted with no selection', async () => {
    const { user, onRespond } = setup();
    const group = screen.getByRole('radiogroup', { name: 'Pick a snack' });
    expect(group.hasAttribute('aria-describedby')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRespond).not.toHaveBeenCalled();
    const message = screen.getByRole('alert');
    expect(message.textContent).toBe('Choose an answer first.');
    expect(message.id).not.toBe('');
    expect(group.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('ignores further submissions after a response', async () => {
    const { user, onRespond } = setup();
    await user.click(screen.getByRole('radio', { name: 'Apple' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(screen.getByRole('radio', { name: 'Bread' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.keyboard('{Enter}');
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith({ optionId: 'apple' });
  });

  it('gives two choice views separate radio groups', () => {
    render(
      <>
        <ChoiceNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />
        <ChoiceNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />
      </>,
    );
    const names = new Set(screen.getAllByRole('radio').map((r) => r.getAttribute('name')));
    expect(names.size).toBe(2);
  });
});
