// Shared fast-check arbitraries for the shop-challenge property tests (design "Testing Strategy").
// Not a test file: Vitest only collects `*.test.ts`. Later tasks add more generators here.
//
// `selectConfigArb` builds configs that pass the `collectionSelect` config schema (design C7 limits
// and `SELECT_LIMITS`) and are Satisfiable for every occasion value, so a manifest around them
// passes `validateManifest` once the graph checks of task 7.5 exist. The satisfiability arithmetic
// here is written independently of `bundle-rules.ts`.
// A passing property run over these values is evidence for that property, not a proof.

import fc from 'fast-check';
import { SHORTENER_HOSTS, validateManifest, type Cond, type Edge, type Manifest, type ManifestNode } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type AttemptState, type Runtime } from '@dreame/runtime';
import { SELECT_LIMITS, type CollectionSelectConfig, type CollectionSelectResponse, type SelectItem } from '../src/node-types/collectionSelect.ts';
import { readSelectNodeState, type CollectionSelectNodeState } from '../src/node-types/bundle-rules.ts';
import type { RecommendConfig, RecommendOutcomeConfig, WhereClauseConfig } from '../src/node-types/recommendOutcome.ts';
import { shopProfile } from '../src/profile.ts';
import type { ChoiceConfig } from '@dreame/node-types';
import { acceptedResponse, SAFE_CTA_URLS, UNSAFE_CTA_URLS, validManifestArb } from '../../../packages/node-types/test/arbitraries.ts';

/** Item IDs that match `NODE_ID_PATTERN` (short, so collisions and shrinking stay readable). */
export const itemIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,7}$/);

/** Non-blank text up to `maxLength` UTF-16 code units, so `blank-text` is never reported. */
function textArb(maxLength: number): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength }).filter((s) => s.trim() !== '');
}

/** Mostly small prices, sometimes large ones; 24 × 10,000,000 stays below `SELECT_LIMITS.maxBudget`. */
const priceArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 1000 }) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 10_000_000 }) },
);

/**
 * One Item with ID `id`. `occasions` is drawn from `occasionIds` and is absent when that list is
 * empty (an `occasions` entry needs an Occasion_Source, design C7 step 4).
 */
export function selectItemArb(id: string, occasionIds: readonly string[] = []): fc.Arbitrary<SelectItem> {
  const occasionsArb: fc.Arbitrary<string[] | undefined> =
    occasionIds.length === 0
      ? fc.constant(undefined)
      : fc.option(
          fc.uniqueArray(fc.constantFrom(...occasionIds), {
            minLength: 1,
            maxLength: Math.min(occasionIds.length, SELECT_LIMITS.maxOccasionsPerItem),
          }),
          { nil: undefined },
        );
  return fc
    .record({
      name: textArb(80),
      price: priceArb,
      tags: fc.array(fc.string({ minLength: 1, maxLength: 32 }), { maxLength: SELECT_LIMITS.maxTags }),
      occasions: occasionsArb,
      emoji: fc.option(fc.constantFrom('☕', '🎁', '🕯️', '👩‍👩‍👧‍👦'), { nil: undefined }),
    })
    .map(({ occasions, emoji, ...rest }): SelectItem => ({
      id,
      ...rest,
      ...(occasions === undefined ? {} : { occasions }),
      ...(emoji === undefined ? {} : { emoji }),
    }));
}

export interface SelectConfigOptions {
  /** Upper bound on the Item count, 1–24. Default `SELECT_LIMITS.maxItems`; Property 4 uses 10. */
  readonly maxItems?: number;
  /** The Occasion_Source: its node ID and option IDs. Absent: no `occasionFrom`. */
  readonly occasion?: { readonly nodeId: string; readonly optionIds: readonly string[] };
}

/** Items offered for `occasion` (`null`: all), written here without `offeredItems`. */
function offeredFor(items: readonly SelectItem[], occasion: string | null): SelectItem[] {
  return occasion === null ? [...items] : items.filter((i) => i.occasions === undefined || i.occasions.includes(occasion));
}

/** Sum of the `n` lowest prices of `items`. */
function cheapestSum(items: readonly SelectItem[], n: number): number {
  return items
    .map((i) => i.price)
    .sort((a, b) => a - b)
    .slice(0, n)
    .reduce((sum, p) => sum + p, 0);
}

