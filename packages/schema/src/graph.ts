// Graph validator: the seven stages of Brief §3 in order (Req 7, 8, 9, 10, 11).
// Browser-safe: this file does not import `ajv`; stage 1 calls the generated validator.
// Graph walks are iterative. Exceptions are not caught here: a throw is a bug that the
// property tests are meant to find, and callers fail closed.

import { mapSchemaErrors } from './ajv-errors.ts';
import type { Cond, Effect, Manifest, ManifestNode, Scalar, ValidManifest, VarDecl } from './contracts.ts';
import { severityOf, sortDiagnostics, type Diagnostic, type DiagnosticCode, type Stage } from './diagnostics.ts';
import { HARD_LIMITS } from './ids.ts';
import type { GraphCtx, NodeTypeDescriptor, ProfileDescriptor, ValueType } from './node-type.ts';
import { parseManifestText } from './parse.ts';
import { checkHttpsUrl } from './url.ts';

export type ValidationResult =
  | { ok: true; manifest: ValidManifest; diagnostics: Diagnostic[] } // warnings only
  | { ok: false; diagnostics: Diagnostic[] }; // at least one error

/**
 * Lookups built once after stage 1, shared by stages 2–7. Maps keep the first index of each ID;
 * stage 3 reports the duplicates, so from stage 4 on every ID maps to exactly one entry.
 */
export interface GraphIndex {
  /** Node ID → index in `manifest.nodes`. */
  readonly nodeIndex: ReadonlyMap<string, number>;
  /** Variable ID → declaration. */
  readonly variables: ReadonlyMap<string, VarDecl>;
  /** Node type name → descriptor of the profile. */
  readonly nodeTypes: ReadonlyMap<string, NodeTypeDescriptor>;
}

