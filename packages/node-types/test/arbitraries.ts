// Shared fast-check arbitraries for the runtime-core property tests (design "Correctness
// Properties", Req 18.11). Not a test file: Vitest only collects `*.test.ts`.
//
// The valid-manifest arbitrary draws a plain "recipe" of numbers and flags and turns it into a
// manifest with a pure builder, so shrinking works on the recipe. The builder:
// - orders node IDs (`n00`, `n01`, ...) and adds edges only from a lower to a higher position, so
//   the graph is acyclic and every path ends in an `outcome` (outcomes take the last positions);
// - gives every node after the entry a parent edge, so every node is reachable from `entryNodeId`;
// - makes the last edge of each node unconditional;
// - uses in conditions only variables and the answers of `choice` nodes that dominate the node
//   (including the node's own answer);
// - declares a bounded and an unbounded `number` variable, and `add` effects up to ±25, which
//   cross the bounded variable's range of at most 12;
// - sets `requires` to exactly the node types used and `limits.maxTransitions` to at least the
//   longest entry-to-outcome path.
// A passing property run over these manifests is evidence for that property, not a proof.

import fc from 'fast-check';
import {
  validateManifest,
  type Cond,
  type DiagnosticCode,
  type Edge,
  type Effect,
  type Manifest,
  type ManifestNode,
  type Stage,
  type VarDecl,
} from '@dreame/schema';
import {
  checkAction,
  createAttempt,
  createRuntime,
  reduce,
  type Action,
  type AttemptState,
  type Runtime,
} from '@dreame/runtime';
import { coreProfile, type ChoiceConfig, type ContentConfig, type OutcomeConfig } from '../src/index.ts';

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export type CondRecipe =
  | { readonly k: 'leaf'; readonly ref: number; readonly op: number; readonly value: number }
  | { readonly k: 'and' | 'or'; readonly args: readonly CondRecipe[] }
  | { readonly k: 'not'; readonly arg: CondRecipe };

export interface EffectRecipe {
  readonly add: boolean;
  readonly var: number;
  readonly value: number;
}

export interface NonTerminalRecipe {
  readonly kind: 'content' | 'choice';
  readonly title: boolean;
  readonly optionCount: number;
  readonly effects: readonly (readonly EffectRecipe[])[];
  readonly shuffle: boolean;
  readonly parent: number;
  readonly extras: readonly number[];
  readonly conds: readonly CondRecipe[];
}

export interface OutcomeRecipe {
  readonly parent: number;
  readonly cta: boolean;
  readonly url: number;
}

export interface ExtraVarRecipe {
  readonly kind: 'number' | 'boolean' | 'enum';
  readonly hasMin: boolean;
  readonly hasMax: boolean;
  readonly low: number;
  readonly span: number;
  readonly offset: number;
  readonly enumCount: number;
  readonly flag: boolean;
}

export interface ManifestRecipe {
  readonly nonTerminals: readonly NonTerminalRecipe[];
  readonly outcomes: readonly OutcomeRecipe[];
  readonly bounded: { readonly low: number; readonly span: number; readonly offset: number };
  readonly unboundedInitial: number;
  readonly extraVars: readonly ExtraVarRecipe[];
  readonly fallback: number;
  readonly transitionSlack: number;
  readonly nodeSlack: number;
  readonly version: number;
}

const leafRecipeArb: fc.Arbitrary<CondRecipe> = fc.record({
  k: fc.constant('leaf' as const),
  ref: fc.nat(),
  op: fc.nat(),
  value: fc.integer({ min: -40, max: 40 }),
});

/** Condition recipes nest at most 3 levels below the root, so a built `Cond` has depth ≤ 4 (cap 8). */
export const condRecipeArb: fc.Arbitrary<CondRecipe> = fc.letrec<{ cond: CondRecipe }>((tie) => ({
  cond: fc.oneof(
    { maxDepth: 3, depthSize: 'small' },
    leafRecipeArb,
    fc.record({
      k: fc.constantFrom('and' as const, 'or' as const),
      args: fc.array(tie('cond'), { minLength: 1, maxLength: 3 }),
    }),
    fc.record({ k: fc.constant('not' as const), arg: tie('cond') }),
  ),
})).cond;