/**
 * `collectionSelect` configs with 1–`maxItems` Items with unique IDs, Satisfiable for every
 * occasion value: `min` ≤ the smallest Offered_Items count, `min` ≤ `max` ≤ 24, and `budget` at
 * least the largest sum of the `min` cheapest Offered_Item prices, plus a generated slack.
 */
export function selectConfigArb(opts: SelectConfigOptions = {}): fc.Arbitrary<CollectionSelectConfig> {
  const maxItems = Math.max(1, Math.min(opts.maxItems ?? SELECT_LIMITS.maxItems, SELECT_LIMITS.maxItems));
  const occasion = opts.occasion;
  const optionIds = occasion?.optionIds ?? [];
  const values: readonly (string | null)[] = occasion === undefined ? [null] : optionIds;
  return fc
    .uniqueArray(itemIdArb, { minLength: 1, maxLength: maxItems })
    .chain((ids) =>
      fc.tuple(
        fc.tuple(...ids.map((id) => selectItemArb(id, optionIds))),
        fc.record({
          minPick: fc.nat(),
          maxPick: fc.nat(),
          slack: fc.nat(),
          prompt: textArb(500),
          currency: fc.constantFrom('USD', 'EUR', 'NGN', 'GBP'),
          pricesAsOf: fc.option(fc.constantFrom('2026-11-21', '2025-01-31'), { nil: undefined }),
          continueLabel: fc.option(textArb(40), { nil: undefined }),
        }),
      ),
    )
    .map(([generated, r]): CollectionSelectConfig => {
      let items: SelectItem[] = [...generated];
      // Every occasion value needs at least one Offered_Item; an Item without `occasions` is offered for all.
      if (values.some((v) => offeredFor(items, v).length === 0)) {
        const [first, ...rest] = items;
        if (first !== undefined) {
          const { occasions: _dropped, ...open } = first;
          items = [open, ...rest];
        }
      }
      const fewestOffered = Math.min(...values.map((v) => offeredFor(items, v).length));
      const min = 1 + (r.minPick % fewestOffered);
      const max = min + (r.maxPick % (SELECT_LIMITS.maxPick - min + 1));
      const floor = Math.max(...values.map((v) => cheapestSum(offeredFor(items, v), min)));
      const allPrices = items.reduce((sum, i) => sum + i.price, 0);
      const budget = Math.min(SELECT_LIMITS.maxBudget, Math.max(1, floor + (r.slack % (allPrices - floor + 1))));
      return {
        prompt: r.prompt,
        items,
        min,
        max,
        budget,
        currency: r.currency,
        ...(occasion === undefined ? {} : { occasionFrom: occasion.nodeId }),
        ...(r.pricesAsOf === undefined ? {} : { pricesAsOf: r.pricesAsOf }),
        ...(r.continueLabel === undefined ? {} : { continueLabel: r.continueLabel }),
      };
    });
}

/**
 * A response that meets the Selection_Rules of `cfg`, built from the Offered_Items in `nodeState`
 * (what the view shows): the `min` cheapest, then more Items while `max` and `budget` allow, chosen
 * and ordered by `pick`. `null` when no such selection of the Offered_Items exists.
 */
export function acceptedSelectResponse(
  cfg: CollectionSelectConfig,
  nodeState: CollectionSelectNodeState,
  pick: number,
): CollectionSelectResponse | null {
  const offered = nodeState.items;
  if (cfg.min > cfg.max || offered.length < cfg.min) return null;
  let r = pick >>> 0;
  const next = (): number => {
    r = (Math.imul(r, 1103515245) + 12345) >>> 0;
    return r;
  };
  const byPrice = offered.map((item, i) => ({ item, i })).sort((a, b) => a.item.price - b.item.price || a.i - b.i);
  const chosen = byPrice.slice(0, cfg.min).map((e) => e.item);
  let total = chosen.reduce((sum, item) => sum + item.price, 0);
  if (total > cfg.budget) return null;
  const rest = byPrice.slice(cfg.min).map((e) => e.item);
  const start = rest.length === 0 ? 0 : next() % rest.length;
  for (let k = 0; k < rest.length; k++) {
    const item = rest[(start + k) % rest.length];
    if (item === undefined || chosen.length >= cfg.max) break;
    if (next() % 2 === 0 && total + item.price <= cfg.budget) {
      chosen.push(item);
      total += item.price;
    }
  }
  const ids = chosen.map((item) => item.id);
  // Fisher–Yates with the same generator, so the response order varies with `pick`.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const a = ids[i];
    const b = ids[j];
    if (a !== undefined && b !== undefined) {
      ids[i] = b;
      ids[j] = a;
    }
  }
  return { itemIds: ids };
}

