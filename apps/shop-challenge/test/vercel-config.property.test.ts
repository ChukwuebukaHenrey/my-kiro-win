// Property 11 (design "Correctness Properties", C14). The Vercel header rule and the rewrite
// rule of apps/shop-challenge/vercel.json apply to every request path, the header rule sets
// exactly the four headers of Architecture Spec §A3 with values byte-equal to the spec text
// read at run time, and the rewrite destination is /index.html. A passing run is evidence for
// this property over the generated paths, not a proof.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const NUM_RUNS = 200;

const EXPECTED_KEYS = [
  'Content-Security-Policy',
  'Referrer-Policy',
  'X-Content-Type-Options',
  'Permissions-Policy',
] as const;

interface HeaderEntry {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

interface Rewrite {
  source: string;
  destination: string;
}

interface VercelConfig {
  rewrites: Rewrite[];
  headers: HeaderRule[];
}

const configPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
const specPath = fileURLToPath(new URL('../../../docs/Architecture_and_UI_Spec.md', import.meta.url));

/**
 * Reads the security headers from Architecture Spec §A3. §A3 runs from the `### A3.` heading to
 * the next `###` heading. Its "Hosting and security" table has a row whose first cell is
 * **`vercel.json` headers**; the second cell lists each header as a code span `Key: value`,
 * with the spans separated by ` · `. Each span is split at its first `: `.
 */
function parseSpecHeaders(specText: string): Map<string, string> {
  const lines = specText.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('### A3.'));
  if (start < 0) throw new Error('Architecture Spec: heading "### A3." not found');
  const rest = lines.slice(start + 1);
  const endOffset = rest.findIndex((l) => l.startsWith('### ') || l.startsWith('## '));
  const section = endOffset < 0 ? rest : rest.slice(0, endOffset);

  const rows = section.filter((l) => l.startsWith('| **`vercel.json` headers**'));
  if (rows.length !== 1) {
    throw new Error(`Architecture Spec §A3: expected 1 "vercel.json headers" table row, found ${rows.length}`);
  }
  const cells = (rows[0] ?? '').split('|');
  // cells: ['', ' **`vercel.json` headers** ', ' `K: v` · `K: v` ... ', '']
  const valueCell = cells[2];
  if (valueCell === undefined) throw new Error('Architecture Spec §A3: headers row has no value cell');

  const headers = new Map<string, string>();
  for (const m of valueCell.matchAll(/`([^`]+)`/g)) {
    const span = m[1] ?? '';
    const sep = span.indexOf(': ');
    if (sep <= 0) throw new Error(`Architecture Spec §A3: header span without "Key: value": ${span}`);
    const key = span.slice(0, sep);
    if (headers.has(key)) throw new Error(`Architecture Spec §A3: header ${key} listed twice`);
    headers.set(key, span.slice(sep + 2));
  }
  if (headers.size < EXPECTED_KEYS.length) {
    throw new Error(
      `Architecture Spec §A3: found ${headers.size} headers (${[...headers.keys()].join(', ')}), expected ${EXPECTED_KEYS.length}`,
    );
  }
  return headers;
}

/** Reads a Vercel `source` of the form `/(.*)` as an anchored regular expression. */
function sourceRegExp(source: string): RegExp {
  return new RegExp(`^${source}$`);
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

// --- Path generators: every path begins with `/` and has no query or fragment. ---

const idArb = fc.stringMatching(/^[a-z0-9-]{1,24}$/);

const routePathArb = fc.oneof(
  fc.constant('/'),
  fc.constant('/play/demo'),
  idArb.map((id) => `/play/demo/${id}`),
);

const assetPathArb = fc
  .tuple(
    fc.stringMatching(/^[A-Za-z0-9_-]{1,24}$/),
    fc.constantFrom('js', 'css', 'png', 'svg', 'webp', 'woff2', 'ico', 'json', 'map', 'txt'),
  )
  .map(([name, ext]) => `/assets/${name}.${ext}`);

/** RFC 3986 pchar characters (unreserved, sub-delims, `:` and `@`), without `%`. */
const segmentArb = fc.stringMatching(/^[A-Za-z0-9\-._~!$&'()*+,;=:@]{0,16}$/);

const deepPathArb = fc
  .array(segmentArb, { minLength: 2, maxLength: 10 })
  .map((segments) => `/${segments.join('/')}`);

const encodedPathArb = fc
  .array(fc.string({ unit: 'grapheme', maxLength: 8 }), { minLength: 1, maxLength: 5 })
  .map((segments) => `/${segments.map((s) => encodeURIComponent(s)).join('/')}`);

/** Free strings of path characters, including `%` and `/`, with no `?` or `#`. */
const freePathArb = fc
  .stringMatching(/^[A-Za-z0-9\-._~!$&'()*+,;=:@%/]{0,40}$/)
  .map((s) => `/${s}`);

const requestPathArb = fc.oneof(routePathArb, assetPathArb, deepPathArb, encodedPathArb, freePathArb);

describe('Feature: shop-challenge, Property 11: The hosting headers and rewrite apply to every path', () => {
  // **Validates: Requirements 15.1, 15.2**
  it('Feature: shop-challenge, Property 11: The hosting headers and rewrite apply to every path', () => {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as VercelConfig;
    const specHeaders = parseSpecHeaders(readFileSync(specPath, 'utf8'));
    expect([...specHeaders.keys()]).toEqual([...EXPECTED_KEYS]);

    expect(config.headers).toHaveLength(1);
    expect(config.rewrites).toHaveLength(1);
    const headerRule = config.headers[0] as HeaderRule;
    const rewrite = config.rewrites[0] as Rewrite;
    const headerSource = sourceRegExp(headerRule.source);
    const rewriteSource = sourceRegExp(rewrite.source);

    fc.assert(
      fc.property(requestPathArb, (path) => {
        expect(path.startsWith('/')).toBe(true);
        expect(headerSource.test(path)).toBe(true);
        expect(rewriteSource.test(path)).toBe(true);
        expect(rewrite.destination).toBe('/index.html');

        // Exactly the four §A3 headers, no more and no fewer, each value byte-equal to §A3.
        expect(headerRule.headers).toHaveLength(EXPECTED_KEYS.length);
        expect(headerRule.headers.map((h) => h.key).sort()).toEqual([...specHeaders.keys()].sort());
        for (const h of headerRule.headers) {
          const expected = specHeaders.get(h.key);
          expect(expected).toBeDefined();
          expect(h.value).toBe(expected);
          expect(utf8(h.value)).toEqual(utf8(expected ?? ''));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
