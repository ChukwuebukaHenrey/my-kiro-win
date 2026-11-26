// Property test for text rendering in the three practice views (design Property 19, sections
// C12, C13, C14; Requirements 15.9, 16.7, 17.9, 17.10). Generated strings, including markup such
// as `<b>x</b>` and `<img src=x>`, fill every string field that Property 19 names. A passing run
// is evidence for this property over the generated strings, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@dreame/runtime';
import type { RecallConfig } from '../src/node-types/recall.ts';
import type { ReviewQueueConfig } from '../src/node-types/reviewQueue.ts';
import type { MasterySummaryConfig } from '../src/node-types/masterySummary.ts';
import type { ItemResult, ItemSnapshot } from '../src/node-types/practice-state.ts';
import { RecallNodeView } from '../src/views/RecallNodeView.tsx';
import { ReviewQueueNodeView } from '../src/views/ReviewQueueNodeView.tsx';
import { MasterySummaryNodeView } from '../src/views/MasterySummaryNodeView.tsx';
import { snapshotJson } from './practice-arbitraries.ts';

const NUM_RUNS = 100;
const TIMEOUT_MS = 120_000;
const DEFAULT_EMPTY_TEXT = 'Nothing to review. Every question was right on the first try.';

// Markup fragments whose tags must never become elements, mixed with text that HTML parsing
// would change (entities, line breaks, quotes). Same list as shop-challenge Property 14.
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

/** Short strings: joined markup fragments and text, any code points, graphemes and lone surrogates. */
const textArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.array(fc.oneof(fc.constantFrom(...MARKUP_FRAGMENTS), fc.string({ maxLength: 6 })), { maxLength: 4 }).map((p) => p.join('')) },
  { weight: 1, arbitrary: fc.string({ maxLength: 20 }) },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', maxLength: 10 }) },
  { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 10 }) },
);

