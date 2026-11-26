// `reviewQueue` node type: the review round that brings back each first-try miss of the `recall`
// nodes named in `from`, once, in `from` order (design C7, D57, D58, Requirements 7, 8). No React;
// neither hook reads `env`. The Queue and Review_Result rules live in `practice-rules.ts`.

import Type, { type Static } from 'typebox';
import { NODE_ID_PATTERN, severityOf, type Diagnostic, type DiagnosticCode } from '@dreame/schema';
import type { AttemptState, NodeType } from '@dreame/runtime';
import { buildQueue, reviewResults, summarize } from './practice-rules.ts';
import {
  readRecallNodeState,
  readReviewQueueState,
  type ItemSnapshot,
  type ItemSummary,
  type ReviewQueueNodeState,
  type TryResult,
} from './practice-state.ts';

const closed = { additionalProperties: false } as const;

export const REVIEW_LIMITS = { maxFrom: 24 } as const;

export const ReviewQueueConfigSchema = Type.Object(
  {
    title: Type.String({ maxLength: 120 }),
    // `uniqueItems` on a typed string array: Ajv emits an inline check with no `equal` helper (D58).
    from: Type.Array(Type.String({ pattern: NODE_ID_PATTERN }), {
      minItems: 1,
      maxItems: REVIEW_LIMITS.maxFrom,
      uniqueItems: true,
    }),
    intro: Type.Optional(Type.String({ maxLength: 500 })),
    emptyText: Type.Optional(Type.String({ maxLength: 300 })),
  },
  closed,
);

export const ReviewAnswerSchema = Type.Object(
  { itemId: Type.String({ maxLength: 64 }), optionId: Type.String({ maxLength: 64 }) },
  closed,
);

export const ReviewQueueResponseSchema = Type.Object(
  { answers: Type.Array(ReviewAnswerSchema, { maxItems: REVIEW_LIMITS.maxFrom }) },
  closed,
);

export type ReviewQueueConfig = Static<typeof ReviewQueueConfigSchema>;
export type ReviewAnswer = Static<typeof ReviewAnswerSchema>;
export type ReviewQueueResponse = Static<typeof ReviewQueueResponseSchema>;

// Plain-JSON shapes with no optional key, so they are assignable to both the state types and
// `JsonValue` (an inferred union would widen to `topic?: undefined`).
type SummaryFields = { itemId: string; prompt: string; firstTry: TryResult };
type SummaryJson = SummaryFields | (SummaryFields & { topic: string });
type SnapshotFields = {
  itemId: string;
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  explanation: string;
  tries: string[];
  firstTry: TryResult;
};
type SnapshotJson = SnapshotFields | (SnapshotFields & { topic: string });

/** A fresh plain-JSON Item summary; `topic` is left out when absent, never `undefined`. */
function summaryJson(item: ItemSummary): SummaryJson {
  const { itemId, prompt, firstTry } = item;
  return item.topic === undefined ? { itemId, prompt, firstTry } : { itemId, topic: item.topic, prompt, firstTry };
}

/** A fresh plain-JSON Item_Snapshot; `topic` is left out when absent, never `undefined`. */
function snapshotJson(item: ItemSnapshot): SnapshotJson {
  const rest = {
    prompt: item.prompt,
    options: item.options.map((o) => ({ id: o.id, label: o.label })),
    correctOptionId: item.correctOptionId,
    explanation: item.explanation,
    tries: [...item.tries],
    firstTry: item.firstTry,
  };
  return item.topic === undefined ? { itemId: item.itemId, ...rest } : { itemId: item.itemId, topic: item.topic, ...rest };
}

/** `{ items, queue }` as a fresh JSON value; its type is assignable to both `ReviewQueueNodeState` and `JsonValue`. */
function queueStateJson(items: readonly ItemSummary[], queue: readonly ItemSnapshot[]) {
  return { items: items.map(summaryJson), queue: queue.map(snapshotJson) };
}

