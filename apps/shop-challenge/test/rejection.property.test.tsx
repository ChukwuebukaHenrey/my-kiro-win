// Property test for Rejection handling in the ActivityPlayer with the shop views (design Property 9, C11).
// Rejections are forced through a profile wrapper: the `collectionSelect` node type is replaced by a
// copy whose `isValidResponse` rejects the first `k` distinct responses it sees. Distinct response
// objects are counted, not raw calls, because an accepted response is checked twice (by the player
// and again inside `reduce`). A passing run is evidence for the property over the generated inputs,
// not a proof.
import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createAttempt, createRegistry, createRuntime, type NodeType, type Profile } from '@dreame/runtime';
import { validateManifest, type Manifest, type ValidManifest } from '@dreame/schema';
import { ActivityPlayer } from '@dreame/ui';
import { readSelectNodeState } from '../src/node-types/bundle-rules.ts';
import {
  collectionSelectNodeType,
  type CollectionSelectConfig,
  type CollectionSelectResponse,
} from '../src/node-types/collectionSelect.ts';
import { shopProfile } from '../src/profile.ts';
import { shopViews } from '../src/views/registry.ts';
import { acceptedSelectResponse, selectConfigArb } from './shop-arbitraries.ts';

const PICK = 'pick';
const DONE = 'done';
const DONE_TITLE = 'All done';

/** `pick` (collectionSelect) → `done` (outcome), validated against `shopProfile`. */
function manifestFor(cfg: CollectionSelectConfig): ValidManifest {
  const m: Manifest = {
    schemaVersion: 1,
    profile: 'shop-challenge',
    activityId: 'rejection-check',
    version: 1,
    requires: { collectionSelect: 1, outcome: 1 },
    entryNodeId: PICK,
    fallbackOutcomeId: DONE,
    limits: { maxNodes: 2, maxTransitions: 1 },
    variables: [],
    nodes: [
      { id: PICK, type: 'collectionSelect', config: cfg, edges: [{ to: DONE }] },
      { id: DONE, type: 'outcome', config: { title: DONE_TITLE, body: 'Your bundle was accepted.' }, edges: [] },
    ],
    theme: 'default',
  };
  const result = validateManifest(m, shopProfile);
  if (!result.ok) {
    const first = result.diagnostics[0];
    throw new Error(`manifestFor: invalid manifest: ${first === undefined ? 'no diagnostics' : `${first.code} ${first.message}`}`);
  }
  return result.manifest;
}

/**
 * `shopProfile` with its `collectionSelect` node type replaced by a copy that rejects the first `k`
 * distinct responses. `seen` lists every distinct response object in the order it was checked.
 */
function rejectingProfile(k: number): { readonly profile: Profile; readonly seen: unknown[] } {
  const seen: unknown[] = [];
  const wrapped: NodeType<CollectionSelectConfig, CollectionSelectResponse> = {
    ...collectionSelectNodeType,
    isValidResponse(cfg: CollectionSelectConfig, r: unknown): r is CollectionSelectResponse {
      if (!seen.includes(r)) seen.push(r);
      if (seen.indexOf(r) < k) return false;
      return collectionSelectNodeType.isValidResponse(cfg, r);
    },
  };
  const nodeTypes = shopProfile.nodeTypes.map((t) => (t.type === 'collectionSelect' ? wrapped : t));
  return { profile: { ...shopProfile, nodeTypes, registry: createRegistry(nodeTypes) }, seen };
}

/** The IDs of a response that meets the Selection_Rules, in config order (what the checkboxes show). */
function picksFor(manifest: ValidManifest, cfg: CollectionSelectConfig, pick: number): string[] {
  const attempt = createAttempt(createRuntime(shopProfile, manifest), 1, { now: 0 });
  const nodeState = readSelectNodeState(attempt.nodeState[PICK]);
  if (nodeState === null) throw new Error('picksFor: no collectionSelect node state');
  const response = acceptedSelectResponse(cfg, nodeState, pick);
  if (response === null) throw new Error('picksFor: no accepted selection');
  return cfg.items.filter((item) => response.itemIds.includes(item.id)).map((item) => item.id);
}

interface Case {
  readonly cfg: CollectionSelectConfig;
  readonly pick: number;
  readonly k: number;
}

const caseArb: fc.Arbitrary<Case> = fc.record({
  cfg: selectConfigArb({ maxItems: 8 }),
  pick: fc.nat(),
  k: fc.integer({ min: 1, max: 4 }),
});

function counterClock(): () => number {
  let t = 1000;
  return () => (t += 1000);
}

function runCase({ cfg, pick, k }: Case): void {
  try {
    const manifest = manifestFor(cfg);
    const picks = picksFor(manifest, cfg, pick);
    const { profile, seen } = rejectingProfile(k);
    const { container } = render(
      <ActivityPlayer profile={profile} manifest={manifest} seed={1} views={shopViews} now={counterClock()} />,
    );
    const section = container.querySelector('section.dr-player');
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (section === null || button === null) throw new Error('The player has no section or no submit button.');
    expect(boxes.map((b) => b.value)).toEqual(cfg.items.map((item) => item.id));

    for (const box of boxes) if (picks.includes(box.value)) fireEvent.click(box);
    const checkedIds = (): string[] => boxes.filter((b) => b.checked).map((b) => b.value);
    expect(checkedIds()).toEqual(picks);
    expect(container.querySelectorAll('[role="alert"]').length).toBe(0);

    let previous: Element | null = null;
    for (let i = 1; i <= k; i++) {
      fireEvent.click(button);
      // The submit reached the node type's check again, and was rejected.
      expect(seen.length).toBe(i);
      expect(seen[i - 1]).toEqual({ itemIds: picks });
      expect(section.getAttribute('data-node-id')).toBe(PICK);
      const alerts = container.querySelectorAll('[role="alert"]');
      expect(alerts.length).toBe(1);
      const alert = alerts[0];
      if (alert === undefined) throw new Error('No alert.');
      if (previous !== null) {
        expect(alert).not.toBe(previous);
        expect(previous.isConnected).toBe(false);
      }
      expect(document.activeElement).toBe(alert);
      expect(checkedIds()).toEqual(picks);
      previous = alert;
    }

    // Submit k + 1 is checked again and accepted, and the player shows the `done` outcome.
    fireEvent.click(button);
    expect(seen.length).toBe(k + 1);
    expect(section.getAttribute('data-node-id')).toBe(DONE);
    expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
    expect(container.querySelector('h2')?.textContent).toBe(DONE_TITLE);
  } finally {
    cleanup();
  }
}

describe('Feature: shop-challenge, Property 9: A Rejection adds a new focused alert and keeps the picks', () => {
  // **Validates: Requirements 12.1, 12.2, 12.3, 12.5, 12.6**
  it(
    'shows one new focused alert per Rejection, keeps the checked picks and accepts the next submit',
    () => {
      fc.assert(fc.property(caseArb, runCase), { numRuns: 100 });
    },
    170_000,
  );
});
