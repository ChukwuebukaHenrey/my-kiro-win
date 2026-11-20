import { describe, expect, it } from 'vitest';
import { LimitsSchema, ScalarSchema } from '@dreame/schema';
import type { StandaloneValidate } from '@dreame/schema';
import type { AnyNodeType } from '../src/node-type.ts';
import { createRegistry } from '../src/registry.ts';
import { defineProfile } from '../src/profile.ts';

// Minimal node types; the registry and profile never read the schemas, so any TypeBox schema will do.
function fixtureType(type: string, terminal = false): AnyNodeType {
  return {
    type,
    version: 1,
    terminal,
    configSchema: LimitsSchema,
    responseSchema: ScalarSchema,
    validate: () => [],
    answerType: () => null,
    isValidResponse: (_cfg: unknown, r: unknown): r is unknown => r !== undefined,
    reduce: (_cfg, s) => s,
  };
}

// Hand-written stand-ins for Ajv standalone validators (no `ajv` import).
const acceptAll: StandaloneValidate = () => true;
const rejectAll: StandaloneValidate = () => false;

function makeStringValidator(calls: unknown[]): StandaloneValidate {
  const fn: StandaloneValidate = (data: unknown): boolean => {
    calls.push(data);
    const ok = typeof data === 'string';
    fn.errors = ok ? null : [{ instancePath: '', keyword: 'type', params: { type: 'string' }, message: 'must be string' }];
    return ok;
  };
  return fn;
}

describe('createRegistry', () => {
  it('get returns the node type with that name, or undefined', () => {
    const a = fixtureType('alpha');
    const b = fixtureType('beta', true);
    const reg = createRegistry([a, b]);
    expect(reg.get('alpha')).toBe(a);
    expect(reg.get('beta')).toBe(b);
    expect(reg.get('gamma')).toBeUndefined();
    expect(reg.get('toString')).toBeUndefined();
    expect(reg.get('__proto__')).toBeUndefined();
  });

  it('list returns every registered node type in input order', () => {
    const a = fixtureType('alpha');
    const b = fixtureType('beta');
    expect(createRegistry([a, b]).list()).toEqual([a, b]);
    expect(createRegistry([]).list()).toEqual([]);
  });

  it('list is not affected by later changes to the input array', () => {
    const input = [fixtureType('alpha')];
    const reg = createRegistry(input);
    input.push(fixtureType('beta'));
    expect(reg.list().map((t) => t.type)).toEqual(['alpha']);
  });

  it('throws an Error on duplicate type names', () => {
    expect(() => createRegistry([fixtureType('alpha'), fixtureType('beta'), fixtureType('alpha')])).toThrow(Error);
    expect(() => createRegistry([fixtureType('alpha'), fixtureType('alpha')])).toThrow(/alpha/);
  });
});

describe('defineProfile', () => {
  it('returns id, nodeTypes, validateSchema and a registry', () => {
    const a = fixtureType('alpha');
    const b = fixtureType('beta', true);
    const profile = defineProfile({
      id: 'test',
      nodeTypes: [a, b],
      validateSchema: acceptAll,
      responseValidators: { alpha: acceptAll, beta: rejectAll },
    });
    expect(profile.id).toBe('test');
    expect(profile.nodeTypes).toEqual([a, b]);
    expect(profile.validateSchema).toBe(acceptAll);
    expect(profile.registry.get('alpha')).toBe(a);
    expect(profile.registry.list()).toEqual([a, b]);
  });

  it('throws an Error when a node type has no response validator', () => {
    expect(() =>
      defineProfile({
        id: 'test',
        nodeTypes: [fixtureType('alpha'), fixtureType('beta')],
        validateSchema: acceptAll,
        responseValidators: { alpha: acceptAll },
      }),
    ).toThrow(/beta/);
  });

  it('does not take an inherited property as a response validator', () => {
    expect(() =>
      defineProfile({
        id: 'test',
        nodeTypes: [fixtureType('toString')],
        validateSchema: acceptAll,
        responseValidators: {},
      }),
    ).toThrow(Error);
  });

  it('throws an Error on duplicate node type names', () => {
    expect(() =>
      defineProfile({
        id: 'test',
        nodeTypes: [fixtureType('alpha'), fixtureType('alpha')],
        validateSchema: acceptAll,
        responseValidators: { alpha: acceptAll },
      }),
    ).toThrow(Error);
  });

  it('validateResponse calls the precompiled validator of that type', () => {
    const alphaCalls: unknown[] = [];
    const betaCalls: unknown[] = [];
    const profile = defineProfile({
      id: 'test',
      nodeTypes: [fixtureType('alpha'), fixtureType('beta')],
      validateSchema: acceptAll,
      responseValidators: { alpha: makeStringValidator(alphaCalls), beta: makeStringValidator(betaCalls) },
    });
    expect(profile.validateResponse('alpha', 'yes')).toBe(true);
    expect(profile.validateResponse('alpha', 42)).toBe(false);
    expect(alphaCalls).toEqual(['yes', 42]);
    expect(betaCalls).toEqual([]);
    expect(profile.validateResponse('beta', 'x')).toBe(true);
    expect(betaCalls).toEqual(['x']);
  });

  it('validateResponse returns false for an unregistered type', () => {
    const profile = defineProfile({
      id: 'test',
      nodeTypes: [fixtureType('alpha')],
      validateSchema: acceptAll,
      responseValidators: { alpha: acceptAll, extra: acceptAll },
    });
    expect(profile.validateResponse('gamma', 'x')).toBe(false);
    expect(profile.validateResponse('extra', 'x')).toBe(false);
    expect(profile.validateResponse('__proto__', 'x')).toBe(false);
  });
});
