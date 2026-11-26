// Shared fast-check arbitraries for the practice-path property tests (design "Testing Strategy"
// → "Property test configuration"). Not a test file: Vitest only collects `*.test.ts`. Later tasks
// add more generators here.
//
// `recallConfigArb` builds configs that pass the `recall` config schema (design C6 limits and
// `RECALL_LIMITS`) and the `recall` checks of design C6: non-blank text, unique option IDs and a
// `correctOptionId` among them. The Try lists here are built without `meetsTryRules`.
// A passing property run over these values is evidence for that property, not a proof.

import fc from 'fast-check';
import type { Edge, Manifest, ManifestNode } from '@dreame/schema';
import { checkAction, createAttempt, reduce, type Action, type AttemptState, type JsonValue, type Runtime } from '@dreame/runtime';
import { RECALL_LIMITS, type RecallConfig, type RecallOption } from '../src/node-types/recall.ts';
import { REVIEW_LIMITS, reviewQueueState, type ReviewAnswer, type ReviewQueueConfig } from '../src/node-types/reviewQueue.ts';
import type { MasterySummaryConfig } from '../src/node-types/masterySummary.ts';
import {
  readReviewQueueState,
  type ItemResult,
  type ItemSnapshot,
  type ItemSummary,
  type MasteryItem,
  type MasteryResult,
  type ReviewResult,
  type TryResult,
} from '../src/node-types/practice-state.ts';
import {
  PROGRESS_FILE_FORMAT,
  PROGRESS_FILE_MAX,
  PROGRESS_VERSION,
  RECORD_CAP,
  type ItemRecord,
  type ProgressStore,
} from '../src/progress.ts';
import { acceptedResponse, validManifestArb } from '../../../packages/node-types/test/arbitraries.ts';

/** IDs that match `NODE_ID_PATTERN` (short, so collisions and shrinking stay readable). */
export const idArb: fc.Arbitrary<string> = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,7}$/);

/** Non-blank text up to `maxLength` UTF-16 code units, so `blank-text` is never reported. */
function textArb(maxLength: number): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength }).filter((s) => s.trim() !== '');
}

/** A `recall` config: 2–5 options with unique IDs, a `correctOptionId` among them, `maxRetries` 0–3, optional `topic` and `shuffle`. */
export const recallConfigArb: fc.Arbitrary<RecallConfig> = fc
  .record({
    itemId: idArb,
    prompt: textArb(80),
    options: fc.uniqueArray(fc.record({ id: idArb, label: textArb(40) }), {
      minLength: RECALL_LIMITS.minOptions,
      maxLength: RECALL_LIMITS.maxOptions,
      selector: (option: RecallOption) => option.id,
    }),
    correct: fc.nat(),
    explanation: textArb(120),
    maxRetries: fc.integer({ min: 0, max: RECALL_LIMITS.maxRetries }),
    topic: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
    shuffle: fc.option(fc.boolean(), { nil: undefined }),
  })
  .map(({ itemId, prompt, options, correct, explanation, maxRetries, topic, shuffle }): RecallConfig => ({
    itemId,
    prompt,
    options,
    correctOptionId: options[correct % options.length]!.id,
    explanation,
    maxRetries,
    ...(topic === undefined ? {} : { topic }),
    ...(shuffle === undefined ? {} : { shuffle }),
  }));

/** The option IDs of `cfg` other than `correctOptionId` (at least one, since options are unique and 2–5). */
function wrongIds(cfg: RecallConfig): string[] {
  return cfg.options.map((option) => option.id).filter((id) => id !== cfg.correctOptionId);
}

/**
 * Try lists that meet the Try_Rules: 0 to `maxRetries` distinct wrong Tries then the correct
 * option, or, when there are enough wrong options, `maxRetries + 1` distinct wrong Tries.
 */
export function acceptedTriesArb(cfg: RecallConfig): fc.Arbitrary<string[]> {
  const wrong = wrongIds(cfg);
  const allowed = cfg.maxRetries + 1;
  const endsCorrect = fc
    .shuffledSubarray(wrong, { minLength: 0, maxLength: Math.min(cfg.maxRetries, wrong.length) })
    .map((tries) => [...tries, cfg.correctOptionId]);
  if (wrong.length < allowed) return endsCorrect;
  const outOfTries = fc.shuffledSubarray(wrong, { minLength: allowed, maxLength: allowed });
  return fc.oneof(endsCorrect, outOfTries);
}

/** Try IDs that name no option of `cfg` in most draws: random IDs, empty, prototype keys, and 65 code units. */
function unknownIdArb(): fc.Arbitrary<string> {
  return fc.oneof(idArb, fc.constantFrom('', '__proto__', 'toString', 'x'.repeat(65)), fc.string({ maxLength: 70 }));
}

/**
 * Candidate Try lists of 0–6 entries: accepted lists, entries drawn from the option IDs and
 * unknown IDs, repeats, a correct Try before the last, too few Tries (the last one dropped), too
 * many Tries (one appended) and an accepted list with one entry replaced by an unknown ID.
 */
export function candidateTriesArb(cfg: RecallConfig): fc.Arbitrary<string[]> {
  const known = fc.constantFrom(...cfg.options.map((option) => option.id));
  const unknown = unknownIdArb();
  const accepted = acceptedTriesArb(cfg);
  const correctBeforeLast = fc
    .tuple(fc.shuffledSubarray(wrongIds(cfg), { minLength: 1 }), fc.nat())
    .map(([wrong, at]) => {
      const tries = [...wrong];
      tries.splice(at % wrong.length, 0, cfg.correctOptionId);
      return tries;
    });
  return fc.oneof(
    { weight: 4, arbitrary: accepted },
    { weight: 2, arbitrary: fc.array(fc.oneof({ weight: 3, arbitrary: known }, { weight: 1, arbitrary: unknown }), { maxLength: 6 }) },
    { weight: 1, arbitrary: fc.array(known, { maxLength: 6 }) },
    { weight: 1, arbitrary: correctBeforeLast },
    { weight: 1, arbitrary: accepted.map((tries) => tries.slice(0, -1)) },
    { weight: 1, arbitrary: fc.tuple(accepted, known).map(([tries, extra]) => [...tries, extra]) },
    {
      weight: 1,
      arbitrary: fc.tuple(accepted, fc.nat(), unknown).map(([tries, at, id]) => tries.map((t, i) => (i === at % tries.length ? id : t))),
    },
  );
}