const effectRecipeArb: fc.Arbitrary<EffectRecipe> = fc.record({
  add: fc.boolean(),
  var: fc.nat(),
  value: fc.integer({ min: -25, max: 25 }),
});

const nonTerminalRecipeArb: fc.Arbitrary<NonTerminalRecipe> = fc.record({
  kind: fc.constantFrom('content' as const, 'choice' as const),
  title: fc.boolean(),
  optionCount: fc.integer({ min: 2, max: 4 }),
  effects: fc.array(fc.array(effectRecipeArb, { maxLength: 2 }), { maxLength: 4 }),
  shuffle: fc.boolean(),
  parent: fc.nat(),
  extras: fc.array(fc.nat(), { maxLength: 2 }),
  conds: fc.array(condRecipeArb, { minLength: 1, maxLength: 3 }),
});

const outcomeRecipeArb: fc.Arbitrary<OutcomeRecipe> = fc.record({
  parent: fc.nat(),
  cta: fc.boolean(),
  url: fc.nat(),
});

const extraVarRecipeArb: fc.Arbitrary<ExtraVarRecipe> = fc.record({
  kind: fc.constantFrom('number' as const, 'boolean' as const, 'enum' as const),
  hasMin: fc.boolean(),
  hasMax: fc.boolean(),
  low: fc.integer({ min: -10, max: 0 }),
  span: fc.integer({ min: 0, max: 15 }),
  offset: fc.integer({ min: 0, max: 15 }),
  enumCount: fc.integer({ min: 1, max: 3 }),
  flag: fc.boolean(),
});

/** 1–9 non-terminal nodes and 1–3 outcomes, so 2–12 nodes in total. */
export const manifestRecipeArb: fc.Arbitrary<ManifestRecipe> = fc.record({
  nonTerminals: fc.array(nonTerminalRecipeArb, { minLength: 1, maxLength: 9 }),
  outcomes: fc.array(outcomeRecipeArb, { minLength: 1, maxLength: 3 }),
  bounded: fc.record({
    low: fc.integer({ min: -10, max: 0 }),
    span: fc.integer({ min: 1, max: 12 }),
    offset: fc.nat(),
  }),
  unboundedInitial: fc.integer({ min: -20, max: 20 }),
  extraVars: fc.array(extraVarRecipeArb, { maxLength: 3 }),
  fallback: fc.nat(),
  transitionSlack: fc.integer({ min: 0, max: 3 }),
  nodeSlack: fc.integer({ min: 0, max: 5 }),
  version: fc.integer({ min: 1, max: 9 }),
});

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** URLs that pass `checkHttpsUrl`. */
export const SAFE_CTA_URLS: readonly string[] = [
  'https://wa.me/15550001111',
  'https://example.com/shop',
  'https://shop.example.org/bundle?ref=quiz',
];

/** Variable IDs the builder always declares. */
export const BOUNDED_VAR_ID = 'b0';
export const UNBOUNDED_VAR_ID = 'u0';

function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

function at<T>(xs: readonly T[], i: number): T {
  const x = xs[i];
  if (x === undefined) throw new Error(`arbitraries: index ${i} out of range (length ${xs.length})`);
  return x;
}

export function nodeIdAt(position: number): string {
  return `n${String(position).padStart(2, '0')}`;
}

function buildVariables(r: ManifestRecipe): VarDecl[] {
  const b = r.bounded;
  const vars: VarDecl[] = [
    { id: BOUNDED_VAR_ID, type: 'number', initial: b.low + mod(b.offset, b.span + 1), min: b.low, max: b.low + b.span },
    { id: UNBOUNDED_VAR_ID, type: 'number', initial: r.unboundedInitial },
  ];
  r.extraVars.forEach((x, i) => {
    const id = `v${i}`;
    if (x.kind === 'boolean') {
      vars.push({ id, type: 'boolean', initial: x.flag });
    } else if (x.kind === 'enum') {
      const values = Array.from({ length: x.enumCount }, (_, j) => `e${j}`);
      vars.push({ id, type: 'enum', initial: at(values, x.offset % values.length), values });
    } else {
      const high = x.low + x.span;
      const initial = x.hasMin && x.hasMax ? x.low + mod(x.offset, x.span + 1) : x.hasMax ? high - x.offset : x.low + x.offset;
      vars.push({
        id,
        type: 'number',
        initial,
        ...(x.hasMin ? { min: x.low } : {}),
        ...(x.hasMax ? { max: high } : {}),
      });
    }
  });
  return vars;
}

