// Progress_Model (design C10, D63; Requirements 12, 13.5, 13.6, 13.8, 13.9): pure functions over the
// device Progress_Store. No React, no clock, no randomness: the current time is a parameter
// (Requirement 12.7). Inputs are read through their own properties only; every returned store is a
// fresh plain object whose keys are sorted by code unit, with each Item_Record in the field order
// `seen`, `firstTryMisses`, `last`, `lastSeenAt`, so equal stores give equal Progress_File text.

import type { AttemptState } from '@dreame/runtime';
import type { Manifest } from '@dreame/schema';
import type { RecallConfig } from './node-types/recall.ts';
import { itemResult } from './node-types/practice-rules.ts';
import { readReviewQueueState, type ItemResult, type TryResult } from './node-types/practice-state.ts';

export type { ItemResult } from './node-types/practice-state.ts';

export const PROGRESS_KEY_NAME = 'dreame.practice-path.progress';
export const PROGRESS_VERSION = 1;
export const RECORD_CAP = 1_000;
export const PROGRESS_FILE_NAME = 'practice-path-progress.json';
export const PROGRESS_FILE_FORMAT = 'dreame-practice-progress';
/** Largest Progress_File text kept and accepted on import, in characters (equal to bytes: the text is ASCII, D63). */
export const PROGRESS_FILE_MAX = 65_536;
/** `<activityId>:<itemId>` with ACTIVITY_ID_PATTERN and NODE_ID_PATTERN parts. */
export const PROGRESS_KEY_PATTERN = '^[a-z0-9][a-z0-9-]{0,63}:[A-Za-z][A-Za-z0-9_-]{0,63}$';

export interface ItemRecord {
  readonly seen: number;
  readonly firstTryMisses: number;
  readonly last: ItemResult;
  readonly lastSeenAt: number;
}
export type ProgressStore = Readonly<Record<string, ItemRecord>>;
export interface AnsweredItem {
  readonly itemId: string;
  readonly firstTry: 'correct' | 'incorrect';
  readonly result: ItemResult;
}

const KEY_RE = new RegExp(PROGRESS_KEY_PATTERN);
const RECORD_KEYS: readonly string[] = ['seen', 'firstTryMisses', 'last', 'lastSeenAt'];
const FILE_KEYS: readonly string[] = ['format', 'version', 'items'];
const MAX_SEEN = 1_000_000_000;
const MAX_TIME = 8_640_000_000_000_000;

// ---------------------------------------------------------------------------
// Own-property helpers
// ---------------------------------------------------------------------------

/** True for a non-array object whose prototype is `Object.prototype` or `null`. */
function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * The own enumerable data property `key` of `obj` as `{ value }`, or `null` when it is missing,
 * inherited, non-enumerable or an accessor. Keys such as `__proto__` are plain data here.
 */
function ownData(obj: object, key: string): { readonly value: unknown } | null {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (desc === undefined || !desc.enumerable || !('value' in desc)) return null;
  return { value: desc.value as unknown };
}

/** True when the own keys of `obj` (symbols included) are exactly `keys`, each an own enumerable data property. */
function hasExactKeys(obj: object, keys: readonly string[]): boolean {
  const own = Reflect.ownKeys(obj);
  if (own.length !== keys.length) return false;
  return keys.every((key) => ownData(obj, key) !== null);
}

/** Item_Record check of design C10. */
function isItemRecord(value: unknown): value is ItemRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, RECORD_KEYS)) return false;
  const seen = ownData(value, 'seen')?.value;
  const misses = ownData(value, 'firstTryMisses')?.value;
  const last = ownData(value, 'last')?.value;
  const at = ownData(value, 'lastSeenAt')?.value;
  if (typeof seen !== 'number' || !Number.isInteger(seen) || seen < 1 || seen > MAX_SEEN) return false;
  if (typeof misses !== 'number' || !Number.isInteger(misses) || misses < 0 || misses > seen) return false;
  if (last !== 'firstTry' && last !== 'reviewed' && last !== 'missed') return false;
  return typeof at === 'number' && Number.isInteger(at) && at >= 0 && at <= MAX_TIME;
}

