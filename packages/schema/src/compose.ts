// Schema composer (design Component 1): builds each profile's closed manifest schema from the
// base contracts and the profile's node types, so that adding a node type extends validation
// without editing the base schema (Requirement 3). Output is plain JSON Schema for Ajv codegen.

import type { TSchema } from 'typebox';
import {
  condDefs,
  EdgeSchemaRef,
  EffectSchema,
  ManifestSchema,
  NodeIdSchema,
  RefSchema,
  ScalarSchema,
  VarDeclSchema,
} from './contracts.ts';
import { HARD_LIMITS, TYPE_NAME_PATTERN } from './ids.ts';
import type { JsonSchema, NodeTypeDescriptor } from './node-type.ts';

const TYPE_NAME_RE = new RegExp(TYPE_NAME_PATTERN);

/** JSON round-trip copy; TypeBox's non-enumerable `~kind` markers drop out. */
export function toPlainJsonSchema(schema: TSchema): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

/** Throws on a malformed or duplicate node type name (programmer error at build time). */
function assertTypeNames(nodeTypes: readonly NodeTypeDescriptor[]): void {
  const seen = new Set<string>();
  for (const nt of nodeTypes) {
    if (typeof nt.type !== 'string' || !TYPE_NAME_RE.test(nt.type)) {
      throw new Error(`Node type name ${JSON.stringify(nt.type)} does not match ${TYPE_NAME_PATTERN}`);
    }
    if (seen.has(nt.type)) {
      throw new Error(`Duplicate node type name "${nt.type}"`);
    }
    seen.add(nt.type);
  }
}

/** One closed branch of `$defs/Node` for a node type. */
function nodeBranch(nt: NodeTypeDescriptor): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'type', 'config', 'edges'],
    properties: {
      id: toPlainJsonSchema(NodeIdSchema),
      type: { const: nt.type },
      config: toPlainJsonSchema(nt.configSchema),
      edges: { type: 'array', maxItems: HARD_LIMITS.maxEdgesPerNode, items: { $ref: '#/$defs/Edge' } },
    },
  };
}

/**
 * Returns the closed manifest schema of a profile: `$id` `urn:dreame:manifest:<profileId>`,
 * `profile` fixed to `profileId`, and `nodes` of 1–200 items of `$defs/Node`, where `Node` is a
 * `oneOf` discriminated on `type` with one branch per node type in `nodeTypes` order.
 */
export function composeManifestSchema(profileId: string, nodeTypes: readonly NodeTypeDescriptor[]): JsonSchema {
  assertTypeNames(nodeTypes);
  const base = toPlainJsonSchema(ManifestSchema);
  const baseProperties = base['properties'] as Record<string, JsonSchema>;
  return {
    $id: `urn:dreame:manifest:${profileId}`,
    ...base,
    properties: {
      ...baseProperties,
      profile: { const: profileId },
      variables: {
        type: 'array',
        maxItems: HARD_LIMITS.maxVariables,
        items: { $ref: '#/$defs/VarDecl' },
      },
      nodes: { type: 'array', minItems: 1, maxItems: HARD_LIMITS.maxNodes, items: { $ref: '#/$defs/Node' } },
    },
    $defs: {
      ...condDefs(HARD_LIMITS.maxCondDepth),
      Ref: toPlainJsonSchema(RefSchema),
      Scalar: toPlainJsonSchema(ScalarSchema),
      Edge: JSON.parse(JSON.stringify(EdgeSchemaRef)) as JsonSchema,
      Effect: toPlainJsonSchema(EffectSchema),
      VarDecl: toPlainJsonSchema(VarDeclSchema),
      Node: {
        type: 'object',
        // Ajv `strict: true` enables `strictRequired`, which needs `type` declared next to `required`.
        properties: { type: { type: 'string' } },
        required: ['type'],
        discriminator: { propertyName: 'type' },
        oneOf: nodeTypes.map(nodeBranch),
      },
    },
  };
}

/** Returns one plain response schema per node type, keyed by the node type name. */
export function composeResponseSchemas(nodeTypes: readonly NodeTypeDescriptor[]): Record<string, JsonSchema> {
  assertTypeNames(nodeTypes);
  const out: Record<string, JsonSchema> = {};
  for (const nt of nodeTypes) {
    out[nt.type] = toPlainJsonSchema(nt.responseSchema);
  }
  return out;
}
