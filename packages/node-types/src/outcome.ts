// `outcome` node type: the terminal result page with an optional https CTA
// (design Component 3, Req 16.4, 16.8; security.md links rule).

import Type, { type Static } from 'typebox';
import type { Diagnostic } from '@dreame/schema';
import type { NodeType } from '@dreame/runtime';

const closed = { additionalProperties: false } as const;

export const OutcomeConfigSchema = Type.Object(
  {
    title: Type.String({ maxLength: 120 }),
    body: Type.String({ maxLength: 2000 }),
    cta: Type.Optional(
      Type.Object(
        {
          label: Type.String({ maxLength: 60 }),
          url: Type.String({ pattern: '^https://' }),
        },
        closed,
      ),
    ),
  },
  closed,
);
export const OutcomeResponseSchema = Type.Object({}, closed);

export type OutcomeConfig = Static<typeof OutcomeConfigSchema>;
export type OutcomeResponse = Static<typeof OutcomeResponseSchema>;

export const outcomeNodeType: NodeType<OutcomeConfig, OutcomeResponse> = {
  type: 'outcome',
  version: 1,
  terminal: true,
  configSchema: OutcomeConfigSchema,
  responseSchema: OutcomeResponseSchema,
  validate(cfg, ctx) {
    const out: Diagnostic[] = [];
    out.push(...ctx.checkText(cfg.title, `${ctx.nodePath}/config/title`));
    if (cfg.cta !== undefined) out.push(...ctx.checkHttpsUrl(cfg.cta.url, `${ctx.nodePath}/config/cta/url`));
    return out;
  },
  answerType: () => null,
  isValidResponse: (_cfg, r): r is OutcomeResponse => typeof r === 'object' && r !== null && !Array.isArray(r),
  // Never called: the runtime rejects actions once status is not `playing`.
  reduce: (_cfg, s) => s,
};