/** A fresh record in the fixed field order. */
function copyRecord(r: ItemRecord): ItemRecord {
  return { seen: r.seen, firstTryMisses: r.firstTryMisses, last: r.last, lastSeenAt: r.lastSeenAt };
}

/** The own enumerable records of `store` as a Map of fresh records; inherited keys are never read. */
function toMap(store: ProgressStore): Map<string, ItemRecord> {
  const map = new Map<string, ItemRecord>();
  for (const key of Object.keys(store)) {
    const entry = ownData(store, key);
    if (entry !== null) map.set(key, copyRecord(entry.value as ItemRecord));
  }
  return map;
}

/** A fresh plain object with the keys of `map` sorted by code unit; `defineProperty` keeps `__proto__` a plain key. */
function toStore(map: ReadonlyMap<string, ItemRecord>): ProgressStore {
  const out: Record<string, ItemRecord> = {};
  for (const key of [...map.keys()].sort()) {
    const record = map.get(key);
    if (record === undefined) continue;
    Object.defineProperty(out, key, { value: copyRecord(record), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trim (Requirement 12.6, D63)
// ---------------------------------------------------------------------------

/** Length of `buildProgressFile({})`. */
const EMPTY_FILE_LENGTH = JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: PROGRESS_VERSION, items: {} }).length;

/** Characters of `"<key>":<record>` inside the `items` object of the Progress_File. */
function entryLength(key: string, record: ItemRecord): number {
  return JSON.stringify(key).length + 1 + JSON.stringify(copyRecord(record)).length;
}

/** `buildProgressFile` length of the store in `map`: the empty file, every entry and the commas between them. */
function fileLength(map: ReadonlyMap<string, ItemRecord>): number {
  let total = EMPTY_FILE_LENGTH;
  for (const [key, record] of map) total += entryLength(key, record);
  return total + Math.max(0, map.size - 1);
}

/** The trim order: `lastSeenAt` ascending, then key ascending by code unit (a total order). */
function compareOrder(a: readonly [string, ItemRecord], b: readonly [string, ItemRecord]): number {
  if (a[1].lastSeenAt !== b[1].lastSeenAt) return a[1].lastSeenAt - b[1].lastSeenAt;
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/**
 * While the store holds more than RECORD_CAP records or its Progress_File text is longer than
 * PROGRESS_FILE_MAX, removes the record not in `keep` that comes first in the trim order. The file
 * length is kept up to date by subtraction, which gives the same value as
 * `buildProgressFile(store).length` after each removal. Mutates and returns `map`.
 */
function trim(map: Map<string, ItemRecord>, keep: ReadonlySet<string>): Map<string, ItemRecord> {
  let length = fileLength(map);
  const candidates = [...map].filter(([key]) => !keep.has(key)).sort(compareOrder);
  for (const [key, record] of candidates) {
    if (map.size <= RECORD_CAP && length <= PROGRESS_FILE_MAX) break;
    length -= entryLength(key, record) + (map.size > 1 ? 1 : 0);
    map.delete(key);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export function progressKey(activityId: string, itemId: string): string {
  return `${activityId}:${itemId}`;
}

/** Data check: closed records, keys match PROGRESS_KEY_PATTERN, at most RECORD_CAP records (Requirement 12.10). */
export function isProgressStore(value: unknown): value is ProgressStore {
  if (!isPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length > RECORD_CAP) return false;
  for (const key of keys) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) return false;
    const entry = ownData(value, key);
    if (entry === null || !isItemRecord(entry.value)) return false;
  }
  return true;
}

/** The `itemId` of a `recall` node config, or `null` when it is not an own string. */
function recallItemId(config: unknown): string | null {
  if (typeof config !== 'object' || config === null) return null;
  const itemId = ownData(config, 'itemId')?.value as RecallConfig['itemId'] | undefined;
  return typeof itemId === 'string' ? itemId : null;
}

/** Item IDs of the Recall nodes of a manifest, in manifest order. */
export function lessonItemIds(manifest: Manifest): string[] {
  const ids: string[] = [];
  for (const node of manifest.nodes) {
    if (node.type !== 'recall') continue;
    const itemId = recallItemId(node.config);
    if (itemId !== null) ids.push(itemId);
  }
  return ids;
}

/** Answered Recall Items of an attempt, in manifest order (Requirements 12.3, 12.4). */
export function answeredItems(manifest: Manifest, s: AttemptState): AnsweredItem[] {
  // Review_Results by Item_ID, from the first reviewQueue node in manifest order that has one.
  // A Map, not a plain object, so IDs such as `__proto__` or `constructor` are plain keys.
  const review = new Map<string, TryResult>();
  for (const node of manifest.nodes) {
    if (node.type !== 'reviewQueue' || !Object.hasOwn(s.nodeState, node.id)) continue;
    const state = readReviewQueueState(s.nodeState[node.id]);
    for (const entry of state?.results ?? []) {
      if (!review.has(entry.itemId)) review.set(entry.itemId, entry.result);
    }
  }
  const items: AnsweredItem[] = [];
  for (const node of manifest.nodes) {
    if (node.type !== 'recall' || !Object.hasOwn(s.answers, node.id)) continue;
    const firstTry = s.answers[node.id];
    if (firstTry !== 'correct' && firstTry !== 'incorrect') continue;
    const itemId = recallItemId(node.config);
    if (itemId === null) continue;
    items.push({ itemId, firstTry, result: itemResult(firstTry, review.get(itemId)) });
  }
  return items;
}

/** One Attempt_End applied to the store at time `now` (Requirements 12.3, 12.5, 12.6). */
export function updateProgress(
  store: ProgressStore,
  activityId: string,
  items: readonly AnsweredItem[],
  now: number,
): ProgressStore {
  const map = toMap(store);
  const keep = new Set<string>();
  for (const item of items) {
    const key = progressKey(activityId, item.itemId);
    const old = map.get(key);
    map.set(key, {
      seen: (old?.seen ?? 0) + 1,
      firstTryMisses: (old?.firstTryMisses ?? 0) + (item.firstTry === 'incorrect' ? 1 : 0),
      last: item.result,
      lastSeenAt: now,
    });
    keep.add(key);
  }
  return toStore(trim(map, keep));
}

/** `updateProgress(store, manifest.activityId, answeredItems(manifest, s), s.updatedAt)`. */
export function recordAttempt(store: ProgressStore, manifest: Manifest, s: AttemptState): ProgressStore {
  return updateProgress(store, manifest.activityId, answeredItems(manifest, s), s.updatedAt);
}

/** Due_For_Review count of the given Item IDs (Requirement 12.8). */
export function dueCount(store: ProgressStore, activityId: string, itemIds: readonly string[]): number {
  let count = 0;
  for (const itemId of itemIds) {
    const entry = ownData(store, progressKey(activityId, itemId));
    if (entry !== null && isDueForReview(entry.value as ItemRecord)) count += 1;
  }
  return count;
}

export function isDueForReview(record: ItemRecord): boolean {
  return record.last === 'reviewed' || record.last === 'missed';
}

/** Requirement 13.6: per key the record with the later lastSeenAt, the current one on equal times. */
export function mergeProgress(current: ProgressStore, incoming: ProgressStore): ProgressStore {
  const map = toMap(current);
  for (const [key, record] of toMap(incoming)) {
    const mine = map.get(key);
    if (mine === undefined || record.lastSeenAt > mine.lastSeenAt) map.set(key, record);
  }
  return toStore(trim(map, new Set()));
}

/** Compact JSON text of { format, version, items } (Requirement 13.1). */
export function buildProgressFile(store: ProgressStore): string {
  return JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: PROGRESS_VERSION, items: toStore(toMap(store)) });
}

/** The items of a Progress_File text, or null when the text is not JSON or fails the check (Requirement 13.5). */
export function parseProgressFile(text: string): ProgressStore | null {
  // Longer text is never a Progress_File this module writes; it is refused before JSON.parse.
  if (text.length > PROGRESS_FILE_MAX) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed) || !hasExactKeys(parsed, FILE_KEYS)) return null;
  if (ownData(parsed, 'format')?.value !== PROGRESS_FILE_FORMAT) return null;
  if (ownData(parsed, 'version')?.value !== PROGRESS_VERSION) return null;
  const items = ownData(parsed, 'items')?.value;
  if (!isProgressStore(items)) return null;
  return toStore(toMap(items));
}
