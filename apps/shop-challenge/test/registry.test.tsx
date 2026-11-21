// Example tests for the shop-challenge view registry (design C5 "Shop_Views test", Requirement 19.3).
// These tests are evidence for the cases listed, not a proof of correctness.
import { describe, expect, it } from 'vitest';
import { ChoiceNodeView, ContentNodeView, OutcomeNodeView } from '@dreame/ui';
import { CollectionSelectNodeView, RecommendOutcomeNodeView, shopViews } from '../src/views/registry.ts';
import { shopProfile } from '../src/profile.ts';

describe('shopViews', () => {
  it('registers exactly the profile node types, in profile order', () => {
    expect(shopViews.types()).toEqual(shopProfile.nodeTypes.map((t) => t.type));
  });

  it('returns the shared-package views by type', () => {
    expect(shopViews.get('content')).toBe(ContentNodeView);
    expect(shopViews.get('choice')).toBe(ChoiceNodeView);
    expect(shopViews.get('outcome')).toBe(OutcomeNodeView);
  });

  it('returns the app views by type', () => {
    expect(shopViews.get('collectionSelect')).toBe(CollectionSelectNodeView);
    expect(shopViews.get('recommendOutcome')).toBe(RecommendOutcomeNodeView);
  });
});
