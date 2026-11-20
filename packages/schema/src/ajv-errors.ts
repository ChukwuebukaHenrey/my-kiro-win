// Maps the errors of a generated (standalone) Ajv validator to stage-1 diagnostics
// (Req 8.1, 8.2, 11.1). Browser-safe: this file does not import `ajv`.

import type { DiagnosticCode, Diagnostic } from './diagnostics.ts';
import { severityOf } from './diagnostics.ts';
import { HARD_LIMITS } from './ids.ts';
import type { ProfileDescriptor } from './node-type.ts';

/** The fields of an Ajv `ErrorObject` that this module reads. */
export interface AjvErrorLike {
  readonly instancePath: string;
  readonly keyword: string;
  readonly params: Record<string, unknown>;
  readonly message?: string;
  readonly schemaPath?: string;
}

/** Own property of a plain object or array, or `undefined`. Never reads inherited properties. */
function own(value: unknown, key: string | number): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const k = String(key);
  return Object.hasOwn(value, k) ? (value as Record<string, unknown>)[k] : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NODE_PATH = /^\/nodes\/(\d+)(?:\/|$)/;
const NODE_ROOT_PATH = /^\/nodes\/(\d+)$/;

/** The `id` of the node that `path` points into, when the input has a string `id` there. */
function nodeIdAt(input: unknown, path: string): string | undefined {
  const m = NODE_PATH.exec(path);
  if (m === null) return undefined;
  const id = own(own(own(input, 'nodes'), Number(m[1])), 'id');
  return typeof id === 'string' ? id : undefined;
}

function diagnostic(code: DiagnosticCode, path: string, message: string, nodeId: string | undefined): Diagnostic {
  const base = { severity: severityOf(code), stage: 'schema' as const, code, path, message };
  return nodeId === undefined ? base : { ...base, nodeId };
}

/**
 * Nesting depth of a condition, measured iteratively: a leaf is depth 1 and each
 * `and`/`or`/`not` adds 1. Only plain-object children count as conditions. The walk stops as
 * soon as it reaches `limit + 1`, so the result is at most `limit + 1`.
 */
function condDepth(when: unknown, limit: number): number {
  if (!isPlainObject(when)) return 0;
  let max = 0;
  const stack: Array<{ cond: Record<string, unknown>; depth: number }> = [{ cond: when, depth: 1 }];
  while (stack.length > 0) {
    const { cond, depth } = stack.pop()!;
    if (depth > max) max = depth;
    if (max > limit) return max;
    const op = own(cond, 'op');
    const children: unknown[] = [];
    if (op === 'and' || op === 'or') {
      const args = own(cond, 'args');
      if (Array.isArray(args)) {
        for (let i = 0; i < args.length; i++) children.push(own(args, i));
      }
    } else if (op === 'not') {
      children.push(own(cond, 'arg'));
    }
    for (const child of children) {
      if (isPlainObject(child)) stack.push({ cond: child, depth: depth + 1 });
    }
  }
  return max;
}

/** JSON Pointers of every edge `when` in the input that nests deeper than the limit. */
function tooDeepWhenPaths(input: unknown, limit: number): string[] {
  const out: string[] = [];
  const nodes = own(input, 'nodes');
  if (!Array.isArray(nodes)) return out;
  for (let n = 0; n < nodes.length; n++) {
    const edges = own(own(nodes, n), 'edges');
    if (!Array.isArray(edges)) continue;
    for (let e = 0; e < edges.length; e++) {
      const when = own(own(edges, e), 'when');
      if (condDepth(when, limit) > limit) out.push(`/nodes/${n}/edges/${e}/when`);
    }
  }
  return out;
}

function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function schemaMessage(err: AjvErrorLike): string {
  const where = err.instancePath === '' ? 'The manifest' : `The value at ${err.instancePath}`;
  let text = `${where} ${err.message ?? `fails the "${err.keyword}" rule`}`;
  const extra = err.params['additionalProperty'];
  if (err.keyword === 'additionalProperties' && typeof extra === 'string') {
    text += `: "${extra}"`;
  }
  return `${text}.`;
}

function unknownTypeMessage(input: unknown, path: string, profile: ProfileDescriptor): string {
  const index = Number(NODE_ROOT_PATH.exec(path)?.[1]);
  const type = own(own(own(input, 'nodes'), index), 'type');
  const known = profile.nodeTypes.map((nt) => nt.type).join(', ');
  const name = typeof type === 'string' ? `"${type}"` : 'missing or not a string';
  return `The node at ${path} has type ${name}, which is not a node type of profile "${profile.id}" (known: ${known}).`;
}

/**
 * Maps Ajv errors to `schema` diagnostics:
 * - one `schema/schema` per Ajv error, at its `instancePath`;
 * - a discriminator failure on a node's `type` becomes `schema/unknown-node-type` for that node;
 * - each edge `when` deeper than `HARD_LIMITS.maxCondDepth` gives one `schema/cond-too-deep` at
 *   the `when` path, in place of the Ajv errors inside it.
 * `input` is read defensively (own properties only, no recursion).
 */
export function mapSchemaErrors(
  errors: readonly AjvErrorLike[] | null | undefined,
  input: unknown,
  profile: ProfileDescriptor,
): Diagnostic[] {
  const limit = HARD_LIMITS.maxCondDepth;
  const deepPaths = tooDeepWhenPaths(input, limit);
  const out: Diagnostic[] = [];

  for (const path of deepPaths) {
    out.push(
      diagnostic(
        'cond-too-deep',
        path,
        `The condition at ${path} nests deeper than ${limit} levels.`,
        nodeIdAt(input, path),
      ),
    );
  }

  const unknownTypeNodes = new Set<string>();
  for (const err of errors ?? []) {
    const path = err.instancePath;
    if (deepPaths.some((root) => isInside(path, root))) continue;
    if (err.keyword === 'discriminator' && err.params['tag'] === 'type' && NODE_ROOT_PATH.test(path)) {
      if (unknownTypeNodes.has(path)) continue;
      unknownTypeNodes.add(path);
      out.push(diagnostic('unknown-node-type', path, unknownTypeMessage(input, path, profile), nodeIdAt(input, path)));
      continue;
    }
    out.push(diagnostic('schema', path, schemaMessage(err), nodeIdAt(input, path)));
  }
  return out;
}