function buildEffect(e: EffectRecipe, vars: readonly VarDecl[]): Effect {
  const decl = at(vars, e.var % vars.length);
  if (decl.type === 'number') {
    if (e.add) return { op: 'add', var: decl.id, value: e.value };
    const lo = decl.min ?? -50;
    const hi = decl.max ?? 50;
    return { op: 'set', var: decl.id, value: lo + mod(e.value, hi - lo + 1) };
  }
  if (decl.type === 'boolean') return { op: 'set', var: decl.id, value: mod(e.value, 2) === 0 };
  return { op: 'set', var: decl.id, value: at(decl.values, mod(e.value, decl.values.length)) };
}

type RefCandidate = { kind: 'answer'; nodeId: string; optionIds: readonly string[] } | { kind: 'var'; decl: VarDecl };

function buildCond(c: CondRecipe, candidates: readonly RefCandidate[]): Cond {
  if (c.k !== 'leaf') {
    if (c.k === 'not') return { op: 'not', arg: buildCond(c.arg, candidates) };
    return { op: c.k, args: c.args.map((a) => buildCond(a, candidates)) };
  }
  const ref = at(candidates, c.ref % candidates.length);
  if (ref.kind === 'answer') {
    return { op: 'eq', ref: { answer: ref.nodeId }, value: at(ref.optionIds, mod(c.value, ref.optionIds.length)) };
  }
  const decl = ref.decl;
  if (decl.type === 'number') {
    const op = at(['eq', 'gte', 'lte'] as const, c.op % 3);
    return { op, ref: { var: decl.id }, value: c.value };
  }
  if (decl.type === 'boolean') return { op: 'eq', ref: { var: decl.id }, value: mod(c.value, 2) === 0 };
  return { op: 'eq', ref: { var: decl.id }, value: at(decl.values, mod(c.value, decl.values.length)) };
}

/** Number of edges on the longest path from position 0 to an outcome (`targets` are forward-only). */
function longestPath(targets: readonly (readonly number[])[], n: number): number {
  const dist = new Array<number>(n).fill(-1);
  dist[0] = 0;
  let longest = 0;
  for (let i = 0; i < n; i++) {
    const d = at(dist, i);
    if (d < 0) continue;
    if (d > longest) longest = d;
    for (const t of targets[i] ?? []) {
      if (d + 1 > at(dist, t)) dist[t] = d + 1;
    }
  }
  return longest;
}

