// `collectionSelect` node type: multi-select bundle builder under min/max/budget rules, with an
// optional occasion filter read from an upstream `choice` answer (design C7, Requirements 5, 6).
// No React; the rules live in `bundle-rules.ts` so the view and `isValidResponse` share them.

import Type, { type Static } from 'typebox';
import { DATE_PATTERN, NODE_ID_PATTERN, severityOf, type Diagnostic, type DiagnosticCode, type GraphCtx } from '@dreame/schema';
import type { AttemptState, NodeType } from '@dreame/runtime';
import type { ChoiceConfig } from '@dreame/node-types';
import {
  checkSelection,
  offeredItems,
  unsatisfiable,
  type CollectionSelectNodeState,
  type Unsatisfiable,
} from './bundle-rules.ts';

const closed = { additionalProperties: false } as const;

export const SELECT_LIMITS = {
  maxItems: 24,
  maxPrice: 100_000_000,
  maxBudget: 1_000_000_000,
  maxPick: 24,
  maxTags: 8,
  maxOccasionsPerItem: 8,
} as const;

export const SelectItemSchema = Type.Object(
  {
    id: Type.String({ pattern: NODE_ID_PATTERN }),
    name: Type.String({ maxLength: 80 }),
    price: Type.Integer({ minimum: 0, maximum: SELECT_LIMITS.maxPrice }),
    tags: Type.Array(Type.String({ minLength: 1, maxLength: 32 }), { maxItems: SELECT_LIMITS.maxTags }),
    occasions: Type.Optional(
      Type.Array(Type.String({ pattern: NODE_ID_PATTERN }), { minItems: 1, maxItems: SELECT_LIMITS.maxOccasionsPerItem }),
    ),
    emoji: Type.Optional(Type.String({ minLength: 1, maxLength: 16 })),
  },
  closed,
);

export const CollectionSelectConfigSchema = Type.Object(
  {
    prompt: Type.String({ maxLength: 500 }),
    items: Type.Array(SelectItemSchema, { minItems: 1, maxItems: SELECT_LIMITS.maxItems }),
    min: Type.Integer({ minimum: 1, maximum: SELECT_LIMITS.maxPick }),
    max: Type.Integer({ minimum: 1, maximum: SELECT_LIMITS.maxPick }),
    budget: Type.Integer({ minimum: 1, maximum: SELECT_LIMITS.maxBudget }),
    currency: Type.String({ pattern: '^[A-Z]{3}$' }),
    occasionFrom: Type.Optional(Type.String({ pattern: NODE_ID_PATTERN })),
    pricesAsOf: Type.Optional(Type.String({ pattern: DATE_PATTERN })),
    continueLabel: Type.Optional(Type.String({ maxLength: 40 })),
  },
  closed,
);

export const CollectionSelectResponseSchema = Type.Object(
  { itemIds: Type.Array(Type.String({ maxLength: 64 }), { maxItems: SELECT_LIMITS.maxPick }) },
  closed,
);

export type SelectItem = Static<typeof SelectItemSchema>;
export type CollectionSelectConfig = Static<typeof CollectionSelectConfigSchema>;
export type CollectionSelectResponse = Static<typeof CollectionSelectResponseSchema>;

/**
 * The answer of the Occasion_Source (`s.answers[cfg.occasionFrom]`, own property only) when it is a
 * string; `null` without `occasionFrom` or when that answer is missing, which offers every Item.
 */
export function occasionOf(cfg: CollectionSelectConfig, s: AttemptState): string | null {
  const from = cfg.occasionFrom;
  if (from === undefined || !Object.hasOwn(s.answers, from)) return null;
  const answer = s.answers[from];
  return typeof answer === 'string' ? answer : null;
}

/** A fresh plain-JSON snapshot of one Item; `emoji` is left out when absent, never `undefined`. */
function snapshot(item: SelectItem) {
  const base = { id: item.id, name: item.name, price: item.price, tags: [...item.tags] };
  return item.emoji === undefined ? base : { ...base, emoji: item.emoji };
}

/** The node state as a fresh JSON value; its type is assignable to both `CollectionSelectNodeState` and `JsonValue`. */
function nodeStateJson(cfg: CollectionSelectConfig, s: AttemptState) {
  const occasion = occasionOf(cfg, s);
  return { occasion, currency: cfg.currency, items: offeredItems(cfg.items, occasion).map(snapshot) };
}

/** Offered_Items snapshot for the current occasion, in config order, plus the currency. */
export function selectNodeState(cfg: CollectionSelectConfig, s: AttemptState): CollectionSelectNodeState {
  return nodeStateJson(cfg, s);
}

/** A `conditions` diagnostic; stage 7 adds `nodeId`. */
function conditionsDiag(code: DiagnosticCode, path: string, message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'conditions', code, path, message };
}

/** The `select-unsatisfiable` message of design C7 for occasion value `v` (`null`: no occasion named). */
function unsatisfiableMessage(v: string | null, why: Unsatisfiable, cfg: CollectionSelectConfig): string {
  const prefix = v === null ? 'No bundle can meet the rules:' : `No bundle can meet the rules for occasion "${v}":`;
  switch (why.reason) {
    case 'min-above-max':
      return `${prefix} min (${cfg.min}) is greater than max (${cfg.max}).`;
    case 'too-few-offered':
      return `${prefix} only ${why.offered} items are offered and min is ${cfg.min}.`;
    case 'cheapest-over-budget':
      return `${prefix} the ${cfg.min} cheapest offered items cost ${why.cheapest} ${cfg.currency}, over the budget of ${cfg.budget} ${cfg.currency}.`;
  }
}

