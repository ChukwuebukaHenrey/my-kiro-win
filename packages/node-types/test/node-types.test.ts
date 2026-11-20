import { describe, expect, it } from 'vitest';
import type { Diagnostic, DiagnosticCode, Effect, GraphCtx, Manifest, VarDecl } from '@dreame/schema';
import { createRng, type AttemptState, type Env } from '@dreame/runtime';
import {
  choiceNodeType,
  contentNodeType,
  coreNodeTypes,
  coreProfile,
  outcomeNodeType,
  type ChoiceConfig,
} from '../src/index.ts';
import { response_choice, response_content, response_outcome, validateManifest } from '../generated/core.validators.js';

const variables: VarDecl[] = [{ id: 'score', type: 'number', initial: 8, min: 0, max: 10 }];
const varMap: ReadonlyMap<string, VarDecl> = new Map(variables.map((v) => [v.id, v]));

const choiceCfg: ChoiceConfig = {
  prompt: 'Pick one',
  options: [
    { id: 'a', label: 'Alpha', effects: [{ op: 'add', var: 'score', value: 5 }] },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma' },
  ],
};

function manifest(choiceConfig: unknown = choiceCfg, outcomeConfig: unknown = { title: 'Done', body: 'Bye' }): Manifest {
  return {
    schemaVersion: 1,
    profile: 'core',
    activityId: 'node-types-demo',
    version: 1,
    requires: { content: 1, choice: 1, outcome: 1 },
    entryNodeId: 'intro',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables,
    nodes: [
      { id: 'intro', type: 'content', config: { body: 'Hello' }, edges: [{ to: 'q1' }] },
      { id: 'q1', type: 'choice', config: choiceConfig, edges: [{ to: 'done' }] },
      { id: 'done', type: 'outcome', config: outcomeConfig, edges: [] },
    ],
    theme: 'default',
  } as Manifest;
}

function diag(code: DiagnosticCode, path: string): Diagnostic {
  return { severity: 'error', stage: 'conditions', code, path, message: code };
}

/** Stub context: the checks report by simple local rules so each node type's calls are visible. */
function ctx(nodePath: string): GraphCtx {
  return {
    manifest: manifest(),
    nodePath,
    variables: varMap,
    checkEffect: (effect: Effect, path: string) => (varMap.has(effect.var) ? [] : [diag('effect-invalid', path)]),
    checkHttpsUrl: (url: string, path: string) => (url.startsWith('https://') ? [] : [diag('unsafe-url', path)]),
    checkText: (text: string, path: string) => (text.trim() === '' ? [diag('blank-text', path)] : []),
  };
}

function state(currentNodeId: string): AttemptState {
  return {
    activityId: 'node-types-demo',
    manifestVersion: 1,
    seed: 7,
    rngState: 7,
    status: 'playing',
    currentNodeId,
    vars: { score: 8 },
    answers: {},
    nodeState: {},
    path: [{ nodeId: currentNodeId, at: 0 }],
    transitions: 0,
    events: [],
    startedAt: 0,
    updatedAt: 0,
  };
}

function env(seed = 7): Env {
  return { now: 1, rng: createRng(seed), variables: varMap };
}

function codes(diags: Diagnostic[]): string[] {
  return diags.map((d) => `${d.code} ${d.path}`);
}

describe('core node types', () => {
  it('exports content, choice and outcome in order with version 1 and terminal flags', () => {
    expect(coreNodeTypes.map((t) => [t.type, t.version, t.terminal])).toEqual([
      ['content', 1, false],
      ['choice', 1, false],
      ['outcome', 1, true],
    ]);
    expect(coreProfile.id).toBe('core');
  });
});

describe('generated validators', () => {
  it('accepts a manifest with valid configs', () => {
    expect(validateManifest(manifest())).toBe(true);
    expect(coreProfile.validateSchema(manifest())).toBe(true);
    expect(validateManifest(manifest(choiceCfg, { title: 'T', body: 'B', cta: { label: 'Go', url: 'https://x.test' } }))).toBe(true);
  });

  it.each([
    ['choice with one option', { prompt: 'P', options: [{ id: 'a', label: 'A' }] }, undefined],
    ['choice with an extra key', { ...choiceCfg, extra: 1 }, undefined],
    ['choice option ID off pattern', { prompt: 'P', options: [{ id: 'A B', label: 'A' }, { id: 'b', label: 'B' }] }, undefined],
    ['choice prompt over 500', { ...choiceCfg, prompt: 'x'.repeat(501) }, undefined],
    ['outcome http CTA', undefined, { title: 'T', body: 'B', cta: { label: 'Go', url: 'http://x.test' } }],
    ['outcome javascript CTA', undefined, { title: 'T', body: 'B', cta: { label: 'Go', url: 'javascript:alert(1)' } }],
    ['outcome without body', undefined, { title: 'T' }],
  ])('rejects %s', (_name, choiceConfig, outcomeConfig) => {
    expect(validateManifest(manifest(choiceConfig ?? choiceCfg, outcomeConfig ?? { title: 'Done', body: 'Bye' }))).toBe(false);
  });

  it('rejects a content body over 2,000 characters', () => {
    const m = manifest();
    const nodes = [{ ...m.nodes[0]!, config: { body: 'x'.repeat(2001) } }, ...m.nodes.slice(1)];
    expect(validateManifest({ ...m, nodes })).toBe(false);
  });

  it('checks closed responses', () => {
    expect(response_content({})).toBe(true);
    expect(response_content({ x: 1 })).toBe(false);
    expect(response_outcome({})).toBe(true);
    expect(response_choice({ optionId: 'a' })).toBe(true);
    expect(response_choice({})).toBe(false);
    expect(response_choice({ optionId: 'a', extra: true })).toBe(false);
  });
});

