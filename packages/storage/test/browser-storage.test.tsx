import { afterEach, describe, expect, it } from 'vitest';
import { browserStorage } from '../src/index.ts';

// browserStorage() in jsdom (design C9; Requirement 11.4). Each case that replaces the global
// storage property restores the saved descriptor in afterEach, and the restore is checked.

const KEY = 'localStorage';
const original: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(globalThis, KEY);

function replaceGlobal(descriptor: PropertyDescriptor): void {
  Object.defineProperty(globalThis, KEY, { configurable: true, ...descriptor });
}

afterEach(() => {
  if (original !== undefined) Object.defineProperty(globalThis, KEY, original);
  expect(Object.getOwnPropertyDescriptor(globalThis, KEY)).toEqual(original);
  expect(browserStorage()).toBe(globalThis.localStorage);
});

describe('browserStorage (Requirement 11.4)', () => {
  it('the jsdom global storage property is present and configurable', () => {
    expect(original).toBeDefined();
    expect(original?.configurable).toBe(true);
  });

  it('returns the jsdom storage object', () => {
    const storage = browserStorage();
    expect(storage).not.toBeNull();
    expect(storage).toBe(globalThis.localStorage);
    storage?.setItem('browser-storage-test', 'x');
    expect(globalThis.localStorage.getItem('browser-storage-test')).toBe('x');
    storage?.removeItem('browser-storage-test');
    expect(globalThis.localStorage.getItem('browser-storage-test')).toBeNull();
  });

  it('returns null when reading the global throws', () => {
    replaceGlobal({
      get(): never {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(() => globalThis.localStorage).toThrow();
    expect(browserStorage()).toBeNull();
  });

  it('returns null when the global is undefined', () => {
    replaceGlobal({ value: undefined, writable: true });
    expect(globalThis.localStorage).toBeUndefined();
    expect(browserStorage()).toBeNull();
  });
});
