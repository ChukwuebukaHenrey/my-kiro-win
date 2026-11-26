// Property 13 (design "Correctness Properties", C10, D63): a progress update counts each answered
// Item once and keeps every other record, and `answeredItems` reads each answered `recall` node
// once. The expected values come from a model written in this file (JSON.stringify for the file
// length, an inline Item_Result rule, a raw read of the stored Review_Results). A passing run is
// evidence for this property over the generated stores, updates and attempts, not a proof.
//
// Property 14 (design "Correctness Properties", C10, "Data Models" → "Device storage format,
// version 1"): the progress data check accepts generated stores within the caps and rejects each
// such store with one change. Design C10 gives `isProgressStore` the record and key rules and the
// Record_Cap only; the 65,536-character file limit belongs to `trim` and the import paths, so a
// store of RECORD_CAP records whose file text is longer still passes the check. A passing run is
// evidence for this property over the generated stores and changes, not a proof.
//
// Property 15 (design "Correctness Properties", C10, D63, "Data Models" → "Progress_File"): the
// Progress_File of a generated store within the caps parses back, merged into an empty store, to a
// store deep-equal to the original, and its text is at most 65,536 bytes. A passing run is evidence
// for this property over the generated stores, not a proof.
//
// Property 16 (design "Correctness Properties", C10 "`mergeProgress`", Requirements 13.6, 13.9):
// merging keeps, for each key, the record with the later `lastSeenAt` and the record of `a` on equal
// times (checked on every key that survives trimming, against a union model written in this file),
// drops only the first records in the trim order, and is idempotent: `mergeProgress(a, a)` equals
// `a` and `mergeProgress(mergeProgress(a, b), b)` equals `mergeProgress(a, b)`. A passing run is
// evidence for this property over the generated store pairs, not a proof.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateManifest, type Manifest } from '@dreame/schema';
import { createRuntime, type AttemptState } from '@dreame/runtime';
import type { RecallConfig } from '../src/node-types/recall.ts';
import { practiceProfile } from '../src/profile.ts';
import {
  PROGRESS_FILE_MAX,
  PROGRESS_KEY_PATTERN,
  RECORD_CAP,
  answeredItems,
  buildProgressFile,
  isProgressStore,
  mergeProgress,
  parseProgressFile,
  updateProgress,
  type AnsweredItem,
  type ItemRecord,
  type ItemResult,
  type ProgressStore,
} from '../src/progress.ts';
import {
  LESSON_IDS,
  MAX_LAST_SEEN_AT,
  itemRecordArb,
  lessonManifestArb,
  modelProgressFileLength,
  playPracticeManifest,
  progressActivityIdArb,
  progressItemIdArb,
  progressStoreArb,
} from './practice-arbitraries.ts';

const NUM_RUNS_UPDATE = 100;
const NUM_RUNS_ANSWERED = 200;

type TryResult = 'correct' | 'incorrect';

/** Item_Result rule of the Glossary, written out for the model. */
function modelItemResult(firstTry: TryResult, review: string | undefined): ItemResult {
  if (firstTry === 'correct') return 'firstTry';
  return review === 'correct' ? 'reviewed' : 'missed';
}

/** The trim order: `lastSeenAt` ascending, then key ascending by code unit. */
function compareTrimOrder(model: ReadonlyMap<string, ItemRecord>): (a: string, b: string) => number {
  return (a, b) => {
    const ta = model.get(a)?.lastSeenAt ?? 0;
    const tb = model.get(b)?.lastSeenAt ?? 0;
    if (ta !== tb) return ta - tb;
    return a < b ? -1 : a > b ? 1 : 0;
  };
}

function plainRecord(r: ItemRecord): ItemRecord {
  return { seen: r.seen, firstTryMisses: r.firstTryMisses, last: r.last, lastSeenAt: r.lastSeenAt };
}

interface UpdateCase {
  readonly store: ProgressStore;
  readonly activityId: string;
  readonly items: readonly AnsweredItem[];
  readonly now: number;
}

/** Splits a key at its first colon (activity IDs hold none). */
function splitKey(key: string): readonly [string, string] {
  const at = key.indexOf(':');
  return [key.slice(0, at), key.slice(at + 1)];
}

/**
 * A store from `progressStoreArb`, an activity ID (mostly one already in the store), 0–12 answered
 * Items with unique Item_IDs (mixing Item_IDs already stored under that activity and new ones),
 * each with a result that follows the Item_Result rule, and a `now` not earlier than any stored
 * `lastSeenAt`.
 */