/** 2–4 option labels, as options `o0`…`o3`. */
const optionsArb = fc
  .array(textArb, { minLength: 2, maxLength: 4 })
  .map((labels) => labels.map((label, i) => ({ id: `o${i}`, label })));

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${what}.`);
  return value;
}

/** Fails when the view created an element named by the generated markup. */
function expectNoMarkupElements(container: HTMLElement): void {
  for (const tag of MARKUP_TAGS) expect(container.querySelector(tag)).toBeNull();
}

/** The option label spans of the radio group, in display order. */
function labelTexts(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('label.dr-option > span')].map((span) => span.textContent);
}

function answerWith(container: HTMLElement, index: number): void {
  fireEvent.click(must(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index], `radio ${index}`));
  fireEvent.submit(must(container.querySelector('form'), 'form'));
}

// ---------------------------------------------------------------------------
// recall
// ---------------------------------------------------------------------------

interface RecallCase {
  readonly cfg: RecallConfig;
  readonly pick: number;
}

const recallCaseArb: fc.Arbitrary<RecallCase> = fc
  .record({ prompt: textArb, options: optionsArb, explanation: textArb, correct: fc.nat(), pick: fc.nat() })
  .map(({ prompt, options, explanation, correct, pick }): RecallCase => ({
    // `maxRetries: 0`, so one Try ends the question and shows the explanation (and the answer when wrong).
    cfg: { itemId: 'q1', prompt, options, correctOptionId: `o${correct % options.length}`, explanation, maxRetries: 0 },
    pick: pick % options.length,
  }));

function checkRecallView({ cfg, pick }: RecallCase): void {
  try {
    const { container } = render(<RecallNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} rejections={0} />);
    expect(container.querySelector('legend')?.textContent).toBe(cfg.prompt);
    expect(labelTexts(container)).toEqual(cfg.options.map((option) => option.label));
    expectNoMarkupElements(container);

    answerWith(container, pick);
    const feedback = must(container.querySelector('.pp-feedback'), 'feedback');
    expect(feedback.querySelector('.dr-body')?.textContent).toBe(cfg.explanation);
    if (`o${pick}` !== cfg.correctOptionId) {
      const correct = must(cfg.options.find((option) => option.id === cfg.correctOptionId), 'correct option');
      const answer = [...feedback.querySelectorAll('p')].find((p) => (p.textContent ?? '').startsWith('The answer is: '));
      expect(answer?.textContent).toBe(`The answer is: ${correct.label}`);
    }
    expectNoMarkupElements(container);
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// reviewQueue
// ---------------------------------------------------------------------------

interface ReviewCase {
  readonly cfg: ReviewQueueConfig;
  readonly queue: readonly ItemSnapshot[];
}

/** A Queue snapshot: a first-try miss with one wrong Try, as `recall.reduce` stores it. */
function snapshotArb(i: number): fc.Arbitrary<ItemSnapshot> {
  return fc.record({ prompt: textArb, options: optionsArb, explanation: textArb }).map(
    ({ prompt, options, explanation }): ItemSnapshot => ({
      itemId: `q${i}`,
      prompt,
      options,
      correctOptionId: 'o0',
      explanation,
      tries: ['o1'],
      firstTry: 'incorrect',
    }),
  );
}

const reviewCaseArb: fc.Arbitrary<ReviewCase> = fc
  .record({
    title: textArb,
    intro: fc.option(textArb, { nil: undefined }),
    emptyText: fc.option(textArb, { nil: undefined }),
    size: fc.integer({ min: 0, max: 3 }),
  })
  .chain(({ title, intro, emptyText, size }) =>
    fc.tuple(...Array.from({ length: size }, (_, i) => snapshotArb(i))).map(
      (queue): ReviewCase => ({
        cfg: {
          title,
          from: ['r0'],
          ...(intro === undefined ? {} : { intro }),
          ...(emptyText === undefined ? {} : { emptyText }),
        },
        queue,
      }),
    ),
  );

function checkReviewView({ cfg, queue }: ReviewCase): void {
  const nodeState: JsonValue = {
    items: queue.map((item) => ({ itemId: item.itemId, prompt: item.prompt, firstTry: item.firstTry })),
    queue: queue.map(snapshotJson),
  };
  try {
    const { container } = render(<ReviewQueueNodeView cfg={cfg} onRespond={() => {}} nodeState={nodeState} rejections={0} />);
    expect(container.querySelector('h2')?.textContent).toBe(cfg.title);
    expectNoMarkupElements(container);
    if (queue.length === 0) {
      expect(container.querySelector('.dr-body')?.textContent).toBe(cfg.emptyText ?? DEFAULT_EMPTY_TEXT);
      return;
    }
    const intro = container.querySelector('.dr-body');
    if (cfg.intro === undefined) expect(intro).toBeNull();
    else expect(intro?.textContent).toBe(cfg.intro);

    fireEvent.click(must([...container.querySelectorAll('button')].find((b) => b.textContent === 'Start'), 'Start'));
    queue.forEach((item, i) => {
      expect(container.querySelector('legend')?.textContent).toBe(item.prompt);
      expect(labelTexts(container)).toEqual(item.options.map((option) => option.label));
      expectNoMarkupElements(container);
      answerWith(container, 0);
      fireEvent.click(must([...container.querySelectorAll('button')].find((b) => b.textContent === 'Next'), `Next ${i}`));
    });
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// masterySummary
// ---------------------------------------------------------------------------

interface SummaryEntry {
  readonly prompt: string;
  readonly result: ItemResult;
  readonly topic: string | undefined;
}

interface SummaryCase {
  readonly cfg: MasterySummaryConfig;
  readonly entries: readonly SummaryEntry[] | null;
}

const summaryCaseArb: fc.Arbitrary<SummaryCase> = fc
  .record({
    title: textArb,
    body: textArb,
    entries: fc.option(
      fc.array(
        fc.record({
          prompt: textArb,
          result: fc.constantFrom<ItemResult>('firstTry', 'reviewed', 'missed'),
          topic: fc.option(textArb, { nil: undefined }),
        }),
        { maxLength: 4 },
      ),
      { nil: null },
    ),
  })
  .map(({ title, body, entries }): SummaryCase => ({
    cfg: { title, body, from: 'review' },
    entries: entries === null ? null : entries.map((e) => ({ prompt: e.prompt, result: e.result, topic: e.topic })),
  }));

/** A Mastery_Result as `masterySummary.enter` stores it (design C8), as plain JSON. */
function masteryJson(entries: readonly SummaryEntry[]): JsonValue {
  const items = entries.map((e, i): { [k: string]: JsonValue } => {
    const base = { itemId: `q${i}`, prompt: e.prompt, result: e.result };
    return e.topic === undefined ? base : { ...base, topic: e.topic };
  });
  const counts = { firstTry: 0, reviewed: 0, missed: 0 };
  const missedTopics: string[] = [];
  for (const e of entries) {
    counts[e.result] += 1;
    if (e.result === 'missed' && e.topic !== undefined && !missedTopics.includes(e.topic)) missedTopics.push(e.topic);
  }
  const nextReview = entries.flatMap((e, i) => (e.result === 'firstTry' ? [] : [`q${i}`]));
  return { items, counts, missedTopics, nextReview };
}

/** The `li` texts of the `section` whose `h3` reads `heading`, or `null` when there is none. */
function sectionItems(container: HTMLElement, heading: string): (string | null)[] | null {
  const section = [...container.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === heading);
  return section === undefined ? null : [...section.querySelectorAll('li')].map((li) => li.textContent);
}

function checkSummaryView({ cfg, entries }: SummaryCase): void {
  const nodeState = entries === null ? undefined : masteryJson(entries);
  try {
    const { container } = render(<MasterySummaryNodeView cfg={cfg} onRespond={() => {}} nodeState={nodeState} rejections={0} />);
    expect(container.querySelector('h2')?.textContent).toBe(cfg.title);
    expect(container.querySelector('.dr-body')?.textContent).toBe(cfg.body);
    if (entries !== null) {
      const section = [...container.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Your answers');
      const prompts = [...must(section, 'answers section').querySelectorAll('li > span:first-child')].map((s) => s.textContent);
      expect(prompts).toEqual(entries.map((e) => e.prompt));
      const topics: string[] = [];
      for (const e of entries) if (e.result === 'missed' && e.topic !== undefined && !topics.includes(e.topic)) topics.push(e.topic);
      expect(sectionItems(container, 'Topics to practise')).toEqual(topics.length === 0 ? null : topics);
      const next = entries.filter((e) => e.result !== 'firstTry').map((e) => e.prompt);
      expect(sectionItems(container, 'Review next time')).toEqual(next.length === 0 ? null : next);
    }
    expectNoMarkupElements(container);
  } finally {
    cleanup();
  }
}

describe('Feature: practice-path, Property 19: Practice views show manifest and stored strings as text', () => {
  // **Validates: Requirements 15.9, 16.7, 17.9, 17.10**
  it(
    'recall: prompt, option labels and explanation are text',
    () => {
      fc.assert(fc.property(recallCaseArb, checkRecallView), { numRuns: NUM_RUNS });
    },
    TIMEOUT_MS,
  );

  it(
    'reviewQueue: title, intro, emptyText and Queue snapshot prompts and labels are text',
    () => {
      fc.assert(fc.property(reviewCaseArb, checkReviewView), { numRuns: NUM_RUNS });
    },
    TIMEOUT_MS,
  );

  it(
    'masterySummary: title, body, item prompts and Topics are text',
    () => {
      fc.assert(fc.property(summaryCaseArb, checkSummaryView), { numRuns: NUM_RUNS });
    },
    TIMEOUT_MS,
  );

  it('shows <b>x</b> and <img src=x> literally in every field of the three views', () => {
    const b = '<b>x</b>';
    const img = '<img src=x>';
    const options = [
      { id: 'o0', label: b },
      { id: 'o1', label: img },
    ];
    checkRecallView({ cfg: { itemId: 'q1', prompt: b, options, correctOptionId: 'o0', explanation: img, maxRetries: 0 }, pick: 1 });
    const snapshot: ItemSnapshot = { itemId: 'q0', prompt: img, options, correctOptionId: 'o0', explanation: b, tries: ['o1'], firstTry: 'incorrect' };
    checkReviewView({ cfg: { title: b, from: ['r0'], intro: img }, queue: [snapshot] });
    checkReviewView({ cfg: { title: img, from: ['r0'], emptyText: b }, queue: [] });
    checkSummaryView({
      cfg: { title: img, body: `${b}\n${img}`, from: 'review' },
      entries: [
        { prompt: b, result: 'missed', topic: img },
        { prompt: img, result: 'firstTry', topic: b },
      ],
    });
  });
});
