// Property test for the Tutor_Share_Link builder (design C8 "Tutor_Share_Link", D59, D60,
// "Correctness Properties" → Property 7). The expected Missed_Topic count `k` and the expected
// Share_Text are computed here by a separate model, not by calling `tutorShareLink` again.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkHttpsUrl } from '@dreame/schema';
import { SHARE_LINK_MAX, SHARE_TEXT_MAX, shareText, tutorShareLink } from '../src/share.ts';
import type { MasteryResult } from '../src/node-types/practice-state.ts';
import { masteryResultArb, titleArb, waMeUrlArb } from './practice-arbitraries.ts';

const NUM_RUNS = 300;

/** Model of `wellFormed`: walks the UTF-16 code units and replaces each unpaired surrogate with U+FFFD. */
function wellFormedModel(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    const next = i + 1 < text.length ? text.charCodeAt(i + 1) : -1;
    if (unit >= 0xd800 && unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      out += text[i]! + text[i + 1]!;
      i += 1;
    } else if (unit >= 0xd800 && unit <= 0xdfff) {
      out += '\uFFFD';
    } else {
      out += text[i]!;
    }
  }
  return out;
}

/** Model of the Share_Text: the well-formed title, the three counts and the first `k` Missed_Topics, four lines. */
function shareTextModel(title: string, result: MasteryResult, k: number): string {
  const n = result.items.length;
  const topics = result.missedTopics.slice(0, k).map(wellFormedModel);
  return [
    wellFormedModel(title),
    `First try: ${result.counts.firstTry} of ${n}`,
    `After review: ${result.counts.firstTry + result.counts.reviewed} of ${n}`,
    `Topics to review: ${topics.length === 0 ? 'none' : topics.join(', ')}`,
  ].join('\n');
}

/** The largest `k` in 0..missedTopics.length whose Share_Text and link both fit, or 0 when none fits. */
function expectedTopicCount(baseUrl: string, title: string, result: MasteryResult): number {
  let best = 0;
  for (let k = 0; k <= result.missedTopics.length; k += 1) {
    const text = shareText(title, result, k);
    const linkLength = baseUrl.length + '?text='.length + encodeURIComponent(text).length;
    if (text.length <= SHARE_TEXT_MAX && linkLength <= SHARE_LINK_MAX) best = k;
  }
  return best;
}

describe('Feature: practice-path, Property 7: The Tutor_Share_Link is safe and short and round-trips its text', () => {
  // **Validates: Requirements 9.13, 9.14, 9.15**
  it('gives a safe wa.me link of at most 2,048 code units whose text is the Share_Text with the most Missed_Topics that fit', () => {
    let cutByText = 0;
    let cutByLink = 0;
    fc.assert(
      fc.property(waMeUrlArb, titleArb, masteryResultArb, (baseUrl, title, result) => {
        const link = tutorShareLink(baseUrl, title, result);

        // Safe and short (Requirement 9.14).
        expect(checkHttpsUrl(link, '/tutorShare/url')).toEqual([]);
        const parsed = new URL(link);
        expect(parsed.host).toBe('wa.me');
        expect(link.length).toBeLessThanOrEqual(SHARE_LINK_MAX);

        // One `text` parameter after the tutorShare URL; it decodes to the Share_Text (Requirement 9.13).
        const prefix = `${baseUrl}?text=`;
        expect(link.startsWith(prefix)).toBe(true);
        const text = decodeURIComponent(link.slice(prefix.length));
        expect([...parsed.searchParams.keys()]).toEqual(['text']);
        expect(parsed.searchParams.get('text')).toBe(text);
        expect(text.length).toBeLessThanOrEqual(SHARE_TEXT_MAX);

        const k = expectedTopicCount(baseUrl, title, result);
        expect(text).toBe(shareText(title, result, k));
        // The text holds only the well-formed title, the counts and the first k Missed_Topics (Requirement 9.15).
        expect(text).toBe(shareTextModel(title, result, k));

        if (k < result.missedTopics.length) {
          const next = shareText(title, result, k + 1);
          if (next.length > SHARE_TEXT_MAX) cutByText += 1;
          else cutByLink += 1;
        }
      }),
      { numRuns: NUM_RUNS },
    );
    // The generators reached both limits in this run.
    expect(cutByText).toBeGreaterThan(0);
    expect(cutByLink).toBeGreaterThan(0);
  });
});