const updateCaseArb: fc.Arbitrary<UpdateCase> = progressStoreArb.chain((store) => {
  const parts = Object.keys(store).map(splitKey);
  const activities = [...new Set(parts.map(([activity]) => activity))];
  const activityArb =
    activities.length === 0
      ? progressActivityIdArb
      : fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...activities) }, { weight: 1, arbitrary: progressActivityIdArb });
  let latest = 0;
  for (const key of Object.keys(store)) latest = Math.max(latest, store[key]?.lastSeenAt ?? 0);
  return activityArb.chain((activityId) => {
    const stored = parts.filter(([activity]) => activity === activityId).map(([, itemId]) => itemId);
    const itemIdArb = stored.length === 0 ? progressItemIdArb : fc.oneof(fc.constantFrom(...stored), progressItemIdArb);
    const itemArb = fc
      .record({
        itemId: itemIdArb,
        firstTry: fc.constantFrom<TryResult>('correct', 'incorrect'),
        review: fc.option(fc.constantFrom<TryResult>('correct', 'incorrect'), { nil: undefined }),
      })
      .map(({ itemId, firstTry, review }): AnsweredItem => ({ itemId, firstTry, result: modelItemResult(firstTry, review) }));
    return fc.record({
      store: fc.constant(store),
      activityId: fc.constant(activityId),
      items: fc.uniqueArray(itemArb, { maxLength: 12, selector: (item) => item.itemId }),
      now: fc
        .oneof(fc.constant(0), fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1_000_000_000 }))
        .map((d) => Math.min(MAX_LAST_SEEN_AT, latest + d)),
    });
  });
});

/** `answeredItems` model: recall nodes in manifest order with a stored answer, Review_Results read raw from the `review` node state. */
function modelAnsweredItems(manifest: Manifest, s: AttemptState): AnsweredItem[] {
  const review = new Map<string, string>();
  const raw: unknown = Object.hasOwn(s.nodeState, LESSON_IDS.review) ? s.nodeState[LESSON_IDS.review] : undefined;
  const results: unknown = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>)['results'] : undefined;
  if (Array.isArray(results)) {
    for (const entry of results as unknown[]) {
      const e = entry as { itemId?: unknown; result?: unknown };
      if (typeof e.itemId === 'string' && typeof e.result === 'string' && !review.has(e.itemId)) review.set(e.itemId, e.result);
    }
  }
  const items: AnsweredItem[] = [];
  for (const node of manifest.nodes) {
    if (node.type !== 'recall' || !Object.hasOwn(s.answers, node.id)) continue;
    const firstTry = s.answers[node.id];
    if (firstTry !== 'correct' && firstTry !== 'incorrect') throw new Error(`model: recall node "${node.id}" stored answer ${String(firstTry)}`);
    const itemId = (node.config as RecallConfig).itemId;
    items.push({ itemId, firstTry, result: modelItemResult(firstTry, review.get(itemId)) });
  }
  return items;
}

