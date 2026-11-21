// Property test for ExternalLinkButton (design Property 3, section C8; Requirements 8.1–8.5).
// A passing run is evidence for this property over the generated URLs, not a proof.
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SHORTENER_HOSTS, checkHttpsUrl } from '@dreame/schema';
import { SAFE_CTA_URLS, UNSAFE_CTA_URLS } from '../../node-types/test/arbitraries.ts';
import { ExternalLinkButton } from '../src/components/ExternalLinkButton.tsx';

const LABEL = 'See the bundle';
const BLOCKED_NOTE = 'This link was blocked because it is not a safe https link.';
const MAX_URL_LENGTH = 2048;

const pathArb = fc.stringMatching(/^[a-z0-9\-._~/]{0,24}$/);

// `fc.webUrl` with only the `https` scheme, so most of these pass `checkHttpsUrl`.
const generatedHttpsArb = fc.webUrl({ validSchemes: ['https'], withQueryParameters: true, withFragments: true });

const otherSchemeArb = fc.oneof(
  fc.webUrl({ validSchemes: ['http'] }),
  pathArb.map((p) => `javascript:alert(1)//${p}`),
  pathArb.map((p) => `JavaScript:void(0)/${p}`),
  pathArb.map((p) => `data:text/html,<p>${p}</p>`),
  pathArb.map((p) => `data:text/plain;base64,${p}`),
);

const credentialsArb = fc
  .tuple(fc.stringMatching(/^[a-z0-9]{0,8}$/), fc.stringMatching(/^[a-z0-9]{0,8}$/), fc.boolean())
  .filter(([user, pass]) => user !== '' || pass !== '')
  .map(([user, pass, withPass]) => `https://${user}${withPass ? `:${pass}` : ''}@example.com/shop`);

const shortenerArb = fc
  .tuple(fc.constantFrom(...SHORTENER_HOSTS), fc.boolean(), fc.boolean(), pathArb)
  .map(([host, www, upper, p]) => `https://${www ? 'www.' : ''}${upper ? host.toUpperCase() : host}/${p}`);

// Lengths just below, at and above the 2,048-character limit.
const overLongArb = fc.integer({ min: -3, max: 10 }).map((delta) => {
  const prefix = 'https://example.com/';
  return prefix + 'a'.repeat(MAX_URL_LENGTH - prefix.length + delta);
});

const urlArb: fc.Arbitrary<string> = fc.oneof(
  generatedHttpsArb,
  fc.constantFrom(...SAFE_CTA_URLS),
  fc.constantFrom(...UNSAFE_CTA_URLS),
  otherSchemeArb,
  credentialsArb,
  shortenerArb,
  overLongArb,
  fc.string({ maxLength: 40 }),
);

function checkOne(url: string): void {
  const safe = checkHttpsUrl(url, '').length === 0;
  const { container, unmount } = render(<ExternalLinkButton label={LABEL} url={url} />);
  try {
    const view = within(container);
    if (safe) {
      const host = new URL(url).hostname;
      expect(container.querySelector('a')).toBeNull();
      expect(view.getByText(`Opens ${host}`)).toBeDefined();
      const button = view.getByRole('button', { name: LABEL });
      fireEvent.click(button);

      const anchors = container.querySelectorAll('a');
      expect(anchors).toHaveLength(1);
      const anchor = anchors[0]!;
      expect(anchor.getAttribute('href')).toBe(url);
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      expect(anchor.getAttribute('target')).toBe('_blank');
      expect(anchor.textContent).toBe(`Open ${host}`);
      expect(view.queryByText(BLOCKED_NOTE)).toBeNull();
    } else {
      expect(container.querySelector('a')).toBeNull();
      expect(container.querySelector('button')).toBeNull();
      expect(view.getByText(LABEL)).toBeDefined();
      expect(view.getByText(BLOCKED_NOTE)).toBeDefined();
    }
  } finally {
    unmount();
  }
}

describe('Feature: ui-renderer, Property 3: Only safe CTA URLs become anchors', () => {
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
  it(
    'renders an anchor with href equal to the input exactly when checkHttpsUrl reports nothing',
    () => {
      fc.assert(
        fc.property(urlArb, (url) => {
          checkOne(url);
        }),
        { numRuns: 300 },
      );
      cleanup();
    },
    120_000,
  );

  it('covers both outcomes: every SAFE_CTA_URLS entry is safe and every UNSAFE_CTA_URLS entry is blocked', () => {
    for (const url of SAFE_CTA_URLS) expect(checkHttpsUrl(url, '')).toEqual([]);
    for (const url of UNSAFE_CTA_URLS) expect(checkHttpsUrl(url, '')).toHaveLength(1);
    for (const url of [...SAFE_CTA_URLS, ...UNSAFE_CTA_URLS]) checkOne(url);
  });
});
