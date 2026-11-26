/**
 * Node state schemas, static types and readers of the Practice Path node types
 * (design "Data Models" → "Node state", C5, D70). The TypeBox schemas give the
 * static types; the hand-written readers check values at run time, because no
 * schema compiler may run in the browser. No React, no clock, no randomness.
 */
import Type, { type Static } from 'typebox';
import type { JsonValue } from '@dreame/runtime';

const closed = { additionalProperties: false } as const;

export const TryResultSchema = Type.Union([Type.Literal('correct'), Type.Literal('incorrect')]);
export const ItemResultSchema = Type.Union([Type.Literal('firstTry'), Type.Literal('reviewed'), Type.Literal('missed')]);

/** Item_Snapshot: one answered Item, written by recall.reduce. */
export const ItemSnapshotSchema = Type.Object(
  {
    itemId: Type.String(),
    topic: Type.Optional(Type.String()),
    prompt: Type.String(),
    options: Type.Array(Type.Object({ id: Type.String(), label: Type.String() }, closed)), // config order
    correctOptionId: Type.String(),
    explanation: Type.String(),
    tries: Type.Array(Type.String()), // as responded
    firstTry: TryResultSchema,
  },
  closed,
);

/** s.nodeState[<recall node>]: `{ order }` after enter with shuffle; `{ order?, item }` after reduce. */
export const RecallNodeStateSchema = Type.Object(
  { order: Type.Optional(Type.Array(Type.String())), item: Type.Optional(ItemSnapshotSchema) },
  closed,
);

export const ItemSummarySchema = Type.Object(
  { itemId: Type.String(), topic: Type.Optional(Type.String()), prompt: Type.String(), firstTry: TryResultSchema },
  closed,
);
export const ReviewResultSchema = Type.Object({ itemId: Type.String(), result: TryResultSchema }, closed);

/** s.nodeState[<reviewQueue node>]: `{ items, queue }` after enter; `results` added by reduce. */
export const ReviewQueueNodeStateSchema = Type.Object(
  {
    items: Type.Array(ItemSummarySchema), // every from node with a snapshot, from order
    queue: Type.Array(ItemSnapshotSchema), // first-try misses, from order
    results: Type.Optional(Type.Array(ReviewResultSchema)), // Queue order
  },
  closed,
);

export const MasteryItemSchema = Type.Object(
  { itemId: Type.String(), topic: Type.Optional(Type.String()), prompt: Type.String(), result: ItemResultSchema },
  closed,
);

/** Mastery_Result: s.nodeState[<masterySummary node>], written by enter. */
export const MasteryResultSchema = Type.Object(
  {
    items: Type.Array(MasteryItemSchema),
    counts: Type.Object(
      { firstTry: Type.Integer({ minimum: 0 }), reviewed: Type.Integer({ minimum: 0 }), missed: Type.Integer({ minimum: 0 }) },
      closed,
    ),
    missedTopics: Type.Array(Type.String()),
    nextReview: Type.Array(Type.String()), // Item_IDs of reviewed and missed items, in item order
  },
  closed,
);

export type TryResult = Static<typeof TryResultSchema>;
export type ItemResult = Static<typeof ItemResultSchema>;
export type ItemSnapshot = Static<typeof ItemSnapshotSchema>;
export type RecallNodeState = Static<typeof RecallNodeStateSchema>;
export type ItemSummary = Static<typeof ItemSummarySchema>;
export type ReviewResult = Static<typeof ReviewResultSchema>;
export type ReviewQueueNodeState = Static<typeof ReviewQueueNodeStateSchema>;
export type MasteryItem = Static<typeof MasteryItemSchema>;
export type MasteryResult = Static<typeof MasteryResultSchema>;

type JsonObject = { readonly [k: string]: JsonValue };

/**
 * The value as an object when it is a non-null, non-array object whose own keys
 * (enumerable or not, symbols included) all appear in `allowed`, else `null`.
 * An own `__proto__` key is an extra key, so it is rejected.
 */
function asClosed(value: JsonValue | undefined, allowed: readonly string[]): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return null;
  }
  return value;
}

