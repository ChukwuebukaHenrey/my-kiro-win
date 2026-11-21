import { describe, expect, it } from 'vitest';
import { coreNodeTypes } from '@dreame/node-types';
import { shopNodeTypes } from '../src/node-types/index.ts';
import { shopProfile } from '../src/profile.ts';
import * as generated from '../generated/shop-challenge.validators.js';

describe('shopProfile', () => {
  it('has the id shop-challenge', () => {
    expect(shopProfile.id).toBe('shop-challenge');
  });

  it('lists the shopNodeTypes names, core names first in order, with no repeat', () => {
    const names = shopProfile.nodeTypes.map((t) => t.type);
    expect(names).toEqual(shopNodeTypes.map((t) => t.type));
    const coreNames = coreNodeTypes.map((t) => t.type);
    expect(names.slice(0, coreNames.length)).toEqual(coreNames);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lists exactly the five shop-challenge node types in profile order', () => {
    expect(shopProfile.nodeTypes.map((t) => t.type)).toEqual([
      'content',
      'choice',
      'outcome',
      'collectionSelect',
      'recommendOutcome',
    ]);
  });
});

describe('generated shop-challenge validators', () => {
  it('exports validateManifest and one response_<type> function per node type', () => {
    const exports: Record<string, unknown> = { ...generated };
    expect(typeof exports['validateManifest']).toBe('function');
    for (const t of shopNodeTypes) {
      expect(typeof exports[`response_${t.type}`], `response_${t.type}`).toBe('function');
    }
  });

  it('exports response_collectionSelect and response_recommendOutcome as functions', () => {
    expect(typeof generated.response_collectionSelect).toBe('function');
    expect(typeof generated.response_recommendOutcome).toBe('function');
  });
});
