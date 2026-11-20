import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Type from 'typebox';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ALLOWED_RUNTIME_HELPERS,
  assertSelfContained,
  buildProfileModule,
  inlineRuntimeHelpers,
} from '../src/codegen/index.ts';
import type { NodeTypeDescriptor, StandaloneValidate } from '../src/node-type.ts';
import { fixtureNodeTypes } from './fixtures/descriptors.ts';

// Forbidden tokens are built from fragments so that this file does not match the source scan.
const REQ = 'req' + 'uire';
const EV = 'ev' + 'al';
const FN = 'Func' + 'tion';
const IMP = 'imp' + 'ort';

type GeneratedModule = Record<string, StandaloneValidate>;

function minimalManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    profile: 'fixture',
    activityId: 'codegen-demo',
    version: 1,
    requires: { note: 1, end: 1 },
    entryNodeId: 'start',
    fallbackOutcomeId: 'done',
    limits: { maxNodes: 10, maxTransitions: 10 },
    variables: [],
    nodes: [
      { id: 'start', type: 'note', config: { text: 'Hello' }, edges: [{ to: 'done' }] },
      { id: 'done', type: 'end', config: { label: 'Bye' }, edges: [] },
    ],
    theme: 'default',
  };
}

describe('buildProfileModule', () => {
  const built = buildProfileModule('fixture', fixtureNodeTypes);
  let dir = '';
  let mod: GeneratedModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'dreame-codegen-'));
    const file = join(dir, 'fixture.validators.mjs');
    writeFileSync(file, built.js, 'utf8');
    mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as GeneratedModule;
  });

  afterAll(() => {
    if (dir !== '') rmSync(dir, { recursive: true, force: true });
  });

  it('returns js that passes assertSelfContained, with LF line endings', () => {
    expect(() => assertSelfContained(built.js)).not.toThrow();
    expect(built.js).not.toContain('\r');
    expect(built.js).not.toContain('ucs2length');
  });

  it('returns dts declaring each export as StandaloneValidate', () => {
    expect(built.dts).toContain("import type { StandaloneValidate } from '@dreame/schema';");
    for (const name of ['validateManifest', 'response_note', 'response_end']) {
      expect(built.dts).toContain(`export declare const ${name}: StandaloneValidate;`);
    }
  });

  it('exports validateManifest and one response_<type> per node type', () => {
    expect(typeof mod['validateManifest']).toBe('function');
    expect(typeof mod['response_note']).toBe('function');
    expect(typeof mod['response_end']).toBe('function');
  });

  it('accepts a minimal valid manifest', () => {
    const validate = mod['validateManifest'] as StandaloneValidate;
    expect(validate(minimalManifest())).toBe(true);
  });

  it('rejects a manifest with an extra property', () => {
    const validate = mod['validateManifest'] as StandaloneValidate;
    expect(validate({ ...minimalManifest(), extra: true })).toBe(false);
    expect(validate.errors?.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('counts maxLength in UTF-16 code units (Decision D6)', () => {
    const validate = mod['response_note'] as StandaloneValidate;
    const twoEmoji = '\u{1F600}\u{1F600}';
    expect(twoEmoji.length).toBe(4);
    expect(validate({ tag: twoEmoji })).toBe(false);
    expect(validate({ tag: '\u{1F600}' })).toBe(true);
    expect(validate({ tag: 'abc' })).toBe(true);
  });

  it('throws an Error naming an Ajv runtime helper that is not allowlisted', () => {
    const uniqueObjects: NodeTypeDescriptor = {
      type: 'picker',
      version: 1,
      terminal: false,
      configSchema: Type.Object({}, { additionalProperties: false }),
      responseSchema: Type.Object(
        { picks: Type.Array(Type.Object({ a: Type.Number() }, { additionalProperties: false }), { uniqueItems: true }) },
        { additionalProperties: false },
      ),
      validate: () => [],
      answerType: () => null,
    };
    expect(() => buildProfileModule('fixture', [uniqueObjects])).toThrow(/"equal"/);
  });
});

describe('inlineRuntimeHelpers', () => {
  it('replaces an allowlisted helper call with the inlined function', () => {
    const js = `const func2 = ${REQ}("ajv/dist/runtime/ucs2length").default;`;
    const out = inlineRuntimeHelpers(js);
    expect(out).toBe(`const func2 = (${ALLOWED_RUNTIME_HELPERS['ucs2length'] as string});`);
    expect(() => assertSelfContained(out)).not.toThrow();
  });

  it('throws an Error naming an unknown helper', () => {
    const js = `const func3 = ${REQ}("ajv/dist/runtime/notAHelper").default;`;
    expect(() => inlineRuntimeHelpers(js)).toThrow(/"notAHelper"/);
  });
});

describe('assertSelfContained', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    [`const x = ${REQ}("fs");`, `${REQ}(`],
    [`${IMP} fs from "fs";`, IMP],
    [`const m = ${IMP}("fs");`, IMP],
    [`${EV}("1 + 1");`, `${EV}(`],
    [`const f = new ${FN}("return 1");`, `new ${FN}`],
    [`const f = ${FN}("return 1");`, `${FN}(`],
  ];

  for (const [js, label] of cases) {
    it(`throws on ${label}`, () => {
      expect(() => assertSelfContained(js)).toThrow(Error);
      expect(() => assertSelfContained(js)).toThrow(label);
    });
  }

  it('accepts plain validator code', () => {
    expect(() => assertSelfContained('"use strict";\nexport const v = (d) => typeof d === "string";\n')).not.toThrow();
  });
});
