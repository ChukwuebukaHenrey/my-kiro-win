// Example tests for RecommendOutcomeNodeView (design C10, Testing Strategy "Example tests",
// Requirements 11.1–11.10). The node state comes from `bundleResult` on an attempt state that holds
// a collectionSelect answer and its node state, as the runtime stores them.
// These tests are evidence for the cases listed, not a proof of correctness.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AttemptState, JsonValue } from '@dreame/runtime';
import { RecommendOutcomeNodeView } from '../src/views/RecommendOutcomeNodeView.tsx';
import { selectNodeState, type CollectionSelectConfig } from '../src/node-types/collectionSelect.ts';
import type { BundleLine } from '../src/node-types/bundle-rules.ts';
import {
  bundleResult,
  type RecommendOutcomeConfig,
  type RecommendOutcomeResponse,
} from '../src/node-types/recommendOutcome.ts';

const WA_URL = 'https://wa.me/12125550142';
const TG_URL = 'https://t.me/dreame_demo_shop';
const OTHER_URL = 'https://example.com/shop';

const selectCfg: CollectionSelectConfig = {
  prompt: 'Build a gift bundle',
  items: [
    { id: 'mug', name: 'Mug', price: 12, tags: ['kitchen'], emoji: '☕' },
    { id: 'candle', name: 'Candle', price: 18, tags: ['home'] },
    { id: 'card', name: 'Card', price: 4, tags: [] },
    { id: 'plant', name: 'Plant', price: 14, tags: ['home'] },
  ],
  min: 2,
  max: 3,
  budget: 50,
  currency: 'USD',
};

const cfg: RecommendOutcomeConfig = {
  title: 'Your gift bundle',
  body: 'Nice picks.\nHere is your bundle.',
  from: 'pick',
  whyText: 'These fit your budget.',
  recommend: { sortBy: 'priceAsc', limit: 2 },
  contacts: [
    { label: 'Order on WhatsApp', url: WA_URL },
    { label: 'Order on Telegram', url: TG_URL },
    { label: 'Visit the shop', url: OTHER_URL },
  ],
};