/** Pure builder from a recipe to a manifest that `validateManifest(…, coreProfile)` accepts. */
export function buildManifest(r: ManifestRecipe): Manifest {
  const t = r.nonTerminals.length;
  const k = r.outcomes.length;
  const n = t + k;
  const ids = Array.from({ length: n }, (_, i) => nodeIdAt(i));
  const variables = buildVariables(r);

  // Forward edge targets per non-terminal: parent edges first (reachability), then extras.
  const targetSets: Set<number>[] = Array.from({ length: t }, () => new Set<number>());
  for (let j = 1; j < n; j++) {
    const parentRaw = j < t ? at(r.nonTerminals, j).parent : at(r.outcomes, j - t).parent;
    const parent = parentRaw % Math.min(j, t);
    at(targetSets, parent).add(j);
  }
  r.nonTerminals.forEach((node, i) => {
    const set = at(targetSets, i);
    for (const x of node.extras) set.add(i + 1 + (x % (n - 1 - i)));
    if (set.size === 0) set.add(i + 1);
  });
  const targets = targetSets.map((s) => [...s]);

  // Dominators over the forward DAG, in position order (a topological order).
  const preds: number[][] = Array.from({ length: n }, () => []);
  targets.forEach((list, i) => {
    for (const j of list) at(preds, j).push(i);
  });
  const dom: Set<number>[] = [];
  for (let j = 0; j < n; j++) {
    const ps = at(preds, j);
    let d: Set<number>;
    if (ps.length === 0) {
      d = new Set<number>();
    } else {
      d = new Set(at(dom, at(ps, 0)));
      for (const p of ps.slice(1)) {
        const other = at(dom, p);
        for (const x of [...d]) if (!other.has(x)) d.delete(x);
      }
    }
    d.add(j);
    dom.push(d);
  }

  const optionIdsOf = (i: number): string[] => {
    const rec = at(r.nonTerminals, i);
    return Array.from({ length: rec.optionCount }, (_, j) => `o${j}`);
  };

  const nodes: ManifestNode[] = [];
  r.nonTerminals.forEach((rec, i) => {
    const candidates: RefCandidate[] = [];
    for (const p of [...at(dom, i)].sort((a, b) => a - b)) {
      if (at(r.nonTerminals, p).kind === 'choice') candidates.push({ kind: 'answer', nodeId: at(ids, p), optionIds: optionIdsOf(p) });
    }
    for (const decl of variables) candidates.push({ kind: 'var', decl });

    const list = at(targets, i);
    const edges: Edge[] = list.map((to, e) =>
      e === list.length - 1 ? { to: at(ids, to) } : { to: at(ids, to), when: buildCond(at(rec.conds, e % rec.conds.length), candidates) },
    );

    if (rec.kind === 'content') {
      const config: ContentConfig = { body: `Read step ${i + 1}.`, ...(rec.title ? { title: `Step ${i + 1}` } : {}) };
      nodes.push({ id: at(ids, i), type: 'content', config, edges });
    } else {
      const config: ChoiceConfig = {
        prompt: `Question ${i + 1}?`,
        options: optionIdsOf(i).map((id, j) => {
          const effects = (rec.effects[j] ?? []).map((e) => buildEffect(e, variables));
          return { id, label: `Option ${j + 1}`, ...(effects.length > 0 ? { effects } : {}) };
        }),
        ...(rec.shuffle ? { shuffle: true } : {}),
      };
      nodes.push({ id: at(ids, i), type: 'choice', config, edges });
    }
  });
  r.outcomes.forEach((rec, j) => {
    const config: OutcomeConfig = {
      title: `Result ${j + 1}`,
      body: `You reached result ${j + 1}.`,
      ...(rec.cta ? { cta: { label: 'Open', url: at(SAFE_CTA_URLS, rec.url % SAFE_CTA_URLS.length) } } : {}),
    };
    nodes.push({ id: at(ids, t + j), type: 'outcome', config, edges: [] });
  });

  const requires: Record<string, number> = {};
  for (const type of ['content', 'choice', 'outcome']) {
    if (nodes.some((node) => node.type === type)) requires[type] = 1;
  }

  return {
    schemaVersion: 1,
    profile: 'core',
    activityId: 'generated-activity',
    version: r.version,
    requires,
    entryNodeId: at(ids, 0),
    fallbackOutcomeId: at(ids, t + (r.fallback % k)),
    limits: { maxNodes: Math.min(200, n + r.nodeSlack), maxTransitions: longestPath(targets, n) + r.transitionSlack },
    variables,
    nodes,
    theme: 'default',
  };
}

/** Valid manifests for the `core` profile (2–12 nodes). */
export const validManifestArb: fc.Arbitrary<Manifest> = manifestRecipeArb.map(buildManifest);

/** Validates `m` against `coreProfile` and builds a runtime; throws if validation fails. */
export function runtimeFor(m: Manifest): Runtime {
  const result = validateManifest(m, coreProfile);
  if (!result.ok) {
    const first = result.diagnostics[0];
    throw new Error(`runtimeFor: manifest is not valid: ${first === undefined ? 'no diagnostics' : `${first.stage}/${first.code} ${first.message}`}`);
  }
  return createRuntime(coreProfile, result.manifest);
}

// ---------------------------------------------------------------------------
// Defect injectors (Property 5)
// ---------------------------------------------------------------------------