describe('answerType', () => {
  it('is null for content and outcome and an enum of option IDs for choice', () => {
    expect(contentNodeType.answerType({ body: 'B' })).toBeNull();
    expect(outcomeNodeType.answerType({ title: 'T', body: 'B' })).toBeNull();
    expect(choiceNodeType.answerType(choiceCfg)).toEqual({ kind: 'enum', values: ['a', 'b', 'c'] });
  });
});

describe('choice', () => {
  it('reduce sets the answer and applies the option effects with clamping', () => {
    const next = choiceNodeType.reduce(choiceCfg, state('q1'), { optionId: 'a' }, env());
    expect(next.answers).toEqual({ q1: 'a' });
    expect(next.vars).toEqual({ score: 10 });
  });

  it('reduce of an option without effects only sets the answer', () => {
    const next = choiceNodeType.reduce(choiceCfg, state('q1'), { optionId: 'b' }, env());
    expect(next.answers).toEqual({ q1: 'b' });
    expect(next.vars).toEqual({ score: 8 });
  });

  it('enter with shuffle stores the seeded permutation of option IDs', () => {
    const s = choiceNodeType.enter!({ ...choiceCfg, shuffle: true }, state('q1'), env(99));
    const order = (s.nodeState['q1'] as { order: string[] }).order;
    expect(order).toEqual(createRng(99).shuffle(['a', 'b', 'c']));
    expect([...order].sort()).toEqual(['a', 'b', 'c']);
  });

  it('enter without shuffle returns the input state', () => {
    const s = state('q1');
    expect(choiceNodeType.enter!(choiceCfg, s, env())).toBe(s);
  });

  it('isValidResponse rejects an unknown optionId', () => {
    expect(choiceNodeType.isValidResponse(choiceCfg, { optionId: 'a' })).toBe(true);
    expect(choiceNodeType.isValidResponse(choiceCfg, { optionId: 'zzz' })).toBe(false);
    expect(choiceNodeType.isValidResponse(choiceCfg, { optionId: 1 })).toBe(false);
    expect(choiceNodeType.isValidResponse(choiceCfg, null)).toBe(false);
  });

  it('validate reports blank-text, duplicate-option-id and effect-invalid', () => {
    const cfg: ChoiceConfig = {
      prompt: '  ',
      options: [
        { id: 'a', label: 'A', effects: [{ op: 'set', var: 'missing', value: 1 }] },
        { id: 'a', label: '' },
      ],
    };
    const diags = choiceNodeType.validate(cfg, ctx('/nodes/1'));
    expect(codes(diags)).toEqual([
      'blank-text /nodes/1/config/prompt',
      'effect-invalid /nodes/1/config/options/0/effects/0',
      'duplicate-option-id /nodes/1/config/options/1/id',
      'blank-text /nodes/1/config/options/1/label',
    ]);
    expect(diags.find((d) => d.code === 'duplicate-option-id')).toMatchObject({ severity: 'error', nodeId: 'q1' });
  });

  it('validate returns no diagnostics for a clean config', () => {
    expect(choiceNodeType.validate(choiceCfg, ctx('/nodes/1'))).toEqual([]);
  });
});

describe('content', () => {
  it('validate checks body and a present title', () => {
    expect(codes(contentNodeType.validate({ title: ' ', body: '' }, ctx('/nodes/0')))).toEqual([
      'blank-text /nodes/0/config/title',
      'blank-text /nodes/0/config/body',
    ]);
    expect(contentNodeType.validate({ body: 'Hello' }, ctx('/nodes/0'))).toEqual([]);
  });

  it('reduce returns the input state', () => {
    const s = state('intro');
    expect(contentNodeType.reduce({ body: 'Hello' }, s, {}, env())).toBe(s);
  });
});

describe('outcome', () => {
  it('validate checks title and the CTA URL', () => {
    const cfg = { title: '', body: 'B', cta: { label: 'Go', url: 'http://x.test' } };
    expect(codes(outcomeNodeType.validate(cfg, ctx('/nodes/2')))).toEqual([
      'blank-text /nodes/2/config/title',
      'unsafe-url /nodes/2/config/cta/url',
    ]);
    expect(outcomeNodeType.validate({ title: 'T', body: 'B' }, ctx('/nodes/2'))).toEqual([]);
  });

  it('reduce returns the input state', () => {
    const s = state('done');
    expect(outcomeNodeType.reduce({ title: 'T', body: 'B' }, s, {}, env())).toBe(s);
  });
});
