import { describe, expect, it } from 'vitest';
import { MAX_MANIFEST_JSON_BYTES } from '../src/ids.ts';
import { parseManifestText, utf8ByteLength } from '../src/parse.ts';

const encodedLength = (s: string): number => new TextEncoder().encode(s).length;

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
