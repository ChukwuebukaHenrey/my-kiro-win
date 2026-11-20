import Type from 'typebox';
import { describe, expect, it } from 'vitest';
import { composeManifestSchema, composeResponseSchemas, toPlainJsonSchema } from '../src/compose.ts';
import { HARD_LIMITS, NODE_ID_PATTERN } from '../src/ids.ts';
import type { JsonSchema, NodeTypeDescriptor } from '../src/node-type.ts';

const closed = { additionalProperties: false } as const;

function descriptor(type: string, terminal = false): NodeTypeDescriptor {
  return {
    type,
    version: 1,
    terminal,
    configSchema: Type.Object({ text: Type.String({ maxLength: 2000 }) }, closed),
    responseSchema: Type.Object({ ok: Type.Literal(true) }, closed),
    validate: () => [],
    answerType: () => null,
  };
}

const nodeTypes = [descriptor('zeta'), descriptor('alpha'), descriptor('outcome', true)];

/** Calls `visit` on every object reachable from `value`. */
function walk(value: unknown, visit: (obj: Record<string, unknown>) => void): void {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (v !== null && typeof v === 'object') {
      if (!Array.isArray(v)) visit(v as Record<string, unknown>);
      for (const child of Object.values(v)) stack.push(child);
    }
  }
}

function collectRefs(value: unknown): string[] {
  const refs: string[] = [];
  walk(value, (obj) => {
    if (typeof obj['$ref'] === 'string') refs.push(obj['$ref']);
  });
  return refs;
}

describe('composeManifestSchema', () => {
  const schema = composeManifestSchema('core', nodeTypes);
  const properties = schema['properties'] as Record<string, JsonSchema>;
  const defs = schema['$defs'] as Record<string, JsonSchema>;

  it('sets $id, a closed root and a profile const', () => {
    expect(schema['$id']).toBe('urn:dreame:manifest:core');
    expect(schema['type']).toBe('object');
    expect(schema['additionalProperties']).toBe(false);
    expect(properties['profile']).toEqual({ const: 'core' });
  });

  it('limits nodes to 1–200 items of #/$defs/Node', () => {
    expect(properties['nodes']).toEqual({
      type: 'array',
      minItems: 1,
      maxItems: HARD_LIMITS.maxNodes,
      items: { $ref: '#/$defs/Node' },
    });
    expect(HARD_LIMITS.maxNodes).toBe(200);
  });

  it('has the expected $defs names', () => {
    const condNames = Array.from({ length: 8 }, (_, i) => `CondD${i + 1}`);
    expect(Object.keys(defs).sort()).toEqual(
      [...condNames, 'Ref', 'Scalar', 'Edge', 'Effect', 'VarDecl', 'Node'].sort(),
    );
  });

  it('defines Node as a discriminated oneOf with one closed branch per node type in input order', () => {
    const node = defs['Node'] as JsonSchema;
    expect(node['type']).toBe('object');
    expect(node['properties']).toEqual({ type: { type: 'string' } });
    expect(node['required']).toEqual(['type']);
    expect(node['discriminator']).toEqual({ propertyName: 'type' });
    const branches = node['oneOf'] as JsonSchema[];
    expect(branches).toHaveLength(nodeTypes.length);
    branches.forEach((branch, i) => {
      const nt = nodeTypes[i] as NodeTypeDescriptor;
      const props = branch['properties'] as Record<string, JsonSchema>;
      expect(branch['type']).toBe('object');
      expect(branch['additionalProperties']).toBe(false);
      expect(branch['required']).toEqual(['id', 'type', 'config', 'edges']);
      expect(props['id']).toMatchObject({ type: 'string', pattern: NODE_ID_PATTERN });
      expect(props['type']).toEqual({ const: nt.type });
      expect(props['config']).toEqual(toPlainJsonSchema(nt.configSchema));
      expect(props['edges']).toEqual({
        type: 'array',
        maxItems: HARD_LIMITS.maxEdgesPerNode,
        items: { $ref: '#/$defs/Edge' },
      });
    });
  });

  it('returns deep-equal output on two calls', () => {
    expect(composeManifestSchema('core', nodeTypes)).toEqual(composeManifestSchema('core', nodeTypes));
  });

  it('contains no ~kind key anywhere', () => {
    expect(JSON.stringify(schema)).not.toContain('~kind');
    walk(schema, (obj) => {
      expect(Reflect.ownKeys(obj)).not.toContain('~kind');
    });
  });

  it('has no CondDk that refers to itself, and every $ref resolves', () => {
    for (let k = 1; k <= 8; k++) {
      expect(collectRefs(defs[`CondD${k}`])).not.toContain(`#/$defs/CondD${k}`);
    }
    for (const ref of collectRefs(schema)) {
      expect(ref.startsWith('#/$defs/')).toBe(true);
      expect(defs[ref.slice('#/$defs/'.length)]).toBeDefined();
    }
  });

  it('throws an Error on duplicate or malformed type names', () => {
    expect(() => composeManifestSchema('core', [descriptor('choice'), descriptor('choice')])).toThrow(Error);
    for (const bad of ['Choice', '1choice', 'my-type', '', 'a'.repeat(33)]) {
      expect(() => composeManifestSchema('core', [descriptor(bad)])).toThrow(Error);
    }
  });
});

describe('composeResponseSchemas', () => {
  it('returns one plain schema per node type, keyed by name', () => {
    const responses = composeResponseSchemas(nodeTypes);
    expect(Object.keys(responses)).toEqual(['zeta', 'alpha', 'outcome']);
    for (const nt of nodeTypes) {
      expect(responses[nt.type]).toEqual(toPlainJsonSchema(nt.responseSchema));
    }
    expect(JSON.stringify(responses)).not.toContain('~kind');
  });

  it('throws an Error on duplicate or malformed type names', () => {
    expect(() => composeResponseSchemas([descriptor('a'), descriptor('a')])).toThrow(Error);
    expect(() => composeResponseSchemas([descriptor('Bad')])).toThrow(Error);
  });
});

describe('toPlainJsonSchema', () => {
  it('returns a JSON copy without ~kind', () => {
    const source = Type.Object({ a: Type.String() }, closed);
    const plain = toPlainJsonSchema(source);
    expect(plain).toEqual(JSON.parse(JSON.stringify(source)));
    expect(plain).not.toBe(source);
    walk(plain, (obj) => {
      expect(Reflect.ownKeys(obj)).not.toContain('~kind');
    });
  });
});
