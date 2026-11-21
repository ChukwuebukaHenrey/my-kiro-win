// Safety check and destination host for CTA links (design C8, Requirement 8).
import { checkHttpsUrl } from '@dreame/schema';

export type LinkDescription = { readonly safe: true; readonly host: string } | { readonly safe: false };

/**
 * `safe` exactly when `checkHttpsUrl(url, '')` returns no diagnostics, the same rule the
 * validator applies. `host` is `new URL(url).hostname`, the ASCII (punycode) form, so a
 * look-alike Unicode host shows as `xn--…`.
 */
export function describeLink(url: string): LinkDescription {
  if (checkHttpsUrl(url, '').length > 0) return { safe: false };
  return { safe: true, host: new URL(url).hostname };
}
