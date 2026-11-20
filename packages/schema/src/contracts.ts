// Manifest contracts: TypeBox schemas and their static types (Architecture Spec §A2 layer 1).
// Every object schema is closed (`additionalProperties: false`). String `maxLength` values are
// UTF-16 code units (Decision D6). The recursive `Cond` type is written by hand; its schema is the
// depth-bounded set of definitions returned by `condDefs` (Decision D5).

import Type, { type Static, type TSchema } from 'typebox';
import {
  ACTIVITY_ID_PATTERN,
  DATE_PATTERN,
  HARD_LIMITS,
  NODE_ID_PATTERN,
  THEME_PATTERN,
  TYPE_NAME_PATTERN,
  VAR_ID_PATTERN,
} from './ids.ts';
import type { JsonSchema } from './node-type.ts';

// ---------------------------------------------------------------------------
// Static types (Brief §3, with the differences listed in design "Data Models")
// ---------------------------------------------------------------------------

export type NodeId = string;
export type Scalar = string | number | boolean;
export type AnswerValue = Scalar | readonly string[];

export type VarDecl =
  | { id: string; type: 'number'; initial: number; min?: number; max?: number }
  | { id: string; type: 'boolean'; initial: boolean }
  | { id: string; type: 'enum'; initial: string; values: string[] };

export type Ref = { answer: NodeId } | { var: string };

export type Cond =
  | { op: 'eq' | 'gte' | 'lte' | 'includes'; ref: Ref; value: Scalar }
  | { op: 'and' | 'or'; args: Cond[] }
  | { op: 'not'; arg: Cond };

/** First match wins; the last edge of a node has no `when`. */
export type Edge = { to: NodeId; when?: Cond };

export type Effect =
  | { op: 'set'; var: string; value: Scalar }
  | { op: 'add'; var: string; value: number };

export type Limits = { maxNodes: number; maxTransitions: number };

export type ManifestNode = {
  id: NodeId;
  type: string;
  /** Narrowed per node type by the composed schema. */
  config: unknown;
  /** `[]` for terminal node types. */
  edges: Edge[];
};

export interface Manifest {
  schemaVersion: 1;
  /** `'core'` in this spec; app profiles come later. */
  profile: string;
  activityId: string;
  version: number;
  requires: Record<string, number>;
  entryNodeId: NodeId;
  fallbackOutcomeId: NodeId;
  limits: Limits;
  variables: VarDecl[];
  nodes: ManifestNode[];
  theme: string;
  /** `YYYY-MM-DD`. */
  validUntil?: string;
}

declare const validBrand: unique symbol;
/** A manifest that passed all seven validator stages. Only the graph validator returns it. */
export type ValidManifest = Manifest & { readonly [validBrand]: true };

// ---------------------------------------------------------------------------
// TypeBox schemas
// ---------------------------------------------------------------------------

const closed = { additionalProperties: false } as const;

/** Copies a schema as plain JSON; TypeBox's hidden `~kind` markers are not enumerable and drop out. */
function plain(schema: TSchema): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

export const NodeIdSchema = Type.String({ pattern: NODE_ID_PATTERN });
export const VarIdSchema = Type.String({ pattern: VAR_ID_PATTERN });

/** `anyOf` string (at most 64 UTF-16 code units) | number | boolean. */
export const ScalarSchema = Type.Union([Type.String({ maxLength: 64 }), Type.Number(), Type.Boolean()]);

const AnswerRefSchema = Type.Object({ answer: NodeIdSchema }, closed);
const VarRefSchema = Type.Object({ var: VarIdSchema }, closed);
/** `oneOf` `{ answer }` | `{ var }`, both closed. */
export const RefSchema = Type.Unsafe<Ref>({ oneOf: [AnswerRefSchema, VarRefSchema] });

const NumberVarDeclSchema = Type.Object(
  {
    id: VarIdSchema,
    type: Type.Literal('number'),
    initial: Type.Number(),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
  },
  closed,
);
const BooleanVarDeclSchema = Type.Object(
  { id: VarIdSchema, type: Type.Literal('boolean'), initial: Type.Boolean() },
  closed,
);
const EnumVarDeclSchema = Type.Object(
  { id: VarIdSchema, type: Type.Literal('enum'), initial: Type.String(), values: Type.Array(Type.String()) },
  closed,
);
/** `oneOf` discriminated on `type`; each variant closed. */
export const VarDeclSchema = Type.Unsafe<VarDecl>({
  type: 'object',
  discriminator: { propertyName: 'type' },
  oneOf: [NumberVarDeclSchema, BooleanVarDeclSchema, EnumVarDeclSchema],
});

const SetEffectSchema = Type.Object({ op: Type.Literal('set'), var: VarIdSchema, value: ScalarSchema }, closed);
const AddEffectSchema = Type.Object({ op: Type.Literal('add'), var: VarIdSchema, value: Type.Number() }, closed);
/** `oneOf` discriminated on `op`; each variant closed. */
export const EffectSchema = Type.Unsafe<Effect>({
  type: 'object',
  discriminator: { propertyName: 'op' },
  oneOf: [SetEffectSchema, AddEffectSchema],
});