/**
 * A `choice` node config to use as an Occasion_Source: 2–4 options with unique IDs that match
 * `NODE_ID_PATTERN`, non-blank labels and prompt, and no effects (Property 4).
 */
export const occasionChoiceArb: fc.Arbitrary<ChoiceConfig> = fc
  .record({
    prompt: textArb(500),
    optionIds: fc.uniqueArray(itemIdArb, { minLength: 2, maxLength: 4 }),
    labels: fc.array(textArb(200), { minLength: 4, maxLength: 4 }),
  })
  .map(({ prompt, optionIds, labels }): ChoiceConfig => ({
    prompt,
    options: optionIds.map((id, i) => ({ id, label: labels[i] ?? id })),
  }));

/** An `occasions` list for an Item: 1–min(n, 8) unique entries drawn from `optionIds` (non-empty). */
export function occasionsListArb(optionIds: readonly string[]): fc.Arbitrary<string[]> {
  return fc.uniqueArray(fc.constantFrom(...optionIds), {
    minLength: 1,
    maxLength: Math.min(optionIds.length, SELECT_LIMITS.maxOccasionsPerItem),
  });
}

/** Mostly small thresholds, so `lte`/`gte` split typical Item prices; sometimes any value in 0–100,000,000. */
const thresholdArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 1000 }) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: SELECT_LIMITS.maxPrice }) },
);

/**
 * One `where` clause: `includes` on `tags` with a string of 1–32 code units (drawn from `tagPool`
 * when it is non-empty, so clauses match generated tags), or `lte`/`gte` on `price`.
 */
export function whereClauseArb(tagPool: readonly string[] = []): fc.Arbitrary<WhereClauseConfig> {
  const anyTag = fc.string({ minLength: 1, maxLength: 32 });
  const tagArb = tagPool.length === 0 ? anyTag : fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...tagPool) }, { weight: 1, arbitrary: anyTag });
  return fc.oneof(
    tagArb.map((value): WhereClauseConfig => ({ op: 'includes', field: 'tags', value })),
    fc
      .record({ op: fc.constantFrom('lte' as const, 'gte' as const), value: thresholdArb })
      .map(({ op, value }): WhereClauseConfig => ({ op, field: 'price', value })),
  );
}

/**
 * A `recommend` block or `undefined` (absent): `where` absent or with 0–4 clauses, either
 * `sortBy`, and `limit` 1–8 (Property 5).
 */
export function recommendArb(tagPool: readonly string[] = []): fc.Arbitrary<RecommendConfig | undefined> {
  return fc.option(
    fc
      .record({
        where: fc.option(fc.array(whereClauseArb(tagPool), { maxLength: 4 }), { nil: undefined }),
        sortBy: fc.constantFrom('priceAsc' as const, 'priceDesc' as const),
        limit: fc.integer({ min: 1, max: 8 }),
      })
      .map(({ where, ...rest }): RecommendConfig => (where === undefined ? rest : { ...rest, where })),
    { nil: undefined },
  );
}

// ---------------------------------------------------------------------------
// Shop manifests and the driver (Property 6; later reused by Properties 7 and 8)
// ---------------------------------------------------------------------------

/** Node IDs of the bundle graph. */
export const BUNDLE_IDS = { occ: 'occ', pick: 'pick', note: 'note', alt: 'alt', rec: 'rec' } as const;

type BranchTarget = typeof BUNDLE_IDS.note | typeof BUNDLE_IDS.alt | typeof BUNDLE_IDS.rec;

/**
 * Conditions on the answer of the `collectionSelect` node `nodeId`: `includes` leaves with a value
 * from `itemIds` (the `answerType` set values), optionally combined with `and`, `or` and `not`
 * (nesting depth at most 3, below the cap of 8).
 */
export function includesCondArb(nodeId: string, itemIds: readonly string[]): fc.Arbitrary<Cond> {
  const leaf: fc.Arbitrary<Cond> = fc
    .constantFrom(...itemIds)
    .map((value): Cond => ({ op: 'includes', ref: { answer: nodeId }, value }));
  return fc.letrec<{ cond: Cond }>((tie) => ({
    cond: fc.oneof(
      { maxDepth: 2, depthSize: 'small' },
      leaf,
      fc
        .record({ op: fc.constantFrom('and' as const, 'or' as const), args: fc.array(tie('cond'), { minLength: 1, maxLength: 3 }) })
        .map((c): Cond => c),
      tie('cond').map((arg): Cond => ({ op: 'not', arg })),
    ),
  })).cond;
}