/** A stage after stage 1: runs on a schema-valid manifest. */
type GraphStage = (manifest: Manifest, index: GraphIndex, profile: ProfileDescriptor) => Diagnostic[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function diag(stage: Stage, code: DiagnosticCode, path: string, message: string, nodeId?: string): Diagnostic {
  const base = { severity: severityOf(code), stage, code, path, message };
  return nodeId === undefined ? base : { ...base, nodeId };
}

/** Escapes one JSON Pointer reference token (RFC 6901). */
function pointerToken(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Own property of an object, or `undefined`. Never reads inherited properties. */
function own(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined;
}

function hasError(list: readonly Diagnostic[]): boolean {
  return list.some((d) => d.severity === 'error');
}

/** Re-derives each severity from its code, so node-type diagnostics follow Req 7.10 too. */
function withSeverity(list: readonly Diagnostic[]): Diagnostic[] {
  return list.map((d) => (d.severity === severityOf(d.code) ? d : { ...d, severity: severityOf(d.code) }));
}

function finish(list: readonly Diagnostic[]): Diagnostic[] {
  return sortDiagnostics(list).slice(0, HARD_LIMITS.maxDiagnostics);
}

function buildIndex(manifest: Manifest, profile: ProfileDescriptor): GraphIndex {
  const nodeIndex = new Map<string, number>();
  manifest.nodes.forEach((node, i) => {
    if (!nodeIndex.has(node.id)) nodeIndex.set(node.id, i);
  });
  const variables = new Map<string, VarDecl>();
  for (const v of manifest.variables) {
    if (!variables.has(v.id)) variables.set(v.id, v);
  }
  const nodeTypes = new Map<string, NodeTypeDescriptor>();
  for (const nt of profile.nodeTypes) {
    if (!nodeTypes.has(nt.type)) nodeTypes.set(nt.type, nt);
  }
  return { nodeIndex, variables, nodeTypes };
}

/** Visits every leaf of a condition iteratively, with the leaf's JSON Pointer. */
function forEachLeaf(
  when: Cond,
  path: string,
  visit: (leaf: Extract<Cond, { ref: unknown }>, leafPath: string) => void,
): void {
  const stack: Array<{ cond: Cond; path: string }> = [{ cond: when, path }];
  while (stack.length > 0) {
    const { cond, path: p } = stack.pop()!;
    // Narrow on the field, not on `op`: `op` is a union of literals in two variants.
    if ('args' in cond) {
      // Push in reverse so that leaves are visited in document order.
      for (let i = cond.args.length - 1; i >= 0; i--) {
        const arg = cond.args[i];
        if (arg !== undefined) stack.push({ cond: arg, path: `${p}/args/${i}` });
      }
    } else if ('arg' in cond) {
      stack.push({ cond: cond.arg, path: `${p}/arg` });
    } else {
      visit(cond, p);
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 1: schema (Req 8.1–8.3)
// ---------------------------------------------------------------------------

function stageSchema(input: unknown, profile: ProfileDescriptor): Diagnostic[] {
  const out: Diagnostic[] = [];
  const declared = own(input, 'profile');
  const mismatch = declared !== undefined && declared !== profile.id;
  if (mismatch) {
    const shown = typeof declared === 'string' ? `"${declared}"` : 'a value that is not a string';
    out.push(
      diag(
        'schema',
        'profile-mismatch',
        '/profile',
        `The manifest names profile ${shown}, but it is being checked against profile "${profile.id}".`,
      ),
    );
  }

  if (profile.validateSchema(input)) return out;

  // `profile-mismatch` replaces the Ajv errors on `/profile` itself (its `const`/`type` errors).
  const errors = (profile.validateSchema.errors ?? []).filter((e) => !(mismatch && e.instancePath === '/profile'));
  out.push(...mapSchemaErrors(errors, input, profile));
  if (!hasError(out)) {
    // The generated validator rejected the input without an error we could map: fail closed.
    out.push(diag('schema', 'schema', '', 'The manifest does not match the schema.'));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 2: caps (Req 8.4–8.6)
// ---------------------------------------------------------------------------

function stageCaps(manifest: Manifest): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { maxNodes, maxTransitions } = manifest.limits;
  if (maxNodes > HARD_LIMITS.maxNodes) {
    out.push(
      diag('caps', 'node-cap', '/limits/maxNodes', `limits.maxNodes is ${maxNodes}; the hard limit is ${HARD_LIMITS.maxNodes}.`),
    );
  }
  if (manifest.nodes.length > maxNodes) {
    out.push(
      diag(
        'caps',
        'node-cap',
        '/nodes',
        `The manifest has ${manifest.nodes.length} nodes, more than its limits.maxNodes of ${maxNodes}.`,
      ),
    );
  }
  if (maxTransitions > HARD_LIMITS.maxTransitions) {
    out.push(
      diag(
        'caps',
        'transition-cap',
        '/limits/maxTransitions',
        `limits.maxTransitions is ${maxTransitions}; the hard limit is ${HARD_LIMITS.maxTransitions}.`,
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 3: ids (Req 9.1, 9.2)
// ---------------------------------------------------------------------------

function stageIds(manifest: Manifest): Diagnostic[] {
  const out: Diagnostic[] = [];
  const firstNode = new Map<string, number>();
  manifest.nodes.forEach((node, i) => {
    const first = firstNode.get(node.id);
    if (first === undefined) {
      firstNode.set(node.id, i);
      return;
    }
    out.push(
      diag(
        'ids',
        'duplicate-node-id',
        `/nodes/${i}/id`,
        `Node ID "${node.id}" is already used by the node at /nodes/${first}.`,
        node.id,
      ),
    );
  });
  const firstVar = new Map<string, number>();
  manifest.variables.forEach((v, i) => {
    const first = firstVar.get(v.id);
    if (first === undefined) {
      firstVar.set(v.id, i);
      return;
    }
    out.push(
      diag(
        'ids',
        'duplicate-var-id',
        `/variables/${i}/id`,
        `Variable ID "${v.id}" is already declared at /variables/${first}.`,
      ),
    );
  });
  return out;
}

// ---------------------------------------------------------------------------
// Stage 4: refs (Req 9.3–9.8)
// ---------------------------------------------------------------------------

function checkNodeRefs(node: ManifestNode, n: number, index: GraphIndex, out: Diagnostic[]): void {
  node.edges.forEach((edge, e) => {
    const edgePath = `/nodes/${n}/edges/${e}`;
    if (!index.nodeIndex.has(edge.to)) {
      out.push(
        diag('refs', 'dangling-ref', `${edgePath}/to`, `The edge at ${edgePath} goes to node "${edge.to}", which does not exist.`, node.id),
      );
    }
    if (edge.when === undefined) return;
    forEachLeaf(edge.when, `${edgePath}/when`, (leaf, leafPath) => {
      const ref = leaf.ref;
      if ('answer' in ref) {
        if (!index.nodeIndex.has(ref.answer)) {
          out.push(
            diag(
              'refs',
              'dangling-ref',
              `${leafPath}/ref/answer`,
              `The condition at ${leafPath} reads the answer of node "${ref.answer}", which does not exist.`,
              node.id,
            ),
          );
        }
      } else if (!index.variables.has(ref.var)) {
        out.push(
          diag(
            'refs',
            'undeclared-var',
            `${leafPath}/ref/var`,
            `The condition at ${leafPath} reads variable "${ref.var}", which is not declared.`,
            node.id,
          ),
        );
      }
    });
  });
}

function checkRequires(manifest: Manifest, index: GraphIndex, profile: ProfileDescriptor, out: Diagnostic[]): void {
  const requires = manifest.requires;
  // Used node types, each with the first node that uses it.
  const used = new Map<string, ManifestNode>();
  for (const node of manifest.nodes) {
    if (!used.has(node.type)) used.set(node.type, node);
  }

  for (const [type, node] of used) {
    if (!Object.hasOwn(requires, type)) {
      out.push(
        diag(
          'refs',
          'requires-missing',
          '/requires',
          `Node type "${type}" is used (first by node "${node.id}") but is not listed in requires.`,
          node.id,
        ),
      );
    }
  }

  for (const type of Object.keys(requires)) {
    const path = `/requires/${pointerToken(type)}`;
    const version = requires[type];
    const nt = index.nodeTypes.get(type);
    if (nt === undefined) {
      out.push(diag('refs', 'requires-unknown', path, `requires names node type "${type}", which profile "${profile.id}" does not have.`));
      continue;
    }
    if (version !== nt.version) {
      out.push(
        diag(
          'refs',
          'requires-version',
          path,
          `requires asks for version ${String(version)} of node type "${type}"; profile "${profile.id}" supports version ${nt.version}.`,
        ),
      );
    }
    if (!used.has(type)) {
      out.push(diag('refs', 'requires-unused', path, `requires lists node type "${type}", but no node uses it.`));
    }
  }
}

function stageRefs(manifest: Manifest, index: GraphIndex, profile: ProfileDescriptor): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (!index.nodeIndex.has(manifest.entryNodeId)) {
    out.push(
      diag('refs', 'dangling-ref', '/entryNodeId', `entryNodeId names node "${manifest.entryNodeId}", which does not exist.`),
    );
  }
  if (!index.nodeIndex.has(manifest.fallbackOutcomeId)) {
    out.push(
      diag(
        'refs',
        'dangling-ref',
        '/fallbackOutcomeId',
        `fallbackOutcomeId names node "${manifest.fallbackOutcomeId}", which does not exist.`,
      ),
    );
  }
  manifest.nodes.forEach((node, n) => checkNodeRefs(node, n, index, out));
  checkRequires(manifest, index, profile, out);
  return out;
}

// ---------------------------------------------------------------------------
// Stage 5: dag (Req 10.1)
// ---------------------------------------------------------------------------

const WHITE = 0; // not visited
const GRAY = 1; // on the DFS stack
const BLACK = 2; // finished

/** Longest cycle listing in a `cycle` message; longer cycles are cut with a count. */
const MAX_CYCLE_IDS_SHOWN = 10;

function describeCycle(ids: readonly string[]): string {
  const shown = ids.slice(0, MAX_CYCLE_IDS_SHOWN).map((id) => `"${id}"`);
  const first = ids[0] ?? '';
  if (ids.length > MAX_CYCLE_IDS_SHOWN) return `${shown.join(' → ')} → … (${ids.length} nodes) → "${first}"`;
  return `${shown.join(' → ')} → "${first}"`;
}

/**
 * Iterative three-color DFS from every unvisited node in document order. Each back edge
 * (an edge to a node still on the stack) closes one cycle: the stack from the target up to
 * the edge's source. A back edge is reported once per (source, target) pair, at the edge itself.
 */
function stageDag(manifest: Manifest, index: GraphIndex): Diagnostic[] {
  const out: Diagnostic[] = [];
  const nodes = manifest.nodes;
  const n = nodes.length;
  const color = new Uint8Array(n);
  const stackPos = new Int32Array(n).fill(-1);
  const reported = new Set<number>();

  for (let root = 0; root < n; root++) {
    if (color[root] !== WHITE) continue;
    const stack: Array<{ node: number; next: number }> = [{ node: root, next: 0 }];
    color[root] = GRAY;
    stackPos[root] = 0;
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const edges = nodes[top.node]!.edges;
      if (top.next >= edges.length) {
        color[top.node] = BLACK;
        stackPos[top.node] = -1;
        stack.pop();
        continue;
      }
      const e = top.next++;
      const to = index.nodeIndex.get(edges[e]!.to);
      if (to === undefined) continue; // stage 4 reports dangling targets
      if (color[to] === WHITE) {
        color[to] = GRAY;
        stackPos[to] = stack.length;
        stack.push({ node: to, next: 0 });
      } else if (color[to] === GRAY) {
        const key = top.node * n + to;
        if (reported.has(key)) continue;
        reported.add(key);
        const cycle = stack.slice(stackPos[to]!).map((f) => nodes[f.node]!.id);
        const from = nodes[top.node]!.id;
        out.push(
          diag(
            'dag',
            'cycle',
            `/nodes/${top.node}/edges/${e}`,
            `The edge at /nodes/${top.node}/edges/${e} from node "${from}" closes the cycle ${describeCycle(cycle)}.`,
            from,
          ),
        );
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 6: terminal (Req 10.2–10.8). Runs only after stage 5 passed, so the graph is a DAG.
// ---------------------------------------------------------------------------

/** Edge targets of each node as node indices; dangling targets (reported by stage 4) are skipped. */
function successorLists(manifest: Manifest, index: GraphIndex): number[][] {
  return manifest.nodes.map((node) => {
    const list: number[] = [];
    for (const edge of node.edges) {
      const to = index.nodeIndex.get(edge.to);
      if (to !== undefined) list.push(to);
    }
    return list;
  });
}

/** Node indices reachable from `starts` along `adjacency` (iterative BFS). */
function reachable(adjacency: readonly (readonly number[])[], starts: readonly number[]): Uint8Array {
  const seen = new Uint8Array(adjacency.length);
  const queue: number[] = [];
  for (const s of starts) {
    if (seen[s] === 0) {
      seen[s] = 1;
      queue.push(s);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    for (const v of adjacency[queue[head]!]!) {
      if (seen[v] === 0) {
        seen[v] = 1;
        queue.push(v);
      }
    }
  }
  return seen;
}

/** Kahn's algorithm; `undefined` if the graph has a cycle. */
function topologicalOrder(successors: readonly (readonly number[])[]): number[] | undefined {
  const n = successors.length;
  const inDegree = new Int32Array(n);
  for (const list of successors) for (const v of list) inDegree[v] = inDegree[v]! + 1;
  const order: number[] = [];
  for (let i = 0; i < n; i++) if (inDegree[i] === 0) order.push(i);
  for (let head = 0; head < order.length; head++) {
    for (const v of successors[order[head]!]!) {
      const left = inDegree[v]! - 1;
      inDegree[v] = left;
      if (left === 0) order.push(v);
    }
  }
  return order.length === n ? order : undefined;
}

/** Number of edges on the longest path from `entry` to a terminal node, or -1 if none. */
function longestPathToTerminal(
  successors: readonly (readonly number[])[],
  terminal: readonly boolean[],
  entry: number,
): number {
  const order = topologicalOrder(successors);
  if (order === undefined) return -1;
  const dist = new Int32Array(successors.length).fill(-1);
  dist[entry] = 0;
  let longest = -1;
  for (const u of order) {
    const d = dist[u]!;
    if (d < 0) continue;
    if (terminal[u] === true && d > longest) longest = d;
    for (const v of successors[u]!) {
      if (d + 1 > dist[v]!) dist[v] = d + 1;
    }
  }
  return longest;
}

function stageTerminal(manifest: Manifest, index: GraphIndex): Diagnostic[] {
  const out: Diagnostic[] = [];
  const nodes = manifest.nodes;
  const terminal = nodes.map((node) => index.nodeTypes.get(node.type)?.terminal === true);
  const successors = successorLists(manifest, index);

  // Per-node edge rules (Req 10.2–10.4).
  nodes.forEach((node, i) => {
    const edgesPath = `/nodes/${i}/edges`;
    const count = node.edges.length;
    if (terminal[i] === true && count > 0) {
      out.push(
        diag('terminal', 'terminal-has-edges', edgesPath, `Node "${node.id}" is a terminal "${node.type}" node but has ${count} edge(s).`, node.id),
      );
    }
    if (terminal[i] !== true && count === 0) {
      out.push(diag('terminal', 'dead-end', edgesPath, `Node "${node.id}" is not a terminal node and has no edges.`, node.id));
    }
    const last = node.edges[count - 1];
    if (last !== undefined && last.when !== undefined) {
      out.push(
        diag(
          'terminal',
          'last-edge-conditional',
          `${edgesPath}/${count - 1}/when`,
          `The last edge of node "${node.id}" has a condition; the last edge must have no "when" so that one edge always applies.`,
          node.id,
        ),
      );
    }
  });

  // Req 10.5.
  const fallback = index.nodeIndex.get(manifest.fallbackOutcomeId);
  if (fallback !== undefined && terminal[fallback] !== true) {
    out.push(
      diag(
        'terminal',
        'fallback-not-terminal',
        '/fallbackOutcomeId',
        `fallbackOutcomeId names node "${manifest.fallbackOutcomeId}", which is not a terminal node.`,
        manifest.fallbackOutcomeId,
      ),
    );
  }

  // Req 10.6: forward reachability from the entry node.
  const entry = index.nodeIndex.get(manifest.entryNodeId);
  const fromEntry = reachable(successors, entry === undefined ? [] : [entry]);
  // Req 10.7: reverse reachability from every terminal node.
  const predecessors: number[][] = nodes.map(() => []);
  successors.forEach((list, u) => {
    for (const v of list) predecessors[v]!.push(u);
  });
  const terminals: number[] = [];
  terminal.forEach((t, i) => {
    if (t) terminals.push(i);
  });
  const toTerminal = reachable(predecessors, terminals);
  nodes.forEach((node, i) => {
    if (fromEntry[i] === 0) {
      out.push(
        diag('terminal', 'unreachable-node', `/nodes/${i}`, `Node "${node.id}" cannot be reached from entryNodeId "${manifest.entryNodeId}".`, node.id),
      );
    }
    if (toTerminal[i] === 0) {
      out.push(diag('terminal', 'no-terminal-reachable', `/nodes/${i}`, `Node "${node.id}" has no path to a terminal node.`, node.id));
    }
  });

  // Req 10.8: longest entry-to-terminal path, in edges, over a topological order.
  if (entry !== undefined) {
    const longest = longestPathToTerminal(successors, terminal, entry);
    const max = manifest.limits.maxTransitions;
    if (longest > max) {
      out.push(
        diag(
          'terminal',
          'limit-below-longest-path',
          '/limits/maxTransitions',
          `limits.maxTransitions is ${max}, but the longest path from entryNodeId to a terminal node has ${longest} edges.`,
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 7: conditions (Req 11.2–11.9). Runs only after stage 6 passed, so the graph is a DAG
// and every node is reachable from the entry node.
// ---------------------------------------------------------------------------

/**
 * `dom[v][u] === 1` when node `u` lies on every path from `entry` to node `v` (`v` itself included).
 * Over a topological order each node's predecessors are final before the node, so one pass is
 * enough: dom(v) = {v} ∪ ⋂ dom(p) over the predecessors p reached from the entry. A node that the
 * entry does not reach keeps an empty set, so only its own answer counts as upstream.
 */
function dominators(successors: readonly (readonly number[])[], entry: number): Uint8Array[] {
  const n = successors.length;
  const dom = successors.map(() => new Uint8Array(n));
  const order = topologicalOrder(successors);
  if (order === undefined) return dom; // stage 5 rejects cycles; fail closed regardless
  const predecessors: number[][] = successors.map(() => []);
  successors.forEach((list, u) => {
    for (const v of list) predecessors[v]!.push(u);
  });
  const reached = new Uint8Array(n);
  for (const v of order) {
    const set = dom[v]!;
    if (v !== entry) {
      let first = true;
      for (const p of predecessors[v]!) {
        if (reached[p] === 0) continue;
        const pd = dom[p]!;
        if (first) {
          set.set(pd);
          first = false;
        } else {
          for (let i = 0; i < n; i++) if (pd[i] === 0) set[i] = 0;
        }
      }
      if (first) continue; // no reached predecessor
    }
    set[v] = 1;
    reached[v] = 1;
  }
  return dom;
}

function varValueType(decl: VarDecl): ValueType {
  switch (decl.type) {
    case 'number':
      return { kind: 'number' };
    case 'boolean':
      return { kind: 'boolean' };
    case 'enum':
      return { kind: 'enum', values: decl.values };
  }
}

/** Whether a leaf's `value` fits its op and the ref's type (Req 11.2). */
function leafTypeOk(op: 'eq' | 'gte' | 'lte' | 'includes', type: ValueType, value: Scalar): boolean {
  switch (op) {
    case 'gte':
    case 'lte':
      return type.kind === 'number' && typeof value === 'number';
    case 'includes':
      return type.kind === 'set' && typeof value === 'string' && type.values.includes(value);
    case 'eq':
      switch (type.kind) {
        case 'number':
          return typeof value === 'number';
        case 'boolean':
          return typeof value === 'boolean';
        case 'enum':
          return typeof value === 'string' && type.values.includes(value);
        case 'set':
          return false; // a set answer is an array and never equals a scalar; use `includes`
      }
  }
}

function expectation(op: 'eq' | 'gte' | 'lte' | 'includes', type: ValueType): string {
  if (op === 'gte' || op === 'lte') return `"${op}" needs a number ref and a number value`;
  if (op === 'includes') return '"includes" needs a set ref and a value from its values';
  if (type.kind === 'set') return '"eq" cannot compare a set ref; use "includes"';
  if (type.kind === 'enum') return `"eq" on an enum ref needs one of ${JSON.stringify(type.values)}`;
  return `"eq" on a ${type.kind} ref needs a ${type.kind} value`;
}

function checkLeaves(
  node: ManifestNode,
  n: number,
  manifest: Manifest,
  index: GraphIndex,
  dom: readonly Uint8Array[],
  out: Diagnostic[],
): void {
  node.edges.forEach((edge, e) => {
    if (edge.when === undefined) return;
    forEachLeaf(edge.when, `/nodes/${n}/edges/${e}/when`, (leaf, leafPath) => {
      const ref = leaf.ref;
      let type: ValueType | null | undefined;
      let refText: string;
      if ('answer' in ref) {
        refText = `the answer of node "${ref.answer}"`;
        const a = index.nodeIndex.get(ref.answer);
        if (a === undefined) return; // stage 4 reports dangling refs
        const target = manifest.nodes[a]!;
        const nt = index.nodeTypes.get(target.type);
        if (nt === undefined) return; // stage 1 rejects unknown node types
        if (a !== n && dom[n]![a] !== 1) {
          out.push(
            diag(
              'conditions',
              'answer-not-upstream',
              `${leafPath}/ref/answer`,
              `The condition at ${leafPath} reads the answer of node "${ref.answer}", which is not on every path from entryNodeId to node "${node.id}".`,
              node.id,
            ),
          );
        }
        type = nt.answerType(target.config);
        if (type === null) {
          out.push(
            diag(
              'conditions',
              'ref-not-answerable',
              `${leafPath}/ref/answer`,
              `The condition at ${leafPath} reads the answer of node "${ref.answer}", but "${target.type}" nodes have no answer.`,
              node.id,
            ),
          );
          return;
        }
      } else {
        refText = `variable "${ref.var}"`;
        const decl = index.variables.get(ref.var);
        if (decl === undefined) return; // stage 4 reports undeclared variables
        type = varValueType(decl);
      }
      if (!leafTypeOk(leaf.op, type, leaf.value)) {
        out.push(
          diag(
            'conditions',
            'type-mismatch',
            leafPath,
            `The condition at ${leafPath} compares ${refText} (${type.kind}) with ${JSON.stringify(leaf.value)}: ${expectation(leaf.op, type)}.`,
            node.id,
          ),
        );
      }
    });
  });
}

/** Req 11.5. */
function checkVarDecls(manifest: Manifest, out: Diagnostic[]): void {
  manifest.variables.forEach((v, i) => {
    const path = `/variables/${i}`;
    if (v.type === 'number') {
      if (v.min !== undefined && v.initial < v.min) {
        out.push(diag('conditions', 'var-decl-invalid', `${path}/initial`, `Variable "${v.id}" starts at ${v.initial}, below its min of ${v.min}.`));
      }
      if (v.max !== undefined && v.initial > v.max) {
        out.push(diag('conditions', 'var-decl-invalid', `${path}/initial`, `Variable "${v.id}" starts at ${v.initial}, above its max of ${v.max}.`));
      }
    } else if (v.type === 'enum') {
      if (v.values.length === 0) {
        out.push(diag('conditions', 'var-decl-invalid', `${path}/values`, `Enum variable "${v.id}" has no values.`));
      }
      const seen = new Set<string>();
      v.values.forEach((value, j) => {
        if (seen.has(value)) {
          out.push(
            diag('conditions', 'var-decl-invalid', `${path}/values/${j}`, `Enum variable "${v.id}" lists the value ${JSON.stringify(value)} more than once.`),
          );
        }
        seen.add(value);
      });
      if (!seen.has(v.initial)) {
        out.push(
          diag('conditions', 'var-decl-invalid', `${path}/initial`, `Enum variable "${v.id}" starts at ${JSON.stringify(v.initial)}, which is not one of its values.`),
        );
      }
    }
  });
}

/** `YYYY-MM-DD` naming a day that exists in the proleptic Gregorian calendar (Req 11.7). */
function isCalendarDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m === null) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

/** Why a `set` value does not fit the declared type, or `undefined` when it fits (Req 11.6). */
function setValueProblem(decl: VarDecl, value: Scalar): string | undefined {
  switch (decl.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'a number variable needs a number';
      if (decl.min !== undefined && value < decl.min) return `${value} is below its min of ${decl.min}`;
      if (decl.max !== undefined && value > decl.max) return `${value} is above its max of ${decl.max}`;
      return undefined;
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'a boolean variable needs true or false';
    case 'enum':
      return typeof value === 'string' && decl.values.includes(value)
        ? undefined
        : `an enum variable needs one of ${JSON.stringify(decl.values)}`;
  }
}

function checkEffect(effect: Effect, path: string, variables: ReadonlyMap<string, VarDecl>, nodeId: string): Diagnostic[] {
  const decl = variables.get(effect.var);
  if (decl === undefined) {
    return [diag('conditions', 'effect-invalid', path, `The effect at ${path} changes variable "${effect.var}", which is not declared.`, nodeId)];
  }
  if (effect.op === 'add') {
    if (decl.type === 'number') return [];
    return [
      diag('conditions', 'effect-invalid', path, `The "add" effect at ${path} targets ${decl.type} variable "${effect.var}"; "add" needs a number variable.`, nodeId),
    ];
  }
  const problem = setValueProblem(decl, effect.value);
  if (problem === undefined) return [];
  return [
    diag(
      'conditions',
      'effect-invalid',
      path,
      `The "set" effect at ${path} gives variable "${effect.var}" the value ${JSON.stringify(effect.value)}: ${problem}.`,
      nodeId,
    ),
  ];
}

function checkText(text: string, path: string, nodeId: string): Diagnostic[] {
  if (text.trim() !== '') return [];
  return [diag('conditions', 'blank-text', path, `The text at ${path} is empty or only whitespace.`, nodeId)];
}

function withNodeId(list: readonly Diagnostic[], nodeId: string): Diagnostic[] {
  return list.map((d) => (d.nodeId === undefined ? { ...d, nodeId } : d));
}

/** Stage 7 (`conditions`): typed conditions, variable declarations, dates and node-type checks (Req 11). */
function stageConditions(manifest: Manifest, index: GraphIndex): Diagnostic[] {
  const out: Diagnostic[] = [];
  checkVarDecls(manifest, out);

  if (manifest.validUntil !== undefined && !isCalendarDate(manifest.validUntil)) {
    out.push(diag('conditions', 'invalid-date', '/validUntil', `validUntil "${manifest.validUntil}" is not a real calendar date.`));
  }

  const successors = successorLists(manifest, index);
  const entry = index.nodeIndex.get(manifest.entryNodeId);
  const dom = entry === undefined ? successors.map(() => new Uint8Array(successors.length)) : dominators(successors, entry);

  manifest.nodes.forEach((node, n) => {
    checkLeaves(node, n, manifest, index, dom, out);
    const nt = index.nodeTypes.get(node.type);
    if (nt === undefined) return; // stage 1 rejects unknown node types
    const ctx: GraphCtx = {
      manifest,
      nodePath: `/nodes/${n}`,
      variables: index.variables,
      checkEffect: (effect, path) => checkEffect(effect, path, index.variables, node.id),
      checkHttpsUrl: (url, path) => withNodeId(checkHttpsUrl(url, path), node.id),
      checkText: (text, path) => checkText(text, path, node.id),
    };
    out.push(...withNodeId(nt.validate(node.config, ctx), node.id));
  });
  return out;
}

/** Stages 2–7 in Brief §3 order (Req 7.1). */
const GRAPH_STAGES: readonly GraphStage[] = [
  (m) => stageCaps(m),
  (m) => stageIds(m),
  stageRefs,
  stageDag,
  stageTerminal,
  stageConditions,
];

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Runs the seven stages in order and stops after the first stage that reports an error;
 * warnings from earlier stages stay in the result. Returns at most 50 sorted diagnostics.
 * Does not mutate `input`.
 */
export function validateManifest(input: unknown, profile: ProfileDescriptor): ValidationResult {
  const collected: Diagnostic[] = withSeverity(stageSchema(input, profile));
  if (hasError(collected)) return { ok: false, diagnostics: finish(collected) };

  // Stage 1 passed, so `input` has the composed manifest shape.
  const manifest = input as Manifest;
  const index = buildIndex(manifest, profile);
  for (const stage of GRAPH_STAGES) {
    const found = withSeverity(stage(manifest, index, profile));
    collected.push(...found);
    if (hasError(found)) return { ok: false, diagnostics: finish(collected) };
  }
  return { ok: true, manifest: manifest as ValidManifest, diagnostics: finish(collected) };
}

/** Parses with the 64 KB cap first; `parse` diagnostics are returned without running stages 1–7. */
export function validateManifestText(text: string, profile: ProfileDescriptor): ValidationResult {
  const parsed = parseManifestText(text);
  if (!parsed.ok) return { ok: false, diagnostics: finish(withSeverity(parsed.diagnostics)) };
  return validateManifest(parsed.value, profile);
}