// ---------------------------------------------------------------------------------------------
// `reviewQueue` generators (Property 4). `snapshotArb` builds Item_Snapshots as `recall.reduce`
// stores them; `reviewStateArb` plants, for each `from` node, no state, a damaged state or a
// Recall state holding an Item_Snapshot, and returns the planted snapshots next to the attempt
// state, so the test model never reads the state back through `readRecallNodeState`.

/** The node ID of the `reviewQueue` node in the generated attempt states; never a `from` entry. */
export const REVIEW_NODE_ID = 'review';

/** Node IDs that match `NODE_ID_PATTERN` and name a property of `Object.prototype`. */
const PROTOTYPE_NODE_IDS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'] as const;

/** Item_IDs: a small shared pool, so one Item_ID on two `from` nodes occurs often, plus random IDs. */
const itemIdArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom('q1', 'q2', 'q3') },
  { weight: 2, arbitrary: idArb },
);

/**
 * An Item_Snapshot: 2–5 options with unique IDs in config order, a `correctOptionId` among them,
 * optional `topic`, and Tries that match `firstTry` (`[correct]` for `correct`; one or more wrong
 * Tries, optionally then the correct one, for `incorrect`).
 */
export const snapshotArb: fc.Arbitrary<ItemSnapshot> = fc
  .record({
    itemId: itemIdArb,
    topic: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
    prompt: textArb(80),
    options: fc.uniqueArray(fc.record({ id: idArb, label: textArb(40) }), {
      minLength: RECALL_LIMITS.minOptions,
      maxLength: RECALL_LIMITS.maxOptions,
      selector: (option: RecallOption) => option.id,
    }),
    correct: fc.nat(),
    explanation: textArb(120),
    firstTry: fc.constantFrom<TryResult>('correct', 'incorrect'),
    wrongCount: fc.nat(),
    endsCorrect: fc.boolean(),
  })
  .map(({ itemId, topic, prompt, options, correct, explanation, firstTry, wrongCount, endsCorrect }): ItemSnapshot => {
    const correctOptionId = options[correct % options.length]!.id;
    const wrong = options.map((option) => option.id).filter((id) => id !== correctOptionId);
    const tries =
      firstTry === 'correct'
        ? [correctOptionId]
        : [...wrong.slice(0, 1 + (wrongCount % wrong.length)), ...(endsCorrect ? [correctOptionId] : [])];
    // Fresh plain objects: shrunk `fc.record` values can have a null prototype, which
    // `toStrictEqual` treats as a different type from the plain objects `enter` stores.
    const plainOptions = options.map((option) => ({ id: option.id, label: option.label }));
    const rest = { prompt, options: plainOptions, correctOptionId, explanation, tries, firstTry };
    return topic === undefined ? { itemId, ...rest } : { itemId, topic, ...rest };
  });

/** A fresh plain-JSON copy of `item`; `topic` is left out when absent. */
export function snapshotJson(item: ItemSnapshot): { [k: string]: JsonValue } {
  const fields: { [k: string]: JsonValue } = {
    itemId: item.itemId,
    prompt: item.prompt,
    options: item.options.map((option) => ({ id: option.id, label: option.label })),
    correctOptionId: item.correctOptionId,
    explanation: item.explanation,
    tries: [...item.tries],
    firstTry: item.firstTry,
  };
  if (item.topic !== undefined) fields['topic'] = item.topic;
  return fields;
}

/**
 * Recall node states that hold no readable Item_Snapshot: non-objects, arrays, a closed state
 * without `item` (`{}` or `{ order }`), a non-object `item`, and a snapshot damaged by an extra
 * key, a bad `firstTry`, a missing `prompt`, a non-string Try or a non-string `topic`, or placed
 * next to a bad `order` or an extra key.
 */
const damagedRecallStateArb: fc.Arbitrary<JsonValue> = fc.oneof(
  fc.constantFrom<JsonValue>(null, 3, true, 'x', [], [{ item: 1 }], {}, { order: ['a', 'b'] }, { item: 1 }, { item: null }, { item: [] }),
  fc.tuple(snapshotArb, fc.integer({ min: 0, max: 6 })).map(([item, kind]): JsonValue => {
    const json = snapshotJson(item);
    switch (kind) {
      case 0:
        return { item: { ...json, extra: 1 } };
      case 1:
        return { item: { ...json, firstTry: 'maybe' } };
      case 2: {
        const rest = { ...json };
        delete rest['prompt'];
        return { item: rest };
      }
      case 3:
        return { item: json, order: 'x' };
      case 4:
        return { item: json, other: 1 };
      case 5:
        return { item: { ...json, tries: [1] } };
      default:
        return { item: { ...json, topic: 3 } };
    }
  }),
);

/** One `from` node: its stored value (`undefined` for no state) and the snapshot planted in it, or `null`. */
interface FromNodeCase {
  readonly value: JsonValue | undefined;
  readonly item: ItemSnapshot | null;
}

const fromNodeCaseArb: fc.Arbitrary<FromNodeCase> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<FromNodeCase>({ value: undefined, item: null }) },
  { weight: 1, arbitrary: damagedRecallStateArb.map((value): FromNodeCase => ({ value, item: null })) },
  {
    weight: 3,
    arbitrary: fc.tuple(snapshotArb, fc.boolean()).map(([item, withOrder]): FromNodeCase => {
      const order = item.options.map((option) => option.id).reverse();
      return { value: withOrder ? { order, item: snapshotJson(item) } : { item: snapshotJson(item) }, item };
    }),
  },
);

