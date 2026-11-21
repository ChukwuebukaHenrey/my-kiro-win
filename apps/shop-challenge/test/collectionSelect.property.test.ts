// Property tests for the `collectionSelect` node type (design C7, "Correctness Properties").
// The Wiring_Hook wrote the first version of this file; task 7.3 replaced its property with
// Property 1, and tasks 7.4 and 8.5 add Properties 2 and 3.
// A passing run is evidence for the property over the generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateManifest, type Manifest } from '@dreame/schema';
import {
  checkAction,
  createAttempt,
  createRng,
  createRuntime,
  reduce,
  type AttemptState,
  type Env,
  type Runtime,
} from '@dreame/runtime';
import { SELECT_LIMITS, collectionSelectNodeType, type CollectionSelectConfig } from '../src/node-types/collectionSelect.ts';
import { recommendOutcomeNodeType, type RecommendOutcomeConfig } from '../src/node-types/recommendOutcome.ts';
import { readSelectNodeState, type CollectionSelectNodeState, type ItemSnapshot } from '../src/node-types/bundle-rules.ts';
import { shopProfile } from '../src/profile.ts';
import { acceptedSelectResponse, itemIdArb, recommendArb, selectConfigArb } from './shop-arbitraries.ts';

const NUM_RUNS = 200;

const OCC = 'occ';
const PICK = 'pick';
const DONE = 'done';
const OCCASION_IDS = ['birthday', 'wedding', 'thanks', 'holiday'] as const;

/** `[occ (choice) →] pick (collectionSelect) → done (outcome)`, as a shop-challenge manifest. */
function selectManifest(cfg: CollectionSelectConfig, optionIds: readonly string[] | null): Manifest {
  const pick = { id: PICK, type: 'collectionSelect', config: cfg, edges: [{ to: DONE }] };
  const done = { id: DONE, type: 'outcome', config: { title: 'Thanks', body: 'Your bundle is ready.' }, edges: [] };
  const occ =
    optionIds === null
      ? []
      : [
          {
            id: OCC,
            type: 'choice',
            config: { prompt: 'What is the occasion?', options: optionIds.map((id) => ({ id, label: `For ${id}` })) },
            edges: [{ to: PICK }],
          },
        ];
  return {
    schemaVersion: 1,
    profile: 'shop-challenge',
    activityId: 'shop-select-property',
    version: 1,
    requires: optionIds === null ? { collectionSelect: 1, outcome: 1 } : { choice: 1, collectionSelect: 1, outcome: 1 },
    entryNodeId: optionIds === null ? PICK : OCC,
    fallbackOutcomeId: DONE,
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [...occ, pick, done],
    theme: 'default',
  } as Manifest;
}

function runtimeFor(m: Manifest): Runtime {
  const result = validateManifest(m, shopProfile);
  if (!result.ok) {
    const d = result.diagnostics[0];
    throw new Error(`selectManifest is not valid: ${d === undefined ? 'no diagnostics' : `${d.stage}/${d.code} at ${d.path}: ${d.message}`}`);
  }
  return createRuntime(shopProfile, result.manifest);
}

/**
 * Reference model of the response schema and the Selection_Rules (Requirements 6.1–6.3),
 * written without `checkSelection`: an object whose only own key is `itemIds`, an array of at most
 * 24 strings of at most 64 code units, every ID names an Item of the config (the occasion is not a
 * rule), no ID repeats, the count is from `min` to `max`, and the price total is at most `budget`.
 */
function modelAccepts(cfg: CollectionSelectConfig, r: unknown): boolean {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return false;
  const keys = Object.keys(r);
  if (keys.length !== 1 || keys[0] !== 'itemIds') return false;
  const ids: unknown = (r as Record<string, unknown>)['itemIds'];
  if (!Array.isArray(ids) || ids.length > SELECT_LIMITS.maxPick) return false;
  const priceOf = new Map<string, number>(cfg.items.map((item) => [item.id, item.price]));
  const seen: string[] = [];
  let total = 0;
  for (const id of ids as unknown[]) {
    if (typeof id !== 'string' || id.length > 64) return false;
    const price = priceOf.get(id);
    if (price === undefined || seen.includes(id)) return false;
    seen.push(id);
    total += price;
  }
  return seen.length >= cfg.min && seen.length <= cfg.max && total <= cfg.budget;
}

