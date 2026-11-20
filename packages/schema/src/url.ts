import type { Diagnostic } from './diagnostics.ts';

/** Link shorteners that hide the real destination (Req 6.3, Architecture Spec §A5). */
export const SHORTENER_HOSTS: readonly string[] = Object.freeze([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
]);

const MAX_URL_LENGTH = 2048;

function unsafe(path: string, reason: string): Diagnostic[] {
  return [
    {
      severity: 'error',
      stage: 'conditions',
      code: 'unsafe-url',
      path,
      message: `Link is not allowed: ${reason}.`,
    },
  ];
}

/**
 * Returns one `unsafe-url` diagnostic at `path` when `url` is not a plain `https:` link
 * to a named host, and no diagnostics otherwise (Req 6.1, 6.2).
 */
export function checkHttpsUrl(url: string, path: string): Diagnostic[] {
  if (url.length > MAX_URL_LENGTH) {
    return unsafe(path, `it is longer than ${MAX_URL_LENGTH} characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return unsafe(path, 'it is not a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    return unsafe(path, 'only https: links are allowed');
  }
  if (parsed.hostname === '') {
    return unsafe(path, 'it has no host name');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return unsafe(path, 'it contains a user name or password');
  }
  const lower = parsed.hostname.toLowerCase();
  const host = lower.startsWith('www.') ? lower.slice(4) : lower;
  if (SHORTENER_HOSTS.includes(host)) {
    return unsafe(path, 'link shorteners hide the real destination');
  }
  return [];
}