/** `from` entries: IDs that match `NODE_ID_PATTERN`, including `Object.prototype` names, never `REVIEW_NODE_ID`. */
const fromIdArb: fc.Arbitrary<string> = fc
  .oneof({ weight: 6, arbitrary: idArb }, { weight: 1, arbitrary: fc.constantFrom(...PROTOTYPE_NODE_IDS) })
  .filter((id) => id !== REVIEW_NODE_ID);

/** A `reviewQueue` config within `REVIEW_LIMITS` and the C7 text limits: 1–24 unique `from` IDs (short and full-length lists). */
export const reviewQueueConfigArb: fc.Arbitrary<ReviewQueueConfig> = fc
  .record({
    title: textArb(120),
    from: fc.oneof(
      fc.uniqueArray(fromIdArb, { minLength: 1, maxLength: REVIEW_LIMITS.maxFrom }),
      fc.uniqueArray(fromIdArb, { minLength: 1, maxLength: REVIEW_LIMITS.maxFrom, size: 'max' }),
    ),
    intro: fc.option(textArb(500), { nil: undefined }),
    emptyText: fc.option(textArb(300), { nil: undefined }),
  })
  .map(({ title, from, intro, emptyText }): ReviewQueueConfig => ({
    title,
    from,
    ...(intro === undefined ? {} : { intro }),
    ...(emptyText === undefined ? {} : { emptyText }),
  }));

/** An attempt state at `REVIEW_NODE_ID` and the snapshot planted in each `from` node, in `from` order (`null` when none). */
export interface ReviewStateCase {
  readonly state: AttemptState;
  readonly planted: readonly (ItemSnapshot | null)[];
}

/**
 * An attempt state in which each `from` node of `cfg` has no state, a damaged state, or a Recall
 * state holding an Item_Snapshot with `firstTry` `correct` or `incorrect`; the `reviewQueue` node
 * itself has no state, a damaged state or an empty earlier state.
 */
export function reviewStateArb(cfg: ReviewQueueConfig): fc.Arbitrary<ReviewStateCase> {
  return fc
    .record({
      cases: fc.array(fromNodeCaseArb, { minLength: cfg.from.length, maxLength: cfg.from.length }),
      own: fc.option(fc.oneof(damagedRecallStateArb, fc.constant<JsonValue>({ items: [], queue: [] })), { nil: undefined }),
    })
    .map(({ cases, own }): ReviewStateCase => {
      const nodeState: Record<string, JsonValue> = {};
      cfg.from.forEach((id, i) => {
        const value = cases[i]?.value;
        if (value !== undefined) nodeState[id] = value;
      });
      if (own !== undefined) nodeState[REVIEW_NODE_ID] = own;
      const state: AttemptState = {
        activityId: 'practice-review-property',
        manifestVersion: 1,
        seed: 7,
        rngState: 7,
        status: 'playing',
        currentNodeId: REVIEW_NODE_ID,
        vars: {},
        answers: {},
        nodeState,
        path: [{ nodeId: REVIEW_NODE_ID, at: 0 }],
        transitions: 0,
        events: [],
        startedAt: 0,
        updatedAt: 0,
      };
      return { state, planted: cases.map((entry) => entry.item) };
    });
}

// ---------------------------------------------------------------------------------------------
// Queue generator (Property 5). A Queue holds first-try misses only, each Item_ID once, as
// `buildQueue` returns them. The snapshots come from `snapshotArb`, whose `map` builds fresh plain
// objects, and `fc.uniqueArray` returns a plain array, so no value here has a null prototype.

/** An Item_Snapshot with `firstTry` `incorrect`. */
const missArb: fc.Arbitrary<ItemSnapshot> = snapshotArb.filter((item) => item.firstTry === 'incorrect');

/** A Queue: 0–24 Item_Snapshots with unique Item_IDs and `firstTry` `incorrect` (short and full-length lists). */
export const queueArb: fc.Arbitrary<ItemSnapshot[]> = fc.oneof(
  fc.uniqueArray(missArb, { maxLength: REVIEW_LIMITS.maxFrom, selector: (item: ItemSnapshot) => item.itemId }),
  fc.uniqueArray(missArb, { maxLength: REVIEW_LIMITS.maxFrom, selector: (item: ItemSnapshot) => item.itemId, size: 'max' }),
);

// ---------------------------------------------------------------------------------------------
// Review_Queue node state generator (Property 6). `reviewNodeStateArb` returns the stored value
// (`undefined` for no state) next to the items and Review_Results planted in it, or `null` for a
// missing or damaged state, so the test model never reads the value back through
// `readReviewQueueState`. Every value is built in a `map` as a fresh plain object: shrunk
// `fc.record` values can have a null prototype, which `toStrictEqual` treats as a different type.

/** Topics: a small shared pool, so one Topic on two missed items occurs often, plus any string and prototype names. */
const topicArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom('Fractions', 'Decimals', 'Percent') },
  { weight: 1, arbitrary: fc.string({ maxLength: 20 }) },
  { weight: 1, arbitrary: fc.constantFrom('__proto__', 'toString') },
);

const tryResultArb: fc.Arbitrary<TryResult> = fc.constantFrom<TryResult>('correct', 'incorrect');

/** An Item summary as `reviewQueue.enter` stores it: any Item_ID from the shared pool, optional Topic, any `firstTry`. */
const itemSummaryArb: fc.Arbitrary<ItemSummary> = fc
  .record({
    itemId: itemIdArb,
    topic: fc.option(topicArb, { nil: undefined }),
    prompt: fc.string({ maxLength: 40 }),
    firstTry: tryResultArb,
  })
  .map(({ itemId, topic, prompt, firstTry }): ItemSummary =>
    topic === undefined ? { itemId, prompt, firstTry } : { itemId, topic, prompt, firstTry },
  );

/** A fresh plain-JSON copy of an Item summary; `topic` is left out when absent. */
function itemSummaryJson(item: ItemSummary): { [k: string]: JsonValue } {
  return item.topic === undefined
    ? { itemId: item.itemId, prompt: item.prompt, firstTry: item.firstTry }
    : { itemId: item.itemId, topic: item.topic, prompt: item.prompt, firstTry: item.firstTry };
}

