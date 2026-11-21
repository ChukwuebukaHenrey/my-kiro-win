// Property test for Contact_Link safety in `recommendOutcome` (design Property 10, sections C8
// and C10; Requirements 7.6, 11.6, 14.4). `validate` is called directly with the real
// `checkHttpsUrl`, because the config schema rejects non-https URLs before the conditions stage.
// The expected outcome for each URL is `checkHttpsUrl(url, '')`. A passing run is evidence for
// the property over the generated Contact_Links, not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkHttpsUrl, type Effect, type GraphCtx, type Manifest } from '@dreame/schema';
import { recommendOutcomeNodeType, type RecommendOutcomeConfig } from '../src/node-types/recommendOutcome.ts';
import { RecommendOutcomeNodeView } from '../src/views/RecommendOutcomeNodeView.tsx';
import { contactsArb, SAFE_CONTACT_URLS, UNSAFE_CONTACT_URLS, type ContactLink } from './shop-arbitraries.ts';

const NODE = '/nodes/1';

/**
 * Context as in `recommendOutcome.test.ts`, with the real `checkHttpsUrl`: `pick` is a
 * collectionSelect node upstream of this one, and `checkText` reports nothing for a non-blank title.
 */
function ctx(): GraphCtx {
  const nodes = [{ id: 'pick', type: 'collectionSelect', config: {}, edges: [] }];
  return {
    manifest: { nodes } as unknown as Manifest,
    nodePath: NODE,
    variables: new Map(),
    checkEffect: (_effect: Effect, _path: string) => [],
    checkHttpsUrl,
    checkText: () => [],
    isUpstream: () => true,
  };
}

function configWith(contacts: ContactLink[], omitEmpty: boolean): RecommendOutcomeConfig {
  const base = { title: 'Your bundle', body: 'Here is what you picked.', from: 'pick' };
  return contacts.length === 0 && omitEmpty ? base : { ...base, contacts };
}

function isSafe(url: string): boolean {
  return checkHttpsUrl(url, '').length === 0;
}

function checkContacts(contacts: ContactLink[], omitEmpty: boolean): void {
  const cfg = configWith(contacts, omitEmpty);

  // Validator: unsafe-url at /config/contacts/<i>/url exactly for the unsafe indexes.
  const expected = contacts.flatMap((c, i) => (isSafe(c.url) ? [] : [['unsafe-url', `${NODE}/config/contacts/${i}/url`]]));
  const got = recommendOutcomeNodeType.validate(cfg, ctx()).map((d) => [d.code, d.path]);
  expect(got).toEqual(expected);

  // View: activate every link button, then match anchors to contacts by list item.
  const { container, unmount } = render(<RecommendOutcomeNodeView cfg={cfg} onRespond={() => {}} nodeState={undefined} />);
  try {
    const items = Array.from(container.querySelectorAll<HTMLLIElement>('ul.shop-contacts > li'));
    expect(items).toHaveLength(contacts.length);
    items.forEach((li) => {
      expect(li.querySelector('a')).toBeNull();
      const button = li.querySelector('button');
      if (button !== null) fireEvent.click(button);
    });
    contacts.forEach((contact, i) => {
      const li = items[i]!;
      const anchors = li.querySelectorAll('a');
      if (isSafe(contact.url)) {
        expect(anchors).toHaveLength(1);
        const anchor = anchors[0]!;
        expect(anchor.getAttribute('href')).toBe(contact.url);
        expect(anchor.getAttribute('target')).toBe('_blank');
        expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      } else {
        expect(anchors).toHaveLength(0);
        expect(li.querySelector('button')).toBeNull();
      }
    });
    const safeCount = contacts.filter((c) => isSafe(c.url)).length;
    expect(container.querySelectorAll('a')).toHaveLength(safeCount);
  } finally {
    unmount();
  }
}

describe('Feature: shop-challenge, Property 10: A recommendOutcome Contact_Link becomes an anchor only for a safe https URL', () => {
  // **Validates: Requirements 7.6, 11.6, 14.4**
  it(
    'validate reports unsafe-url exactly at the unsafe indexes, and the view renders an anchor exactly for each Safe_Url contact',
    () => {
      fc.assert(
        fc.property(contactsArb, fc.boolean(), (contacts, omitEmpty) => {
          try {
            checkContacts(contacts, omitEmpty);
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 },
      );
    },
    120_000,
  );

  it('covers both outcomes: every SAFE_CONTACT_URLS entry is safe and every UNSAFE_CONTACT_URLS entry is rejected', () => {
    for (const url of SAFE_CONTACT_URLS) expect(checkHttpsUrl(url, '')).toEqual([]);
    for (const url of UNSAFE_CONTACT_URLS) expect(checkHttpsUrl(url, '')).toHaveLength(1);
    const all = [...SAFE_CONTACT_URLS, ...UNSAFE_CONTACT_URLS];
    for (let i = 0; i < all.length; i += 3) {
      checkContacts(
        all.slice(i, i + 3).map((url, k) => ({ label: `Contact ${i + k + 1}`, url })),
        false,
      );
      cleanup();
    }
  });
});