interface BundleRecipe {
  readonly branches: readonly { readonly when: Cond; readonly to: BranchTarget }[];
  readonly recommend: RecommendConfig | undefined;
  readonly title: string;
  readonly body: string;
  readonly whyText: string | undefined;
  readonly contacts: { label: string; url: string }[] | undefined;
  readonly fallbackAlt: boolean;
  readonly transitionSlack: number;
  readonly nodeSlack: number;
  readonly version: number;
}

/**
 * `[occ (choice) →] pick (collectionSelect) → rec (recommendOutcome)`, where `pick` has 0–3
 * conditional `includes` edges before its unconditional last edge to `rec`. A conditional edge goes
 * to `rec`, to `note` (a `content` node with one edge to `rec`) or to `alt` (an `outcome`); `note`
 * and `alt` exist only when an edge names them, so every node is reachable. `pick` lies on every
 * path to `rec`, so `from` is upstream; `requires` lists exactly the node types used; and
 * `maxTransitions` is the longest entry-to-terminal path plus a slack of 0–3.
 */
function buildBundleManifest(choice: ChoiceConfig | null, cfg: CollectionSelectConfig, r: BundleRecipe): Manifest {
  const { occ, pick, note, alt, rec } = BUNDLE_IDS;
  const usesNote = r.branches.some((b) => b.to === note);
  const usesAlt = r.branches.some((b) => b.to === alt);
  const pickEdges: Edge[] = [...r.branches.map((b): Edge => ({ to: b.to, when: b.when })), { to: rec }];
  const recConfig: RecommendOutcomeConfig = {
    title: r.title,
    body: r.body,
    from: pick,
    ...(r.whyText === undefined ? {} : { whyText: r.whyText }),
    ...(r.recommend === undefined ? {} : { recommend: r.recommend }),
    ...(r.contacts === undefined ? {} : { contacts: r.contacts }),
  };
  const nodes: ManifestNode[] = [];
  if (choice !== null) nodes.push({ id: occ, type: 'choice', config: choice, edges: [{ to: pick }] });
  nodes.push({ id: pick, type: 'collectionSelect', config: cfg, edges: pickEdges });
  if (usesNote) nodes.push({ id: note, type: 'content', config: { body: 'Good picks. Here is your bundle.' }, edges: [{ to: rec }] });
  if (usesAlt) nodes.push({ id: alt, type: 'outcome', config: { title: 'Nice choice', body: 'That item is a favourite.' }, edges: [] });
  nodes.push({ id: rec, type: 'recommendOutcome', config: recConfig, edges: [] });

  const requires: Record<string, number> = {};
  for (const node of nodes) requires[node.type] = 1;
  const longest = (choice === null ? 0 : 1) + (usesNote ? 2 : 1);
  return {
    schemaVersion: 1,
    profile: 'shop-challenge',
    activityId: 'generated-bundle',
    version: r.version,
    requires,
    entryNodeId: choice === null ? pick : occ,
    fallbackOutcomeId: usesAlt && r.fallbackAlt ? alt : rec,
    limits: { maxNodes: nodes.length + r.nodeSlack, maxTransitions: longest + r.transitionSlack },
    variables: [],
    nodes,
    theme: 'default',
  };
}

/**
 * Bundle manifests for the `shop-challenge` profile: an optional occasion `choice`
 * (`occasionChoiceArb`), a Satisfiable `collectionSelect` (`selectConfigArb`), optional `includes`
 * edges on its answer, and a `recommendOutcome` with `from` the `collectionSelect` (`recommendArb`).
 */
