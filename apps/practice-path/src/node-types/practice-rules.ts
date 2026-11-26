/**
 * Pure rules shared by the Practice Path node types, views, Progress_Model and
 * tests (design C5): the Try_Rules, the First_Try_Result, the Item_Result rule,
 * the Queue and the Review_Results. No React, no clock, no randomness.
 */
import type { ItemResult, ItemSnapshot, ItemSummary, ReviewResult, TryResult } from './practice-state.ts';

/** The fields of a Recall config that the Try_Rules read. */
export interface TryRulesConfig {
  readonly options: readonly { readonly id: string }[];
  readonly correctOptionId: string;
  readonly maxRetries: number;
}

/** Try_Rules of the Glossary: options named, no repeats, at most maxRetries + 1, wrong before the last, last correct or out of Tries. */
export function meetsTryRules(cfg: TryRulesConfig, tries: readonly string[]): boolean {
  const allowed = cfg.maxRetries + 1;
  if (tries.length < 1 || tries.length > allowed) return false;
  const optionIds = new Set(cfg.options.map((option) => option.id));
  const seen = new Set<string>();
  const lastIndex = tries.length - 1;
  for (const [index, tryId] of tries.entries()) {
    if (!optionIds.has(tryId) || seen.has(tryId)) return false;
    seen.add(tryId);
    const correct = tryId === cfg.correctOptionId;
    if (index < lastIndex && correct) return false;
    if (index === lastIndex && !correct && tries.length !== allowed) return false;
  }
  return true;
}

/** `correct` when the first Try is the correct option, else `incorrect`. */
export function firstTryResult(correctOptionId: string, tries: readonly string[]): TryResult {
  return tries.length > 0 && tries[0] === correctOptionId ? 'correct' : 'incorrect';
}

/** Tries left after `tries` under the Retry_Limit: `maxRetries + 1 - tries.length`, at least 0. */
export function triesLeft(maxRetries: number, tries: readonly string[]): number {
  return Math.max(0, maxRetries + 1 - tries.length);
}

/** Item_Result rule: firstTry when the First_Try_Result is correct; reviewed when it is incorrect and the Review_Result is correct; missed otherwise (no Review_Result counts as missed). */
export function itemResult(firstTry: TryResult, review: TryResult | undefined): ItemResult {
  if (firstTry === 'correct') return 'firstTry';
  return review === 'correct' ? 'reviewed' : 'missed';
}

/** The Queue: the snapshots whose `firstTry` is `incorrect`, in the given order, each Item_ID once. */
export function buildQueue(snapshots: readonly ItemSnapshot[]): ItemSnapshot[] {
  const seen = new Set<string>();
  const queue: ItemSnapshot[] = [];
  for (const snapshot of snapshots) {
    if (snapshot.firstTry !== 'incorrect' || seen.has(snapshot.itemId)) continue;
    seen.add(snapshot.itemId);
    queue.push(snapshot);
  }
  return queue;
}

/** One Review_Result per Queue Item, in Queue order; answers whose itemId names no Queue Item are ignored. */
export function reviewResults(
  queue: readonly ItemSnapshot[],
  answers: readonly { readonly itemId: string; readonly optionId: string }[],
): ReviewResult[] {
  // A Map, not a plain object, so IDs such as `__proto__` or `toString` are plain keys.
  const firstAnswer = new Map<string, string>();
  for (const answer of answers) {
    if (!firstAnswer.has(answer.itemId)) firstAnswer.set(answer.itemId, answer.optionId);
  }
  return queue.map((item) => ({
    itemId: item.itemId,
    result: firstAnswer.get(item.itemId) === item.correctOptionId ? 'correct' : 'incorrect',
  }));
}

/** Item summaries in order, used by reviewQueue.enter (Requirement 8.2). */
export function summarize(snapshot: ItemSnapshot): ItemSummary {
  const { itemId, topic, prompt, firstTry } = snapshot;
  return topic === undefined ? { itemId, prompt, firstTry } : { itemId, topic, prompt, firstTry };
}
