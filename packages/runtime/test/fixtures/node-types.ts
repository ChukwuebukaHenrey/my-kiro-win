// Test fixtures for the reducer: two node types, hand-written stand-ins for Ajv standalone
// validators (no `ajv` import) and a cast helper for hand-built manifests.
// The reducer never reads `configSchema` or `responseSchema`, so any TypeBox schema will do.

import { LimitsSchema, ScalarSchema } from '@dreame/schema';
import type { Manifest, StandaloneValidate, ValidManifest } from '@dreame/schema';
import type { NodeType } from '../../src/node-type.ts';
import { defineProfile } from '../../src/profile.ts';
import type { Profile } from '../../src/profile.ts';

export type StepConfig = { readonly label?: string };
export type StepResponse = { readonly value: number };

/**
 * Non-terminal fixture. `enter` draws one uint32 from `env.rng` and stores it in
 * `nodeState[currentNodeId]`; `reduce` records `response.value` as the node's answer.
 */
export const stepType: NodeType<StepConfig, StepResponse> = {
  type: 'step',
  version: 1,
  terminal: false,
  configSchema: LimitsSchema,
  responseSchema: ScalarSchema,
  validate: () => [],
  answerType: () => ({ kind: 'number' }),
  isValidResponse: (_cfg: StepConfig, r: unknown): r is StepResponse =>
    typeof r === 'object' && r !== null && Number.isInteger((r as { value?: unknown }).value),
  enter: (_cfg, s, env) => ({
    ...s,
    nodeState: { ...s.nodeState, [s.currentNodeId]: env.rng.nextUint32() },
  }),
  reduce: (_cfg, s, r) => ({
    ...s,
    answers: { ...s.answers, [s.currentNodeId]: r.value },
  }),
};

/** Terminal fixture with no `enter`. */
export const endType: NodeType<Record<string, never>, Record<string, never>> = {
  type: 'end',
  version: 1,
  terminal: true,
  configSchema: LimitsSchema,
  responseSchema: ScalarSchema,
  validate: () => [],
  answerType: () => null,
  isValidResponse: (_cfg: Record<string, never>, r: unknown): r is Record<string, never> =>
    typeof r === 'object' && r !== null,
  reduce: (_cfg, s) => s,
};

/** Stand-in for the precompiled `step` response validator: a closed `{ value: number }` object. */
export const validateStepResponse: StandaloneValidate = (data: unknown): boolean => {
  const ok =
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    Object.keys(data).length === 1 &&
    typeof (data as { value?: unknown }).value === 'number';
  validateStepResponse.errors = ok ? null : [{ instancePath: '', keyword: 'type', params: {}, message: 'must be { value: number }' }];
  return ok;
};

/** Stand-in for the precompiled `end` response validator: a closed empty object. */
export const validateEndResponse: StandaloneValidate = (data: unknown): boolean => {
  const ok = typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length === 0;
  validateEndResponse.errors = ok ? null : [{ instancePath: '', keyword: 'type', params: {}, message: 'must be {}' }];
  return ok;
};

/** The reducer never calls the manifest schema validator. */
export const acceptAll: StandaloneValidate = () => true;

export function fixtureProfile(): Profile {
  return defineProfile({
    id: 'core',
    nodeTypes: [stepType, endType],
    validateSchema: acceptAll,
    responseValidators: { step: validateStepResponse, end: validateEndResponse },
  });
}

/**
 * Test-only cast: brands a hand-built manifest as valid without running the validator.
 * Tests must only pass manifests that satisfy the validator's structural rules.
 */
export function asValidManifest(m: Manifest): ValidManifest {
  return m as ValidManifest;
}
