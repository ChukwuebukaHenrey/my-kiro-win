// Property test for text rendering in the three core views (design Property 2, section C7;
// Requirements 7.4, 9.1, 10.1, 11.1).
// A passing run is evidence for this property over the generated strings, not a proof.
import { cleanup, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ChoiceConfig, ContentConfig, OutcomeConfig } from '@dreame/node-types';
import { ChoiceNodeView } from '../src/views/ChoiceNodeView.tsx';
import { ContentNodeView } from '../src/views/ContentNodeView.tsx';
import { OutcomeNodeView } from '../src/views/OutcomeNodeView.tsx';

const NUM_RUNS = 150;
const TIMEOUT_MS = 120_000;

// Markup fragments whose tags must never become elements, mixed with text that HTML parsing
// would change (entities, line breaks, quotes).
const MARKUP_FRAGMENTS = [
  '<b>x</b>',
  '<img src=x>',
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '<i>',
  '</p>',
  '<a href="https://example.com/">a</a>',
  '<svg onload=alert(1)>',
  '<iframe src="https://example.com/">',
  '&amp;',
  '&lt;b&gt;',
  '\n',
  '\r\n',
  '  ',
  '"',
  "'",
] as const;

/** Tag names the markup fragments name; none of them may appear in a rendered view. */
const MARKUP_TAGS = ['b', 'img', 'script', 'i', 'a', 'svg', 'iframe'] as const;

const markupStringArb = fc
  .array(fc.oneof(fc.constantFrom(...MARKUP_FRAGMENTS), fc.string({ maxLength: 6 })), { maxLength: 6 })
  .map((parts) => parts.join(''));

const textArb: fc.Arbitrary<string> = fc.oneof(
  markupStringArb,
  fc.string({ maxLength: 40 }),
  fc.string({ unit: 'grapheme', maxLength: 20 }),
  fc.string({ unit: 'binary', maxLength: 20 }),
);

/** Fails when the view created an element named by the generated markup. */
function expectNoMarkupElements(container: HTMLElement): void {
  for (const tag of MARKUP_TAGS) expect(container.querySelector(tag)).toBeNull();
}

function checkContent(cfg: ContentConfig): void {
  const { container, unmount } = render(<ContentNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />);
  try {
    const heading = container.querySelector('h2');
    if (cfg.title === undefined) expect(heading).toBeNull();
    else expect(heading?.textContent).toBe(cfg.title);
    expect(container.querySelector('p.dr-body')?.textContent).toBe(cfg.body);
    expect(container.querySelector('button')?.textContent).toBe(cfg.continueLabel ?? 'Continue');
    expectNoMarkupElements(container);
  } finally {
    unmount();
  }
}

function checkChoice(cfg: ChoiceConfig): void {
  const { container, unmount } = render(<ChoiceNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />);
  try {
    expect(container.querySelector('legend')?.textContent).toBe(cfg.prompt);
    // No `shuffle`, so the rows keep config order (Property 4 covers the shuffled order).
    const labels = [...container.querySelectorAll('label.dr-option > span')].map((span) => span.textContent);
    expect(labels).toEqual(cfg.options.map((option) => option.label));
    expectNoMarkupElements(container);
  } finally {
    unmount();
  }
}

function checkOutcome(cfg: OutcomeConfig): void {
  const { container, unmount } = render(<OutcomeNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />);
  try {
    expect(container.querySelector('h2')?.textContent).toBe(cfg.title);
    expect(container.querySelector('p.dr-body')?.textContent).toBe(cfg.body);
    const link = container.querySelector('.dr-link');
    if (cfg.cta === undefined) {
      expect(link).toBeNull();
    } else {
      // The label is the first child in both states: the CTA button (safe URL) or the
      // paragraph before the blocked note (unsafe URL).
      expect(link?.firstElementChild?.textContent).toBe(cfg.cta.label);
    }
    expectNoMarkupElements(container);
  } finally {
    unmount();
  }
}

const contentArb: fc.Arbitrary<ContentConfig> = fc.record(
  { title: textArb, body: textArb, continueLabel: textArb },
  { requiredKeys: ['body'] },
);

const choiceArb: fc.Arbitrary<ChoiceConfig> = fc
  .tuple(textArb, fc.array(textArb, { minLength: 2, maxLength: 8 }))
  .map(([prompt, labels]) => ({ prompt, options: labels.map((label, i) => ({ id: `o${i}`, label })) }));

// One safe URL (button state) and one unsafe URL (blocked state), so the label is checked in both.
const ctaUrlArb = fc.constantFrom('https://example.com/shop', 'javascript:alert(1)');

const outcomeArb: fc.Arbitrary<OutcomeConfig> = fc.record(
  { title: textArb, body: textArb, cta: fc.record({ label: textArb, url: ctaUrlArb }) },
  { requiredKeys: ['title', 'body'] },
);

describe('Feature: ui-renderer, Property 2: Manifest strings are displayed as text', () => {
  // **Validates: Requirements 7.4, 9.1, 10.1, 11.1**
  it(
    'content: title, body and continueLabel are the textContent of their elements',
    () => {
      fc.assert(fc.property(contentArb, checkContent), { numRuns: NUM_RUNS });
      cleanup();
    },
    TIMEOUT_MS,
  );

  it(
    'choice: prompt and every option label are the textContent of their elements',
    () => {
      fc.assert(fc.property(choiceArb, checkChoice), { numRuns: NUM_RUNS });
      cleanup();
    },
    TIMEOUT_MS,
  );

  it(
    'outcome: title, body and cta.label are the textContent of their elements',
    () => {
      fc.assert(fc.property(outcomeArb, checkOutcome), { numRuns: NUM_RUNS });
      cleanup();
    },
    TIMEOUT_MS,
  );

  it('shows <b>x</b> and <img src=x> literally in every field of the three views', () => {
    const b = '<b>x</b>';
    const img = '<img src=x>';
    checkContent({ title: b, body: `${img}\n${b}`, continueLabel: img });
    checkChoice({ prompt: b, options: [{ id: 'o0', label: img }, { id: 'o1', label: b }] });
    checkOutcome({ title: img, body: b, cta: { label: b, url: 'https://example.com/shop' } });
    checkOutcome({ title: b, body: img, cta: { label: img, url: 'javascript:alert(1)' } });
  });
});