interface Case {
  readonly cfg: CollectionSelectConfig;
  readonly optionIds: readonly string[] | null;
  readonly answer: number;
  readonly seed: number;
}

/** A config with or without an Occasion_Source (2–4 options), the option the player picks, and a seed. */
const caseArb: fc.Arbitrary<Case> = fc
  .option(fc.integer({ min: 2, max: OCCASION_IDS.length }), { nil: null })
  .chain((n) => {
    const optionIds = n === null ? null : OCCASION_IDS.slice(0, n);
    return fc.record({
      cfg: selectConfigArb(optionIds === null ? {} : { occasion: { nodeId: OCC, optionIds } }),
      optionIds: fc.constant(optionIds),
      answer: fc.nat(),
      seed: fc.integer({ min: 0, max: 0xffffffff }),
    });
  });

/** Candidate responses: accepted ones, subsets in any order, repeats, unknown IDs, > 24 entries, non-strings, extra keys, random JSON. */
function responseArb(cfg: CollectionSelectConfig, nodeState: CollectionSelectNodeState): fc.Arbitrary<unknown> {
  const ids = cfg.items.map((item) => item.id);
  const known = fc.constantFrom(...ids);
  const accepted = fc.nat().map((p) => acceptedSelectResponse(cfg, nodeState, p)?.itemIds ?? []);
  const subset = fc.shuffledSubarray(ids);
  const idList = fc.oneof(
    accepted,
    subset,
    fc.tuple(accepted, known).map(([a, extra]) => [...a, extra]),
    fc.array(known, { maxLength: 26 }),
    fc.array(fc.oneof(known, fc.string({ maxLength: 8 }), fc.constant('x'.repeat(65))), { maxLength: 26 }),
    fc.array(fc.oneof(known, itemIdArb), { minLength: SELECT_LIMITS.maxPick + 1, maxLength: 30 }),
  );
  return fc.oneof(
    { weight: 6, arbitrary: idList.map((itemIds) => ({ itemIds })) },
    {
      weight: 1,
      arbitrary: fc.tuple(subset, fc.array(fc.oneof(known, fc.anything()), { maxLength: 4 })).map(([a, b]) => ({ itemIds: [...a, ...b] })),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(fc.oneof(accepted, subset), fc.string(), fc.jsonValue())
        .map(([itemIds, key, value]) => ({ itemIds, [key === 'itemIds' ? 'extra' : key]: value })),
    },
    { weight: 1, arbitrary: fc.record({ itemIds: fc.anything() }) },
    { weight: 1, arbitrary: fc.oneof(fc.jsonValue(), fc.anything()) },
  );
}

/** Plays from `createAttempt` to the `collectionSelect` node, answering the occasion choice when present. */
function reachPick(rt: Runtime, c: Case): AttemptState {
  let s = createAttempt(rt, c.seed, { now: 0 });
  if (c.optionIds !== null) {
    const optionId = c.optionIds[c.answer % c.optionIds.length];
    s = reduce(rt, s, { type: 'respond', nodeId: OCC, response: { optionId } }, { now: 1000 });
  }
  return s;
}