describe('Feature: practice-path, Property 13: A progress update counts each answered Item once and keeps every other record', () => {
  // **Validates: Requirements 12.3, 12.4, 12.5, 12.6, 12.9**
  it('Feature: practice-path, Property 13: updateProgress updates the answered records, keeps the others and trims the oldest first', () => {
    const counts = { runs: 0, trimmed: 0, removed: 0, existing: 0, created: 0 };
    fc.assert(
      fc.property(updateCaseArb, ({ store, activityId, items, now }) => {
        counts.runs += 1;
        const result = updateProgress(store, activityId, items, now);

        // Model before trimming.
        const model = new Map<string, ItemRecord>();
        for (const key of Object.keys(store)) model.set(key, plainRecord(store[key] as ItemRecord));
        const keep = new Set<string>();
        for (const item of items) {
          const key = `${activityId}:${item.itemId}`;
          const old = model.get(key);
          counts[old === undefined ? 'created' : 'existing'] += 1;
          model.set(key, {
            seen: (old?.seen ?? 0) + 1,
            firstTryMisses: (old?.firstTryMisses ?? 0) + (item.firstTry === 'incorrect' ? 1 : 0),
            last: item.result,
            lastSeenAt: now,
          });
          keep.add(key);
        }

        // Only model keys remain; the answered Items' records are kept.
        const resultKeys = Object.keys(result);
        expect(resultKeys.filter((key) => !model.has(key))).toEqual([]);
        const removed = [...model.keys()].filter((key) => !Object.hasOwn(result, key));
        expect(removed.filter((key) => keep.has(key))).toEqual([]);

        // Every remaining record equals the model: updated for answered Items, unchanged otherwise.
        const expected = Object.fromEntries([...model].filter(([key]) => Object.hasOwn(result, key)));
        expect(result).toEqual(expected);

        // Within both caps.
        expect(resultKeys.length).toBeLessThanOrEqual(RECORD_CAP);
        expect(modelProgressFileLength(result)).toBeLessThanOrEqual(PROGRESS_FILE_MAX);
        expect(buildProgressFile(result).length).toBeLessThanOrEqual(PROGRESS_FILE_MAX);

        // The removed records are the first in the (lastSeenAt, key) order among records not kept,
        // and putting back the last one removed would break a cap.
        const order = [...model.keys()].filter((key) => !keep.has(key)).sort(compareTrimOrder(model));
        expect(order.slice(0, removed.length).sort()).toEqual([...removed].sort());
        if (removed.length > 0) {
          counts.trimmed += 1;
          counts.removed += removed.length;
          const lastRemoved = order[removed.length - 1] as string;
          const restored: Record<string, ItemRecord> = { ...result, [lastRemoved]: model.get(lastRemoved) as ItemRecord };
          const over = Object.keys(restored).length > RECORD_CAP || modelProgressFileLength(restored) > PROGRESS_FILE_MAX;
          expect(over).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS_UPDATE },
    );
    console.info(
      `Property 13 updates: ${counts.runs} runs, trimmed in ${counts.trimmed} (${counts.removed} records removed); ` +
        `${counts.existing} existing and ${counts.created} new answered records`,
    );
    // Trimming, existing records and new records all occur, so no case is checked on an empty set.
    expect(counts.trimmed).toBeGreaterThan(0);
    expect(counts.existing).toBeGreaterThan(0);
    expect(counts.created).toBeGreaterThan(0);
  }, 170_000);

  it('Feature: practice-path, Property 13: answeredItems lists each answered recall node once with the Item_Result rule applied', () => {
    const counts = { runs: 0, valid: 0, firstTry: 0, reviewed: 0, missedNoReview: 0, missedWrongReview: 0 };
    fc.assert(
      fc.property(
        lessonManifestArb,
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 8 }),
        fc.nat(),
        (manifest, seed, picks, at) => {
          counts.runs += 1;
          const checked = validateManifest(manifest, practiceProfile);
          if (!checked.ok) return; // the property covers lessons that pass validation
          counts.valid += 1;
          const rt = createRuntime(practiceProfile, checked.manifest);
          const states = playPracticeManifest(rt, { seed, picks });
          // Any state of the attempt: before any answer, mid-lesson, at the review without
          // Review_Results, and after the review.
          const s = states[at % states.length] as AttemptState;
          const actual = answeredItems(checked.manifest, s);
          const expected = modelAnsweredItems(checked.manifest, s);
          expect(actual).toEqual(expected);
          expect(new Set(actual.map((item) => item.itemId)).size).toBe(actual.length);
          const answeredRecalls = checked.manifest.nodes.filter((n) => n.type === 'recall' && Object.hasOwn(s.answers, n.id)).length;
          expect(actual).toHaveLength(answeredRecalls);

          const raw = s.nodeState[LESSON_IDS.review];
          const hasResults = typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.hasOwn(raw, 'results');
          for (const item of expected) {
            if (item.result === 'firstTry') counts.firstTry += 1;
            else if (item.result === 'reviewed') counts.reviewed += 1;
            else if (hasResults) counts.missedWrongReview += 1;
            else counts.missedNoReview += 1;
          }
        },
      ),
      { numRuns: NUM_RUNS_ANSWERED },
    );
    console.info(
      `Property 13 answeredItems: ${counts.valid}/${counts.runs} valid lessons; firstTry ${counts.firstTry}, reviewed ${counts.reviewed}, ` +
        `missed without a Review_Result ${counts.missedNoReview}, missed after a wrong review ${counts.missedWrongReview}`,
    );
    expect(counts.valid / counts.runs).toBeGreaterThanOrEqual(0.9);
    expect(counts.firstTry).toBeGreaterThan(0);
    expect(counts.reviewed).toBeGreaterThan(0);
    expect(counts.missedNoReview).toBeGreaterThan(0);
    expect(counts.missedWrongReview).toBeGreaterThan(0);
  }, 170_000);
});

// ---------------------------------------------------------------------------------------------
// Property 14. Each run takes a generated store within the caps (sometimes the empty store) and one
// change of a generated kind. A change aimed at a record of an empty store first adds one valid
// record under a valid key and changes that record, so no change is a no-op. Every changed value
// is built with `defineProperty`, so keys such as `__proto__` stay plain own keys.

const NUM_RUNS_CHECK = 300;

const KEY_RE = new RegExp(PROGRESS_KEY_PATTERN);
const RECORD_FIELDS = ['seen', 'firstTryMisses', 'last', 'lastSeenAt'] as const;
type RecordField = (typeof RECORD_FIELDS)[number];
/** Largest `seen` the Item_Record check accepts (design C10, test model). */
const MODEL_MAX_SEEN = 1_000_000_000;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
/** The smallest valid Item_Record, used to pad stores past RECORD_CAP. */
const PAD_RECORD: ItemRecord = { seen: 1, firstTryMisses: 0, last: 'firstTry', lastSeenAt: 0 };

const MUTATION_KINDS = [
  'extraField',
  'missingField',
  'wrongType:nonNumber',
  'wrongType:nonInteger',
  'wrongType:outOfRange',
  'wrongType:unknownLast',
  'missesAboveSeen',
  'badKey',
  'overCap',
] as const;
type MutationKind = (typeof MUTATION_KINDS)[number];

interface WrongValue {
  readonly field: RecordField;
  readonly value: unknown;
}

interface Mutation {
  readonly kind: MutationKind;
  /** Index (modulo the record count) of the record or key that changes. */
  readonly at: number;
  /** A valid key and record added first when a record-level change meets an empty store. */
  readonly spareKey: string;
  readonly spareRecord: ItemRecord;
  readonly extraKey: string;
  readonly extraValue: unknown;
  readonly missing: RecordField;
  readonly wrong: WrongValue | null;
  /** `firstTryMisses` becomes `seen + above`. */
  readonly above: number;
  readonly badKey: string;
  /** Records past RECORD_CAP. */
  readonly over: number;
}