/**
 * Step 3 of design C7. Returns the Occasion_Source option IDs in config order, `null` without
 * `occasionFrom`, or `'skip'` after `dangling-ref` or `type-mismatch`, when steps 4 and 5 do not run.
 */
function occasionSource(cfg: CollectionSelectConfig, ctx: GraphCtx, base: string, out: Diagnostic[]): string[] | null | 'skip' {
  const from = cfg.occasionFrom;
  if (from === undefined) return null;
  const path = `${base}/occasionFrom`;
  const node = ctx.manifest.nodes.find((n) => n.id === from);
  if (node === undefined) {
    out.push(conditionsDiag('dangling-ref', path, `occasionFrom names node "${from}", which does not exist.`));
    return 'skip';
  }
  if (node.type !== 'choice') {
    out.push(
      conditionsDiag('type-mismatch', path, `occasionFrom names node "${from}" of type "${node.type}"; it must name a choice node.`),
    );
    return 'skip';
  }
  if (!ctx.isUpstream(from)) {
    out.push(
      conditionsDiag(
        'answer-not-upstream',
        path,
        `occasionFrom names node "${from}", which is not on every path from entryNodeId to this node.`,
      ),
    );
  }
  // Stage 7 runs only on schema-valid manifests, so a `choice` node's config is a ChoiceConfig.
  return (node.config as ChoiceConfig).options.map((o) => o.id);
}

export const collectionSelectNodeType: NodeType<CollectionSelectConfig, CollectionSelectResponse> = {
  type: 'collectionSelect',
  version: 1,
  terminal: false,
  configSchema: CollectionSelectConfigSchema,
  responseSchema: CollectionSelectResponseSchema,
  validate(cfg, ctx) {
    const base = `${ctx.nodePath}/config`;
    const out: Diagnostic[] = [...ctx.checkText(cfg.prompt, `${base}/prompt`)];
    cfg.items.forEach((item, i) => {
      out.push(...ctx.checkText(item.name, `${base}/items/${i}/name`));
    });
    // Step 2: a repeated Item ID, reported at the later Item.
    const seen = new Set<string>();
    cfg.items.forEach((item, i) => {
      if (seen.has(item.id)) {
        out.push(
          conditionsDiag('duplicate-item-id', `${base}/items/${i}`, `Item ID "${item.id}" is used more than once in this product list.`),
        );
      }
      seen.add(item.id);
    });
    // Step 3: the Occasion_Source; after dangling-ref or type-mismatch, steps 4 and 5 are skipped.
    const options = occasionSource(cfg, ctx, base, out);
    if (options === 'skip') return out;
    // Step 4: every `occasions` entry is an option ID of the Occasion_Source.
    const optionSet = options === null ? null : new Set(options);
    cfg.items.forEach((item, i) => {
      (item.occasions ?? []).forEach((entry, j) => {
        const path = `${base}/items/${i}/occasions/${j}`;
        if (optionSet === null) {
          out.push(
            conditionsDiag('dangling-ref', path, `The occasions entry "${entry}" at ${path} needs occasionFrom, which this config does not set.`),
          );
        } else if (!optionSet.has(entry)) {
          out.push(
            conditionsDiag(
              'dangling-ref',
              path,
              `The occasions entry "${entry}" at ${path} is not an option ID of occasion node "${cfg.occasionFrom ?? ''}".`,
            ),
          );
        }
      });
    });
    // Step 5: one select-unsatisfiable per occasion value with no bundle that meets the rules.
    const values: (string | null)[] = options === null ? [null] : [...new Set(options)];
    for (const v of values) {
      const why = unsatisfiable(offeredItems(cfg.items, v), cfg);
      if (why !== null) out.push(conditionsDiag('select-unsatisfiable', base, unsatisfiableMessage(v, why, cfg)));
    }
    return out;
  },
  answerType: (cfg) => ({ kind: 'set', values: cfg.items.map((i) => i.id) }),
  isValidResponse(cfg, r): r is CollectionSelectResponse {
    if (typeof r !== 'object' || r === null || Array.isArray(r) || !Object.hasOwn(r, 'itemIds')) return false;
    const itemIds: unknown = (r as { itemIds: unknown }).itemIds;
    if (!Array.isArray(itemIds)) return false;
    const ids: string[] = [];
    for (const id of itemIds as unknown[]) {
      if (typeof id !== 'string') return false;
      ids.push(id);
    }
    return checkSelection(cfg.items, cfg, ids) === null;
  },
  enter(cfg, s) {
    return { ...s, nodeState: { ...s.nodeState, [s.currentNodeId]: nodeStateJson(cfg, s) } };
  },
  reduce(cfg, s, r) {
    const ids = cfg.items.filter((item) => r.itemIds.includes(item.id)).map((item) => item.id); // config order
    return {
      ...s,
      answers: { ...s.answers, [s.currentNodeId]: ids },
      nodeState: { ...s.nodeState, [s.currentNodeId]: nodeStateJson(cfg, s) },
    };
  },
};