/** The items and Review_Results planted in a readable Review_Queue node state. */
export interface PlantedReview {
  readonly items: readonly ItemSummary[];
  readonly results: readonly ReviewResult[];
}

/** One Review_Queue node: its stored value (`undefined` for no state) and what was planted in it, or `null` when missing or damaged. */
export interface ReviewNodeStateCase {
  readonly value: JsonValue | undefined;
  readonly planted: PlantedReview | null;
}

/**
 * A readable Review_Queue node state: 0–24 items, a `queue` of 0–2 snapshots (not read by
 * `masterySummary`), and, when `results` is present, any subset of the distinct Item_IDs with a
 * Review_Result each, plus 0–2 results for Item_IDs that name no item, in any order.
 */
const readableReviewStateArb: fc.Arbitrary<{ fields: { [k: string]: JsonValue }; planted: PlantedReview }> = fc
  .array(itemSummaryArb, { maxLength: REVIEW_LIMITS.maxFrom })
  .chain((items) => {
    const ids = [...new Set(items.map((item) => item.itemId))];
    return fc.record({
      items: fc.constant(items),
      picks: fc.tuple(...ids.map((itemId) => fc.option(tryResultArb, { nil: undefined }).map((result) => ({ itemId, result })))),
      unknown: fc.array(
        fc.tuple(idArb.filter((id) => !ids.includes(id)), tryResultArb).map(([itemId, result]): ReviewResult => ({ itemId, result })),
        { maxLength: 2 },
      ),
      withResults: fc.boolean(),
      queue: fc.array(snapshotArb, { maxLength: 2 }),
    });
  })
  .chain(({ items, picks, unknown, withResults, queue }) => {
    const chosen = picks.flatMap(({ itemId, result }): ReviewResult[] => (result === undefined ? [] : [{ itemId, result }]));
    const all = [...chosen, ...unknown];
    return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length }).map((shuffled) => {
      const results = shuffled.map((entry): ReviewResult => ({ itemId: entry.itemId, result: entry.result }));
      const fields: { [k: string]: JsonValue } = { items: items.map(itemSummaryJson), queue: queue.map(snapshotJson) };
      if (withResults) fields['results'] = results.map((entry) => ({ itemId: entry.itemId, result: entry.result }));
      const plantedItems = items.map((item): ItemSummary =>
        item.topic === undefined
          ? { itemId: item.itemId, prompt: item.prompt, firstTry: item.firstTry }
          : { itemId: item.itemId, topic: item.topic, prompt: item.prompt, firstTry: item.firstTry },
      );
      return { fields, planted: { items: plantedItems, results: withResults ? results : [] } };
    });
  });

/**
 * Review_Queue node states that `readReviewQueueState` rejects: non-objects, arrays, objects
 * without `items` or `queue`, and a readable state damaged by an extra key, a non-array field, an
 * item with a bad `firstTry`, a non-string `topic` or no `prompt`, or a result with a bad `result`
 * or an extra key.
 */
const damagedReviewStateArb: fc.Arbitrary<JsonValue> = fc.oneof(
  fc.constantFrom<JsonValue>(null, 3, true, 'x', [], [{ items: [], queue: [] }], {}, { items: [] }, { queue: [] }, { item: 1 }),
  fc.tuple(readableReviewStateArb, fc.integer({ min: 0, max: 8 })).map(([{ fields }, kind]): JsonValue => {
    const items = Array.isArray(fields['items']) ? fields['items'] : [];
    switch (kind) {
      case 0:
        return { ...fields, extra: 1 };
      case 1:
        return { ...fields, items: 'x' };
      case 2:
        return { ...fields, queue: {} };
      case 3:
        return { ...fields, results: 'x' };
      case 4:
        return { ...fields, items: [...items, { itemId: 'q1', prompt: 'p', firstTry: 'maybe' }] };
      case 5:
        return { ...fields, items: [...items, { itemId: 'q1', topic: 3, prompt: 'p', firstTry: 'incorrect' }] };
      case 6:
        return { ...fields, items: [{ itemId: 'q1', firstTry: 'incorrect' }, ...items] };
      case 7:
        return { ...fields, results: [{ itemId: 'q1', result: 'maybe' }] };
      default:
        return { ...fields, results: [{ itemId: 'q1', result: 'correct', extra: 1 }] };
    }
  }),
);

/** A Review_Queue node state: missing, damaged, or readable with items of any Topics and `firstTry` values and any subset of Review_Results. */
export const reviewNodeStateArb: fc.Arbitrary<ReviewNodeStateCase> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<ReviewNodeStateCase>({ value: undefined, planted: null }) },
  { weight: 1, arbitrary: damagedReviewStateArb.map((value): ReviewNodeStateCase => ({ value, planted: null })) },
  {
    weight: 4,
    arbitrary: readableReviewStateArb.map(({ fields, planted }): ReviewNodeStateCase => ({ value: fields, planted })),
  },
);

// ---------------------------------------------------------------------------------------------
// Tutor_Share_Link generators (Property 7). Titles and Topics mix markup, URL-special characters,
// non-ASCII text, emoji and lone surrogates; the Topics include long ASCII and long non-ASCII
// strings, so both the 500 code-unit text limit and the 2,048 code-unit link limit are reached.
// Every Mastery_Result is built in a `map` as a fresh plain object with counts and lists derived
// as in design C8.

/** A Tutor_Share_Link target that matches `TUTOR_SHARE_URL_PATTERN`: `https://wa.me/` and 6–15 digits. */
export const waMeUrlArb: fc.Arbitrary<string> = fc.stringMatching(/^[0-9]{6,15}$/).map((digits) => `https://wa.me/${digits}`);

