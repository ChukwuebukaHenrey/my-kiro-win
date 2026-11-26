import { describe, expect, it } from 'vitest';
import { coreNodeTypes } from '@dreame/node-types';
import { practiceNodeTypes } from '../src/node-types/index.ts';
import { practiceProfile } from '../src/profile.ts';
import * as generated from '../generated/practice-path.validators.js';

describe('practiceProfile', () => {
  it('has the id practice-path', () => {
    expect(practiceProfile.id).toBe('practice-path');
  });

  it('lists the practiceNodeTypes names, core names first in order, with no repeat', () => {
    const names = practiceProfile.nodeTypes.map((t) => t.type);
    expect(names).toEqual(practiceNodeTypes.map((t) => t.type));
    const coreNames = coreNodeTypes.map((t) => t.type);
    expect(names.slice(0, coreNames.length)).toEqual(coreNames);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lists exactly the six practice-path node types in profile order', () => {
    expect(practiceProfile.nodeTypes.map((t) => t.type)).toEqual([
      'content',
      'choice',
      'outcome',
      'recall',
      'reviewQueue',
      'masterySummary',
    ]);
  });
});

describe('generated practice-path validators', () => {
  it('exports validateManifest and one response_<type> function per node type', () => {
    const exports: Record<string, unknown> = { ...generated };
    expect(typeof exports['validateManifest']).toBe('function');
    for (const t of practiceNodeTypes) {
      expect(typeof exports[`response_${t.type}`], `response_${t.type}`).toBe('function');
    }
  });

  it('exports response_recall, response_reviewQueue and response_masterySummary as functions', () => {
    expect(typeof generated.response_recall).toBe('function');
    expect(typeof generated.response_reviewQueue).toBe('function');
    expect(typeof generated.response_masterySummary).toBe('function');
  });
});
