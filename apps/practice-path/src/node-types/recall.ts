// `recall` node type: one retrieval question with a Retry_Limit and an explanation (design C6,
// D55, D56, Requirements 5, 6). No React, no clock; only `enter` uses `env.rng`, and only when
// `shuffle` is set. The Try_Rules live in `practice-rules.ts` so the view and `isValidResponse`
// share them.

import Type, { type Static } from 'typebox';
import { NODE_ID_PATTERN, severityOf, type Diagnostic, type DiagnosticCode, type GraphCtx } from '@dreame/schema';
import type { NodeType } from '@dreame/runtime';
import { firstTryResult, meetsTryRules } from './practice-rules.ts';
import { readRecallNodeState, type ItemSnapshot, type RecallNodeState, type TryResult } from './practice-state.ts';

const closed = { additionalProperties: false } as const;

export const RECALL_LIMITS = { minOptions: 2, maxOptions: 5, maxRetries: 3, maxTries: 4 } as const;

export const RecallOptionSchema = Type.Object(
  { id: Type.String({ pattern: NODE_ID_PATTERN }), label: Type.String({ maxLength: 200 }) },
  closed,
);

export const RecallConfigSchema = Type.Object(
  {
    itemId: Type.String({ pattern: NODE_ID_PATTERN }),
    prompt: Type.String({ maxLength: 500 }),
    options: Type.Array(RecallOptionSchema, { minItems: RECALL_LIMITS.minOptions, maxItems: RECALL_LIMITS.maxOptions }),
    correctOptionId: Type.String({ pattern: NODE_ID_PATTERN }),
    explanation: Type.String({ maxLength: 1000 }),
    maxRetries: Type.Integer({ minimum: 0, maximum: RECALL_LIMITS.maxRetries }),
    topic: Type.Optional(Type.String({ minLength: 1, maxLength: 60 })),
    shuffle: Type.Optional(Type.Boolean()),
  },
  closed,
);

export const RecallResponseSchema = Type.Object(
  { tries: Type.Array(Type.String({ maxLength: 64 }), { minItems: 1, maxItems: RECALL_LIMITS.maxTries }) },
  closed,
);

export type RecallOption = Static<typeof RecallOptionSchema>;
export type RecallConfig = Static<typeof RecallConfigSchema>;
export type RecallResponse = Static<typeof RecallResponseSchema>;

/**
 * A fresh plain-JSON Item_Snapshot: options in config order, Tries copied, `topic` only when set
 * (never `undefined`). Its inferred type is assignable to both `ItemSnapshot` and `JsonValue`.
 */
function snapshot(cfg: RecallConfig, tries: readonly string[], firstTry: TryResult) {
  const rest = {
    prompt: cfg.prompt,
    options: cfg.options.map((o) => ({ id: o.id, label: o.label })),
    correctOptionId: cfg.correctOptionId,
    explanation: cfg.explanation,
    tries: [...tries],
    firstTry,
  };
  return cfg.topic === undefined ? { itemId: cfg.itemId, ...rest } : { itemId: cfg.itemId, topic: cfg.topic, ...rest };
}

/** A `conditions` diagnostic; stage 7 adds `nodeId`. */
function conditionsDiag(code: DiagnosticCode, path: string, message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'conditions', code, path, message };
}

/**
 * Step 4 of design C6 (D56): the first node before this one in `ctx.manifest.nodes` that is a
 * `recall` node with the same `itemId`, or `undefined`. The index is read from `ctx.nodePath`
 * (`/nodes/<index>`) as in `choice`.
 */
function earlierItemOwner(cfg: RecallConfig, ctx: GraphCtx): string | undefined {
  const index = Number(ctx.nodePath.slice('/nodes/'.length));
  if (!Number.isInteger(index)) return undefined;
  // Stage 7 runs only on schema-valid manifests, so a `recall` node's config is a RecallConfig.
  const earlier = ctx.manifest.nodes
    .slice(0, index)
    .find((node) => node.type === 'recall' && (node.config as RecallConfig).itemId === cfg.itemId);
  return earlier?.id;
}

export const recallNodeType: NodeType<RecallConfig, RecallResponse> = {
  type: 'recall',
  version: 1,
  terminal: false,
  configSchema: RecallConfigSchema,
  responseSchema: RecallResponseSchema,
  validate(cfg, ctx) {
    const base = `${ctx.nodePath}/config`;
    // Step 1: blank text in the prompt, each option label and the explanation (Requirement 5.7).
    const out: Diagnostic[] = [...ctx.checkText(cfg.prompt, `${base}/prompt`)];
    cfg.options.forEach((option, i) => {
      out.push(...ctx.checkText(option.label, `${base}/options/${i}/label`));
    });
    out.push(...ctx.checkText(cfg.explanation, `${base}/explanation`));
    // Step 2: a repeated option ID, reported at the later option (Requirement 5.5).
    const seen = new Set<string>();
    cfg.options.forEach((option, i) => {
      if (seen.has(option.id)) {
        out.push(
          conditionsDiag(
            'duplicate-option-id',
            `${base}/options/${i}/id`,
            `Option ID "${option.id}" is used more than once in this question.`,
          ),
        );
      }
      seen.add(option.id);
    });
    // Step 3: `correctOptionId` names an option of this question (Requirement 5.6).
    if (!seen.has(cfg.correctOptionId)) {
      out.push(
        conditionsDiag(
          'dangling-ref',
          `${base}/correctOptionId`,
          `correctOptionId "${cfg.correctOptionId}" names no option of this question.`,
        ),
      );
    }
    // Step 4: an Item_ID already used by an earlier `recall` node (Requirement 5.8, D56).
    const owner = earlierItemOwner(cfg, ctx);
    if (owner !== undefined) {
      out.push(
        conditionsDiag('duplicate-item-id', `${base}/itemId`, `Item ID "${cfg.itemId}" is already used by node "${owner}".`),
      );
    }
    return out;
  },
  answerType: () => ({ kind: 'enum', values: ['correct', 'incorrect'] }),
  isValidResponse(cfg, r): r is RecallResponse {
    if (typeof r !== 'object' || r === null || Array.isArray(r) || !Object.hasOwn(r, 'tries')) return false;
    const tries: unknown = (r as { tries: unknown }).tries;
    if (!Array.isArray(tries)) return false;
    const ids: string[] = [];
    for (const entry of tries as unknown[]) {
      if (typeof entry !== 'string') return false;
      ids.push(entry);
    }
    return meetsTryRules(cfg, ids);
  },
  enter(cfg, s, env) {
    if (cfg.shuffle !== true) return s;
    return { ...s, nodeState: { ...s.nodeState, [s.currentNodeId]: { order: env.rng.shuffle(cfg.options.map((o) => o.id)) } } };
  },
  reduce(cfg, s, r) {
    const id = s.currentNodeId;
    const firstTry = firstTryResult(cfg.correctOptionId, r.tries);
    const prior = Object.hasOwn(s.nodeState, id) ? readRecallNodeState(s.nodeState[id]) : null;
    const item = snapshot(cfg, r.tries, firstTry) satisfies ItemSnapshot;
    const answers = { ...s.answers, [id]: firstTry };
    // Two returns, so the two state literals are never joined into one union with `order?: undefined`.
    if (prior?.order === undefined) {
      const state = { item } satisfies RecallNodeState;
      return { ...s, answers, nodeState: { ...s.nodeState, [id]: state } };
    }
    const state = { order: [...prior.order], item } satisfies RecallNodeState;
    return { ...s, answers, nodeState: { ...s.nodeState, [id]: state } };
  },
};