const MARKUP_FRAGMENTS = ['<b>', '</b>', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '&amp;', '&', '#', '?', '+', '%', '%20', '=', '"', "'", '\n', ' ', ', '];
const NON_ASCII_FRAGMENTS = ['é', 'Ünïcödé', 'Привет', '日本語', 'عربي', 'ß', '\u00A0', '\uFFFD'];
const EMOJI_FRAGMENTS = ['😀', '👩‍👩‍👧', '🇳🇬', '👍🏽'];
const LONE_SURROGATES = ['\uD83D', '\uDE00', '\uD800', '\uDBFF', '\uDC00', '\uDFFF'];

/** Text pieces: ASCII, any code points, markup, non-ASCII text, emoji and lone surrogates. */
const fragmentArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.string({ unit: 'binary', maxLength: 6 }),
  fc.constantFrom(...MARKUP_FRAGMENTS),
  fc.constantFrom(...NON_ASCII_FRAGMENTS),
  fc.constantFrom(...EMOJI_FRAGMENTS),
  fc.constantFrom(...LONE_SURROGATES),
);

/** Units whose percent-encoding is long (9 or 12 code units per 1 or 2 code units). */
const HEAVY_UNITS = ['漢', '😀', '\uD83D', '\uDC00', '\uFFFD'];

/** A Mastery_Summary title of at most 120 code units; cutting at 120 may split a surrogate pair. */
export const titleArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.array(fragmentArb, { maxLength: 30 }).map((parts) => parts.join('').slice(0, 120)) },
  {
    weight: 1,
    arbitrary: fc.array(fc.constantFrom(...HEAVY_UNITS, '%'), { minLength: 120, maxLength: 120 }).map((parts) => parts.join('').slice(0, 120)),
  },
);

/** Topics of 1–60 code units with many encoded code units each. */
const heavyTopicArb: fc.Arbitrary<string> = fc
  .tuple(fc.constantFrom(...HEAVY_UNITS), fc.integer({ min: 1, max: 60 }))
  .map(([unit, n]) => unit.repeat(n).slice(0, 60));

/** Topics of 1–60 code units: a small shared pool (repeats occur often), any strings, long ASCII and long non-ASCII. */
const shareTopicArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom('Fractions', 'Decimals', 'Percent, ratios', 'Topic & more?') },
  { weight: 2, arbitrary: fc.string({ minLength: 1, maxLength: 60 }) },
  { weight: 1, arbitrary: fc.string({ minLength: 40, maxLength: 60 }) },
  {
    weight: 2,
    arbitrary: fc
      .array(fragmentArb, { minLength: 1, maxLength: 20 })
      .map((parts) => parts.join('').slice(0, 60))
      .filter((topic) => topic.length > 0),
  },
  { weight: 1, arbitrary: heavyTopicArb },
);

const itemResultArb: fc.Arbitrary<ItemResult> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<ItemResult>('firstTry') },
  { weight: 1, arbitrary: fc.constant<ItemResult>('reviewed') },
  { weight: 2, arbitrary: fc.constant<ItemResult>('missed') },
);

interface MasteryEntry {
  readonly result: ItemResult;
  readonly topic: string | undefined;
}

const masteryEntryArb: fc.Arbitrary<MasteryEntry> = fc
  .record({ result: itemResultArb, topic: fc.option(shareTopicArb, { nil: undefined }) })
  .map(({ result, topic }): MasteryEntry => ({ result, topic }));

/** A Mastery_Result as `masterySummary.enter` stores it (design C8 steps 3–4), as fresh plain objects. */
function masteryResultOf(entries: readonly MasteryEntry[]): MasteryResult {
  const items = entries.map((entry, i): MasteryItem => {
    const base = { itemId: `q${i + 1}`, prompt: `Prompt ${i + 1}`, result: entry.result };
    return entry.topic === undefined ? base : { itemId: base.itemId, topic: entry.topic, prompt: base.prompt, result: base.result };
  });
  const counts = { firstTry: 0, reviewed: 0, missed: 0 };
  const missedTopics: string[] = [];
  for (const item of items) {
    counts[item.result] += 1;
    if (item.result === 'missed' && item.topic !== undefined && !missedTopics.includes(item.topic)) missedTopics.push(item.topic);
  }
  const nextReview = items.filter((item) => item.result !== 'firstTry').map((item) => item.itemId);
  return { items, counts, missedTopics, nextReview };
}

/** A Mastery_Result of 24 missed items whose Topics come from `topicArb`. */
function allMissedArb(topicArb: fc.Arbitrary<string>): fc.Arbitrary<MasteryResult> {
  return fc
    .array(topicArb, { minLength: REVIEW_LIMITS.maxFrom, maxLength: REVIEW_LIMITS.maxFrom })
    .map((topics) => masteryResultOf(topics.map((topic): MasteryEntry => ({ result: 'missed', topic }))));
}

/**
 * A Mastery_Result with 0–24 items and Topics of 1–60 code units: short and full-length lists of
 * any results; 24 missed items with long ASCII Topics, which reach the text limit; and 24 missed
 * items with long non-ASCII Topics, which reach the link limit.
 */
export const masteryResultArb: fc.Arbitrary<MasteryResult> = fc.oneof(
  { weight: 2, arbitrary: fc.array(masteryEntryArb, { maxLength: REVIEW_LIMITS.maxFrom }).map(masteryResultOf) },
  { weight: 2, arbitrary: fc.array(masteryEntryArb, { maxLength: REVIEW_LIMITS.maxFrom, size: 'max' }).map(masteryResultOf) },
  { weight: 1, arbitrary: allMissedArb(fc.string({ minLength: 20, maxLength: 60 })) },
  { weight: 1, arbitrary: allMissedArb(heavyTopicArb) },
);

// ---------------------------------------------------------------------------------------------
// Lesson manifests and the driver (Property 8). `lessonManifestArb` draws plain recipes and turns
// them into manifests with a pure builder that writes fresh plain objects only, so no value in a
// built manifest has a null prototype. Node IDs are fixed (`intro`, `r0`…`r7`, `h0`…`h7`,
// `review`, `summary`), so no node ID names a property of `Object.prototype`.

/** Node IDs of the lesson graph. */
export const LESSON_IDS = { intro: 'intro', review: 'review', summary: 'summary' } as const;