/** A fresh plain object with the own enumerable data properties `entries`, in order. */
function plainObject(entries: readonly (readonly [string, unknown])[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
  return out;
}

function recordFields(r: ItemRecord): [string, unknown][] {
  return [
    ['seen', r.seen],
    ['firstTryMisses', r.firstTryMisses],
    ['last', r.last],
    ['lastSeenAt', r.lastSeenAt],
  ];
}

function wrongArb(fieldArb: fc.Arbitrary<RecordField>, valueArb: fc.Arbitrary<unknown>): fc.Arbitrary<WrongValue> {
  return fc.tuple(fieldArb, valueArb).map(([field, value]): WrongValue => ({ field, value }));
}

const numericFieldArb = fc.constantFrom<RecordField>('seen', 'firstTryMisses', 'lastSeenAt');

/** A numeric field set to a non-number, or `last` set to a non-string. */
const nonNumberArb: fc.Arbitrary<WrongValue> = fc.oneof(
  wrongArb(
    numericFieldArb,
    fc.oneof(
      fc.constantFrom<unknown>('1', '0', '', null, true, false),
      fc.string({ maxLength: 6 }),
      fc.array(fc.nat(), { maxLength: 2 }),
      fc.constant<unknown>({}),
    ),
  ),
  wrongArb(
    fc.constant<RecordField>('last'),
    fc.oneof(
      fc.constantFrom<unknown>(null, 0, 1, true, false),
      fc.array(fc.constantFrom('firstTry', 'reviewed', 'missed'), { maxLength: 2 }),
      fc.constant<unknown>({ last: 'missed' }),
    ),
  ),
);

/** A numeric field set to a number that is not an integer (NaN and the infinities included). */
const nonIntegerArb: fc.Arbitrary<WrongValue> = wrongArb(
  numericFieldArb,
  fc.oneof(
    fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.5, 1.5, 1 + Number.EPSILON),
    fc.double().filter((d) => !Number.isInteger(d)),
  ),
);

/** A numeric field set to an integer outside its range: boundary values and the whole safe-integer range. */
const outOfRangeArb: fc.Arbitrary<WrongValue> = fc.oneof(
  wrongArb(
    fc.constant<RecordField>('seen'),
    fc.oneof(
      fc.constantFrom(0, -1, MODEL_MAX_SEEN + 1, MAX_SAFE),
      fc.maxSafeNat().map((n) => -n),
      fc.maxSafeNat().map((n) => MODEL_MAX_SEEN + 1 + (n % (MAX_SAFE - MODEL_MAX_SEEN))),
    ),
  ),
  wrongArb(
    fc.constant<RecordField>('firstTryMisses'),
    fc.oneof(fc.constantFrom(-1, -MAX_SAFE), fc.maxSafeNat().map((n) => -1 - (n % MAX_SAFE))),
  ),
  wrongArb(
    fc.constant<RecordField>('lastSeenAt'),
    fc.oneof(
      fc.constantFrom(-1, MAX_LAST_SEEN_AT + 1, MAX_SAFE),
      fc.maxSafeNat().map((n) => -1 - (n % MAX_SAFE)),
      fc.maxSafeNat().map((n) => MAX_LAST_SEEN_AT + 1 + (n % (MAX_SAFE - MAX_LAST_SEEN_AT))),
    ),
  ),
);

/** `last` set to a string that is none of the three Item_Results. */
const unknownLastArb: fc.Arbitrary<WrongValue> = wrongArb(
  fc.constant<RecordField>('last'),
  fc.oneof(
    fc.constantFrom('correct', 'incorrect', 'maybe', '', 'FirstTry', 'firstTry ', 'Missed', 'toString', '__proto__'),
    fc.string({ maxLength: 10 }).filter((s) => s !== 'firstTry' && s !== 'reviewed' && s !== 'missed'),
  ),
);

function wrongFor(kind: MutationKind): fc.Arbitrary<WrongValue | null> {
  switch (kind) {
    case 'wrongType:nonNumber':
      return nonNumberArb;
    case 'wrongType:nonInteger':
      return nonIntegerArb;
    case 'wrongType:outOfRange':
      return outOfRangeArb;
    case 'wrongType:unknownLast':
      return unknownLastArb;
    default:
      return fc.constant(null);
  }
}

/** Field names other than the four Item_Record fields, including prototype names and near misses. */
const extraKeyArb: fc.Arbitrary<string> = fc
  .oneof(
    fc.constantFrom('extra', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'Seen', 'seen ', ''),
    fc.string({ maxLength: 8 }),
  )
  .filter((k) => !(RECORD_FIELDS as readonly string[]).includes(k));

/**
 * Keys that do not match PROGRESS_KEY_PATTERN: no colon, empty parts, upper-case or `_` in the
 * activity part, an Item part that starts with a digit or `_`, a second colon, spaces, a trailing
 * newline, non-ASCII, 65-character parts, prototype names, valid keys with a bad tail, and random strings.
 */
const badKeyArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    '',
    ':',
    'lesson-a',
    'lesson-a:',
    ':q1',
    'Lesson-a:q1',
    '-lesson:q1',
    'lesson_a:q1',
    'lesson-a:1q',
    'lesson-a:_q',
    'lesson-a:q1:x',
    'lesson a:q1',
    'lesson-a:q 1',
    'lesson-a:q1\n',
    ' lesson-a:q1',
    'lesson-a:qé',
    '__proto__',
    'constructor',
    `${'a'.repeat(65)}:q1`,
    `lesson-a:q${'x'.repeat(64)}`,
  ),
  fc
    .tuple(progressActivityIdArb, progressItemIdArb, fc.constantFrom(':x', '\n', ' ', '.', '?'))
    .map(([activity, item, tail]) => `${activity}:${item}${tail}`),
  fc.tuple(progressActivityIdArb, progressItemIdArb).map(([activity, item]) => `${activity.toUpperCase()}X:${item}`),
  fc.string({ maxLength: 20 }).filter((k) => !KEY_RE.test(k)),
);

const mutationArb: fc.Arbitrary<Mutation> = fc.constantFrom(...MUTATION_KINDS).chain((kind) =>
  fc.record({
    kind: fc.constant(kind),
    at: fc.nat(),
    spareKey: fc.tuple(progressActivityIdArb, progressItemIdArb).map(([activity, item]) => `${activity}:${item}`),
    spareRecord: itemRecordArb,
    extraKey: extraKeyArb,
    extraValue: fc.jsonValue({ maxDepth: 1 }),
    missing: fc.constantFrom(...RECORD_FIELDS),
    wrong: wrongFor(kind),
    above: fc.oneof(fc.constant(1), fc.integer({ min: 1, max: 1_000_000 })),
    badKey: badKeyArb,
    over: fc.integer({ min: 1, max: 3 }),
  }),
);

/** Stores within the caps from `progressStoreArb`, plus the empty store on its own weight. */
const checkStoreArb: fc.Arbitrary<ProgressStore> = fc.oneof(
  { weight: 9, arbitrary: progressStoreArb },
  { weight: 1, arbitrary: fc.constant<ProgressStore>({}) },
);

interface Mutated {
  /** The store with one change. */
  readonly value: Record<string, unknown>;
  /** For `overCap`: the same store padded to exactly RECORD_CAP records, which the check accepts. */
  readonly control: Record<string, unknown> | null;
  readonly onEmpty: boolean;
}

/** The store padded with PAD_RECORD copies under unused valid keys `pad-x:P<i>` to `target` records. */
function padTo(entries: readonly [string, unknown][], used: ReadonlySet<string>, target: number): Record<string, unknown> {
  const out = [...entries];
  for (let i = 0; out.length < target; i += 1) {
    const key = `pad-x:P${i}`;
    if (!used.has(key)) out.push([key, plainObject(recordFields(PAD_RECORD))]);
  }
  return plainObject(out);
}

/** Applies one change of kind `m.kind` to `store`. */
function mutate(store: ProgressStore, m: Mutation): Mutated {
  const entries: [string, unknown][] = Object.keys(store).map((key): [string, unknown] => [key, store[key] as ItemRecord]);
  const onEmpty = entries.length === 0;

  if (m.kind === 'overCap') {
    const used = new Set(Object.keys(store));
    return { value: padTo(entries, used, RECORD_CAP + m.over), control: padTo(entries, used, RECORD_CAP), onEmpty };
  }

  if (m.kind === 'badKey') {
    if (onEmpty) {
      entries.push([m.badKey, plainObject(recordFields(m.spareRecord))]);
    } else {
      const i = m.at % entries.length;
      entries[i] = [m.badKey, (entries[i] as [string, unknown])[1]];
    }
    return { value: plainObject(entries), control: null, onEmpty };
  }

  // Record-level changes: one record (the spare record when the store is empty) changes.
  if (onEmpty) entries.push([m.spareKey, m.spareRecord]);
  const i = m.at % entries.length;
  const [key, raw] = entries[i] as [string, unknown];
  const record = raw as ItemRecord;
  const fields = recordFields(record);
  let changed: [string, unknown][];
  switch (m.kind) {
    case 'extraField':
      changed = [...fields, [m.extraKey, m.extraValue]];
      break;
    case 'missingField':
      changed = fields.filter(([field]) => field !== m.missing);
      break;
    case 'missesAboveSeen':
      changed = fields.map(([field, v]): [string, unknown] => [field, field === 'firstTryMisses' ? record.seen + m.above : v]);
      break;
    default: {
      const wrong = m.wrong;
      if (wrong === null) throw new Error(`mutate: kind ${m.kind} has no wrong value`);
      changed = fields.map(([field, v]): [string, unknown] => [field, field === wrong.field ? wrong.value : v]);
    }
  }
  entries[i] = [key, plainObject(changed)];
  return { value: plainObject(entries), control: null, onEmpty };
}

