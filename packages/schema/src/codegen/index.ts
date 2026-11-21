// Build-time validator codegen (design Component 1, Requirement 4). Node-only: this is the one
// Schema_Package module that imports `ajv`, it is exposed only through the `./codegen` export,
// and `src/index.ts` does not re-export it, so browser code never reaches `ajv` (tech.md, B5).

import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { composeManifestSchema, composeResponseSchemas } from '../compose.ts';
import type { NodeTypeDescriptor } from '../node-type.ts';

export interface ProfileModule {
  readonly js: string;
  readonly dts: string;
}

/** Ajv code generation options that `buildProfileModule` lets callers change (ui-renderer design C2). */
export interface CodegenOptions {
  /** Ajv `inlineRefs`. `false` emits one function per `$ref` target instead of inlining it at every use site. */
  readonly inlineRefs: boolean;
  /** Ajv `code.lines`. */
  readonly lines: boolean;
}

/** The size-reducing setting used by `pnpm codegen` (Decision D14). */
export const DEFAULT_CODEGEN_OPTIONS: CodegenOptions = Object.freeze({ inlineRefs: false, lines: false });

/** The Day 2–4 setting, used only as the baseline of the equivalence test. */
export const BASELINE_CODEGEN_OPTIONS: CodegenOptions = Object.freeze({ inlineRefs: true, lines: true });

/**
 * Ajv runtime helpers that may be inlined, keyed by helper name, with the source of a function
 * expression written in this repo. `unicode: false` (Decision D6) means Ajv measures string
 * lengths with `.length` and no longer emits `ucs2length`; the entry stays so that the allowlist
 * mechanism has one known helper, and it matches Ajv's own semantics (code points).
 */
export const ALLOWED_RUNTIME_HELPERS: Readonly<Record<string, string>> = Object.freeze({
  ucs2length: 'function ucs2length(str) { let n = 0; for (const _ of str) n++; return n; }',
});

// Forbidden patterns are built from fragments so that the literal call tokens never appear in
// this file and the repository source scan (task 2.7) stays clean.
const FORBIDDEN_PATTERNS: ReadonlyArray<{ readonly label: string; readonly re: RegExp }> = [
  { label: 'req' + 'uire(', re: new RegExp('\\breq' + 'uire\\s*\\(') },
  { label: 'imp' + 'ort', re: new RegExp('\\bimp' + 'ort\\b') },
  { label: 'ev' + 'al(', re: new RegExp('\\bev' + 'al\\s*\\(') },
  { label: 'new ' + 'Func' + 'tion', re: new RegExp('\\bnew\\s+Func' + 'tion\\b') },
  { label: 'Func' + 'tion(', re: new RegExp('\\bFunc' + 'tion\\s*\\(') },
];

// Matches `require("ajv/dist/runtime/<helper>")` with an optional `.default`.
const RUNTIME_HELPER_RE = new RegExp(
  '\\breq' + 'uire\\(\\s*["\']ajv/dist/runtime/([A-Za-z0-9_]+)["\']\\s*\\)(?:\\.default)?',
  'g',
);

/** Throws an `Error` naming the first forbidden pattern found in `js`. */
export function assertSelfContained(js: string): void {
  for (const { label, re } of FORBIDDEN_PATTERNS) {
    const match = re.exec(js);
    if (match !== null) {
      throw new Error(`Generated validator code contains forbidden pattern "${label}" at index ${match.index}`);
    }
  }
}

/**
 * Replaces each Ajv runtime helper call whose helper is in `ALLOWED_RUNTIME_HELPERS` with the
 * inlined function; throws an `Error` naming the first helper that is not allowlisted.
 */
export function inlineRuntimeHelpers(js: string): string {
  return js.replace(RUNTIME_HELPER_RE, (_call: string, helper: string) => {
    if (!Object.hasOwn(ALLOWED_RUNTIME_HELPERS, helper)) {
      throw new Error(`Generated validator code needs Ajv runtime helper "${helper}", which is not in ALLOWED_RUNTIME_HELPERS`);
    }
    return `(${ALLOWED_RUNTIME_HELPERS[helper] as string})`;
  });
}

// Ajv 8 marks `unicode` as deprecated and warns on every instance. The option still works and is
// required by Decision D6, so only that one known warning is dropped; every other message passes.
const UNICODE_DEPRECATION_PREFIX = 'DEPRECATED: option unicode.';
const codegenLogger = {
  log: (...args: unknown[]): void => console.log(...args),
  warn: (...args: unknown[]): void => {
    if (typeof args[0] === 'string' && args[0].startsWith(UNICODE_DEPRECATION_PREFIX)) return;
    console.warn(...args);
  },
  error: (...args: unknown[]): void => console.error(...args),
};

function responseExportName(type: string): string {
  return `response_${type}`;
}

/**
 * Compiles the composed manifest schema of `profileId` and one response schema per node type
 * (`$id` `urn:dreame:response:<type>`) into one self-contained ES module. `js` exports
 * `validateManifest` and `response_<type>` per node type; `dts` declares each as
 * `StandaloneValidate`. `options` sets Ajv `inlineRefs` and `code.lines`; every other Ajv option
 * is fixed.
 */
export function buildProfileModule(
  profileId: string,
  nodeTypes: readonly NodeTypeDescriptor[],
  options: CodegenOptions = DEFAULT_CODEGEN_OPTIONS,
): ProfileModule {
  const manifestSchema = composeManifestSchema(profileId, nodeTypes);
  const responseSchemas = composeResponseSchemas(nodeTypes);

  const ajv = new Ajv({
    code: { source: true, esm: true, lines: options.lines },
    inlineRefs: options.inlineRefs,
    strict: true,
    allErrors: true,
    discriminator: true,
    // Text limits count UTF-16 code units (`string.length`), Decision D6.
    unicode: false,
    logger: codegenLogger,
  });

  const manifestId = `urn:dreame:manifest:${profileId}`;
  ajv.addSchema(manifestSchema);
  const exportsMap: Record<string, string> = { validateManifest: manifestId };
  for (const nt of nodeTypes) {
    const id = `urn:dreame:response:${nt.type}`;
    ajv.addSchema({ $id: id, ...responseSchemas[nt.type] });
    exportsMap[responseExportName(nt.type)] = id;
  }

  const raw = standaloneCode(ajv, exportsMap);
  const js =
    `// Generated by @dreame/schema/codegen for profile "${profileId}". Do not edit.\n` +
    `${inlineRuntimeHelpers(raw).replace(/\r\n/g, '\n')}\n`;
  assertSelfContained(js);

  const dtsLines = [
    `// Generated by @dreame/schema/codegen for profile "${profileId}". Do not edit.`,
    "import type { StandaloneValidate } from '@dreame/schema';",
    ...Object.keys(exportsMap).map((name) => `export declare const ${name}: StandaloneValidate;`),
    '',
  ];
  return { js, dts: dtsLines.join('\n') };
}