/** Closed; `maxNodes` integer 1–200, `maxTransitions` integer 0–1,000. */
export const LimitsSchema = Type.Object(
  {
    maxNodes: Type.Integer({ minimum: 1, maximum: HARD_LIMITS.maxNodes }),
    maxTransitions: Type.Integer({ minimum: 0, maximum: HARD_LIMITS.maxTransitions }),
  },
  closed,
);

const LEAF_OPS = ['eq', 'gte', 'lte', 'includes'] as const;

function condRef(depth: number): JsonSchema {
  return { $ref: `#/$defs/CondD${depth}` };
}

/**
 * Returns the condition definitions `CondD1` to `CondD<maxDepth>`. `CondD1` is the leaf only.
 * Each `CondDk` (k ≥ 2) is a `oneOf` discriminated on `op` over the leaf (`$ref` `CondD1`),
 * `and`/`or` with 1–8 `args` of `CondD(k-1)`, and `not` with an `arg` of `CondD(k-1)`.
 * No definition refers to itself, so the generated validator recurses at most `maxDepth` levels.
 */
export function condDefs(maxDepth: number): Record<string, JsonSchema> {
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new RangeError(`condDefs: maxDepth must be a positive integer, got ${String(maxDepth)}`);
  }
  const defs: Record<string, JsonSchema> = {
    CondD1: {
      type: 'object',
      additionalProperties: false,
      required: ['op', 'ref', 'value'],
      properties: {
        op: { type: 'string', enum: [...LEAF_OPS] },
        ref: plain(RefSchema),
        value: plain(ScalarSchema),
      },
    },
  };
  for (let k = 2; k <= maxDepth; k++) {
    defs[`CondD${k}`] = {
      type: 'object',
      discriminator: { propertyName: 'op' },
      oneOf: [
        condRef(1),
        {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'args'],
          properties: {
            op: { type: 'string', enum: ['and', 'or'] },
            args: { type: 'array', minItems: 1, maxItems: HARD_LIMITS.maxCondArgs, items: condRef(k - 1) },
          },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'arg'],
          properties: {
            op: { type: 'string', const: 'not' },
            arg: condRef(k - 1),
          },
        },
      ],
    };
  }
  return defs;
}

/** Closed edge; `when` refers to the deepest condition definition, `#/$defs/CondD8`. */
export const EdgeSchema = Type.Object(
  {
    to: NodeIdSchema,
    when: Type.Optional(Type.Unsafe<Cond>(condRef(HARD_LIMITS.maxCondDepth))),
  },
  closed,
);
/** Plain JSON Schema form of `EdgeSchema`, used under `$defs/Edge` by the composer. */
export const EdgeSchemaRef: JsonSchema = plain(EdgeSchema);

/** Generic node shape; the composer replaces it with one closed branch per node type. */
export const ManifestNodeSchema = Type.Object(
  {
    id: NodeIdSchema,
    type: Type.String({ pattern: TYPE_NAME_PATTERN }),
    config: Type.Unknown(),
    edges: Type.Array(EdgeSchema, { maxItems: HARD_LIMITS.maxEdgesPerNode }),
  },
  closed,
);

/** Node type name → positive integer version. */
export const RequiresSchema = Type.Unsafe<Record<string, number>>({
  type: 'object',
  patternProperties: { [TYPE_NAME_PATTERN]: { type: 'integer', minimum: 1 } },
  additionalProperties: false,
});

/** Generic manifest shape; the composer narrows `profile` and `nodes` for each profile. */
export const ManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    profile: Type.String(),
    activityId: Type.String({ pattern: ACTIVITY_ID_PATTERN }),
    version: Type.Integer({ minimum: 1 }),
    requires: RequiresSchema,
    entryNodeId: NodeIdSchema,
    fallbackOutcomeId: NodeIdSchema,
    limits: LimitsSchema,
    variables: Type.Array(VarDeclSchema, { maxItems: HARD_LIMITS.maxVariables }),
    nodes: Type.Array(ManifestNodeSchema, { minItems: 1, maxItems: HARD_LIMITS.maxNodes }),
    theme: Type.String({ pattern: THEME_PATTERN }),
    validUntil: Type.Optional(Type.String({ pattern: DATE_PATTERN })),
  },
  closed,
);

// ---------------------------------------------------------------------------
// Compile-time checks that the schemas and the hand-written types agree
// ---------------------------------------------------------------------------

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

// Not exported: the type exists only so that `tsc` fails when a schema and its type drift apart.
type _ContractChecks = [
  Assert<Same<Static<typeof ScalarSchema>, Scalar>>,
  Assert<Same<Static<typeof AnswerRefSchema> | Static<typeof VarRefSchema>, Ref>>,
  Assert<
    Same<
      Static<typeof NumberVarDeclSchema> | Static<typeof BooleanVarDeclSchema> | Static<typeof EnumVarDeclSchema>,
      VarDecl
    >
  >,
  Assert<Same<Static<typeof SetEffectSchema> | Static<typeof AddEffectSchema>, Effect>>,
  Assert<Same<Static<typeof LimitsSchema>, Limits>>,
  Assert<Same<Static<typeof EdgeSchema>, Edge>>,
  Assert<Same<Static<typeof ManifestNodeSchema>, ManifestNode>>,
  Assert<Same<Static<typeof ManifestSchema>, Manifest>>,
];
