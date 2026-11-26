// Storage_Wrapper (design C9, D62; Requirement 11). Pure functions that take the Storage_Backend
// as a parameter, so tests pass an in-memory double. This file imports nothing, every function
// wraps its body in try/catch, and it is the only source file that names the browser storage
// global (Requirement 19.3). Values are stored as the Envelope {"v":<version>,"data":<value>}.

export type StorageError = 'unavailable' | 'quota' | 'too-large' | 'corrupt' | 'version';
export type StoreResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: StorageError };

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type Json = null | boolean | number | string | readonly Json[] | { readonly [k: string]: Json };

/** 65,536 UTF-16 code units for the serialized Envelope text (Value_Cap). */
export const VALUE_CAP = 65_536;

const QUOTA_NAMES: readonly string[] = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'];
const QUOTA_CODES: readonly number[] = [22, 1014];

function fail(error: StorageError): StoreResult<never> {
  return { ok: false, error };
}

/** The browser storage object, or null when the global is missing or reading it throws (Requirement 11.4). */
export function browserStorage(): StorageBackend | null {
  try {
    const storage: unknown = globalThis.localStorage;
    if (storage === undefined || storage === null) return null;
    return storage as StorageBackend;
  } catch {
    return null;
  }
}

/** True when `value` is a plain object whose own keys are exactly `v` and `data`, with an integer `v`. */
function isEnvelope(value: unknown): value is { v: number; data: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !Object.hasOwn(value, 'v') || !Object.hasOwn(value, 'data')) return false;
  return Number.isInteger((value as { v: unknown }).v);
}

/** Reads one Envelope; `{ ok: true, value: null }` when nothing is stored (Requirements 11.7, 11.9, 11.10, 11.12, 11.13). */
export function readJson<T>(
  backend: StorageBackend | null,
  key: string,
  version: number,
  check: (data: unknown) => data is T,
): StoreResult<T | null> {
  try {
    if (backend === null) return fail('unavailable');
    let text: unknown;
    try {
      text = backend.getItem(key);
    } catch {
      return fail('unavailable');
    }
    if (text === null) return { ok: true, value: null };
    if (typeof text !== 'string') return fail('corrupt');
    // The size check runs before JSON.parse (Requirement 11.9).
    if (text.length > VALUE_CAP) return fail('too-large');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fail('corrupt');
    }
    if (!isEnvelope(parsed)) return fail('corrupt');
    // The version check runs before the data check, so another version reports `version` (D62).
    if (parsed.v !== version) return fail('version');
    const data: unknown = parsed.data;
    let accepted: boolean;
    try {
      accepted = check(data);
    } catch {
      return fail('corrupt');
    }
    if (!accepted) return fail('corrupt');
    return { ok: true, value: data as T };
  } catch {
    return fail('unavailable');
  }
}

/** Writes `{ v: version, data: value }` as JSON text (Requirements 11.6, 11.8, 11.10, 11.11). */
export function writeJson(backend: StorageBackend | null, key: string, version: number, value: Json): StoreResult<null> {
  try {
    if (backend === null) return fail('unavailable');
    let text: unknown;
    try {
      text = JSON.stringify({ v: version, data: value });
    } catch {
      return fail('corrupt');
    }
    if (typeof text !== 'string') return fail('corrupt');
    // Over the Value_Cap, nothing is written and the stored text stays unchanged (Requirement 11.8).
    if (text.length > VALUE_CAP) return fail('too-large');
    try {
      backend.setItem(key, text);
    } catch (e) {
      return fail(isQuotaError(e) ? 'quota' : 'unavailable');
    }
    return { ok: true, value: null };
  } catch {
    return fail('unavailable');
  }
}

/** Removes the key (Requirements 11.5, 11.10). */
export function removeKey(backend: StorageBackend | null, key: string): StoreResult<null> {
  try {
    if (backend === null) return fail('unavailable');
    backend.removeItem(key);
    return { ok: true, value: null };
  } catch {
    return fail('unavailable');
  }
}

/** True for a DOMException named QuotaExceededError or NS_ERROR_DOM_QUOTA_REACHED, or with code 22 or 1014. */
export function isQuotaError(e: unknown): boolean {
  try {
    if (typeof DOMException === 'undefined' || !(e instanceof DOMException)) return false;
    return QUOTA_NAMES.includes(e.name) || QUOTA_CODES.includes(e.code);
  } catch {
    return false;
  }
}
