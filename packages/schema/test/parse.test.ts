import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_MANIFEST_JSON_BYTES } from '../src/ids.ts';
import { parseManifestText, utf8ByteLength } from '../src/parse.ts';

const encodedLength = (s: string): number => new TextEncoder().encode(s).length;

// Any UTF-16 code unit (so lone surrogates appear) or any full code point (valid pairs).
const unitArb = fc.oneof(
  fc.integer({ min: 0, max: 0xffff }).map((c) => String.fromCharCode(c)),
  fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }),
);
const mixedStringArb = fc.string({ unit: unitArb, maxLength: 64 });

// Padding characters of 1, 2, 3 and 4 UTF-8 bytes. None starts with a low surrogate, so
// appending one never merges with a lone high surrogate at the end of the prefix.
const padArb = fc.constantFrom(
  { ch: 'a', bytes: 1 },
  { ch: 'é', bytes: 2 },
  { ch: '€', bytes: 3 },
  { ch: '😀', bytes: 4 },
);

describe('utf8ByteLength', () => {
  it('matches TextEncoder for 1-, 2-, 3- and 4-byte characters', () => {
    for (const s of ['', 'a', 'é', '€', '😀', 'aé€😀']) {
      expect(utf8ByteLength(s)).toBe(encodedLength(s));
    }
  });

  it('counts lone surrogates as 3 bytes like TextEncoder', () => {
    for (const s of ['\uD800', '\uDBFF', '\uDC00', '\uDFFF', 'a\uD800b', '\uDC00\uD800', '\uD83D']) {
      expect(utf8ByteLength(s)).toBe(encodedLength(s));
    }
    expect(utf8ByteLength('\uD800')).toBe(3);
    expect(utf8ByteLength('\uDC00\uD800')).toBe(6);
    expect(utf8ByteLength('\uD83D\uDE00')).toBe(4);
  });
});

describe('parseManifestText', () => {
  it('accepts a JSON string of exactly 65,536 bytes built from multi-byte characters', () => {
    // 2 quotes + 21,844 × 3-byte '€' + one 2-byte 'é' = 65,536 bytes.
    const body = '€'.repeat(21_844) + 'é';
    const text = `"${body}"`;
    expect(encodedLength(text)).toBe(MAX_MANIFEST_JSON_BYTES);
    expect(utf8ByteLength(text)).toBe(MAX_MANIFEST_JSON_BYTES);
    expect(parseManifestText(text)).toEqual({ ok: true, value: body });
  });

  it('rejects 65,537 bytes with exactly one parse/too-large diagnostic', () => {
    // 2 quotes + 21,845 × 3-byte '€' = 65,537 bytes.
    const text = `"${'€'.repeat(21_845)}"`;
    expect(encodedLength(text)).toBe(MAX_MANIFEST_JSON_BYTES + 1);
    const result = parseManifestText(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      stage: 'parse',
      code: 'too-large',
      path: '',
    });
  });

  it('returns parse/invalid-json carrying the JSON parser position message', () => {
    const text = '{"a":}';
    let parserMessage = '';
    try {
      JSON.parse(text);
    } catch (err) {
      parserMessage = (err as Error).message;
    }
    expect(parserMessage).not.toBe('');
    const result = parseManifestText(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toHaveLength(1);
    const [d] = result.diagnostics;
    expect(d).toMatchObject({ severity: 'error', stage: 'parse', code: 'invalid-json', path: '' });
    expect(d?.message).toContain(parserMessage);
  });

  it('returns the parsed value for valid JSON', () => {
    const value = { schemaVersion: 1, nodes: [{ id: 'start', type: 'content' }], flag: true, n: null };
    expect(parseManifestText(JSON.stringify(value))).toEqual({ ok: true, value });
    expect(parseManifestText('42')).toEqual({ ok: true, value: 42 });
  });
});

// Feature: runtime-core, Property 8: The 64 KB cap is checked before `JSON.parse`
// **Validates: Requirements 5.1, 5.2**
// A passing run is evidence for this property over the generated strings, not a proof.
describe('Feature: runtime-core, Property 8: The 64 KB cap is checked before `JSON.parse`', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('utf8ByteLength equals TextEncoder length for random strings', () => {
    fc.assert(
      fc.property(mixedStringArb, (s) => {
        expect(utf8ByteLength(s)).toBe(encodedLength(s));
      }),
      { numRuns: 300 },
    );
  });

  it('returns parse/too-large without calling JSON.parse above 65,536 bytes', () => {
    fc.assert(
      fc.property(mixedStringArb, padArb, fc.integer({ min: 1, max: 1_000 }), (prefix, pad, overshoot) => {
        const needed = MAX_MANIFEST_JSON_BYTES + overshoot - encodedLength(prefix);
        const text = prefix + pad.ch.repeat(Math.max(0, Math.ceil(needed / pad.bytes)));
        expect(encodedLength(text)).toBeGreaterThan(MAX_MANIFEST_JSON_BYTES);
        const spy = vi.spyOn(JSON, 'parse');
        try {
          const result = parseManifestText(text);
          expect(spy).not.toHaveBeenCalled();
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.diagnostics).toHaveLength(1);
          expect(result.diagnostics[0]).toMatchObject({ stage: 'parse', code: 'too-large' });
        } finally {
          spy.mockRestore();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('calls JSON.parse exactly once at or under 65,536 bytes', () => {
    fc.assert(
      fc.property(
        mixedStringArb,
        padArb,
        fc.integer({ min: 0, max: MAX_MANIFEST_JSON_BYTES }),
        (prefix, pad, target) => {
          const room = target - encodedLength(prefix);
          const text = prefix + pad.ch.repeat(Math.max(0, Math.floor(room / pad.bytes)));
          expect(encodedLength(text)).toBeLessThanOrEqual(MAX_MANIFEST_JSON_BYTES);
          const spy = vi.spyOn(JSON, 'parse');
          try {
            const result = parseManifestText(text);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(text);
            if (!result.ok) {
              expect(result.diagnostics.map((d) => d.code)).toEqual(['invalid-json']);
            }
          } finally {
            spy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