export const bundleManifestArb: fc.Arbitrary<Manifest> = fc.option(occasionChoiceArb, { nil: null }).chain((choice) => {
  const occasion = choice === null ? undefined : { nodeId: BUNDLE_IDS.occ, optionIds: choice.options.map((o) => o.id) };
  return selectConfigArb(occasion === undefined ? {} : { occasion }).chain((cfg) => {
    const itemIds = cfg.items.map((i) => i.id);
    const tagPool = [...new Set(cfg.items.flatMap((i) => i.tags))];
    return fc
      .record({
        branches: fc.array(
          fc.record({
            when: includesCondArb(BUNDLE_IDS.pick, itemIds),
            to: fc.constantFrom<BranchTarget>(BUNDLE_IDS.note, BUNDLE_IDS.alt, BUNDLE_IDS.rec),
          }),
          { maxLength: 3 },
        ),
        recommend: recommendArb(tagPool),
        title: textArb(120),
        body: fc.string({ maxLength: 200 }),
        whyText: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
        contacts: fc.option(fc.array(fc.record({ label: textArb(60), url: fc.constantFrom(...SAFE_CTA_URLS) }), { maxLength: 3 }), {
          nil: undefined,
        }),
        fallbackAlt: fc.boolean(),
        transitionSlack: fc.integer({ min: 0, max: 3 }),
        nodeSlack: fc.integer({ min: 0, max: 5 }),
        version: fc.integer({ min: 1, max: 9 }),
      })
      .map((r) => buildBundleManifest(choice, cfg, r));
  });
});

/** `bundleManifestArb`, or a core-type `validManifestArb` manifest relabelled to the `shop-challenge` profile. */
export const shopManifestArb: fc.Arbitrary<Manifest> = fc.oneof(
  bundleManifestArb,
  validManifestArb.map((m): Manifest => ({ ...m, profile: 'shop-challenge' })),
);

/** Validates `m` against `shopProfile` and builds a runtime; throws if validation fails. */
export function shopRuntimeFor(m: Manifest): Runtime {
  const result = validateManifest(m, shopProfile);
  if (!result.ok) {
    const first = result.diagnostics[0];
    throw new Error(`shopRuntimeFor: manifest is not valid: ${first === undefined ? 'no diagnostics' : `${first.stage}/${first.code} ${first.message}`}`);
  }
  return createRuntime(shopProfile, result.manifest);
}

/**
 * A response that `checkAction` accepts at the current node of a `playing` state: for a
 * `collectionSelect` node, `acceptedSelectResponse` over the stored node state; for `content` and
 * `choice`, the core `acceptedResponse`. `pick` chooses among accepted responses.
 */
export function shopAcceptedResponse(rt: Runtime, s: AttemptState, pick: number): unknown {
  if (s.status !== 'playing') throw new Error(`shopAcceptedResponse: attempt status is "${s.status}"; no response is accepted`);
  const node = rt.nodes.get(s.currentNodeId);
  if (node === undefined) throw new Error(`shopAcceptedResponse: no node "${s.currentNodeId}"`);
  if (node.type !== 'collectionSelect') return acceptedResponse(rt, s, pick);
  const cfg = node.config as CollectionSelectConfig;
  const nodeState = Object.hasOwn(s.nodeState, node.id) ? readSelectNodeState(s.nodeState[node.id]) : null;
  if (nodeState === null) throw new Error(`shopAcceptedResponse: node "${node.id}" has no collectionSelect node state`);
  const response = acceptedSelectResponse(cfg, nodeState, pick);
  if (response === null) throw new Error(`shopAcceptedResponse: no accepted selection at node "${node.id}"`);
  return response;
}

export interface ShopPlayOptions {
  readonly seed: number;
  /** Response picks, used in turn (cycled). Default `[0]`. */
  readonly picks?: readonly number[];
  /** Clock value for `createAttempt`; step `i` (from 1) uses `startAt + i * stepMs`. */
  readonly startAt?: number;
  readonly stepMs?: number;
  /** Stops after this many actions even if still `playing`. Default `maxTransitions + 2`. */
  readonly maxSteps?: number;
}

/**
 * Plays `rt` from `createAttempt` with `shopAcceptedResponse` responses until the status is not
 * `playing` or `maxSteps` actions were sent, following `playManifest` in
 * `packages/node-types/test/arbitraries.ts`. Returns every state, the initial one first. Throws if
 * a response is rejected, since that is a bug in the test.
 */
export function playShopManifest(rt: Runtime, opts: ShopPlayOptions): AttemptState[] {
  const startAt = opts.startAt ?? 0;
  const stepMs = opts.stepMs ?? 1000;
  const picks = opts.picks !== undefined && opts.picks.length > 0 ? opts.picks : [0];
  const maxSteps = opts.maxSteps ?? rt.manifest.limits.maxTransitions + 2;
  let s = createAttempt(rt, opts.seed, { now: startAt });
  const states: AttemptState[] = [s];
  for (let step = 0; step < maxSteps && s.status === 'playing'; step++) {
    const response = shopAcceptedResponse(rt, s, picks[step % picks.length] ?? 0);
    const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
    const rejection = checkAction(rt, s, action);
    if (rejection !== null) throw new Error(`playShopManifest: step ${step} at node "${s.currentNodeId}" was rejected (${rejection})`);
    s = reduce(rt, s, action, { now: startAt + (step + 1) * stepMs });
    states.push(s);
  }
  return states;
}

