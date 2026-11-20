import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkHttpsUrl, SHORTENER_HOSTS } from '../src/url.ts';

const PATH = '/nodes/2/config/cta/url';

function expectUnsafe(url: string): void {
  const d = checkHttpsUrl(url, PATH);
  expect(d).toHaveLength(1);
  expect(d[0]).toMatchObject({ code: 'unsafe-url', path: PATH, severity: 'error' });
}

describe('checkHttpsUrl', () => {
  it('accepts an https wa.me link', () => {
    expect(checkHttpsUrl('https://wa.me/15550100?text=Hi', PATH)).toEqual([]);
  });

  it('accepts an ordinary https link', () => {
    expect(checkHttpsUrl('https://www.example.com/shop', PATH)).toEqual([]);
  });

  it('accepts a URL of exactly 2,048 characters', () => {
    const base = 'https://example.com/';
    const url = base + 'a'.repeat(2048 - base.length);
    expect(url).toHaveLength(2048);
    expect(checkHttpsUrl(url, PATH)).toEqual([]);
  });

  it.each([
    'javascript:alert(1)',
    'http://example.com/',
    'data:text/html,<p>hi</p>',
  ])('rejects the non-https URL %s', (url) => {
    expectUnsafe(url);
  });

  it('lists exactly the ten shortener hosts of Req 6.3', () => {
    expect([...SHORTENER_HOSTS]).toEqual([
      'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
      'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at',
    ]);
  });

  it.each([...SHORTENER_HOSTS])('rejects the shortener %s with and without www.', (host) => {
    expectUnsafe(`https://${host}/abc`);
    expectUnsafe(`https://www.${host}/abc`);
    expectUnsafe(`https://WWW.${host.toUpperCase()}/abc`);
  });

  it('rejects credentials in the URL', () => {
    expectUnsafe('https://user:secret@example.com/');
    expectUnsafe('https://user@example.com/');
    expectUnsafe('https://:secret@example.com/');
  });

  it('rejects an empty host', () => {
    expectUnsafe('https://');
    expectUnsafe('https:');
  });

  it('rejects a string that does not parse', () => {
    expectUnsafe('not a url');
  });

  it('rejects a 2,049-character URL', () => {
    const base = 'https://example.com/';
    const url = base + 'a'.repeat(2049 - base.length);
    expect(url).toHaveLength(2049);
    expectUnsafe(url);
  });
});

// Feature: runtime-core, Property 11: Only `https:` URLs pass the URL check
// **Validates: Requirements 6.1, 6.2**
// A passing run is evidence for this property over the generated strings, not a proof.
describe('Feature: runtime-core, Property 11: Only `https:` URLs pass the URL check', () => {
  // Independent oracle for Req 6.1: collects every broken rule instead of returning early.
  function oracleAllows(url: string): boolean {
    const broken: string[] = [];
    if (url.length > 2048) broken.push('length');
    let parsed: URL | undefined;
    try {
      parsed = new URL(url);
    } catch {
      broken.push('parse');
    }
    if (parsed !== undefined) {
      if (parsed.protocol !== 'https:') broken.push('protocol');
      if (parsed.hostname.length === 0) broken.push('host');
      if (parsed.username.length > 0 || parsed.password.length > 0) broken.push('credentials');
      const bare = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const shorteners = [
        'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
        'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at',
      ];
      if (shorteners.includes(bare)) broken.push('shortener');
    }
    return broken.length === 0;
  }

  function mixCase(s: string, flags: readonly boolean[]): string {
    return [...s].map((ch, i) => (flags[i % Math.max(flags.length, 1)] ? ch.toUpperCase() : ch)).join('');
  }

  const schemeArb = fc.oneof(
    fc.constantFrom('https:', 'http:', 'javascript:', 'data:', 'ftp:', 'file:', 'blob:', 'mailto:', ''),
    fc
      .tuple(fc.constantFrom('https:', 'http:', 'javascript:', 'data:'), fc.array(fc.boolean(), { minLength: 1, maxLength: 11 }))
      .map(([s, flags]) => mixCase(s, flags)),
    fc.stringMatching(/^[a-z][a-z0-9+.-]{0,8}:$/),
  );

  const hostArb = fc.oneof(
    fc.domain(),
    fc.constantFrom(...SHORTENER_HOSTS),
    fc.constantFrom(...SHORTENER_HOSTS).map((h) => `www.${h}`),
    fc
      .tuple(fc.constantFrom(...SHORTENER_HOSTS), fc.array(fc.boolean(), { minLength: 1, maxLength: 11 }))
      .map(([h, flags]) => mixCase(`www.${h}`, flags)),
    fc.constant(''),
  );

  const credsArb = fc.oneof(
    { weight: 3, arbitrary: fc.constant('') },
    { weight: 1, arbitrary: fc.constantFrom('user@', 'user:secret@', ':secret@', 'a:b@') },
  );

  const builtUrlArb = fc
    .record({
      scheme: schemeArb,
      slashes: fc.constantFrom('//', '//', '/', ''),
      creds: credsArb,
      host: hostArb,
      rest: fc.webUrl({ withQueryParameters: true, withFragments: true }).map((u) => {
        const m = /^https?:\/\/[^/?#]*(.*)$/.exec(u);
        return m?.[1] ?? '';
      }),
      padding: fc.oneof({ weight: 4, arbitrary: fc.constant(0) }, { weight: 1, arbitrary: fc.integer({ min: 1900, max: 2200 }) }),
    })
    .map(({ scheme, slashes, creds, host, rest, padding }) => {
      const url = `${scheme}${slashes}${creds}${host}${rest.startsWith('/') ? rest : `/${rest}`}`;
      return padding > url.length ? url + 'a'.repeat(padding - url.length) : url;
    });

  const webUrlWithSchemeArb = fc
    .tuple(fc.webUrl({ withQueryParameters: true, withFragments: true }), schemeArb)
    .map(([u, scheme]) => u.replace(/^https?:/, scheme));

  const urlArb = fc.oneof(fc.string(), fc.string({ unit: 'binary' }), builtUrlArb, webUrlWithSchemeArb);

  it('returns no diagnostic exactly when every rule holds, otherwise one unsafe-url at the path', () => {
    fc.assert(
      fc.property(urlArb, fc.constantFrom(PATH, '/nodes/0/config/cta/url', ''), (url, path) => {
        let result: ReturnType<typeof checkHttpsUrl> = [];
        expect(() => {
          result = checkHttpsUrl(url, path);
        }).not.toThrow();
        if (oracleAllows(url)) {
          expect(result).toEqual([]);
        } else {
          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({ code: 'unsafe-url', path, severity: 'error' });
        }
      }),
      { numRuns: 500 },
    );
  });
});
