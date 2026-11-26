// Example tests for the practice-path view registry (design C4 "Practice_Views test", Requirement 23.3).
// These tests are evidence for the cases listed, not a proof of correctness.
import { describe, expect, it } from 'vitest';
import { ChoiceNodeView, ContentNodeView, OutcomeNodeView } from '@dreame/ui';
import {
  MasterySummaryNodeView,
  practiceViews,
  RecallNodeView,
  ReviewQueueNodeView,
} from '../src/views/registry.ts';
import { practiceProfile } from '../src/profile.ts';

describe('practiceViews', () => {
  it('registers exactly the profile node types, in profile order', () => {
    expect(practiceViews.types()).toEqual(practiceProfile.nodeTypes.map((t) => t.type));
  });

  it('returns the shared-package views by type', () => {
    expect(practiceViews.get('content')).toBe(ContentNodeView);
    expect(practiceViews.get('choice')).toBe(ChoiceNodeView);
    expect(practiceViews.get('outcome')).toBe(OutcomeNodeView);
  });

  it('returns the app views by type', () => {
    expect(practiceViews.get('recall')).toBe(RecallNodeView);
    expect(practiceViews.get('reviewQueue')).toBe(ReviewQueueNodeView);
    expect(practiceViews.get('masterySummary')).toBe(MasterySummaryNodeView);
  });
});