// ---------------------------------------------------------------------------
// Contact_Links (Property 10)
// ---------------------------------------------------------------------------

/** One Contact_Link of a `recommendOutcome` config. */
export type ContactLink = NonNullable<RecommendOutcomeConfig['contacts']>[number];

/** Contact_Link URLs that pass `checkHttpsUrl`: the core safe CTA URLs plus wa.me and t.me forms. */
export const SAFE_CONTACT_URLS: readonly string[] = [
  ...SAFE_CTA_URLS,
  'https://wa.me/12125550142',
  'https://wa.me/447700900123?text=Hi',
  'https://api.whatsapp.com/send?phone=12125550142',
  'https://t.me/dreame_demo_shop',
  'https://t.me/ShopBot2026',
];

/**
 * Contact_Link URLs that `checkHttpsUrl` rejects: the core unsafe CTA URLs (shorteners,
 * credentials, no host) plus `http:`, `javascript:` and `data:` forms of contact links. The
 * non-https entries stop at the schema pattern in `validateManifest`, so Property 10 calls
 * `recommendOutcomeNodeType.validate` directly.
 */
export const UNSAFE_CONTACT_URLS: readonly string[] = [
  ...UNSAFE_CTA_URLS,
  'http://wa.me/12125550142',
  'http://t.me/dreame_demo_shop',
  'javascript:alert(1)//https://wa.me/1',
  'data:text/html,<a href="https://t.me/x">x</a>',
  'https://t.co/abc',
  'https://user@wa.me/12125550142',
];

const MAX_CONTACT_URL_LENGTH = 2048;
const contactPathArb = fc.stringMatching(/^[a-z0-9\-._~/]{0,24}$/);

/** Generated `https://wa.me/<digits>` URLs (1–15 digits). */
export const waMeUrlArb: fc.Arbitrary<string> = fc.stringMatching(/^[0-9]{1,15}$/).map((d) => `https://wa.me/${d}`);

/** Generated `https://t.me/<name>` URLs (Telegram-style names of 5–32 characters). */
export const tMeUrlArb: fc.Arbitrary<string> = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{4,31}$/).map((n) => `https://t.me/${n}`);

/**
 * Contact_Link URL strings: constant and generated safe `https:` URLs (wa.me, t.me and other
 * hosts), `http:`, `javascript:` and `data:` URLs, shortener hosts, credentials, lengths around
 * the 2,048-character limit and random strings.
 */
export const contactUrlArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...SAFE_CONTACT_URLS),
  fc.constantFrom(...UNSAFE_CONTACT_URLS),
  waMeUrlArb,
  tMeUrlArb,
  fc.webUrl({ validSchemes: ['https'], withQueryParameters: true }),
  fc.webUrl({ validSchemes: ['http'] }),
  contactPathArb.map((p) => `javascript:alert(1)//${p}`),
  contactPathArb.map((p) => `data:text/plain,${p}`),
  fc
    .tuple(fc.constantFrom(...SHORTENER_HOSTS), fc.boolean(), contactPathArb)
    .map(([host, www, p]) => `https://${www ? 'www.' : ''}${host}/${p}`),
  fc
    .tuple(fc.stringMatching(/^[a-z0-9]{1,8}$/), fc.option(fc.stringMatching(/^[a-z0-9]{0,8}$/), { nil: undefined }))
    .map(([user, pass]) => `https://${user}${pass === undefined ? '' : `:${pass}`}@wa.me/12125550142`),
  fc.integer({ min: -2, max: 2 }).map((delta) => {
    const prefix = 'https://t.me/';
    return prefix + 'a'.repeat(MAX_CONTACT_URL_LENGTH - prefix.length + delta);
  }),
  fc.string({ maxLength: 40 }),
);

/** 0–3 Contact_Links with non-blank labels of at most 60 code units and `contactUrlArb` URLs. */
export const contactsArb: fc.Arbitrary<ContactLink[]> = fc.array(
  fc.record({ label: textArb(60), url: contactUrlArb }),
  { maxLength: 3 },
);
