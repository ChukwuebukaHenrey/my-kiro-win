// `recommendOutcome` node type: the terminal result page that shows the bundle picked at a
// `collectionSelect` node, its total, up to `limit` Suggestions and 0-3 https Contact_Links
// (design C8, Requirements 7, 8). No React. Naming a Contact_Link's channel is a view concern,
// so this file imports nothing from the contact folder (Requirement 7.12).

import Type, { type Static } from 'typebox';
import { NODE_ID_PATTERN, severityOf, type Diagnostic, type DiagnosticCode } from '@dreame/schema';
import type { AttemptState, NodeType } from '@dreame/runtime';
import { readSelectNodeState, suggestItems, type BundleResultState, type ItemSnapshot } from './bundle-rules.ts';
import { SELECT_LIMITS } from './collectionSelect.ts';

const closed = { additionalProperties: false } as const;

export const WhereClauseSchema = Type.Union([
  Type.Object(
    { op: Type.Literal('includes'), field: Type.Literal('tags'), value: Type.String({ minLength: 1, maxLength: 32 }) },
    closed,
  ),
  Type.Object(
    {
      op: Type.Union([Type.Literal('lte'), Type.Literal('gte')]),
      field: Type.Literal('price'),
      value: Type.Integer({ minimum: 0, maximum: SELECT_LIMITS.maxPrice }),
    },
    closed,
  ),
]);

export const RecommendSchema = Type.Object(
  {
    where: Type.Optional(Type.Array(WhereClauseSchema, { maxItems: 4 })),
    sortBy: Type.Union([Type.Literal('priceAsc'), Type.Literal('priceDesc')]),
    limit: Type.Integer({ minimum: 1, maximum: 8 }),
  },
  closed,
);

export const RecommendOutcomeConfigSchema = Type.Object(
  {
    title: Type.String({ maxLength: 120 }),
    body: Type.String({ maxLength: 2000 }),
    from: Type.String({ pattern: NODE_ID_PATTERN }),
    whyText: Type.Optional(Type.String({ maxLength: 300 })),
    recommend: Type.Optional(RecommendSchema),
    contacts: Type.Optional(
      Type.Array(
        Type.Object({ label: Type.String({ maxLength: 60 }), url: Type.String({ pattern: '^https://', maxLength: 2048 }) }, closed),
        { maxItems: 3 },
      ),
    ),
  },
  closed,
);
export const RecommendOutcomeResponseSchema = Type.Object({}, closed);

export type WhereClauseConfig = Static<typeof WhereClauseSchema>;
export type RecommendConfig = Static<typeof RecommendSchema>;
export type RecommendOutcomeConfig = Static<typeof RecommendOutcomeConfigSchema>;
export type RecommendOutcomeResponse = Static<typeof RecommendOutcomeResponseSchema>;

/** A fresh plain-JSON BundleLine; `emoji` is left out when absent, never `undefined`. */
function line(item: ItemSnapshot) {
  const base = { id: item.id, name: item.name, price: item.price };
  return item.emoji === undefined ? base : { ...base, emoji: item.emoji };
}

/** `s.answers[from]` (own property only) when it is an array of strings, else `null`. */
function selectedIds(s: AttemptState, from: string): string[] | null {
  if (!Object.hasOwn(s.answers, from)) return null;
  const answer: unknown = s.answers[from];
  if (!Array.isArray(answer)) return null;
  const ids: string[] = [];
  for (const id of answer as unknown[]) {
    if (typeof id !== 'string') return null;
    ids.push(id);
  }
  return ids;
}

/** The bundle result as a fresh JSON value; its type is assignable to both `BundleResultState` and `JsonValue`. */
function bundleResultJson(cfg: RecommendOutcomeConfig, s: AttemptState) {
  const source = Object.hasOwn(s.nodeState, cfg.from) ? readSelectNodeState(s.nodeState[cfg.from]) : null;
  const answer = selectedIds(s, cfg.from);
  if (answer === null || source === null) {
    return { selection: [], total: 0, currency: source?.currency ?? null, suggestions: [] };
  }
  const picked = new Set(answer);
  const selection = source.items.filter((item) => picked.has(item.id)).map(line); // config order
  let total = 0;
  for (const entry of selection) total += entry.price;
  const suggestions = cfg.recommend === undefined ? [] : suggestItems(source.items, answer, cfg.recommend).map(line);
  return { selection, total, currency: source.currency, suggestions };
}

/** Pure: reads only `s.answers[cfg.from]` and `s.nodeState[cfg.from]`. */
export function bundleResult(cfg: RecommendOutcomeConfig, s: AttemptState): BundleResultState {
  return bundleResultJson(cfg, s);
}

/** A `conditions` diagnostic; stage 7 adds `nodeId`. */
function conditionsDiag(code: DiagnosticCode, path: string, message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'conditions', code, path, message };
}

export const recommendOutcomeNodeType: NodeType<RecommendOutcomeConfig, RecommendOutcomeResponse> = {
  type: 'recommendOutcome',
  version: 1,
  terminal: true,
  configSchema: RecommendOutcomeConfigSchema,
  responseSchema: RecommendOutcomeResponseSchema,
  validate(cfg, ctx) {
    const base = `${ctx.nodePath}/config`;
    const out: Diagnostic[] = [...ctx.checkText(cfg.title, `${base}/title`)];
    (cfg.contacts ?? []).forEach((contact, i) => {
      out.push(...ctx.checkHttpsUrl(contact.url, `${base}/contacts/${i}/url`));
    });
    const from = cfg.from;
    const path = `${base}/from`;
    const node = ctx.manifest.nodes.find((n) => n.id === from);
    if (node === undefined) {
      out.push(conditionsDiag('dangling-ref', path, `from names node "${from}", which does not exist.`));
    } else if (node.type !== 'collectionSelect') {
      out.push(
        conditionsDiag('type-mismatch', path, `from names node "${from}" of type "${node.type}"; it must name a collectionSelect node.`),
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
  isValidResponse: (_cfg, r): r is RecommendOutcomeResponse => typeof r === 'object' && r !== null && !Array.isArray(r),
  enter(cfg, s) {
    return { ...s, nodeState: { ...s.nodeState, [s.currentNodeId]: bundleResultJson(cfg, s) } };
  },
  // Never called: the attempt is no longer `playing` on a terminal node.
  reduce: (_cfg, s) => s,
};
