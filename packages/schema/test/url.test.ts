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