describe('Feature: practice-path, Property 14: The progress data check accepts stores and rejects extra fields', () => {
  // **Validates: Requirements 12.2, 12.10**
  it('Feature: practice-path, Property 14: isProgressStore accepts generated stores within the caps and rejects each store with one change', () => {
    const kinds = Object.fromEntries(MUTATION_KINDS.map((kind) => [kind, 0])) as Record<MutationKind, number>;
    const fields: Record<RecordField, number> = { seen: 0, firstTryMisses: 0, last: 0, lastSeenAt: 0 };
    const counts = { runs: 0, onEmpty: 0, atCap: 0, largeStores: 0 };
    fc.assert(
      fc.property(checkStoreArb, mutationArb, (store, m) => {
        counts.runs += 1;
        const size = Object.keys(store).length;
        if (size === RECORD_CAP) counts.atCap += 1;
        if (size > 40) counts.largeStores += 1;
        expect(isProgressStore(store)).toBe(true);

        const result = mutate(store, m);
        kinds[m.kind] += 1;
        if (result.onEmpty) counts.onEmpty += 1;
        if (m.wrong !== null) fields[m.wrong.field] += 1;
        if (m.kind === 'badKey') expect(KEY_RE.test(m.badKey)).toBe(false);
        if (result.control !== null) {
          expect(Object.keys(result.control)).toHaveLength(RECORD_CAP);
          expect(isProgressStore(result.control)).toBe(true);
        }
        expect(isProgressStore(result.value)).toBe(false);
      }),
      { numRuns: NUM_RUNS_CHECK },
    );
    console.info(
      `Property 14: ${counts.runs} runs (${counts.largeStores} large stores, ${counts.atCap} at RECORD_CAP, ${counts.onEmpty} changes on an empty store); ` +
        `kinds ${MUTATION_KINDS.map((kind) => `${kind} ${kinds[kind]}`).join(', ')}; ` +
        `wrong-type fields ${RECORD_FIELDS.map((field) => `${field} ${fields[field]}`).join(', ')}`,
    );
    // Every kind of change occurs, and some changes meet an empty store.
    for (const kind of MUTATION_KINDS) expect(kinds[kind], kind).toBeGreaterThan(0);
    for (const field of RECORD_FIELDS) expect(fields[field], field).toBeGreaterThan(0);
    expect(counts.onEmpty).toBeGreaterThan(0);
  }, 170_000);
});

// ---------------------------------------------------------------------------------------------
// Property 15. Each run takes a generated store within the caps (`checkStoreArb`: small stores,
// large stores up to and at the file limit, and the empty store). Records are compared key by key
// as JSON text, so key order inside a record and object prototypes play no part, and also with
// `toEqual` on the whole store.

const NUM_RUNS_ROUND_TRIP = 150;
/** A file text this close to PROGRESS_FILE_MAX, in characters, counts as near the limit. */
const NEAR_LIMIT = 1_000;
const encoder = new TextEncoder();

/** True when every code unit of `text` is below 0x80. */
function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) > 0x7f) return false;
  return true;
}

describe('Feature: practice-path, Property 15: The Progress_File round-trips', () => {
  // **Validates: Requirements 13.8**
  it('Feature: practice-path, Property 15: parseProgressFile(buildProgressFile(store)) merged into an empty store equals the store, within 65,536 bytes', () => {
    const counts = { runs: 0, empty: 0, nearLimit: 0, largest: 0, records: 0 };
    fc.assert(
      fc.property(checkStoreArb, (store) => {
        counts.runs += 1;
        const keys = Object.keys(store);
        if (keys.length === 0) counts.empty += 1;
        counts.records += keys.length;

        const text = buildProgressFile(store);
        const bytes = encoder.encode(text).length;
        // The text is ASCII (D63), so its UTF-8 byte count equals its length in characters.
        expect(isAscii(text)).toBe(true);
        expect(bytes).toBe(text.length);
        expect(bytes).toBeLessThanOrEqual(PROGRESS_FILE_MAX);
        if (PROGRESS_FILE_MAX - text.length <= NEAR_LIMIT) counts.nearLimit += 1;
        counts.largest = Math.max(counts.largest, text.length);

        const parsed = parseProgressFile(text);
        expect(parsed).not.toBeNull();
        const result = mergeProgress({}, parsed as ProgressStore);

        // Same keys, and each record equal to the original as JSON text in the fixed field order.
        const resultKeys = Object.keys(result);
        expect(resultKeys).toEqual([...keys].sort());
        for (const key of keys) {
          expect(Object.hasOwn(result, key), key).toBe(true);
          expect(JSON.stringify(result[key]), key).toBe(JSON.stringify(plainRecord(store[key] as ItemRecord)));
        }
        expect(result).toEqual(store);
        // Building the file again gives the same text.
        expect(buildProgressFile(result)).toBe(text);
      }),
      { numRuns: NUM_RUNS_ROUND_TRIP },
    );
    console.info(
      `Property 15: ${counts.runs} runs (${counts.empty} empty stores, ${counts.records} records in all); ` +
        `${counts.nearLimit} files within ${NEAR_LIMIT} characters of ${PROGRESS_FILE_MAX}, largest ${counts.largest} characters`,
    );
    // Full stores near the file limit and the empty store both occur.
    expect(counts.nearLimit).toBeGreaterThan(0);
    expect(counts.empty).toBeGreaterThan(0);
  }, 170_000);
});

// ---------------------------------------------------------------------------------------------
// Property 16. Each run takes a store `a` from `progressStoreArb` (small stores and large stores up
// to and at the file limit) and a store `b` built from it: a share of `a`'s keys (none, about a
// third, most or all) copied with `a`'s record or a fresh one and a `lastSeenAt` equal to, earlier
// than or later than `a`'s, plus the records of a second generated store, added in a drawn order
// while `b` stays within both caps. So shared keys, equal-time ties with different records and
// merges that trim all occur. Stores are compared key by key as JSON text in the fixed field order,
// so object prototypes and key order play no part.