function attempt(answers: AttemptState['answers'], nodeState: AttemptState['nodeState']): AttemptState {
  return {
    activityId: 'shop-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId: 'result',
    vars: {},
    answers,
    nodeState,
    path: [
      { nodeId: 'pick', at: 0 },
      { nodeId: 'result', at: 0 },
    ],
    transitions: 1,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function lineJson(line: BundleLine): JsonValue {
  const base = { id: line.id, name: line.name, price: line.price };
  return line.emoji === undefined ? base : { ...base, emoji: line.emoji };
}

/** The node state `enter` stores for the `pick` answer `itemIds`, as a JSON value. */
function nodeStateFor(c: RecommendOutcomeConfig, itemIds: readonly string[]): JsonValue {
  const ns = selectNodeState(selectCfg, attempt({}, {}));
  const pickState: JsonValue = {
    occasion: ns.occasion,
    currency: ns.currency,
    items: ns.items.map((item) => {
      const base = { id: item.id, name: item.name, price: item.price, tags: [...item.tags] };
      return item.emoji === undefined ? base : { ...base, emoji: item.emoji };
    }),
  };
  const result = bundleResult(c, attempt({ pick: [...itemIds] }, { pick: pickState }));
  return {
    selection: result.selection.map(lineJson),
    total: result.total,
    currency: result.currency,
    suggestions: result.suggestions.map(lineJson),
  };
}

function setup(c: RecommendOutcomeConfig = cfg, nodeState: JsonValue | undefined = nodeStateFor(c, ['card', 'mug'])) {
  const user = userEvent.setup();
  const onRespond = vi.fn<(r: RecommendOutcomeResponse) => void>();
  const view = render(<RecommendOutcomeNodeView cfg={c} onRespond={onRespond} nodeState={nodeState} rejections={0} />);
  return { user, onRespond, container: view.container };
}

function rowTexts(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '');
}

/** The `li` elements of `ul.shop-contacts`, in document order. */
function contactItems(container: HTMLElement): HTMLLIElement[] {
  return Array.from(container.querySelectorAll<HTMLLIElement>('ul.shop-contacts > li'));
}

/** The "via <name>" note that is a direct child of `li`, or `null`. */
function viaNote(li: HTMLLIElement): string | null {
  const span = Array.from(li.children).find((el) => el.tagName === 'SPAN');
  return span?.textContent ?? null;
}

describe('RecommendOutcomeNodeView', () => {
  it('shows the title as a focusable level-2 heading', () => {
    setup();
    const heading = screen.getByRole('heading', { level: 2, name: 'Your gift bundle' });
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the line breaks of the body in .dr-body', () => {
    const { container } = setup();
    const body = container.querySelector('.dr-body');
    expect(body?.tagName).toBe('P');
    expect(body?.textContent).toBe('Nice picks.\nHere is your bundle.');
  });

  it('shows each bundle line with its name and formatted price, in config order, and the total', () => {
    const { container } = setup();
    const bundle = screen.getByRole('region', { name: 'Your bundle' });
    const rows = rowTexts(bundle);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Mug');
    expect(rows[0]).toContain('$12');
    expect(rows[1]).toContain('Card');
    expect(rows[1]).toContain('$4');
    const emoji = bundle.querySelector('.shop-emoji');
    expect(emoji?.textContent).toBe('☕');
    expect(emoji?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.shop-total')?.textContent).toBe('Total $16');
    expect(screen.queryByText('No bundle was chosen.')).toBeNull();
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('shows whyText', () => {
    const { container } = setup();
    expect(container.querySelector('.shop-why')?.textContent).toBe('These fit your budget.');
  });

  it('shows no whyText paragraph when the config has none', () => {
    const { whyText: _unused, ...rest } = cfg;
    const { container } = setup(rest, nodeStateFor(rest, ['card', 'mug']));
    expect(container.querySelector('.shop-why')).toBeNull();
  });

  it('shows the Suggestions under their own heading when there are any', () => {
    setup();
    const suggestions = screen.getByRole('region', { name: 'You might also like' });
    const rows = rowTexts(suggestions);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Plant');
    expect(rows[0]).toContain('$14');
    expect(rows[1]).toContain('Candle');
    expect(rows[1]).toContain('$18');
  });

  it('shows no Suggestions heading when there are no Suggestions', () => {
    const { recommend: _unused, ...rest } = cfg;
    setup(rest, nodeStateFor(rest, ['card', 'mug']));
    expect(screen.queryByRole('heading', { name: 'You might also like' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Your bundle' })).toBeDefined();
  });

  it('shows the note when the stored Selection is empty', () => {
    const { container } = setup(cfg, nodeStateFor(cfg, []));
    expect(screen.getByText('No bundle was chosen.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Your bundle' })).toBeNull();
    expect(container.querySelector('.shop-total')).toBeNull();
  });

  it('shows one link button per Contact_Link in config order, each confirming its host', async () => {
    const { user } = setup();
    const buttons = within(document.querySelector<HTMLElement>('ul.shop-contacts') ?? document.body).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Order on WhatsApp', 'Order on Telegram', 'Visit the shop']);
    expect(screen.getByText('Opens wa.me')).toBeDefined();
    expect(screen.getByText('Opens t.me')).toBeDefined();
    expect(screen.getByText('Opens example.com')).toBeDefined();

    for (const [label, host, url] of [
      ['Order on WhatsApp', 'wa.me', WA_URL],
      ['Order on Telegram', 't.me', TG_URL],
      ['Visit the shop', 'example.com', OTHER_URL],
    ] as const) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('group', { name: `You are leaving this page for ${host}.` })).toBeDefined();
      const anchor = screen.getByRole('link', { name: `Open ${host}` });
      expect(anchor.getAttribute('href')).toBe(url);
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      expect(anchor.getAttribute('target')).toBe('_blank');
    }
  });

  it('shows "via WhatsApp" and "via Telegram" next to those links and no note for another host', () => {
    const { container } = setup();
    const items = contactItems(container);
    expect(items).toHaveLength(3);
    expect(viaNote(items[0]!)).toBe('via WhatsApp');
    expect(within(items[0]!).getByRole('button', { name: 'Order on WhatsApp' })).toBeDefined();
    expect(viaNote(items[1]!)).toBe('via Telegram');
    expect(within(items[1]!).getByRole('button', { name: 'Order on Telegram' })).toBeDefined();
    expect(viaNote(items[2]!)).toBeNull();
    expect(items[2]!.textContent ?? '').not.toMatch(/\bvia\b/);
    expect(within(items[2]!).getByRole('button', { name: 'Visit the shop' })).toBeDefined();
  });

  it.each<[string, JsonValue | undefined]>([
    ['missing', undefined],
    ['damaged', { selection: 'x', total: 16, currency: 'USD', suggestions: [] }],
    ['damaged currency', { selection: [{ id: 'mug', name: 'Mug', price: 12 }], total: 12, currency: null, suggestions: [] }],
  ])('shows title, body, Contact_Links and the note when the node state is %s', (_name, nodeState) => {
    // Rendered directly: passing `undefined` to `setup` would select its default node state.
    const { container } = render(<RecommendOutcomeNodeView cfg={cfg} onRespond={() => {}} nodeState={nodeState} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your gift bundle' })).toBeDefined();
    expect(container.querySelector('.dr-body')?.textContent).toBe('Nice picks.\nHere is your bundle.');
    expect(screen.getByText('No bundle was chosen.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Your bundle' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'You might also like' })).toBeNull();
    expect(contactItems(container)).toHaveLength(3);
    for (const label of ['Order on WhatsApp', 'Order on Telegram', 'Visit the shop']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });

  it('has no control that calls onRespond', async () => {
    const { user, onRespond, container } = setup();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input, select, textarea')).toBeNull();
    for (const label of ['Order on WhatsApp', 'Order on Telegram', 'Visit the shop']) {
      await user.click(screen.getByRole('button', { name: label }));
    }
    for (const stay of screen.getAllByRole('button', { name: 'Stay here' })) {
      await user.click(stay);
    }
    await user.click(screen.getByRole('heading', { level: 2 }));
    await user.keyboard('{Enter}');
    expect(onRespond).not.toHaveBeenCalled();
  });
});
