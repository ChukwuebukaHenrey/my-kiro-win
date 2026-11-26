// Property tests for the Storage_Wrapper (design C9, "Correctness Properties" → Properties 11
// and 12): the round trip on an in-memory Storage_Backend double, and the Store_Result of every
// call on generated backend behaviours. A passing run is evidence for the properties over the
// generated inputs, not a proof.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { VALUE_CAP, readJson, removeKey, writeJson } from '../src/index.ts';
import type { Json, StorageBackend, StorageError, StoreResult } from '../src/index.ts';

const NUM_RUNS = 200;

interface MemoryBackend extends StorageBackend {
  readonly items: Map<string, string>;
}

function memoryBackend(): MemoryBackend {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const acceptAll = (data: unknown): data is unknown => true;

/** The Envelope text that `writeJson` is expected to store. */
function envelopeText(version: number, value: Json): string {
  return JSON.stringify({ v: version, data: value });
}

/**
 * JSON values that survive a JSON round trip by construction: each generated value is passed
 * through JSON.stringify and JSON.parse, which turns -0 into 0 and gives every object the plain
 * prototype with own data properties only.
 */
const jsonValueArb: fc.Arbitrary<Json> = fc
  .jsonValue({ maxDepth: 4 })
  .map((x) => JSON.parse(JSON.stringify(x)) as Json);

const keyArb = fc.string({ maxLength: 40 });
const versionArb = fc.integer();

/** A small JSON value plus a long string, sized so the Envelope text ends 0–64 code units under VALUE_CAP. */
function nearCapValueArb(version: number): fc.Arbitrary<Json> {
  return fc.tuple(jsonValueArb, fc.nat({ max: 64 })).map(([small, slack]) => {
    const base = envelopeText(version, [small, '']).length;
    const pad = Math.max(0, VALUE_CAP - slack - base);
    return [small, 'a'.repeat(pad)];
  });
}

const caseArb = versionArb
  .chain((version) =>
    fc.record({
      key: keyArb,
      version: fc.constant(version),
      value: fc.oneof({ weight: 4, arbitrary: jsonValueArb }, { weight: 1, arbitrary: nearCapValueArb(version) }),
    }),
  )
  .filter(({ version, value }) => envelopeText(version, value).length <= VALUE_CAP);

describe('Feature: practice-path, Property 11: A stored value reads back unchanged', () => {
  // **Validates: Requirements 11.6, 11.7, 11.14**
  it('writeJson then readJson with the same key and version returns the written value', () => {
    fc.assert(
      fc.property(caseArb, keyArb, ({ key, version, value }, otherKey) => {
        fc.pre(otherKey !== key);
        const backend = memoryBackend();

        // A key that was never written reads as { ok: true, value: null }, before and after the write.
        expect(readJson(backend, key, version, acceptAll)).toEqual({ ok: true, value: null });

        expect(writeJson(backend, key, version, value)).toEqual({ ok: true, value: null });
        const stored = backend.items.get(key);
        expect(stored).toBe(envelopeText(version, value));
        expect(stored!.length).toBeLessThanOrEqual(VALUE_CAP);

        const read = readJson(backend, key, version, acceptAll);
        expect(read.ok).toBe(true);
        if (read.ok) {
          expect(read.value).toEqual(value);
          // Key-by-key comparison through the JSON text, so key order and every nested value match.
          expect(JSON.stringify(read.value)).toBe(JSON.stringify(value));
        }

        expect(readJson(backend, otherKey, version, acceptAll)).toEqual({ ok: true, value: null });
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Property 12: generated backend behaviours, stored texts and values, checked against a
// reference model of the C9 rules written in this file.

/** Labels of the values a backend method throws. */
type ThrowLabel =
  | 'quota-name'
  | 'quota-legacy-name'
  | 'quota-code-22'
  | 'quota-code-1014'
  | 'error'
  | 'type-error'
  | 'security-error'
  | 'error-named-quota'
  | 'string'
  | 'number'
  | 'undefined'
  | 'null'
  | 'object-named-quota';

/** A DOMException whose `code` is overridden, for the legacy quota codes. */
function domExceptionWithCode(code: number): DOMException {
  const e = new DOMException('storage full', 'UnknownError');
  Object.defineProperty(e, 'code', { value: code });
  return e;
}

/** What each label throws (a fresh value per throw), and whether the C9 rules count it as a quota error. */
const THROWN: { readonly [L in ThrowLabel]: { readonly quota: boolean; readonly make: () => unknown } } = {
  'quota-name': { quota: true, make: () => new DOMException('storage full', 'QuotaExceededError') },
  'quota-legacy-name': { quota: true, make: () => new DOMException('storage full', 'NS_ERROR_DOM_QUOTA_REACHED') },
  'quota-code-22': { quota: true, make: () => domExceptionWithCode(22) },
  'quota-code-1014': { quota: true, make: () => domExceptionWithCode(1014) },
  error: { quota: false, make: () => new Error('boom') },
  'type-error': { quota: false, make: () => new TypeError('boom') },
  'security-error': { quota: false, make: () => new DOMException('blocked', 'SecurityError') },
  'error-named-quota': { quota: false, make: () => Object.assign(new Error('full'), { name: 'QuotaExceededError' }) },
  string: { quota: false, make: () => 'QuotaExceededError' },
  number: { quota: false, make: () => 22 },
  undefined: { quota: false, make: () => undefined },
  null: { quota: false, make: () => null },
  'object-named-quota': { quota: false, make: () => ({ name: 'QuotaExceededError', code: 22 }) },
};

type GetBehaviour =
  | { readonly kind: 'stored' }
  | { readonly kind: 'return'; readonly value: unknown }
  | { readonly kind: 'throw'; readonly error: ThrowLabel };
type SetBehaviour = { readonly kind: 'store' } | { readonly kind: 'throw'; readonly error: ThrowLabel };
type RemoveBehaviour = { readonly kind: 'remove' } | { readonly kind: 'throw'; readonly error: ThrowLabel };
type MethodBehaviours = { readonly get: GetBehaviour; readonly set: SetBehaviour; readonly remove: RemoveBehaviour };
/** `null` is a missing backend; otherwise one behaviour per backend method. */
type BackendBehaviour = null | MethodBehaviours;

const quotaLabelArb = fc.constantFrom<ThrowLabel>('quota-name', 'quota-legacy-name', 'quota-code-22', 'quota-code-1014');
const otherErrorLabelArb = fc.constantFrom<ThrowLabel>('error', 'type-error', 'security-error', 'error-named-quota');
const nonErrorLabelArb = fc.constantFrom<ThrowLabel>('string', 'number', 'undefined', 'null', 'object-named-quota');
const throwLabelArb: fc.Arbitrary<ThrowLabel> = fc.oneof(quotaLabelArb, otherErrorLabelArb, nonErrorLabelArb);

/** Values that are neither a string nor null, as a non-conforming `getItem` might return. */
const nonStringArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.integer(),
  fc.boolean(),
  fc.constant(undefined),
  fc.constant({}),
  fc.constant(['text']),
  fc.constant(Object('text')),
);

const getBehaviourArb: fc.Arbitrary<GetBehaviour> = fc.oneof(
  // Returns the stored text for the key, or null when nothing is stored.
  { weight: 4, arbitrary: fc.constant<GetBehaviour>({ kind: 'stored' }) },
  // Returns a fixed value: any string, null or a non-string.
  {
    weight: 1,
    arbitrary: fc
      .oneof(fc.string(), fc.constant(null), nonStringArb)
      .map((value): GetBehaviour => ({ kind: 'return', value })),
  },
  { weight: 1, arbitrary: throwLabelArb.map((error): GetBehaviour => ({ kind: 'throw', error })) },
);
const setBehaviourArb: fc.Arbitrary<SetBehaviour> = fc.oneof(
  fc.constant<SetBehaviour>({ kind: 'store' }),
  throwLabelArb.map((error): SetBehaviour => ({ kind: 'throw', error })),
);
const removeBehaviourArb: fc.Arbitrary<RemoveBehaviour> = fc.oneof(
  { weight: 2, arbitrary: fc.constant<RemoveBehaviour>({ kind: 'remove' }) },
  { weight: 1, arbitrary: throwLabelArb.map((error): RemoveBehaviour => ({ kind: 'throw', error })) },
);

const backendBehaviourArb: fc.Arbitrary<BackendBehaviour> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<BackendBehaviour>(null) },
  { weight: 6, arbitrary: fc.record({ get: getBehaviourArb, set: setBehaviourArb, remove: removeBehaviourArb }) },
);

interface BehaviourBackend extends StorageBackend {
  setCalls: number;
}

/** A backend double that follows `b` and keeps stored texts in `items`. */
function behaviourBackend(b: MethodBehaviours, items: Map<string, string>): BehaviourBackend {
  const backend: BehaviourBackend = {
    setCalls: 0,
    getItem: (key) => {
      if (b.get.kind === 'throw') throw THROWN[b.get.error].make();
      if (b.get.kind === 'return') return b.get.value as string | null;
      return items.get(key) ?? null;
    },
    setItem: (key, value) => {
      backend.setCalls += 1;
      if (b.set.kind === 'throw') throw THROWN[b.set.error].make();
      items.set(key, value);
    },
    removeItem: (key) => {
      if (b.remove.kind === 'throw') throw THROWN[b.remove.error].make();
      items.delete(key);
    },
  };
  return backend;
}

type CheckKind = 'accept' | 'reject' | 'throw' | 'is-number';

/** A check that follows `kind` and counts its calls in `calls.n`. */
function makeCheck(kind: CheckKind, calls: { n: number }): (data: unknown) => data is unknown {
  return (data: unknown): data is unknown => {
    calls.n += 1;
    if (kind === 'throw') throw new Error('check failed');
    if (kind === 'reject') return false;
    if (kind === 'is-number') return typeof data === 'number';
    return true;
  };
}

function otherVersionArb(version: number): fc.Arbitrary<number> {
  return fc.integer().filter((v) => v !== version);
}

/** The Envelope text for `version` whose string data makes it exactly `length` code units long. */
function envelopeTextOfLength(version: number, length: number): string {
  const empty = envelopeText(version, '').length;
  return envelopeText(version, 'a'.repeat(Math.max(0, length - empty)));
}

const extraKeyArb = fc.string({ maxLength: 8 }).filter((k) => k !== 'v' && k !== 'data');

/** JSON texts that are not an Envelope: other JSON values, missing keys, a non-integer `v`, an array. */
function notEnvelopeTextArb(version: number): fc.Arbitrary<string> {
  const nonIntegerArb = fc.oneof(
    fc.integer().map((n) => n + 0.5),
    fc.string({ maxLength: 4 }),
    fc.boolean(),
    fc.constant(null),
  );
  return fc.oneof(
    jsonValueArb.map((x) => JSON.stringify(x)),
    fc.constant(JSON.stringify({ v: version })),
    jsonValueArb.map((data) => JSON.stringify({ data })),
    fc.tuple(nonIntegerArb, jsonValueArb).map(([v, data]) => JSON.stringify({ v, data })),
    jsonValueArb.map((data) => JSON.stringify([version, data])),
  );
}

/** Stored texts for a read with `version`; the model classifies each text by itself, so any string is allowed. */
function storedTextArb(version: number): fc.Arbitrary<string> {
  const other = otherVersionArb(version);
  return fc.oneof(
    // An Envelope of the read version, in either key order.
    {
      weight: 3,
      arbitrary: fc
        .tuple(jsonValueArb, fc.boolean())
        .map(([data, dataFirst]) => (dataFirst ? JSON.stringify({ data, v: version }) : envelopeText(version, data))),
    },
    // An Envelope of another version.
    fc.tuple(other, jsonValueArb).map(([v, data]) => envelopeText(v, data)),
    // An Envelope with extra keys.
    fc
      .tuple(fc.oneof(fc.constant(version), other), jsonValueArb, fc.dictionary(extraKeyArb, jsonValueArb, { minKeys: 1, maxKeys: 3 }))
      .map(([v, data, extra]) => JSON.stringify({ ...extra, v, data })),
    // Non-JSON: a proper prefix of an Envelope text.
    fc.tuple(jsonValueArb, fc.nat()).map(([data, cut]) => {
      const text = envelopeText(version, data);
      return text.slice(0, cut % text.length);
    }),
    // Any string.
    fc.string(),
    // JSON that is not an Envelope.
    notEnvelopeTextArb(version),
    // Text from VALUE_CAP - 16 to VALUE_CAP + 64 code units: an Envelope of the read version, or non-JSON.
    fc.tuple(fc.integer({ min: -16, max: 64 }), fc.boolean()).map(([delta, asEnvelope]) =>
      asEnvelope ? envelopeTextOfLength(version, VALUE_CAP + delta) : 'x'.repeat(VALUE_CAP + delta),
    ),
  );
}

/** Values to write with `version`: JSON values, values whose Envelope is near or over VALUE_CAP, and values JSON.stringify rejects. */
function writeValueArb(version: number): fc.Arbitrary<Json> {
  const empty = envelopeText(version, '').length;
  return fc.oneof(
    { weight: 3, arbitrary: jsonValueArb },
    {
      weight: 2,
      arbitrary: fc.integer({ min: -16, max: 64 }).map((delta): Json => 'a'.repeat(Math.max(0, VALUE_CAP + delta - empty))),
    },
    {
      weight: 1,
      arbitrary: fc.constantFrom('bigint', 'circular').map((kind): Json => {
        if (kind === 'bigint') return { n: BigInt(10) } as unknown as Json;
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        return circular as unknown as Json;
      }),
    },
  );
}

const property12CaseArb = fc
  .tuple(fc.integer(), fc.boolean())
  .chain(([version, sameWriteVersion]) =>
    (sameWriteVersion ? fc.constant(version) : otherVersionArb(version)).chain((writeVersion) =>
      fc.record({
        behaviour: backendBehaviourArb,
        key: keyArb,
        version: fc.constant(version),
        initial: fc.option(storedTextArb(version), { nil: null, freq: 6 }),
        check: fc.oneof(
          { weight: 4, arbitrary: fc.constant<CheckKind>('accept') },
          { weight: 3, arbitrary: fc.constantFrom<CheckKind>('reject', 'throw', 'is-number') },
        ),
        writeVersion: fc.constant(writeVersion),
        value: writeValueArb(writeVersion),
      }),
    ),
  );

// Reference model of the C9 rules.

function failed(error: StorageError): StoreResult<never> {
  return { ok: false, error };
}

/** True for a parsed JSON value with exactly the own keys `data` and `v`, and an integer `v`. */
function modelIsEnvelope(parsed: unknown): parsed is { readonly v: number; readonly data: unknown } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const keys = Object.keys(parsed).sort();
  return keys.length === 2 && keys[0] === 'data' && keys[1] === 'v' && Number.isInteger((parsed as { v: unknown }).v);
}

interface ReadPrediction {
  readonly result: StoreResult<unknown>;
  readonly checkRuns: boolean;
}

function predictRead(
  b: BackendBehaviour,
  stored: ReadonlyMap<string, string>,
  key: string,
  version: number,
  check: CheckKind,
): ReadPrediction {
  const result = (r: StoreResult<unknown>, checkRuns = false): ReadPrediction => ({ result: r, checkRuns });
  if (b === null) return result(failed('unavailable'));
  if (b.get.kind === 'throw') return result(failed('unavailable'));
  const raw: unknown = b.get.kind === 'return' ? b.get.value : stored.has(key) ? stored.get(key) : null;
  if (raw === null) return result({ ok: true, value: null });
  if (typeof raw !== 'string') return result(failed('corrupt'));
  if (raw.length > VALUE_CAP) return result(failed('too-large'));
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result(failed('corrupt'));
  }
  if (!modelIsEnvelope(parsed)) return result(failed('corrupt'));
  if (parsed.v !== version) return result(failed('version'));
  const accepted = check === 'accept' || (check === 'is-number' && typeof parsed.data === 'number');
  return result(accepted ? { ok: true, value: parsed.data } : failed('corrupt'), true);
}

interface WritePrediction {
  readonly result: StoreResult<null>;
  readonly setCalls: number;
  /** The text the key holds after a successful write, or null when the stored text stays unchanged. */
  readonly written: string | null;
}

function predictWrite(b: BackendBehaviour, version: number, value: Json): WritePrediction {
  if (b === null) return { result: failed('unavailable'), setCalls: 0, written: null };
  let text: string;
  try {
    text = JSON.stringify({ v: version, data: value });
  } catch {
    return { result: failed('corrupt'), setCalls: 0, written: null };
  }
  if (text.length > VALUE_CAP) return { result: failed('too-large'), setCalls: 0, written: null };
  if (b.set.kind === 'throw') {
    return { result: failed(THROWN[b.set.error].quota ? 'quota' : 'unavailable'), setCalls: 1, written: null };
  }
  return { result: { ok: true, value: null }, setCalls: 1, written: text };
}

function predictRemove(b: BackendBehaviour): StoreResult<null> {
  if (b === null || b.remove.kind === 'throw') return failed('unavailable');
  return { ok: true, value: null };
}

type Outcome = StorageError | 'read ok null' | 'read ok value' | 'write ok' | 'remove ok';
const ALL_OUTCOMES: readonly Outcome[] = [
  'unavailable',
  'quota',
  'too-large',
  'corrupt',
  'version',
  'read ok null',
  'read ok value',
  'write ok',
  'remove ok',
];

function outcomeOf(call: 'read' | 'write' | 'remove', r: StoreResult<unknown>): Outcome {
  if (!r.ok) return r.error;
  if (call === 'read') return r.value === null ? 'read ok null' : 'read ok value';
  return call === 'write' ? 'write ok' : 'remove ok';
}

describe('Feature: practice-path, Property 12: Storage calls return a Store_Result for every backend behaviour', () => {
  // **Validates: Requirements 11.5, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.15**
  it('readJson, writeJson and removeKey return the Store_Result the C9 reference model predicts', () => {
    const seen = new Map<Outcome, number>();
    const tally = (call: 'read' | 'write' | 'remove', r: StoreResult<unknown>): void => {
      const outcome = outcomeOf(call, r);
      seen.set(outcome, (seen.get(outcome) ?? 0) + 1);
    };

    fc.assert(
      fc.property(property12CaseArb, (c) => {
        const items = new Map<string, string>(c.initial === null ? [] : [[c.key, c.initial]]);
        const model = new Map(items);
        const backend = c.behaviour === null ? null : behaviourBackend(c.behaviour, items);
        const checkCalls = { n: 0 };
        const check = makeCheck(c.check, checkCalls);

        // A call that throws fails the property, so each call below also checks "without throwing".
        const read = (): void => {
          const expected = predictRead(c.behaviour, model, c.key, c.version, c.check);
          const before = checkCalls.n;
          const actual = readJson(backend, c.key, c.version, check);
          expect(actual).toEqual(expected.result);
          // The check runs only after the version check passes.
          expect(checkCalls.n - before).toBe(expected.checkRuns ? 1 : 0);
          tally('read', actual);
        };

        read();

        const expectedWrite = predictWrite(c.behaviour, c.writeVersion, c.value);
        const textBefore = items.get(c.key);
        const setBefore = backend?.setCalls ?? 0;
        const written = writeJson(backend, c.key, c.writeVersion, c.value);
        expect(written).toEqual(expectedWrite.result);
        expect((backend?.setCalls ?? 0) - setBefore).toBe(expectedWrite.setCalls);
        if (!written.ok && written.error === 'too-large') {
          // A write over VALUE_CAP makes no setItem call and leaves the stored text unchanged.
          expect(backend?.setCalls ?? 0).toBe(setBefore);
          expect(items.get(c.key)).toBe(textBefore);
        }
        if (expectedWrite.written !== null) model.set(c.key, expectedWrite.written);
        expect(items).toEqual(model);
        tally('write', written);

        read();

        const expectedRemove = predictRemove(c.behaviour);
        const removed = removeKey(backend, c.key);
        expect(removed).toEqual(expectedRemove);
        if (expectedRemove.ok) model.delete(c.key);
        expect(items).toEqual(model);
        tally('remove', removed);

        read();
      }),
      { numRuns: NUM_RUNS },
    );

    console.info('Property 12 outcome counts:', Object.fromEntries(ALL_OUTCOMES.map((o) => [o, seen.get(o) ?? 0])));
    // The generated cases reached all five Storage_Errors and every ok case.
    for (const outcome of ALL_OUTCOMES) {
      expect(seen.get(outcome) ?? 0, outcome).toBeGreaterThan(0);
    }
  });
});
