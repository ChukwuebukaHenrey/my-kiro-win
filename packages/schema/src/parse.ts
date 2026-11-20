// Byte cap and JSON parsing for manifest text (Req 5.1–5.4, Brief C2, security.md).
import { MAX_MANIFEST_JSON_BYTES } from './ids.ts';
import { severityOf, type Diagnostic } from './diagnostics.ts';

export type ParseResult = { ok: true; value: unknown } | { ok: false; diagnostics: Diagnostic[] };

/**
 * UTF-8 length of `text`, equal to `new TextEncoder().encode(text).length`, without
 * allocating an encoded copy. A lone surrogate counts as 3 bytes, because `TextEncoder`
 * replaces it with U+FFFD.
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) {
      bytes += 1;
    } else if (c < 0x800) {
      bytes += 2;
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < n) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4; // valid surrogate pair: one code point above U+FFFF
        i++;
      } else {
        bytes += 3; // lone high surrogate
      }
    } else {
      bytes += 3; // rest of the BMP, including lone surrogates
    }
  }
  return bytes;
}

function parseDiagnostic(code: 'too-large' | 'invalid-json', message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'parse', code, path: '', message };
}

/** Applies the 64 KB cap before `JSON.parse`, then parses. Never throws. */
export function parseManifestText(text: string): ParseResult {
  const size = utf8ByteLength(text);
  if (size > MAX_MANIFEST_JSON_BYTES) {
    return {
      ok: false,
      diagnostics: [
        parseDiagnostic(
          'too-large',
          `Manifest is ${size} bytes of UTF-8; the limit is ${MAX_MANIFEST_JSON_BYTES} bytes.`,
        ),
      ],
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, diagnostics: [parseDiagnostic('invalid-json', `Manifest is not valid JSON: ${detail}`)] };
  }
}