/** The node ID of the `recall` node at position `i`. */
export function recallNodeId(i: number): string {
  return `r${i}`;
}

/** The node ID of the `content` hint node after the `recall` node at position `i`. */
export function hintNodeId(i: number): string {
  return `h${i}`;
}

/** One `recall` node of a lesson: its config and, optionally, the First_Try_Result that sends it through its hint node. */
interface LessonStep {
  readonly cfg: RecallConfig;
  readonly hintOn: TryResult | null;
}

interface LessonRecipe {
  readonly intro: boolean;
  readonly steps: readonly LessonStep[];
  readonly reviewTitle: string;
  readonly reviewIntro: string | undefined;
  readonly emptyText: string | undefined;
  readonly summaryTitle: string;
  readonly summaryBody: string;
  readonly tutorShare: { readonly label: string; readonly url: string } | undefined;
  readonly transitionSlack: number;
  readonly nodeSlack: number;
  readonly version: number;
}

/** A fresh plain copy of a `recall` config; `topic` and `shuffle` are left out when absent. */
function plainRecallConfig(cfg: RecallConfig): RecallConfig {
  const base: RecallConfig = {
    itemId: cfg.itemId,
    prompt: cfg.prompt,
    options: cfg.options.map((option) => ({ id: option.id, label: option.label })),
    correctOptionId: cfg.correctOptionId,
    explanation: cfg.explanation,
    maxRetries: cfg.maxRetries,
  };
  if (cfg.topic !== undefined) base.topic = cfg.topic;
  if (cfg.shuffle !== undefined) base.shuffle = cfg.shuffle;
  return base;
}

/**
 * `[intro (content) →] r0 (recall) → … → r<n-1> (recall) → review (reviewQueue) → summary
 * (masterySummary)`. A `recall` node with a hint has a first edge `eq` on its own answer to its
 * `content` hint node, which has one edge to the next node, and an unconditional last edge to the
 * next node; so every `recall` node lies on every path to `review`. `review.from` names every
 * `recall` node in order; `summary.from` is `review`; `requires` lists exactly the node types used;
 * `fallbackOutcomeId` is `summary`; and `maxTransitions` is the longest entry-to-terminal path
 * plus a slack of 0–3.
 */
function buildLessonManifest(r: LessonRecipe): Manifest {
  const { intro, review, summary } = LESSON_IDS;
  const n = r.steps.length;
  const nextOf = (i: number): string => (i + 1 < n ? recallNodeId(i + 1) : review);
  const nodes: ManifestNode[] = [];
  if (r.intro) nodes.push({ id: intro, type: 'content', config: { title: 'Warm-up', body: 'Answer each question.' }, edges: [{ to: recallNodeId(0) }] });
  r.steps.forEach((step, i) => {
    const id = recallNodeId(i);
    const next = nextOf(i);
    const edges: Edge[] =
      step.hintOn === null ? [{ to: next }] : [{ to: hintNodeId(i), when: { op: 'eq', ref: { answer: id }, value: step.hintOn } }, { to: next }];
    nodes.push({ id, type: 'recall', config: plainRecallConfig(step.cfg), edges });
    if (step.hintOn !== null) nodes.push({ id: hintNodeId(i), type: 'content', config: { body: `Hint for question ${i + 1}.` }, edges: [{ to: next }] });
  });
  const reviewConfig: ReviewQueueConfig = { title: r.reviewTitle, from: r.steps.map((_, i) => recallNodeId(i)) };
  if (r.reviewIntro !== undefined) reviewConfig.intro = r.reviewIntro;
  if (r.emptyText !== undefined) reviewConfig.emptyText = r.emptyText;
  nodes.push({ id: review, type: 'reviewQueue', config: reviewConfig, edges: [{ to: summary }] });
  const summaryConfig: MasterySummaryConfig = { title: r.summaryTitle, body: r.summaryBody, from: review };
  if (r.tutorShare !== undefined) summaryConfig.tutorShare = { label: r.tutorShare.label, url: r.tutorShare.url };
  nodes.push({ id: summary, type: 'masterySummary', config: summaryConfig, edges: [] });

  const requires: Record<string, number> = {};
  for (const node of nodes) requires[node.type] = 1;
  const longest = (r.intro ? 1 : 0) + r.steps.reduce((sum, step) => sum + (step.hintOn === null ? 1 : 2), 0) + 1;
  return {
    schemaVersion: 1,
    profile: 'practice-path',
    activityId: 'generated-lesson',
    version: r.version,
    requires,
    entryNodeId: r.intro ? intro : recallNodeId(0),
    fallbackOutcomeId: summary,
    limits: { maxNodes: nodes.length + r.nodeSlack, maxTransitions: longest + r.transitionSlack },
    variables: [],
    nodes,
    theme: 'default',
  };
}

/**
 * Lesson manifests for the `practice-path` profile: an optional `content` intro, 1–8 `recall`
 * nodes (`recallConfigArb`, unique Item_IDs), each with an optional `eq` branch on its own answer
 * through a `content` hint node that rejoins the chain, a `reviewQueue` naming every `recall` node
 * and a `masterySummary` reading the `reviewQueue`.
 */
export const lessonManifestArb: fc.Arbitrary<Manifest> = fc
  .record({
    intro: fc.boolean(),
    steps: fc.uniqueArray(
      fc.record({ cfg: recallConfigArb, hintOn: fc.option(tryResultArb, { nil: null }) }),
      { minLength: 1, maxLength: 8, selector: (step: LessonStep) => step.cfg.itemId },
    ),
    reviewTitle: textArb(120),
    reviewIntro: fc.option(textArb(500), { nil: undefined }),
    emptyText: fc.option(textArb(300), { nil: undefined }),
    summaryTitle: textArb(120),
    summaryBody: fc.string({ maxLength: 200 }),
    tutorShare: fc.option(fc.record({ label: textArb(60), url: waMeUrlArb }), { nil: undefined }),
    transitionSlack: fc.integer({ min: 0, max: 3 }),
    nodeSlack: fc.integer({ min: 0, max: 5 }),
    version: fc.integer({ min: 1, max: 9 }),
  })
  .map((r) =>
    buildLessonManifest({
      intro: r.intro,
      steps: r.steps.map((step): LessonStep => ({ cfg: step.cfg, hintOn: step.hintOn })),
      reviewTitle: r.reviewTitle,
      reviewIntro: r.reviewIntro,
      emptyText: r.emptyText,
      summaryTitle: r.summaryTitle,
      summaryBody: r.summaryBody,
      tutorShare: r.tutorShare === undefined ? undefined : { label: r.tutorShare.label, url: r.tutorShare.url },
      transitionSlack: r.transitionSlack,
      nodeSlack: r.nodeSlack,
      version: r.version,
    }),
  );

