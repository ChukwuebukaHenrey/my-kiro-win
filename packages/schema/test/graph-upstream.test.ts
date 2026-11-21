// GraphCtx.isUpstream on a diamond graph (design C4; Requirements 5.9, 7.9).

import Type from 'typebox';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../src/contracts.ts';
import { validateManifest } from '../src/graph.ts';
import type { NodeTypeDescriptor, ProfileDescriptor, StandaloneValidate } from '../src/node-type.ts';

const closed = { additionalProperties: false } as const;

/** Node IDs asked about at every node; `zz` names no node. */
const PROBES = ['a', 'b', 'c', 'd', 'e', 'zz'] as const;

/** `isUpstream` answers per node path, filled by the `probe` node type's `validate`. */
type Answers = Map<string, Record<string, boolean>>;

function profileRecordingInto(answers: Answers): ProfileDescriptor {
  const probe: NodeTypeDescriptor = {
    type: 'probe',
    version: 1,
    terminal: false,
    configSchema: Type.Object({}, closed),
    responseSchema: Type.Object({}, closed),
    validate: (_cfg, ctx) => {
      const row: Record<string, boolean> = {};
      for (const id of PROBES) row[id] = ctx.isUpstream(id);
      answers.set(ctx.nodePath, row);
      return [];
    },
    answerType: () => null,
  };
  const end: NodeTypeDescriptor = {
    type: 'end',
    version: 1,
    terminal: true,
    configSchema: Type.Object({}, closed),
    responseSchema: Type.Object({}, closed),
    validate: () => [],
    answerType: () => null,
  };
  // Stage 1 is not under test here; the graph stages 2–7 run on the manifest below.
  const acceptAll: StandaloneValidate = () => true;
  return { id: 'test', nodeTypes: [probe, end], validateSchema: acceptAll };
}

/** Diamond `a → b → d`, `a → c → d`, then `d → e` (terminal). */
const diamond: Manifest = {
  schemaVersion: 1,
  profile: 'test',
  activityId: 'graph-upstream',
  version: 1,
  requires: { probe: 1, end: 1 },
  entryNodeId: 'a',
  fallbackOutcomeId: 'e',
  limits: { maxNodes: 10, maxTransitions: 10 },
  variables: [{ id: 'left', type: 'boolean', initial: true }],
  nodes: [
    {
      id: 'a',
      type: 'probe',
      config: {},
      edges: [{ to: 'b', when: { op: 'eq', ref: { var: 'left' }, value: true } }, { to: 'c' }],
    },
    { id: 'b', type: 'probe', config: {}, edges: [{ to: 'd' }] },
    { id: 'c', type: 'probe', config: {}, edges: [{ to: 'd' }] },
    { id: 'd', type: 'probe', config: {}, edges: [{ to: 'e' }] },
    { id: 'e', type: 'end', config: {}, edges: [] },
  ],
  theme: 'default',
};

/** Validates the diamond and returns the answers recorded at the node with `nodeId`. */
function answersAt(nodeId: string): Record<string, boolean> {
  const answers: Answers = new Map();
  const result = validateManifest(structuredClone(diamond), profileRecordingInto(answers));
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(result.ok).toBe(true);
  const n = diamond.nodes.findIndex((node) => node.id === nodeId);
  const row = answers.get(`/nodes/${n}`);
  expect(row).toBeDefined();
  return row!;
}

describe('GraphCtx.isUpstream', () => {
  it('at the join node d: the entry is upstream, one branch, d itself and an unknown ID are not', () => {
    const atD = answersAt('d');
    expect(atD['a']).toBe(true);
    expect(atD['b']).toBe(false);
    expect(atD['c']).toBe(false);
    expect(atD['d']).toBe(false);
    expect(atD['zz']).toBe(false);
  });

  it('at branch node b: the entry a is upstream, the other branch c is not', () => {
    const atB = answersAt('b');
    expect(atB['a']).toBe(true);
    expect(atB['c']).toBe(false);
  });
});
