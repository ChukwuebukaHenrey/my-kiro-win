// Tutor_Share_Link builder (design C8 "Tutor_Share_Link", D59, D60; Requirements 9.13-9.15).
// React-free and pure: no clock, no randomness, no storage. The Share_Text holds only the lesson
// title (the Mastery_Summary `title`, D59), the First_Try count, the after-review count, the Item
// count and the Missed_Topics (Requirement 9.15).

import type { MasteryResult } from './node-types/practice-state.ts';

/** Most UTF-16 code units in the Share_Text (Requirement 9.13). */
export const SHARE_TEXT_MAX = 500;
/** Most code units in the Tutor_Share_Link (Requirement 9.14). */
export const SHARE_LINK_MAX = 2048;

// A high surrogate not followed by a low one, or a low surrogate not preceded by a high one.
// No `u` flag, so the pattern matches single UTF-16 code units.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Lone UTF-16 surrogates replaced with U+FFFD, so encodeURIComponent never throws. */
export function wellFormed(text: string): string {
  // Hand-written: `String.prototype.toWellFormed` is ES2024 and the workspace lib is ES2023.
  return text.replace(LONE_SURROGATE, '\uFFFD');
}

/** The Share_Text with the first `topicCount` Missed_Topics. */
export function shareText(title: string, result: MasteryResult, topicCount: number): string {
  const n = result.items.length;
  const { firstTry, reviewed } = result.counts;
  const topics = result.missedTopics.slice(0, Math.max(0, topicCount)).map(wellFormed);
  return [
    wellFormed(title),
    `First try: ${firstTry} of ${n}`,
    `After review: ${firstTry + reviewed} of ${n}`,
    `Topics to review: ${topics.length === 0 ? 'none' : topics.join(', ')}`,
  ].join('\n');
}

function linkFor(baseUrl: string, text: string): string {
  return `${baseUrl}?text=${encodeURIComponent(text)}`;
}

/**
 * `${baseUrl}?text=${encodeURIComponent(text)}`, dropping Missed_Topics from the end until the
 * text is at most 500 code units and the link at most 2,048. With the schema limits (title at most
 * 120 code units, `baseUrl` at most 29) the text with no topics always fits, so the result with
 * no topics is returned when no larger count fits.
 */
export function tutorShareLink(baseUrl: string, title: string, result: MasteryResult): string {
  for (let k = result.missedTopics.length; k > 0; k -= 1) {
    const text = shareText(title, result, k);
    if (text.length > SHARE_TEXT_MAX) continue;
    const link = linkFor(baseUrl, text);
    if (link.length <= SHARE_LINK_MAX) return link;
  }
  return linkFor(baseUrl, shareText(title, result, 0));
}