/** `lessonManifestArb`, or a core-type `validManifestArb` manifest relabelled to the `practice-path` profile. */
export const practiceManifestArb: fc.Arbitrary<Manifest> = fc.oneof(
  lessonManifestArb,
  validManifestArb.map((m): Manifest => ({ ...m, profile: 'practice-path' })),
);

/**
 * An accepted Try list for `cfg` chosen by `pick`: 0 to `maxRetries` distinct wrong Tries then
 * the correct option, or, when there are enough wrong options, `maxRetries + 1` distinct wrong
 * Tries. Which wrong options are used rotates with `pick`.
 */
function acceptedTries(cfg: RecallConfig, pick: number): string[] {
  const wrong = cfg.options.map((option) => option.id).filter((id) => id !== cfg.correctOptionId);
  const allowed = cfg.maxRetries + 1;
  const endsCorrect = Math.min(cfg.maxRetries, wrong.length) + 1; // 0..min wrong Tries, then correct
  const choices = endsCorrect + (wrong.length >= allowed ? 1 : 0);
  const choice = pick % choices;
  const shift = Math.floor(pick / choices) % wrong.length;
  const rotated = [...wrong.slice(shift), ...wrong.slice(0, shift)];
  if (choice < endsCorrect) return [...rotated.slice(0, choice), cfg.correctOptionId];
  return rotated.slice(0, allowed);
}

/**
 * Review answers for `queue` chosen by `pick`: for Queue item `j`, digit `j` of `pick` in base 3
 * gives the correct option (0), a wrong option (1) or no answer (2).
 */
function reviewAnswers(queue: readonly ItemSnapshot[], pick: number): ReviewAnswer[] {
  const answers: ReviewAnswer[] = [];
  queue.forEach((item, j) => {
    const digit = Math.floor(pick / 3 ** j) % 3;
    if (digit === 2) return;
    const wrong = item.options.find((option) => option.id !== item.correctOptionId);
    const optionId = digit === 0 || wrong === undefined ? item.correctOptionId : wrong.id;
    answers.push({ itemId: item.itemId, optionId });
  });
  return answers;
}

/**
 * A response that `checkAction` accepts at the current node of a `playing` state: for `recall`,
 * an accepted Try list; for `reviewQueue`, answers for the Queue stored by `enter` (recomputed
 * when the stored state is not readable); for `content` and `choice`, the core
 * `acceptedResponse`. `pick` chooses among accepted responses.
 */
export function practiceAcceptedResponse(rt: Runtime, s: AttemptState, pick: number): unknown {
  if (s.status !== 'playing') throw new Error(`practiceAcceptedResponse: attempt status is "${s.status}"; no response is accepted`);
  const node = rt.nodes.get(s.currentNodeId);
  if (node === undefined) throw new Error(`practiceAcceptedResponse: no node "${s.currentNodeId}"`);
  const safePick = Math.abs(Math.trunc(pick));
  if (node.type === 'recall') return { tries: acceptedTries(node.config as RecallConfig, safePick) };
  if (node.type === 'reviewQueue') {
    const stored = Object.hasOwn(s.nodeState, node.id) ? readReviewQueueState(s.nodeState[node.id]) : null;
    const queue = (stored ?? reviewQueueState(node.config as ReviewQueueConfig, s)).queue;
    return { answers: reviewAnswers(queue, safePick) };
  }
  return acceptedResponse(rt, s, safePick);
}

export interface PracticePlayOptions {
  readonly seed: number;
  /** Response picks, used in turn (cycled). Default `[0]`. */
  readonly picks?: readonly number[];
  /** Clock value for `createAttempt`; step `i` (from 1) uses `startAt + i * stepMs`. */
  readonly startAt?: number;
  readonly stepMs?: number;
  /** Stops after this many actions even if still `playing`. Default `maxTransitions + 2`. */
  readonly maxSteps?: number;
}

/**
 * Plays `rt` from `createAttempt` with `practiceAcceptedResponse` responses until the status is
 * not `playing` or `maxSteps` actions were sent, following `playManifest` in
 * `packages/node-types/test/arbitraries.ts`. Returns every state, the initial one first. Throws if
 * a response is rejected, since that is a bug in the test.
 */
export function playPracticeManifest(rt: Runtime, opts: PracticePlayOptions): AttemptState[] {
  const startAt = opts.startAt ?? 0;
  const stepMs = opts.stepMs ?? 1000;
  const picks = opts.picks !== undefined && opts.picks.length > 0 ? opts.picks : [0];
  const maxSteps = opts.maxSteps ?? rt.manifest.limits.maxTransitions + 2;
  let s = createAttempt(rt, opts.seed, { now: startAt });
  const states: AttemptState[] = [s];
  for (let step = 0; step < maxSteps && s.status === 'playing'; step++) {
    const response = practiceAcceptedResponse(rt, s, picks[step % picks.length] ?? 0);
    const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
    const rejection = checkAction(rt, s, action);
    if (rejection !== null) throw new Error(`playPracticeManifest: step ${step} at node "${s.currentNodeId}" was rejected (${rejection})`);
    s = reduce(rt, s, action, { now: startAt + (step + 1) * stepMs });
    states.push(s);
  }
  return states;
}