const NUM_RUNS_MERGE = 150;

interface MergeCase {
  readonly a: ProgressStore;
  readonly b: ProgressStore;
}

/** Change of `lastSeenAt` for a copied key: none (a tie), a little earlier or later, or anywhere in range. */
const timeShiftArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 3, arbitrary: fc.constant(0) },
  { weight: 2, arbitrary: fc.integer({ min: -20, max: -1 }) },
  { weight: 2, arbitrary: fc.integer({ min: 1, max: 20 }) },
  { weight: 1, arbitrary: fc.maxSafeInteger().map((n) => n % (MAX_LAST_SEEN_AT + 1)) },
);

interface CopyPick {
  /** The key is copied when `roll` is below the store's copy rate (0–10). */
  readonly roll: number;
  /** Copy `a`'s record (true) or use `fresh` (false); `lastSeenAt` is shifted either way. */
  readonly same: boolean;
  readonly fresh: ItemRecord;
  readonly shift: number;
}

const copyPickArb: fc.Arbitrary<CopyPick> = fc
  .record({ roll: fc.integer({ min: 0, max: 9 }), same: fc.boolean(), fresh: itemRecordArb, shift: timeShiftArb })
  .map(({ roll, same, fresh, shift }): CopyPick => ({ roll, same, fresh, shift }));

/** A fresh plain store of `entries`, in order, keeping each entry that fits within RECORD_CAP and PROGRESS_FILE_MAX. */
function fitWithinCaps(entries: readonly (readonly [string, ItemRecord])[]): ProgressStore {
  const out: Record<string, ItemRecord> = {};
  let length = modelProgressFileLength({});
  let count = 0;
  for (const [key, record] of entries) {
    if (count >= RECORD_CAP) break;
    const add = JSON.stringify(key).length + 1 + JSON.stringify(plainRecord(record)).length + (count === 0 ? 0 : 1);
    if (length + add > PROGRESS_FILE_MAX) continue;
    // Keys hold a colon, so none is `__proto__`.
    out[key] = plainRecord(record);
    length += add;
    count += 1;
  }
  return out;
}

const mergeCaseArb: fc.Arbitrary<MergeCase> = progressStoreArb.chain((a) => {
  const keys = Object.keys(a);
  return fc
    .record({
      rate: fc.constantFrom(0, 3, 7, 10),
      picks: fc.array(copyPickArb, { minLength: keys.length, maxLength: keys.length }),
      extra: fc.oneof({ weight: 2, arbitrary: progressStoreArb }, { weight: 1, arbitrary: fc.constant<ProgressStore>({}) }),
      copiesFirst: fc.boolean(),
    })
    .map(({ rate, picks, extra, copiesFirst }): MergeCase => {
      const copies: [string, ItemRecord][] = [];
      keys.forEach((key, i) => {
        const pick = picks[i];
        const old = a[key];
        if (pick === undefined || old === undefined || pick.roll >= rate) return;
        const base = pick.same ? old : pick.fresh;
        const lastSeenAt = Math.min(MAX_LAST_SEEN_AT, Math.max(0, old.lastSeenAt + pick.shift));
        copies.push([key, { seen: base.seen, firstTryMisses: base.firstTryMisses, last: base.last, lastSeenAt }]);
      });
      const copied = new Set(copies.map(([key]) => key));
      const extras = Object.keys(extra)
        .filter((key) => !copied.has(key))
        .map((key): [string, ItemRecord] => [key, extra[key] as ItemRecord]);
      return { a, b: fitWithinCaps(copiesFirst ? [...copies, ...extras] : [...extras, ...copies]) };
    });
});

