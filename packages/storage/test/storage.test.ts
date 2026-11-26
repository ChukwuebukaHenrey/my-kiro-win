import { afterEach, describe, expect, it, vi } from 'vitest';
import { VALUE_CAP, isQuotaError, readJson, removeKey, writeJson } from '../src/index.ts';
import type { Json, StorageBackend } from '../src/index.ts';

// Example tests for the Storage_Wrapper rules of design C9 (Requirement 11), one case per rule,
// run against an in-memory Storage_Backend double.

interface MemoryBackend extends StorageBackend {
  readonly items: Map<string, string>;
  setCalls: number;
}

function memoryBackend(initial: Record<string, string> = {}): MemoryBackend {
  const items = new Map<string, string>(Object.entries(initial));
  const backend: MemoryBackend = {
    items,
    setCalls: 0,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      backend.setCalls += 1;
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
  return backend;
}

/** A backend whose `setItem` throws `error` and records each call. */
function throwingSetBackend(error: unknown): MemoryBackend {
  const backend = memoryBackend();
  backend.setItem = () => {
    backend.setCalls += 1;
    throw error;
  };
  return backend;
}

/** An Envelope text for version 1 whose total length is exactly `length` code units. */
function envelopeOfLength(length: number): string {
  const empty = '{"v":1,"data":""}';
  return '{"v":1,"data":"' + 'a'.repeat(length - empty.length) + '"}';
}

/** A string value whose version-1 Envelope text is exactly `length` code units long. */
function valueForEnvelopeLength(length: number): string {
  return 'a'.repeat(length - '{"v":1,"data":""}'.length);
}

/** A DOMException whose `code` is overridden, for the legacy quota codes. */
function domExceptionWithCode(code: number): DOMException {
  const e = new DOMException('storage full', 'UnknownError');
  Object.defineProperty(e, 'code', { value: code });
  return e;
}

const KEY = 'dreame.test';
const isNumber = (data: unknown): data is number => typeof data === 'number';
const isAnything = (data: unknown): data is unknown => true;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readJson', () => {
  it('returns unavailable when the backend is null', () => {
    expect(readJson(null, KEY, 1, isAnything)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('returns unavailable when getItem throws', () => {
    const backend = memoryBackend();
    backend.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    expect(readJson(backend, KEY, 1, isAnything)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('returns { ok: true, value: null } when nothing is stored', () => {
    expect(readJson(memoryBackend(), KEY, 1, isAnything)).toEqual({ ok: true, value: null });
  });

  it('returns corrupt when getItem returns something other than a string', () => {
    const backend = memoryBackend();
    backend.getItem = () => 42 as unknown as string;
    expect(readJson(backend, KEY, 1, isAnything)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('returns too-large for text over VALUE_CAP before JSON.parse runs', () => {
    const parse = vi.spyOn(JSON, 'parse');
    const backend = memoryBackend({ [KEY]: envelopeOfLength(VALUE_CAP + 1) });
    expect(readJson(backend, KEY, 1, isAnything)).toEqual({ ok: false, error: 'too-large' });
    expect(parse).not.toHaveBeenCalled();
  });

  it('reads an Envelope of exactly VALUE_CAP code units', () => {
    const text = envelopeOfLength(VALUE_CAP);
    expect(text.length).toBe(VALUE_CAP);
    const result = readJson(memoryBackend({ [KEY]: text }), KEY, 1, isAnything);
    expect(result.ok).toBe(true);
  });

  it('returns corrupt for text that is not JSON', () => {
    const backend = memoryBackend({ [KEY]: '{"v":1,"data":' });
    expect(readJson(backend, KEY, 1, isAnything)).toEqual({ ok: false, error: 'corrupt' });
  });

  it.each([
    ['an extra key', '{"v":1,"data":5,"x":0}'],
    ['a missing data key', '{"v":1}'],
    ['a non-integer v', '{"v":1.5,"data":5}'],
    ['a string v', '{"v":"1","data":5}'],
    ['an array', '[1,5]'],
    ['a number', '5'],
    ['null', 'null'],
  ])('returns corrupt for an Envelope with %s', (_label, text) => {
    const backend = memoryBackend({ [KEY]: text });
    expect(readJson(backend, KEY, 1, isAnything)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('returns version on a version mismatch even when the check would fail, without running the check', () => {
    const check = vi.fn(isNumber);
    const backend = memoryBackend({ [KEY]: '{"v":2,"data":"not a number"}' });
    expect(readJson(backend, KEY, 1, check as unknown as typeof isNumber)).toEqual({ ok: false, error: 'version' });
    expect(check).not.toHaveBeenCalled();
  });

  it('returns corrupt when the check returns false', () => {
    const backend = memoryBackend({ [KEY]: '{"v":1,"data":"text"}' });
    expect(readJson(backend, KEY, 1, isNumber)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('returns corrupt when the check throws', () => {
    const throwing = (_data: unknown): _data is number => {
      throw new Error('check failed');
    };
    const backend = memoryBackend({ [KEY]: '{"v":1,"data":5}' });
    expect(readJson(backend, KEY, 1, throwing)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('returns the data of a valid Envelope that passes the check', () => {
    const backend = memoryBackend({ [KEY]: '{"v":1,"data":7}' });
    expect(readJson(backend, KEY, 1, isNumber)).toEqual({ ok: true, value: 7 });
  });
});

describe('writeJson', () => {
  it('returns unavailable when the backend is null', () => {
    expect(writeJson(null, KEY, 1, 5)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('stores the Envelope as JSON text, and readJson returns the value', () => {
    const backend = memoryBackend();
    const value: Json = { a: [1, 'two', null, true], b: { c: -3.5 } };
    expect(writeJson(backend, KEY, 3, value)).toEqual({ ok: true, value: null });
    expect(backend.items.get(KEY)).toBe('{"v":3,"data":{"a":[1,"two",null,true],"b":{"c":-3.5}}}');
    expect(readJson(backend, KEY, 3, isAnything)).toEqual({ ok: true, value });
  });

  it('writes an Envelope of exactly VALUE_CAP code units', () => {
    const backend = memoryBackend();
    expect(writeJson(backend, KEY, 1, valueForEnvelopeLength(VALUE_CAP))).toEqual({ ok: true, value: null });
    expect(backend.items.get(KEY)?.length).toBe(VALUE_CAP);
  });

  it('returns too-large over VALUE_CAP with no setItem call and the stored text unchanged', () => {
    const backend = memoryBackend({ [KEY]: '{"v":1,"data":"old"}' });
    expect(writeJson(backend, KEY, 1, valueForEnvelopeLength(VALUE_CAP + 1))).toEqual({ ok: false, error: 'too-large' });
    expect(backend.setCalls).toBe(0);
    expect(backend.items.get(KEY)).toBe('{"v":1,"data":"old"}');
  });

  it('returns corrupt for a value that JSON.stringify cannot serialize, with no setItem call', () => {
    const backend = memoryBackend();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson(backend, KEY, 1, 10n as unknown as Json)).toEqual({ ok: false, error: 'corrupt' });
    expect(writeJson(backend, KEY, 1, circular as unknown as Json)).toEqual({ ok: false, error: 'corrupt' });
    expect(backend.setCalls).toBe(0);
  });

  it.each([
    ["DOMException('…', 'QuotaExceededError')", new DOMException('storage full', 'QuotaExceededError')],
    ['the name NS_ERROR_DOM_QUOTA_REACHED', new DOMException('storage full', 'NS_ERROR_DOM_QUOTA_REACHED')],
    ['the code 22', domExceptionWithCode(22)],
    ['the code 1014', domExceptionWithCode(1014)],
  ])('returns quota when setItem throws %s', (_label, error) => {
    const backend = throwingSetBackend(error);
    expect(writeJson(backend, KEY, 1, 5)).toEqual({ ok: false, error: 'quota' });
    expect(backend.setCalls).toBe(1);
  });

  it.each([
    ['an Error', new Error('boom')],
    ['a SecurityError DOMException', new DOMException('blocked', 'SecurityError')],
    ['a plain object named QuotaExceededError', { name: 'QuotaExceededError', code: 22 }],
  ])('returns unavailable when setItem throws %s', (_label, error) => {
    expect(writeJson(throwingSetBackend(error), KEY, 1, 5)).toEqual({ ok: false, error: 'unavailable' });
  });
});

describe('removeKey', () => {
  it('removes the key and returns { ok: true, value: null }', () => {
    const backend = memoryBackend({ [KEY]: '{"v":1,"data":5}', other: 'x' });
    expect(removeKey(backend, KEY)).toEqual({ ok: true, value: null });
    expect(backend.items.has(KEY)).toBe(false);
    expect(backend.items.get('other')).toBe('x');
  });

  it('returns unavailable when the backend is null or removeItem throws', () => {
    const backend = memoryBackend();
    backend.removeItem = () => {
      throw new Error('blocked');
    };
    expect(removeKey(null, KEY)).toEqual({ ok: false, error: 'unavailable' });
    expect(removeKey(backend, KEY)).toEqual({ ok: false, error: 'unavailable' });
  });
});

describe('isQuotaError', () => {
  it('accepts the quota DOMExceptions and rejects other values', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError(new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true);
    expect(isQuotaError(domExceptionWithCode(22))).toBe(true);
    expect(isQuotaError(domExceptionWithCode(1014))).toBe(true);
    expect(isQuotaError(new DOMException('blocked', 'SecurityError'))).toBe(false);
    expect(isQuotaError(new Error('QuotaExceededError'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});