describe('Feature: shop-challenge, Property 1: Response acceptance matches the Selection_Rules model', () => {
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.7, 19.6**
  it('checkAction at a collectionSelect node accepts a candidate response exactly when the reference model does', () => {
    let accepted = 0;
    let total = 0;
    fc.assert(
      fc.property(
        caseArb.chain((c) => {
          const rt = runtimeFor(selectManifest(c.cfg, c.optionIds));
          const s = reachPick(rt, c);
          const nodeState = s.nodeState[PICK] as unknown as CollectionSelectNodeState;
          return fc.record({
            c: fc.constant(c),
            rt: fc.constant(rt),
            s: fc.constant(s),
            response: responseArb(c.cfg, nodeState),
          });
        }),
        ({ c, rt, s, response }) => {
          expect(rt.profile.registry.get('collectionSelect')).toBe(collectionSelectNodeType);
          expect([s.status, s.currentNodeId]).toEqual(['playing', PICK]);
          const expected = modelAccepts(c.cfg, response);
          const rejection = checkAction(rt, s, { type: 'respond', nodeId: PICK, response });
          expect(rejection).toBe(expected ? null : 'invalid-response');
          total += 1;
          if (expected) accepted += 1;
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Both outcomes occur, so the run says something about acceptance and about rejection.
    expect(accepted).toBeGreaterThan(0);
    expect(total - accepted).toBeGreaterThan(0);
  });
});

/**
 * Expected node state written without `offeredItems` or `selectNodeState`: with no occasion every
 * Item is offered; otherwise the Items with no `occasions` list or with the occasion in it, in
 * config order, each as `{ id, name, price, tags }` plus `emoji` only when the Item has one.
 */
function expectedNodeState(cfg: CollectionSelectConfig, occasion: string | null): CollectionSelectNodeState {
  const items: ItemSnapshot[] = [];
  for (const item of cfg.items) {
    if (occasion !== null && item.occasions !== undefined && !item.occasions.includes(occasion)) continue;
    const base = { id: item.id, name: item.name, price: item.price, tags: [...item.tags] };
    items.push(item.emoji === undefined ? base : { ...base, emoji: item.emoji });
  }
  return { occasion, currency: cfg.currency, items };
}

describe('Feature: shop-challenge, Property 2: An accepted selection is stored as an ordered set with the offered Item data', () => {
  // **Validates: Requirements 5.12, 6.4, 6.5**
  it('reduce stores the response IDs once each in config order and the Offered_Items node state for the occasion', () => {
    fc.assert(
      fc.property(caseArb, fc.nat(), (c, pick) => {
        const rt = runtimeFor(selectManifest(c.cfg, c.optionIds));
        const s = reachPick(rt, c);
        expect([s.status, s.currentNodeId]).toEqual(['playing', PICK]);
        const occasion = c.optionIds === null ? null : (c.optionIds[c.answer % c.optionIds.length] ?? null);
        const response = acceptedSelectResponse(c.cfg, s.nodeState[PICK] as unknown as CollectionSelectNodeState, pick);
        expect(response).not.toBeNull();
        if (response === null) return;
        const action = { type: 'respond', nodeId: PICK, response } as const;
        expect(checkAction(rt, s, action)).toBeNull();

        const next = reduce(rt, s, action, { now: 2000 });

        const answerType = collectionSelectNodeType.answerType(c.cfg);
        const values = answerType !== null && answerType.kind === 'set' ? answerType.values : null;
        expect(values).toEqual(c.cfg.items.map((item) => item.id));
        const answer = next.answers[PICK];
        expect(Array.isArray(answer)).toBe(true);
        const ids = answer as readonly string[];
        // Each response ID exactly once, nothing else, in the order of the `answerType` values.
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual([...new Set(response.itemIds)].sort());
        expect(ids).toEqual((values ?? []).filter((id) => response.itemIds.includes(id)));

        const stored = next.nodeState[PICK];
        const read = readSelectNodeState(stored);
        expect(read).not.toBeNull();
        const expected = expectedNodeState(c.cfg, occasion);
        expect(read).toEqual(expected);
        expect(stored).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

const REC = 'rec';

/** Freezes `value` and every object reachable from it, so a later write throws (ES modules are strict). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return value;
}

/**
 * Calls `call` twice on deep-frozen copies of `cfg`, `state` and `response`, then checks that the
 * inputs are deep-equal to the originals, that `rngState` is unchanged and that both results are
 * deep-equal. A write to a frozen input throws, which fails the property. Returns the first result.
 */
function expectPureCall<C, R>(cfg: C, state: AttemptState, response: R, call: (c: C, s: AttemptState, r: R) => AttemptState): AttemptState {
  const c = deepFreeze(structuredClone(cfg));
  const s = deepFreeze(structuredClone(state));
  const r = deepFreeze(structuredClone(response));
  const first = call(c, s, r);
  const second = call(c, s, r);
  expect(c).toStrictEqual(cfg);
  expect(s).toStrictEqual(state);
  expect(r).toStrictEqual(response);
  expect(first.rngState).toBe(state.rngState);
  expect(second).toStrictEqual(first);
  return first;
}

/** Which of `answers[from]` and `nodeState[from]` the `recommendOutcome` input state keeps. */
type FromParts = 'both' | 'answer-only' | 'node-state-only' | 'neither';

/** The state after `reduce` at `PICK`, moved to the result node, keeping the `from` parts named by `parts`. */
function atResultNode(selected: AttemptState, parts: FromParts): AttemptState {
  const { [PICK]: _answer, ...answersWithout } = selected.answers;
  const { [PICK]: _nodeState, ...nodeStateWithout } = selected.nodeState;
  const keepAnswer = parts === 'both' || parts === 'answer-only';
  const keepNodeState = parts === 'both' || parts === 'node-state-only';
  return {
    ...selected,
    currentNodeId: REC,
    answers: keepAnswer ? selected.answers : answersWithout,
    nodeState: keepNodeState ? selected.nodeState : nodeStateWithout,
  };
}

/** A `recommendOutcome` config whose `from` is `PICK`, with Suggestion clauses drawn from the config's tags. */
function recommendConfigArb(cfg: CollectionSelectConfig): fc.Arbitrary<RecommendOutcomeConfig> {
  const tagPool = [...new Set(cfg.items.flatMap((item) => item.tags))];
  return fc
    .record({
      recommend: recommendArb(tagPool),
      whyText: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
      contacts: fc.option(fc.constant<{ label: string; url: string }[]>([{ label: 'Message the shop', url: 'https://wa.me/15551234567' }]), { nil: undefined }),
    })
    .map(({ recommend, whyText, contacts }): RecommendOutcomeConfig => ({
      title: 'Your bundle',
      body: 'Here is what you picked.',
      from: PICK,
      ...(whyText === undefined ? {} : { whyText }),
      ...(recommend === undefined ? {} : { recommend }),
      ...(contacts === undefined ? {} : { contacts }),
    }));
}

const selectEnter = collectionSelectNodeType.enter;
const recommendEnter = recommendOutcomeNodeType.enter;

describe('Feature: shop-challenge, Property 3: Node type hooks leave their inputs unchanged and are deterministic', () => {
  // **Validates: Requirements 6.6, 6.8, 8.5**
  it('collectionSelect.enter, collectionSelect.reduce and recommendOutcome.enter on deep-frozen inputs are pure and repeatable', () => {
    if (selectEnter === undefined || recommendEnter === undefined) throw new Error('both node types must define enter');
    const exercised = new Set<FromParts>();
    fc.assert(
      fc.property(
        caseArb.chain((c) =>
          fc.record({
            c: fc.constant(c),
            pick: fc.nat(),
            rec: recommendConfigArb(c.cfg),
            parts: fc.constantFrom<FromParts>('both', 'answer-only', 'node-state-only', 'neither'),
            stepMs: fc.integer({ min: 0, max: 60_000 }),
          }),
        ),
        ({ c, pick, rec, parts, stepMs }) => {
          const rt = runtimeFor(selectManifest(c.cfg, c.optionIds));
          const s = reachPick(rt, c);
          expect([s.status, s.currentNodeId]).toEqual(['playing', PICK]);
          const response = acceptedSelectResponse(c.cfg, s.nodeState[PICK] as unknown as CollectionSelectNodeState, pick);
          expect(response).not.toBeNull();
          if (response === null) return;
          const env: Env = { now: s.updatedAt + stepMs, rng: createRng(s.rngState), variables: rt.variables };

          expectPureCall(c.cfg, s, undefined, (cfg, st) => selectEnter(cfg, st, env));
          const selected = expectPureCall(c.cfg, s, response, (cfg, st, r) => collectionSelectNodeType.reduce(cfg, st, r, env));

          const atRec = atResultNode(selected, parts);
          const resultEnv: Env = { now: atRec.updatedAt + stepMs, rng: createRng(atRec.rngState), variables: rt.variables };
          const entered = expectPureCall(rec, atRec, undefined, (cfg, st) => recommendEnter(cfg, st, resultEnv));
          expect(Object.hasOwn(entered.nodeState, REC)).toBe(true);
          exercised.add(parts);
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // Each kind of `recommendOutcome` input state was tried at least once over the run.
    expect([...exercised].sort()).toEqual(['answer-only', 'both', 'neither', 'node-state-only']);
  });
});