/** The own property `key` of `obj`, or `undefined`; inherited keys are never read. */
function own(obj: JsonObject, key: string): JsonValue | undefined {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function readList<T>(value: JsonValue | undefined, read: (entry: JsonValue | undefined) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const entry of value) {
    const item = read(entry);
    if (item === null) return null;
    out.push(item);
  }
  return out;
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function readCount(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function readTryResult(value: JsonValue | undefined): TryResult | null {
  return value === 'correct' || value === 'incorrect' ? value : null;
}

function readItemResult(value: JsonValue | undefined): ItemResult | null {
  return value === 'firstTry' || value === 'reviewed' || value === 'missed' ? value : null;
}

/**
 * The optional own string `topic` of `obj`: `{ ok: true }` without a value when
 * the key is absent, `{ ok: true, topic }` for a string, `{ ok: false }` otherwise.
 */
function readTopic(obj: JsonObject): { readonly ok: boolean; readonly topic?: string } {
  if (!Object.hasOwn(obj, 'topic')) return { ok: true };
  const topic = obj['topic'];
  return typeof topic === 'string' ? { ok: true, topic } : { ok: false };
}

function readOption(value: JsonValue | undefined): { id: string; label: string } | null {
  const obj = asClosed(value, ['id', 'label']);
  if (obj === null) return null;
  const id = own(obj, 'id');
  const label = own(obj, 'label');
  if (typeof id !== 'string' || typeof label !== 'string') return null;
  return { id, label };
}

const SNAPSHOT_KEYS = ['itemId', 'topic', 'prompt', 'options', 'correctOptionId', 'explanation', 'tries', 'firstTry'];

function readSnapshot(value: JsonValue | undefined): ItemSnapshot | null {
  const obj = asClosed(value, SNAPSHOT_KEYS);
  if (obj === null) return null;
  const itemId = own(obj, 'itemId');
  const prompt = own(obj, 'prompt');
  const correctOptionId = own(obj, 'correctOptionId');
  const explanation = own(obj, 'explanation');
  if (typeof itemId !== 'string' || typeof prompt !== 'string') return null;
  if (typeof correctOptionId !== 'string' || typeof explanation !== 'string') return null;
  const options = readList(own(obj, 'options'), readOption);
  const tries = readList(own(obj, 'tries'), readString);
  const firstTry = readTryResult(own(obj, 'firstTry'));
  const topic = readTopic(obj);
  if (options === null || tries === null || firstTry === null || !topic.ok) return null;
  const rest = { prompt, options, correctOptionId, explanation, tries, firstTry };
  return topic.topic === undefined ? { itemId, ...rest } : { itemId, topic: topic.topic, ...rest };
}

function readSummary(value: JsonValue | undefined): ItemSummary | null {
  const obj = asClosed(value, ['itemId', 'topic', 'prompt', 'firstTry']);
  if (obj === null) return null;
  const itemId = own(obj, 'itemId');
  const prompt = own(obj, 'prompt');
  const firstTry = readTryResult(own(obj, 'firstTry'));
  const topic = readTopic(obj);
  if (typeof itemId !== 'string' || typeof prompt !== 'string' || firstTry === null || !topic.ok) return null;
  return topic.topic === undefined ? { itemId, prompt, firstTry } : { itemId, topic: topic.topic, prompt, firstTry };
}

function readReviewResult(value: JsonValue | undefined): ReviewResult | null {
  const obj = asClosed(value, ['itemId', 'result']);
  if (obj === null) return null;
  const itemId = own(obj, 'itemId');
  const result = readTryResult(own(obj, 'result'));
  if (typeof itemId !== 'string' || result === null) return null;
  return { itemId, result };
}

function readMasteryItem(value: JsonValue | undefined): MasteryItem | null {
  const obj = asClosed(value, ['itemId', 'topic', 'prompt', 'result']);
  if (obj === null) return null;
  const itemId = own(obj, 'itemId');
  const prompt = own(obj, 'prompt');
  const result = readItemResult(own(obj, 'result'));
  const topic = readTopic(obj);
  if (typeof itemId !== 'string' || typeof prompt !== 'string' || result === null || !topic.ok) return null;
  return topic.topic === undefined ? { itemId, prompt, result } : { itemId, topic: topic.topic, prompt, result };
}

function readCounts(value: JsonValue | undefined): MasteryResult['counts'] | null {
  const obj = asClosed(value, ['firstTry', 'reviewed', 'missed']);
  if (obj === null) return null;
  const firstTry = readCount(own(obj, 'firstTry'));
  const reviewed = readCount(own(obj, 'reviewed'));
  const missed = readCount(own(obj, 'missed'));
  if (firstTry === null || reviewed === null || missed === null) return null;
  return { firstTry, reviewed, missed };
}

/** The value as a RecallNodeState when every field has the right JSON type, else null. */
export function readRecallNodeState(value: JsonValue | undefined): RecallNodeState | null {
  const obj = asClosed(value, ['order', 'item']);
  if (obj === null) return null;
  const state: RecallNodeState = {};
  if (Object.hasOwn(obj, 'order')) {
    const order = readList(obj['order'], readString);
    if (order === null) return null;
    state.order = order;
  }
  if (Object.hasOwn(obj, 'item')) {
    const item = readSnapshot(obj['item']);
    if (item === null) return null;
    state.item = item;
  }
  return state;
}

/** The value as a ReviewQueueNodeState, else null. */
export function readReviewQueueState(value: JsonValue | undefined): ReviewQueueNodeState | null {
  const obj = asClosed(value, ['items', 'queue', 'results']);
  if (obj === null) return null;
  const items = readList(own(obj, 'items'), readSummary);
  const queue = readList(own(obj, 'queue'), readSnapshot);
  if (items === null || queue === null) return null;
  if (!Object.hasOwn(obj, 'results')) return { items, queue };
  const results = readList(obj['results'], readReviewResult);
  if (results === null) return null;
  return { items, queue, results };
}

/** The value as a MasteryResult, else null. */
export function readMasteryResult(value: JsonValue | undefined): MasteryResult | null {
  const obj = asClosed(value, ['items', 'counts', 'missedTopics', 'nextReview']);
  if (obj === null) return null;
  const items = readList(own(obj, 'items'), readMasteryItem);
  const counts = readCounts(own(obj, 'counts'));
  const missedTopics = readList(own(obj, 'missedTopics'), readString);
  const nextReview = readList(own(obj, 'nextReview'), readString);
  if (items === null || counts === null || missedTopics === null || nextReview === null) return null;
  return { items, counts, missedTopics, nextReview };
}
