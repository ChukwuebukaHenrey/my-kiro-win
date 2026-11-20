// `choice` node type: single-select question whose options carry variable effects
// (design Component 3, Req 16.3, 16.5–16.8).

import Type, { type Static } from 'typebox';
import { EffectSchema, NODE_ID_PATTERN, severityOf, type Diagnostic } from '@dreame/schema';
import { applyEffects, type NodeType } from '@dreame/runtime';

const closed = { additionalProperties: false } as const;

export const ChoiceOptionSchema = Type.Object(
  {
    id: Type.String({ pattern: NODE_ID_PATTERN }),
    label: Type.String({ maxLength: 200 }),
    effects: Type.Optional(Type.Array(EffectSchema, { maxItems: 8 })),
  },
  closed,
);
export const ChoiceConfigSchema = Type.Object(
  {
    prompt: Type.String({ maxLength: 500 }),
    options: Type.Array(ChoiceOptionSchema, { minItems: 2, maxItems: 8 }),
    shuffle: Type.Optional(Type.Boolean()),
  },
  closed,
);
export const ChoiceResponseSchema = Type.Object({ optionId: Type.String() }, closed);

export type ChoiceConfig = Static<typeof ChoiceConfigSchema>;
export type ChoiceResponse = Static<typeof ChoiceResponseSchema>;

function optionIds(cfg: ChoiceConfig): string[] {
  return cfg.options.map((o) => o.id);
}

/** Node ID for the node at `nodePath` (`/nodes/<index>`), when it can be read. */
function nodeIdAt(ctx: Parameters<NodeType<ChoiceConfig>['validate']>[1]): string | undefined {
  const index = Number(ctx.nodePath.slice('/nodes/'.length));
  return Number.isInteger(index) ? ctx.manifest.nodes[index]?.id : undefined;
}

export const choiceNodeType: NodeType<ChoiceConfig, ChoiceResponse> = {
  type: 'choice',
  version: 1,
  terminal: false,
  configSchema: ChoiceConfigSchema,
  responseSchema: ChoiceResponseSchema,
  validate(cfg, ctx) {
    const base = `${ctx.nodePath}/config`;
    const out: Diagnostic[] = [...ctx.checkText(cfg.prompt, `${base}/prompt`)];
    const nodeId = nodeIdAt(ctx);
    const seen = new Set<string>();
    cfg.options.forEach((option, i) => {
      const path = `${base}/options/${i}`;
      if (seen.has(option.id)) {
        out.push({
          severity: severityOf('duplicate-option-id'),
          stage: 'conditions',
          code: 'duplicate-option-id',
          path: `${path}/id`,
          message: `Option ID "${option.id}" is used more than once in this choice.`,
          ...(nodeId === undefined ? {} : { nodeId }),
        });
      }
      seen.add(option.id);
      out.push(...ctx.checkText(option.label, `${path}/label`));
      (option.effects ?? []).forEach((effect, j) => {
        out.push(...ctx.checkEffect(effect, `${path}/effects/${j}`));
      });
    });
    return out;
  },
  answerType: (cfg) => ({ kind: 'enum', values: optionIds(cfg) }),
  isValidResponse(cfg, r): r is ChoiceResponse {
    if (typeof r !== 'object' || r === null || !Object.hasOwn(r, 'optionId')) return false;
    const optionId: unknown = (r as { optionId: unknown }).optionId;
    return typeof optionId === 'string' && cfg.options.some((o) => o.id === optionId);
  },
  enter(cfg, s, env) {
    if (cfg.shuffle !== true) return s;
    return { ...s, nodeState: { ...s.nodeState, [s.currentNodeId]: { order: env.rng.shuffle(optionIds(cfg)) } } };
  },
  reduce(cfg, s, r, env) {
    const option = cfg.options.find((o) => o.id === r.optionId);
    const answered = { ...s, answers: { ...s.answers, [s.currentNodeId]: r.optionId } };
    return applyEffects(option?.effects ?? [], answered, env.variables);
  },
};
