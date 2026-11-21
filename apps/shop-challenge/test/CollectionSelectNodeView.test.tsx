// Example tests for CollectionSelectNodeView (design C9, Testing Strategy "Example tests",
// Requirements 10.1–10.11). The node state comes from `selectNodeState`, as the runtime stores it.
// These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AttemptState, JsonValue } from '@dreame/runtime';
import { CollectionSelectNodeView } from '../src/views/CollectionSelectNodeView.tsx';
import {
  selectNodeState,
  type CollectionSelectConfig,
  type CollectionSelectResponse,
} from '../src/node-types/collectionSelect.ts';

// Budget 20: Mug + Candle = 16 (exactly 80%), Mug + Scarf = 20 (exactly 100%), Mug + Scarf + Card = 21.
const cfg: CollectionSelectConfig = {
  prompt: 'Build a gift bundle',
  items: [
    { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen', 'gift'], emoji: '☕' },
    { id: 'candle', name: 'Candle', price: 4, tags: ['home'], occasions: ['birthday'] },
    { id: 'scarf', name: 'Scarf', price: 8, tags: ['winter'], occasions: ['wedding'] },
    { id: 'card', name: 'Card', price: 1, tags: [] },
  ],
  min: 2,
  max: 3,
  budget: 20,
  currency: 'USD',
  occasionFrom: 'occ',
  pricesAsOf: '2026-11-01',
};

function state(answers: AttemptState['answers']): AttemptState {
  return {
    activityId: 'shop-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId: 'pick',
    vars: {},
    answers,
    nodeState: {},
    path: [{ nodeId: 'pick', at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

/** The node state the runtime stores for `answers`, as a JSON value. */
function nodeStateFor(c: CollectionSelectConfig, answers: AttemptState['answers'] = {}): JsonValue {
  const ns = selectNodeState(c, state(answers));
  return {
    occasion: ns.occasion,
    currency: ns.currency,
    items: ns.items.map((item) => {
      const base = { id: item.id, name: item.name, price: item.price, tags: [...item.tags] };
      return item.emoji === undefined ? base : { ...base, emoji: item.emoji };
    }),
  };
}

function setup(c: CollectionSelectConfig = cfg, nodeState: JsonValue | undefined = nodeStateFor(c)) {
  const user = userEvent.setup();
  const onRespond = vi.fn<(r: CollectionSelectResponse) => void>();
  const view = render(<CollectionSelectNodeView cfg={c} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
  return { user, onRespond, container: view.container };
}

function checkbox(name: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name: (n) => n.startsWith(name) }) as HTMLInputElement;
}

function statusText(container: HTMLElement): string {
  return container.querySelector('[aria-live="polite"]')?.textContent ?? '';
}

function hint(container: HTMLElement): string | null {
  return container.querySelector('.shop-hint')?.textContent ?? null;
}

async function pick(user: ReturnType<typeof userEvent.setup>, names: readonly string[]): Promise<void> {
  for (const name of names) await user.click(checkbox(name));
}

describe('CollectionSelectNodeView', () => {
  it('names the group by prompt and shows one checkbox per Item in config order', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Build a gift bundle' });
    expect(group.tagName).toBe('FIELDSET');
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('value'))).toEqual(['mug', 'candle', 'scarf', 'card']);
    expect(screen.getByRole('button', { name: 'Continue' }).getAttribute('type')).toBe('submit');
  });

  it('gives each checkbox a name with the Item name and the US dollar price, hides the emoji and shows tags as text', () => {
    const { container } = setup();
    for (const [name, price] of [
      ['Mug', '$12'],
      ['Candle', '$4'],
      ['Scarf', '$8'],
      ['Card', '$1'],
    ] as const) {
      expect(screen.getByRole('checkbox', { name: (n) => n.includes(name) && n.includes(price) })).toBeDefined();
    }
    const emoji = container.querySelector('.shop-emoji');
    expect(emoji?.textContent).toBe('☕');
    expect(emoji?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('checkbox', { name: (n) => n.includes('Mug') && !n.includes('☕') })).toBeDefined();
    expect(screen.getByText('kitchen, gift')).toBeDefined();
    expect(screen.getByText('home')).toBeDefined();
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('shows the pricesAsOf note', () => {
    setup();
    expect(screen.getByText("Prices as of 2026-11-01. The seller's page has the current prices.")).toBeDefined();
  });

  it('shows no pricesAsOf note when the config has none', () => {
    const { pricesAsOf: _unused, ...rest } = cfg;
    setup(rest);
    expect(screen.queryByText(/Prices as of/)).toBeNull();
  });

  it('shows "Under budget" at exactly 80%, "Close to budget" at exactly 100% and "Over budget" above', async () => {
    const { user, container } = setup();
    await pick(user, ['Mug', 'Candle']);
    expect(statusText(container)).toBe('2 of 3 items · Total $16 of $20 · Under budget');

    await user.click(checkbox('Candle'));
    await user.click(checkbox('Scarf'));
    expect(statusText(container)).toBe('2 of 3 items · Total $20 of $20 · Close to budget');

    await user.click(checkbox('Card'));
    expect(statusText(container)).toBe('3 of 3 items · Total $21 of $20 · Over budget');
  });

  it('shows the hint for too few, too many and over budget', async () => {
    const { user, container } = setup();
    expect(hint(container)).toBe('Add 2 more items');
    await user.click(checkbox('Mug'));
    expect(hint(container)).toBe('Add 1 more item');
    await pick(user, ['Scarf', 'Card']);
    expect(hint(container)).toBe('$1 over budget');
    await user.click(checkbox('Candle'));
    expect(hint(container)).toBe('Remove 1 item');
    await user.click(checkbox('Mug'));
    expect(hint(container)).toBeNull();
  });

  it('shows a linked inline message and does not respond when continue finds a broken Selection', async () => {
    const { user, onRespond } = setup();
    await user.click(checkbox('Mug'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onRespond).not.toHaveBeenCalled();
    const message = screen.getByRole('alert');
    expect(message.textContent).toBe('Your bundle does not meet the rules yet. Add 1 more item');
    expect(message.id).not.toBe('');
    const group = screen.getByRole('group', { name: 'Build a gift bundle' });
    expect((group.getAttribute('aria-describedby') ?? '').split(' ')).toContain(message.id);
  });

  it('calls onRespond once with itemIds in config order and ignores a second click', async () => {
    const { user, onRespond } = setup();
    await pick(user, ['Card', 'Mug']);
    const button = screen.getByRole('button', { name: 'Continue' });
    await user.click(button);
    await user.click(button);
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(onRespond).toHaveBeenCalledWith({ itemIds: ['mug', 'card'] });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('toggles a checkbox with Space', async () => {
    const { user } = setup();
    await user.tab();
    const mug = checkbox('Mug');
    expect(document.activeElement).toBe(mug);
    await user.keyboard(' ');
    expect(mug.checked).toBe(true);
    await user.keyboard(' ');
    expect(mug.checked).toBe(false);
  });

  it('shows only the Offered_Items of the stored occasion, in config order', () => {
    setup(cfg, nodeStateFor(cfg, { occ: 'birthday' }));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('value'))).toEqual(['mug', 'candle', 'card']);
    expect(screen.queryByRole('checkbox', { name: (n) => n.startsWith('Scarf') })).toBeNull();
  });

  it('shows every config Item when the node state is damaged or missing', () => {
    const { unmount } = render(
      <CollectionSelectNodeView cfg={cfg} onRespond={() => {}} nodeState={{ occasion: 5, currency: 'USD', items: 'x' }} />,
    );
    expect(screen.getAllByRole('checkbox').map((b) => b.getAttribute('value'))).toEqual(['mug', 'candle', 'scarf', 'card']);
    unmount();
    render(<CollectionSelectNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />);
    expect(screen.getAllByRole('checkbox').map((b) => b.getAttribute('value'))).toEqual(['mug', 'candle', 'scarf', 'card']);
  });
});
