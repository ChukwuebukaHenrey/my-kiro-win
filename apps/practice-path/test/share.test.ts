// Example tests for the Tutor_Share_Link builder (design C8 "Tutor_Share_Link", D59, D60;
// Requirements 9.13, 9.15): the four-line Share_Text, "Topics to review: none", Missed_Topics
// dropped from the end at the 500 code-unit limit, lone surrogates replaced with U+FFFD, and the
// link prefix. These tests are evidence for the cases listed, not a proof of correctness.

import { describe, expect, it } from 'vitest';
import { SHARE_LINK_MAX, SHARE_TEXT_MAX, shareText, tutorShareLink, wellFormed } from '../src/share.ts';
import type { ItemResult, MasteryItem, MasteryResult } from '../src/node-types/practice-state.ts';

const URL_BASE = 'https://wa.me/12125550100';

/** A Mastery_Result built from Item_Results and optional Topics, with counts and lists derived as in C8. */
function resultOf(entries: readonly { result: ItemResult; topic?: string }[]): MasteryResult {
  const items: MasteryItem[] = entries.map((e, i) =>
    e.topic === undefined
      ? { itemId: `q${i + 1}`, prompt: `Prompt ${i + 1}`, result: e.result }
      : { itemId: `q${i + 1}`, topic: e.topic, prompt: `Prompt ${i + 1}`, result: e.result },
  );
  const counts = { firstTry: 0, reviewed: 0, missed: 0 };
  const missedTopics: string[] = [];
  for (const item of items) {
    counts[item.result] += 1;
    if (item.result === 'missed' && item.topic !== undefined && !missedTopics.includes(item.topic)) {
      missedTopics.push(item.topic);
    }
  }
  const nextReview = items.filter((item) => item.result !== 'firstTry').map((item) => item.itemId);
  return { items, counts, missedTopics, nextReview };
}

/** The decoded `text` parameter of a link that starts with `${URL_BASE}?text=`. */
function decodedText(link: string): string {
  const prefix = `${URL_BASE}?text=`;
  expect(link.startsWith(prefix)).toBe(true);
  return decodeURIComponent(link.slice(prefix.length));
}

describe('shareText', () => {
  it('has four lines: title, First_Try count, after-review count and Missed_Topics', () => {
    const result = resultOf([
      { result: 'firstTry', topic: 'Fractions' },
      { result: 'firstTry' },
      { result: 'reviewed', topic: 'Percentages' },
      { result: 'missed', topic: 'Decimals' },
      { result: 'missed', topic: 'Ratios' },
    ]);
    expect(shareText('Fractions and percentages', result, result.missedTopics.length)).toBe(
      'Fractions and percentages\nFirst try: 2 of 5\nAfter review: 3 of 5\nTopics to review: Decimals, Ratios',
    );
  });

  it('says "Topics to review: none" when there are no Missed_Topics', () => {
    const result = resultOf([{ result: 'firstTry', topic: 'Fractions' }, { result: 'reviewed' }]);
    const text = shareText('Quiz', result, result.missedTopics.length);
    expect(text).toBe('Quiz\nFirst try: 1 of 2\nAfter review: 2 of 2\nTopics to review: none');
    expect(decodedText(tutorShareLink(URL_BASE, 'Quiz', result))).toBe(text);
  });

  it('says "of 0" and "none" for an empty Mastery_Result', () => {
    expect(shareText('Quiz', resultOf([]), 0)).toBe('Quiz\nFirst try: 0 of 0\nAfter review: 0 of 0\nTopics to review: none');
  });
});

describe('tutorShareLink', () => {
  it('starts with the tutorShare URL followed by ?text= and decodes to the Share_Text', () => {
    const result = resultOf([{ result: 'missed', topic: 'Fractions & ratios?' }, { result: 'firstTry' }]);
    const link = tutorShareLink(URL_BASE, 'Quiz #1 + more', result);
    expect(link.startsWith(`${URL_BASE}?text=`)).toBe(true);
    expect(new URL(link).host).toBe('wa.me');
    expect(decodedText(link)).toBe(shareText('Quiz #1 + more', result, 1));
    // The text parameter is one parameter: `&`, `#`, `+` and `?` are percent-encoded.
    expect(new URL(link).searchParams.get('text')).toBe(shareText('Quiz #1 + more', result, 1));
  });

  it('drops Missed_Topics from the end until the Share_Text is at most 500 code units', () => {
    // 24 missed Items, each with a distinct 60-code-unit Topic.
    const topics = Array.from({ length: 24 }, (_, i) => `Topic ${String(i + 1).padStart(2, '0')} ${'x'.repeat(51)}`);
    expect(topics.every((t) => t.length === 60)).toBe(true);
    const result = resultOf(topics.map((topic) => ({ result: 'missed' as const, topic })));
    const link = tutorShareLink(URL_BASE, 'Quiz', result);
    const text = decodedText(link);
    // Fixed part is 62 code units plus 62 per Topic (60 + ", "), so 7 Topics give 496 and 8 give 558.
    expect(text).toBe(shareText('Quiz', result, 7));
    expect(text.length).toBe(496);
    expect(text.length).toBeLessThanOrEqual(SHARE_TEXT_MAX);
    expect(shareText('Quiz', result, 8).length).toBeGreaterThan(SHARE_TEXT_MAX);
    expect(text.endsWith(topics[6] ?? '')).toBe(true);
    expect(text.includes('Topic 08')).toBe(false);
    expect(link.length).toBeLessThanOrEqual(SHARE_LINK_MAX);
  });

  it('replaces a lone surrogate in the title with U+FFFD, so encodeURIComponent does not throw', () => {
    expect(() => encodeURIComponent('Quiz \uD83D')).toThrow(URIError);
    const result = resultOf([{ result: 'missed', topic: 'Topic \uDC00 end' }]);
    let link = '';
    expect(() => {
      link = tutorShareLink(URL_BASE, 'Quiz \uD83D', result);
    }).not.toThrow();
    expect(decodedText(link)).toBe('Quiz \uFFFD\nFirst try: 0 of 1\nAfter review: 0 of 1\nTopics to review: Topic \uFFFD end');
  });
});

describe('wellFormed', () => {
  it('replaces lone high and low surrogates and keeps surrogate pairs', () => {
    expect(wellFormed('a\uD800b')).toBe('a\uFFFDb');
    expect(wellFormed('a\uDC00b')).toBe('a\uFFFDb');
    expect(wellFormed('\uD800\uD83D\uDE00\uDC00')).toBe('\uFFFD\uD83D\uDE00\uFFFD');
    expect(wellFormed('Fractions 😀 é')).toBe('Fractions 😀 é');
    expect(wellFormed('')).toBe('');
  });
});
