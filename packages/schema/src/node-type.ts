// The part of the Brief §3 `NodeType` that the validator and the composer need.
// `@dreame/runtime` extends it with `reduce`; `Render` is added by the Day 5 UI modules.

import type { TSchema } from 'typebox';
import type { Effect, Manifest, VarDecl } from './contracts.ts';
import type { Diagnostic } from './diagnostics.ts';

export type JsonSchema = Record<string, unknown>;

export type ValueType =
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly string[] }
  /** Multi-select answers (used by later node types). */
  | { kind: 'set'; values: readonly string[] };

export interface GraphCtx {
  /** Schema-valid, IDs unique, refs resolved. */
  readonly manifest: Manifest;
  /** JSON Pointer of the node being checked, for example `"/nodes/3"`. */
  readonly nodePath: string;
  readonly variables: ReadonlyMap<string, VarDecl>;
  /** Reports `conditions/effect-invalid` (Req 11.6). */
  checkEffect(effect: Effect, path: string): Diagnostic[];
  /** Reports `conditions/unsafe-url` (Req 6). */
  checkHttpsUrl(url: string, path: string): Diagnostic[];
  /** Reports `conditions/blank-text` (Req 11.9). */
  checkText(text: string, path: string): Diagnostic[];
  /**
   * `true` when `nodeId` names a node other than the one being checked that lies on every path
   * from `entryNodeId` to the node being checked; `false` for an unknown ID and for the node itself.
   */
  isUpstream(nodeId: string): boolean;
}

export interface NodeTypeDescriptor<C = unknown> {
  /** Matches `TYPE_NAME_PATTERN`. */
  readonly type: string;
  /** Positive integer. */
  readonly version: number;
  /** `true` → the node must have no edges. */
  readonly terminal: boolean;
  /** Closed. */
  readonly configSchema: TSchema;
  /** Closed. */
  readonly responseSchema: TSchema;
  validate(cfg: C, ctx: GraphCtx): Diagnostic[];
  /** `null` → the node cannot be the target of an `answer` ref. */
  answerType(cfg: C): ValueType | null;
}

/** Shape of an Ajv standalone validator function. */
export interface StandaloneValidate {
  (data: unknown): boolean;
  errors?: ReadonlyArray<{
    instancePath: string;
    keyword: string;
    params: Record<string, unknown>;
    message?: string;
  }> | null;
}

export interface ProfileDescriptor {
  readonly id: string;
  readonly nodeTypes: readonly NodeTypeDescriptor[];
  /** Generated and precompiled at build time. */
  readonly validateSchema: StandaloneValidate;
}