// ---------------------------------------------------------------------------------------------
// Progress_Store generator (Property 13). Every store holds at most RECORD_CAP records, its
// Progress_File text is at most PROGRESS_FILE_MAX characters, and every key matches
// PROGRESS_KEY_PATTERN (`<activityId>:<itemId>`). Keys always hold a colon, so no key is
// `__proto__` and `Object.fromEntries` builds plain objects. Every Item_Record is built in a `map`
// as a fresh plain object in the field order `seen`, `firstTryMisses`, `last`, `lastSeenAt`.

/** Largest `lastSeenAt` the Item_Record check accepts (design C10). */
export const MAX_LAST_SEEN_AT = 8_640_000_000_000_000;
/** Largest `seen` the Item_Record check accepts (design C10). */
const MAX_SEEN = 1_000_000_000;

/** Activity IDs that match ACTIVITY_ID_PATTERN: a small pool, short random IDs and 64-character IDs. */
export const progressActivityIdArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom('lesson-a', 'lesson-b', 'practice-fractions') },
  { weight: 2, arbitrary: fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,11}$/) },
  { weight: 1, arbitrary: fc.stringMatching(/^[a-z0-9][a-z0-9-]{63}$/) },
);

/** Item_IDs that match NODE_ID_PATTERN: a small pool with `Object.prototype` names, short IDs and 64-character IDs. */
export const progressItemIdArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom('q1', 'q2', 'q3', 'constructor', 'toString') },
  { weight: 2, arbitrary: idArb },
  { weight: 1, arbitrary: fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{63}$/) },
);

/** `lastSeenAt` values: small values (many ties), realistic millisecond times and the full range. */
const lastSeenAtArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 20 }) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 1_000_000 }).map((d) => 1_763_000_000_000 + d) },
  { weight: 1, arbitrary: fc.maxSafeNat().map((n) => n % (MAX_LAST_SEEN_AT + 1)) },
);

/** An Item_Record that passes the design C10 check: `seen` 1–1,000,000,000, `firstTryMisses` 0–`seen`. */
export const itemRecordArb: fc.Arbitrary<ItemRecord> = fc
  .record({
    seen: fc.oneof(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: MAX_SEEN })),
    misses: fc.nat(),
    last: fc.constantFrom<ItemResult>('firstTry', 'reviewed', 'missed'),
    lastSeenAt: lastSeenAtArb,
  })
  .map(({ seen, misses, last, lastSeenAt }): ItemRecord => ({ seen, firstTryMisses: misses % (seen + 1), last, lastSeenAt }));

/** Length of the Progress_File text of an empty store. */
const EMPTY_PROGRESS_FILE_LENGTH = JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: PROGRESS_VERSION, items: {} }).length;

/** Length of the Progress_File text `{"format":…,"version":1,"items":<store>}`, computed with `JSON.stringify` (test model). */
export function modelProgressFileLength(store: ProgressStore): number {
  return JSON.stringify({ format: PROGRESS_FILE_FORMAT, version: PROGRESS_VERSION, items: store }).length;
}

/** Characters that one `"<key>":<record>` entry adds to the Progress_File text, with its comma when it is not the first. */
function entryTextLength(key: string, record: ItemRecord, first: boolean): number {
  return JSON.stringify(key).length + 1 + JSON.stringify(record).length + (first ? 0 : 1);
}

/** A fresh plain store from `entries`; keys hold a colon, so none is `__proto__`. */
function storeOf(entries: readonly (readonly [string, ItemRecord])[]): ProgressStore {
  return Object.fromEntries(entries.map(([key, r]) => [key, { seen: r.seen, firstTryMisses: r.firstTryMisses, last: r.last, lastSeenAt: r.lastSeenAt }]));
}

/** Small stores: 0–40 records with random keys (far below both caps). */
const smallProgressStoreArb: fc.Arbitrary<ProgressStore> = fc
  .uniqueArray(
    fc.tuple(fc.tuple(progressActivityIdArb, progressItemIdArb).map(([a, i]) => `${a}:${i}`), itemRecordArb),
    { maxLength: 40, selector: ([key]) => key },
  )
  .map(storeOf);

/**
 * Large stores: records under 1–3 activity IDs with Item_IDs `I<index>` padded to 1–64 code units,
 * added in turn while the Progress_File text stays at most `target` characters. With `target`
 * equal to PROGRESS_FILE_MAX the store is full: one more entry of its kind would pass the limit, so
 * an update that adds records often has to trim. At most RECORD_CAP records.
 */
const largeProgressStoreArb: fc.Arbitrary<ProgressStore> = fc
  .record({
    activities: fc.uniqueArray(progressActivityIdArb, { minLength: 1, maxLength: 3 }),
    pad: fc.integer({ min: 0, max: 63 }),
    target: fc.oneof(
      { weight: 2, arbitrary: fc.constant(PROGRESS_FILE_MAX) },
      { weight: 1, arbitrary: fc.integer({ min: PROGRESS_FILE_MAX / 2, max: PROGRESS_FILE_MAX }) },
    ),
    records: fc.array(itemRecordArb, { minLength: RECORD_CAP, maxLength: RECORD_CAP }),
  })
  .map(({ activities, pad, target, records }) => {
    const entries: [string, ItemRecord][] = [];
    let length = EMPTY_PROGRESS_FILE_LENGTH;
    for (const [i, record] of records.entries()) {
      const key = `${activities[i % activities.length] ?? 'lesson-a'}:I${String(i).padStart(pad, '0')}`;
      const add = entryTextLength(key, record, entries.length === 0);
      if (length + add > target) break;
      entries.push([key, record]);
      length += add;
    }
    const store = storeOf(entries);
    if (modelProgressFileLength(store) > PROGRESS_FILE_MAX) throw new Error('largeProgressStoreArb: store is over PROGRESS_FILE_MAX');
    return store;
  });

/** Progress_Stores within the caps: small stores with random keys, and large stores up to and at the file limit. */
export const progressStoreArb: fc.Arbitrary<ProgressStore> = fc.oneof(
  { weight: 1, arbitrary: smallProgressStoreArb },
  { weight: 1, arbitrary: largeProgressStoreArb },
);
