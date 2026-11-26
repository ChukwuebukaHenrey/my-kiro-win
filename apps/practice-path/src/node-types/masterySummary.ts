// `masterySummary` node type: the terminal result page that shows each Item_Result of the
// `reviewQueue` node named in `from`, the counts, the Missed_Topics, the Next_Review_Set and an
// optional https Tutor_Share_Link target (design C8, Requirement 9). No React; `enter` reads no
// `env`. The Item_Result rule lives in `practice-rules.ts`; the Tutor_Share_Link builder lives in
// `src/share.ts`.

import Type, { type Static } from 'typebox';
import { NODE_ID_PATTERN, severityOf, type Diagnostic, type DiagnosticCode } from '@dreame/schema';
import type { AttemptState, NodeType } from '@dreame/runtime';
import { itemResult } from './practice-rules.ts';
import { readReviewQueueState, type ItemResult, type MasteryResult, type TryResult } from './practice-state.ts';

const closed = { additionalProperties: false } as const;

/** `https://wa.me/` followed by 6-15 digits (Requirement 9.2). */
export const TUTOR_SHARE_URL_PATTERN = '^https://wa\\.me/[0-9]{6,15}$';

export const MasterySummaryConfigSchema = Type.Object(
  {
    title: Type.String({ maxLength: 120 }),
    body: Type.String({ maxLength: 2000 }),
    from: Type.String({ pattern: NODE_ID_PATTERN }),
    tutorShare: Type.Optional(
      Type.Object({ label: Type.String({ maxLength: 60 }), url: Type.String({ pattern: TUTOR_SHARE_URL_PATTERN }) }, closed),
    ),
  },
  closed,
);
export const MasterySummaryResponseSchema = Type.Object({}, closed);

export type MasterySummaryConfig = Static<typeof MasterySummaryConfigSchema>;
export type MasterySummaryResponse = Static<typeof MasterySummaryResponseSchema>;

// Plain-JSON shapes with no optional key, so they are assignable to both `MasteryResult` and
// `JsonValue` (an inferred union would widen to `topic?: undefined`).
type MasteryItemFields = { itemId: string; prompt: string; result: ItemResult };
type MasteryItemJson = MasteryItemFields | (MasteryItemFields & { topic: string });
type MasteryResultJson = {
  items: MasteryItemJson[];
  counts: { firstTry: number; reviewed: number; missed: number };
  missedTopics: string[];
  nextReview: string[];
};

/** The Mastery_Result as a fresh JSON value; reads only `s.nodeState[cfg.from]`, own property only. */
function masteryResultJson(cfg: MasterySummaryConfig, s: AttemptState): MasteryResultJson {
  const source = Object.hasOwn(s.nodeState, cfg.from) ? readReviewQueueState(s.nodeState[cfg.from]) : null;
  if (source === null) {
    // No or damaged `from` state (Requirement 9.10).
    return { items: [], counts: { firstTry: 0, reviewed: 0, missed: 0 }, missedTopics: [], nextReview: [] };
  }
  // A Map, not a plain object, so IDs such as `__proto__` or `toString` are plain keys.
  const review = new Map<string, TryResult>();
  for (const entry of source.results ?? []) {
    if (!review.has(entry.itemId)) review.set(entry.itemId, entry.result);
  }
  const items: MasteryItemJson[] = [];
  const counts = { firstTry: 0, reviewed: 0, missed: 0 };
  const missedTopics: string[] = [];
  const nextReview: string[] = [];
  for (const entry of source.items) {
    const result = itemResult(entry.firstTry, review.get(entry.itemId));
    const { itemId, prompt, topic } = entry;
    items.push(topic === undefined ? { itemId, prompt, result } : { itemId, topic, prompt, result });
    counts[result] += 1;
    if (result !== 'firstTry') nextReview.push(itemId);
    if (result === 'missed' && topic !== undefined && !missedTopics.includes(topic)) missedTopics.push(topic);
  }
  return { items, counts, missedTopics, nextReview };
}

/** Pure: reads only s.nodeState[cfg.from], own property only. */
export function masteryResult(cfg: MasterySummaryConfig, s: AttemptState): MasteryResult {
  return masteryResultJson(cfg, s);
}

/** A `conditions` diagnostic; stage 7 adds `nodeId`. */
function conditionsDiag(code: DiagnosticCode, path: string, message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'conditions', code, path, message };
}

export const masterySummaryNodeType: NodeType<MasterySummaryConfig, MasterySummaryResponse> = {
  type: 'masterySummary',
  version: 1,
  terminal: true,
  configSchema: MasterySummaryConfigSchema,
  responseSchema: MasterySummaryResponseSchema,
  validate(cfg, ctx) {
    const base = `${ctx.nodePath}/config`;
    // Blank title (Requirement 9.6).
    const out: Diagnostic[] = [...ctx.checkText(cfg.title, `${base}/title`)];
    // Safe_Url check on the Tutor_Share_Link target (Requirement 9.7).
    if (cfg.tutorShare !== undefined) out.push(...ctx.checkHttpsUrl(cfg.tutorShare.url, `${base}/tutorShare/url`));
    // `from` names an upstream `reviewQueue` node (Requirements 9.3-9.5).
    const from = cfg.from;
    const path = `${base}/from`;
    const node = ctx.manifest.nodes.find((n) => n.id === from);
    if (node === undefined) {
      out.push(conditionsDiag('dangling-ref', path, `from names node "${from}", which does not exist.`));
    } else if (node.type !== 'reviewQueue') {
      out.push(
        conditionsDiag('type-mismatch', path, `from names node "${from}" of type "${node.type}"; it must name a reviewQueue node.`),
      );
    } else if (!ctx.isUpstream(from)) {
      out.push(
        conditionsDiag(
          'answer-not-upstream',
          path,
          `from names node "${from}", which is not on every path from entryNodeId to this node.`,
        ),
      );
    }
    return out;
  },
  answerType: () => null,
  // The `outcome` rule (Requirement 9.8).
  isValidResponse: (_cfg, r): r is MasterySummaryResponse => typeof r === 'object' && r !== null && !Array.isArray(r),
  enter(cfg, s) {
    return { ...s, nodeState: { ...s.nodeState, [s.currentNodeId]: masteryResultJson(cfg, s) } };
  },
  // Never called: the attempt is no longer `playing` on a terminal node.
  reduce: (_cfg, s) => s,
};