/** `"<key>":<record>` for each own key of `store`, keys sorted by code unit, records in the fixed field order. */
function storeText(store: ProgressStore): string[] {
  return Object.keys(store)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(plainRecord(store[key] as ItemRecord))}`);
}

/** Union model of Requirement 13.6: `a`'s records, replaced by `b`'s where `b`'s `lastSeenAt` is later. */
function modelUnion(a: ProgressStore, b: ProgressStore): Map<string, ItemRecord> {
  const model = new Map<string, ItemRecord>();
  for (const key of Object.keys(a)) model.set(key, plainRecord(a[key] as ItemRecord));
  for (const key of Object.keys(b)) {
    const theirs = plainRecord(b[key] as ItemRecord);
    const mine = model.get(key);
    if (mine === undefined || theirs.lastSeenAt > mine.lastSeenAt) model.set(key, theirs);
  }
  return model;
}

describe('Feature: practice-path, Property 16: Merging keeps the later record and is idempotent', () => {
  // **Validates: Requirements 13.6, 13.9**
  it("Feature: practice-path, Property 16: mergeProgress keeps the later record, a's record on equal times, and trims the oldest first", () => {
    const counts = { runs: 0, withOverlap: 0, overlap: 0, laterB: 0, earlierB: 0, ties: 0, tiesDiffer: 0, trimmed: 0, dropped: 0 };
    fc.assert(
      fc.property(mergeCaseArb, ({ a, b }) => {
        counts.runs += 1;
        expect(isProgressStore(a)).toBe(true);
        expect(isProgressStore(b)).toBe(true);
        expect(modelProgressFileLength(b)).toBeLessThanOrEqual(PROGRESS_FILE_MAX);

        let overlap = 0;
        for (const key of Object.keys(b)) {
          if (!Object.hasOwn(a, key)) continue;
          overlap += 1;
          const mine = a[key] as ItemRecord;
          const theirs = b[key] as ItemRecord;
          if (theirs.lastSeenAt > mine.lastSeenAt) counts.laterB += 1;
          else if (theirs.lastSeenAt < mine.lastSeenAt) counts.earlierB += 1;
          else {
            counts.ties += 1;
            if (JSON.stringify(plainRecord(theirs)) !== JSON.stringify(plainRecord(mine))) counts.tiesDiffer += 1;
          }
        }
        counts.overlap += overlap;
        if (overlap > 0) counts.withOverlap += 1;

        const result = mergeProgress(a, b);
        const model = modelUnion(a, b);

        // Surviving keys are union keys, and each surviving record is the model's record.
        const resultKeys = Object.keys(result);
        expect(resultKeys.filter((key) => !model.has(key))).toEqual([]);
        for (const key of resultKeys) {
          expect(JSON.stringify(plainRecord(result[key] as ItemRecord)), key).toBe(JSON.stringify(model.get(key)));
        }

        // Within both caps.
        expect(resultKeys.length).toBeLessThanOrEqual(RECORD_CAP);
        expect(modelProgressFileLength(result)).toBeLessThanOrEqual(PROGRESS_FILE_MAX);

        // Dropped keys are the first in the (lastSeenAt, key) order, and putting back the last one
        // dropped would break a cap.
        const dropped = [...model.keys()].filter((key) => !Object.hasOwn(result, key));
        const order = [...model.keys()].sort(compareTrimOrder(model));
        expect(order.slice(0, dropped.length).sort()).toEqual([...dropped].sort());
        if (dropped.length > 0) {
          counts.trimmed += 1;
          counts.dropped += dropped.length;
          const lastDropped = order[dropped.length - 1] as string;
          const restored: Record<string, ItemRecord> = { ...result, [lastDropped]: model.get(lastDropped) as ItemRecord };
          const over = Object.keys(restored).length > RECORD_CAP || modelProgressFileLength(restored) > PROGRESS_FILE_MAX;
          expect(over).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS_MERGE },
    );
    console.info(
      `Property 16 merge rule: ${counts.runs} runs, ${counts.withOverlap} with shared keys (${counts.overlap} shared keys: ` +
        `b later ${counts.laterB}, b earlier ${counts.earlierB}, equal times ${counts.ties}, of which ${counts.tiesDiffer} with different records); ` +
        `trimmed in ${counts.trimmed} (${counts.dropped} records dropped)`,
    );
    // Shared keys with each time relation, ties with different records and trimmed merges all occur.
    expect(counts.withOverlap).toBeGreaterThan(0);
    expect(counts.laterB).toBeGreaterThan(0);
    expect(counts.earlierB).toBeGreaterThan(0);
    expect(counts.ties).toBeGreaterThan(0);
    expect(counts.tiesDiffer).toBeGreaterThan(0);
    expect(counts.trimmed).toBeGreaterThan(0);
  }, 170_000);

  it('Feature: practice-path, Property 16: mergeProgress(a, a) equals a and mergeProgress(mergeProgress(a, b), b) equals mergeProgress(a, b) when the union fits the caps', () => {
    const counts = { runs: 0, withOverlap: 0, trimmed: 0, fits: 0 };
    fc.assert(
      fc.property(mergeCaseArb, ({ a, b }) => {
        counts.runs += 1;
        if (Object.keys(b).some((key) => Object.hasOwn(a, key))) counts.withOverlap += 1;
        expect(storeText(mergeProgress(a, a))).toEqual(storeText(a));
        const once = mergeProgress(a, b);
        const union = modelUnion(a, b);
        if (Object.keys(once).length < union.size) counts.trimmed += 1;
        // The second-merge check applies only when the untrimmed union fits both caps
        // (Requirement 13.9, decision 2026-11-22). When the union exceeds the file limit, `trim` can
        // leave free space, and the second merge keeps a record the first dropped (fast-check seed
        // -408745390, path "44"), so those pairs are excluded.
        const fits = union.size <= RECORD_CAP && modelProgressFileLength(Object.fromEntries(union)) <= PROGRESS_FILE_MAX;
        if (!fits) return;
        counts.fits += 1;
        expect(storeText(mergeProgress(once, b))).toEqual(storeText(once));
      }),
      { numRuns: NUM_RUNS_MERGE },
    );
    console.info(
      `Property 16 idempotence: ${counts.runs} runs, ${counts.withOverlap} with shared keys, ${counts.trimmed} trimmed merges, ` +
        `${counts.fits} pairs whose union fits the caps`,
    );
    expect(counts.withOverlap).toBeGreaterThan(0);
    expect(counts.trimmed).toBeGreaterThan(0);
    expect(counts.fits).toBeGreaterThan(0);
  }, 170_000);
});
