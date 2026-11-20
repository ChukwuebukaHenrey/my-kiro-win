// `content` node type: a text page with a continue button (design Component 3, Req 16.2, 16.8).

import Type, { type Static } from 'typebox';
import type { Diagnostic } from '@dreame/schema';
import type { NodeType } from '@dreame/runtime';

const closed = { additionalProperties: false } as const;

export const ContentConfigSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ maxLength: 120 })),
    body: Type.String({ maxLength: 2000 }),
    continueLabel: Type.Optional(Type.String({ maxLength: 40 })),
  },
  closed,
);
export const ContentResponseSchema = Type.Object({}, closed);

export type ContentConfig = Static<typeof ContentConfigSchema>;
export type ContentResponse = Static<typeof ContentResponseSchema>;

export const contentNodeType: NodeType<ContentConfig, ContentResponse> = {
  type: 'content',
  version: 1,
  terminal: false,
  configSchema: ContentConfigSchema,
  responseSchema: ContentResponseSchema,
  validate(cfg, ctx) {
    const out: Diagnostic[] = [];
    if (cfg.title !== undefined) out.push(...ctx.checkText(cfg.title, `${ctx.nodePath}/config/title`));
    out.push(...ctx.checkText(cfg.body, `${ctx.nodePath}/config/body`));
    return out;
  },
  answerType: () => null,
  isValidResponse: (_cfg, r): r is ContentResponse => typeof r === 'object' && r !== null && !Array.isArray(r),
  reduce: (_cfg, s) => s,
};