export type DefectKind = 'dangling-ref' | 'duplicate-node-id' | 'cycle' | 'dead-end' | 'type-mismatch' | 'unsafe-url';

export interface Defect {
  readonly kind: DefectKind;
  readonly stage: Stage;
  readonly code: DiagnosticCode;
  /** Returns a changed copy of `m`; `m` is not modified. `pick` chooses the affected node. */
  readonly inject: (m: Manifest, pick: number) => Manifest;
}

/** A node ID the builder never produces. */
export const MISSING_NODE_ID = 'zzMissing';

/**
 * CTA URLs that `checkHttpsUrl` rejects. They all start with `https://` because the outcome
 * config schema has the pattern `^https://`, so a `javascript:`, `http:` or `data:` URL stops at
 * the `schema` stage before `conditions/unsafe-url` can be reported.
 */
export const UNSAFE_CTA_URLS: readonly string[] = [
  'https://bit.ly/abc123',
  'https://www.tinyurl.com/x',
  'https://user:secret@example.com/',
  'https://',
];

function copy(m: Manifest): Manifest {
  return JSON.parse(JSON.stringify(m)) as Manifest;
}

/** Index of a node with edges (a non-terminal), chosen by `pick`. */
function pickNonTerminal(m: Manifest, pick: number): number {
  const indices = m.nodes.flatMap((node, i) => (node.edges.length > 0 ? [i] : []));
  return at(indices, pick % indices.length);
}

function pickOutcome(m: Manifest, pick: number): number {
  const indices = m.nodes.flatMap((node, i) => (node.type === 'outcome' ? [i] : []));
  return at(indices, pick % indices.length);
}

function lastEdge(node: ManifestNode): Edge {
  return at(node.edges, node.edges.length - 1);
}

export const DEFECTS: Readonly<Record<DefectKind, Defect>> = {
  'dangling-ref': {
    kind: 'dangling-ref',
    stage: 'refs',
    code: 'dangling-ref',
    inject(m, pick) {
      const out = copy(m);
      lastEdge(at(out.nodes, pickNonTerminal(out, pick))).to = MISSING_NODE_ID;
      return out;
    },
  },
  'duplicate-node-id': {
    kind: 'duplicate-node-id',
    stage: 'ids',
    code: 'duplicate-node-id',
    inject(m, pick) {
      const out = copy(m);
      const n = out.nodes.length;
      const i = pick % n;
      const j = (i + 1 + (Math.floor(pick / n) % (n - 1))) % n;
      at(out.nodes, j).id = at(out.nodes, i).id;
      return out;
    },
  },
  // Every node is reachable from the entry along nodes at lower positions, so pointing a node's
  // last edge back at the entry closes a cycle (a self-loop when the node is the entry).
  cycle: {
    kind: 'cycle',
    stage: 'dag',
    code: 'cycle',
    inject(m, pick) {
      const out = copy(m);
      lastEdge(at(out.nodes, pickNonTerminal(out, pick))).to = out.entryNodeId;
      return out;
    },
  },
  'dead-end': {
    kind: 'dead-end',
    stage: 'terminal',
    code: 'dead-end',
    inject(m, pick) {
      const out = copy(m);
      at(out.nodes, pickNonTerminal(out, pick)).edges = [];
      return out;
    },
  },
  'type-mismatch': {
    kind: 'type-mismatch',
    stage: 'conditions',
    code: 'type-mismatch',
    inject(m, pick) {
      const out = copy(m);
      const node = at(out.nodes, pickNonTerminal(out, pick));
      const numberVar = out.variables.find((v) => v.type === 'number');
      if (numberVar === undefined) throw new Error('type-mismatch defect: the manifest has no number variable');
      node.edges.unshift({ to: lastEdge(node).to, when: { op: 'eq', ref: { var: numberVar.id }, value: 'not-a-number' } });
      return out;
    },
  },
  'unsafe-url': {
    kind: 'unsafe-url',
    stage: 'conditions',
    code: 'unsafe-url',
    inject(m, pick) {
      const out = copy(m);
      const node = at(out.nodes, pickOutcome(out, pick));
      const config = node.config as OutcomeConfig;
      node.config = { ...config, cta: { label: 'Open', url: at(UNSAFE_CTA_URLS, pick % UNSAFE_CTA_URLS.length) } };
      return out;
    },
  },
};