/** The Item_Snapshot stored by each `from` node, in `from` order; reads own properties only. */
function fromSnapshots(cfg: ReviewQueueConfig, s: AttemptState): ItemSnapshot[] {
  const snapshots: ItemSnapshot[] = [];
  for (const id of cfg.from) {
    if (!Object.hasOwn(s.nodeState, id)) continue;
    const item = readRecallNodeState(s.nodeState[id])?.item;
    if (item !== undefined) snapshots.push(item);
  }
  return snapshots;
}

/** Pure: reads only s.nodeState[from[i]] for each entry, own properties only. */
export function reviewQueueState(cfg: ReviewQueueConfig, s: AttemptState): ReviewQueueNodeState {
  const snapshots = fromSnapshots(cfg, s);
  return { items: snapshots.map(summarize), queue: buildQueue(snapshots) };
}

/** A `conditions` diagnostic; stage 7 adds `nodeId`. */
function conditionsDiag(code: DiagnosticCode, path: string, message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'conditions', code, path, message };
}

export const reviewQueueNodeType: NodeType<ReviewQueueConfig, ReviewQueueResponse> = {
  type: 'reviewQueue',
  version: 1,
  terminal: false,
  configSchema: ReviewQueueConfigSchema,
  responseSchema: ReviewQueueResponseSchema,
  validate(cfg, ctx) {
    const base = `${ctx.nodePath}/config`;
    // Blank title (Requirement 7.6).
    const out: Diagnostic[] = [...ctx.checkText(cfg.title, `${base}/title`)];
    // Each `from` entry names an upstream `recall` node (Requirements 7.3-7.5).
    cfg.from.forEach((id, i) => {
      const path = `${base}/from/${i}`;
      const node = ctx.manifest.nodes.find((n) => n.id === id);
      if (node === undefined) {
        out.push(conditionsDiag('dangling-ref', path, `from entry "${id}" names a node that does not exist.`));
      } else if (node.type !== 'recall') {
        out.push(
          conditionsDiag('type-mismatch', path, `from entry "${id}" names a node of type "${node.type}"; it must name a recall node.`),
        );
      } else if (!ctx.isUpstream(id)) {
        out.push(
          conditionsDiag(
            'answer-not-upstream',
            path,
            `from entry "${id}" names a node that is not on every path from entryNodeId to this node.`,
          ),
        );
      }
    });
    return out;
  },
  answerType: () => null,
  isValidResponse(_cfg, r): r is ReviewQueueResponse {
    if (typeof r !== 'object' || r === null || Array.isArray(r) || !Object.hasOwn(r, 'answers')) return false;
    const answers: unknown = (r as { answers: unknown }).answers;
    if (!Array.isArray(answers)) return false;
    const seen = new Set<string>();
    for (const entry of answers as unknown[]) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
      if (!Object.hasOwn(entry, 'itemId') || !Object.hasOwn(entry, 'optionId')) return false;
      const { itemId, optionId } = entry as { itemId: unknown; optionId: unknown };
      if (typeof itemId !== 'string' || typeof optionId !== 'string') return false;
      if (seen.has(itemId)) return false; // a repeated itemId (Requirement 8.6)
      seen.add(itemId);
    }
    return true;
  },
  enter(cfg, s) {
    const state = reviewQueueState(cfg, s);
    return { ...s, nodeState: { ...s.nodeState, [s.currentNodeId]: queueStateJson(state.items, state.queue) } };
  },
  reduce(cfg, s, r) {
    const id = s.currentNodeId;
    // Recompute the Queue when the state did not pass through `enter` (D57, as collectionSelect.reduce).
    const stored = Object.hasOwn(s.nodeState, id) ? readReviewQueueState(s.nodeState[id]) : null;
    const base = stored ?? reviewQueueState(cfg, s);
    const results = reviewResults(base.queue, r.answers).map((entry) => ({ itemId: entry.itemId, result: entry.result }));
    const state = { ...queueStateJson(base.items, base.queue), results } satisfies ReviewQueueNodeState;
    return { ...s, nodeState: { ...s.nodeState, [id]: state } };
  },
};
