import { describe, expect, it } from 'vitest';
import { coreNodeTypes } from '@dreame/node-types';
import { ChoiceNodeView, ContentNodeView, OutcomeNodeView, coreViews } from '../src/core-views.ts';

describe('coreViews (Wiring_File W4, Requirements 12.1, 16.1, 16.2)', () => {
  it('lists the coreNodeTypes names, in order', () => {
    expect(coreViews.types()).toEqual(coreNodeTypes.map((nodeType) => nodeType.type));
  });

  it('returns the three core views by type name', () => {
    expect(coreViews.get('content')).toBe(ContentNodeView);
    expect(coreViews.get('choice')).toBe(ChoiceNodeView);
    expect(coreViews.get('outcome')).toBe(OutcomeNodeView);
  });
});