export const DEFECT_KINDS: readonly DefectKind[] = Object.keys(DEFECTS) as DefectKind[];

export const defectArb: fc.Arbitrary<Defect> = fc.constantFrom(...DEFECT_KINDS).map((kind) => DEFECTS[kind]);

/** A valid manifest with one injected defect, plus the defect that was injected. */
export const defectiveManifestArb: fc.Arbitrary<{ manifest: Manifest; defect: Defect }> = fc
  .tuple(validManifestArb, defectArb, fc.nat())
  .map(([m, defect, pick]) => ({ manifest: defect.inject(m, pick), defect }));

// ---------------------------------------------------------------------------
// Responses and the driver
// ---------------------------------------------------------------------------

function playingNode(rt: Runtime, s: AttemptState): ManifestNode {
  if (s.status !== 'playing') throw new Error(`arbitraries: attempt status is "${s.status}"; no response is accepted`);
  const node = rt.nodes.get(s.currentNodeId);
  if (node === undefined) throw new Error(`arbitraries: no node "${s.currentNodeId}"`);
  return node;
}

/** Responses that `checkAction` accepts at the current node of a `playing` state. */
export function acceptedResponseArb(rt: Runtime, s: AttemptState): fc.Arbitrary<unknown> {
  const node = playingNode(rt, s);
  if (node.type === 'choice') {
    const ids = (node.config as ChoiceConfig).options.map((o) => o.id);
    return fc.constantFrom(...ids).map((optionId) => ({ optionId }));
  }
  if (node.type === 'content') return fc.constant({});
  throw new Error(`acceptedResponseArb: no responses for node type "${node.type}"`);
}

/** Deterministic counterpart of `acceptedResponseArb`: `pick` selects the option. */
export function acceptedResponse(rt: Runtime, s: AttemptState, pick: number): unknown {
  const node = playingNode(rt, s);
  if (node.type === 'choice') {
    const options = (node.config as ChoiceConfig).options;
    return { optionId: at(options, mod(pick, options.length)).id };
  }
  if (node.type === 'content') return {};
  throw new Error(`acceptedResponse: no responses for node type "${node.type}"`);
}

export interface PlayOptions {
  readonly seed: number;
  /** Option picks, used in turn (cycled); ignored when `choose` is given. Default `[0]`. */
  readonly picks?: readonly number[];
  /** Returns the response for each step; must be accepted by `checkAction`. */
  readonly choose?: (s: AttemptState, step: number) => unknown;
  /** Clock value for `createAttempt`; step `i` (from 1) uses `startAt + i * stepMs`. */
  readonly startAt?: number;
  readonly stepMs?: number;
  /** Stops after this many actions even if still `playing`. Default `maxTransitions + 2`. */
  readonly maxSteps?: number;
}

/**
 * Plays `rt` from `createAttempt` with accepted responses until the status is not `playing` or
 * `maxSteps` actions were sent. Returns every state, the initial one first. Throws if a chosen
 * response is rejected, since that is a bug in the test.
 */
export function playManifest(rt: Runtime, opts: PlayOptions): AttemptState[] {
  const startAt = opts.startAt ?? 0;
  const stepMs = opts.stepMs ?? 1000;
  const picks = opts.picks !== undefined && opts.picks.length > 0 ? opts.picks : [0];
  const maxSteps = opts.maxSteps ?? rt.manifest.limits.maxTransitions + 2;
  let s = createAttempt(rt, opts.seed, { now: startAt });
  const states: AttemptState[] = [s];
  for (let step = 0; step < maxSteps && s.status === 'playing'; step++) {
    const response = opts.choose !== undefined ? opts.choose(s, step) : acceptedResponse(rt, s, at(picks, step % picks.length));
    const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
    const rejection = checkAction(rt, s, action);
    if (rejection !== null) throw new Error(`playManifest: step ${step} at node "${s.currentNodeId}" was rejected (${rejection})`);
    s = reduce(rt, s, action, { now: startAt + (step + 1) * stepMs });
    states.push(s);
  }
  return states;
}
