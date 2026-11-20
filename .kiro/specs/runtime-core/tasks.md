# Implementation Plan: Runtime Core (DREAME Days 2–4)

## Overview

Tasks follow the design's build order: workspace dependencies and package scaffolding, `@dreame/schema` contracts and codegen, `@dreame/runtime`, `@dreame/node-types`, the graph validator, the property tests, the `tools/validate` CLI, the demo manifest and broken fixture, the root scripts and `pnpm check`, then a final checkpoint. Interfaces, file names, limits and rules come from `design.md`; each task names the files it creates and how to verify them. All code is TypeScript under `strict`.

Conventions for every task:
- Write files with the editor tool (UTF-8, no BOM, LF line endings).
- Commands typed into PowerShell must work in PowerShell 5.1 and 7: separate commands with `;` or separate calls, and never use `&&` or `||`. `&&` appears only inside `package.json` script values (design Component 5).
- Check exit codes with `; $LASTEXITCODE` after the command. A verification passes only when every listed command prints exit code 0 unless the task says otherwise.
- Run tests once with `pnpm exec vitest run <path>` (never watch mode, Req 18.10).
- Relative imports use explicit `.ts` extensions; use only erasable syntax, with no `enum`, `namespace` or constructor parameter properties (Req 1.5).
- Do not add a dependency that Req 1.6 or 1.7 does not list. If one seems needed, stop and ask the user (Req 1.9).
- Create no files under `.kiro/hooks/` (Req 17.14) and do not edit `.github/workflows/ci.yml` (Req 18.9).
- When a fast-check property fails, fix the code, then copy the printed seed and shrunk counterexample into the same test file as a regular example test.
- Property tests run with `numRuns` of at least 100 and carry the tag `Feature: runtime-core, Property N: <title>` in the `describe` or `it` title (Req 18.11).
- Until task 9.1 replaces the root scripts, run codegen with `pnpm --filter @dreame/node-types run codegen` and typecheck with `pnpm exec tsc -p tsconfig.json`.

## Tasks

- [x] 1. Workspace dependencies and package scaffolding
  - [x] 1.1 Add root devDependencies, base compiler options and the generated-files ignore rule
    - Edit `package.json`: add `vitest` `^5.1.1`, `vite` `^8.3.8`, `fast-check` `^4.10.3` and `@types/node` `^22.20.5` to `devDependencies`, keeping `typescript` and `simple-git-hooks` (six entries); keep `engines.node` `>=22`; leave `scripts` and the `simple-git-hooks` field unchanged in this task
    - Edit `tsconfig.base.json`: keep `strict: true`; add `noEmit`, `allowImportingTsExtensions` and `erasableSyntaxOnly`, each `true`
    - Edit `.gitignore`: add the line `packages/*/generated/`
    - _Requirements: 1.3, 1.5, 1.7, 1.8, 1.11, 4.6_

  - [x] 1.2 Create the four workspace package manifests and tsconfigs
    - Create `packages/schema/package.json`, `packages/runtime/package.json`, `packages/node-types/package.json` and `tools/validate/package.json` with the exact content in design Components 1–4 (`private`, `type: module`, `exports`, the `codegen` script in `@dreame/node-types`, and the dependencies of Req 1.6)
    - Create `tsconfig.json` in each of the four folders: extends `../../tsconfig.base.json`, `compilerOptions.strict: true`, includes that package's `src`, `test`, `scripts` and `generated` folders
    - Create a placeholder `src/index.ts` containing `export {};` in each of the four packages, so that the root typecheck has inputs; keep the existing Day 1 `README.md` files
    - No `package.json` other than the root lists `vite` or `@types/node`
    - _Requirements: 1.1, 1.2, 1.6, 1.8_

  - [x] 1.3 Create the root `tsconfig.json` and `vitest.config.ts`
    - `tsconfig.json`: extends `./tsconfig.base.json`, `strict: true`, `include` exactly the seven globs of Req 1.4
    - `vitest.config.ts`: `defineConfig` from `vitest/config` with `test.include` `['packages/*/test/**/*.test.ts', 'tools/*/test/**/*.test.ts']` and `test.environment` `'node'`
    - _Requirements: 1.4, 18.3_

  - [x] 1.4 Install and verify the scaffolding
    - Run `pnpm install; $LASTEXITCODE`
    - Run `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - Run `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Run `Select-String -Path packages/*/package.json, tools/*/package.json -Pattern '"vite"|"@types/node"'`; pass on no output
    - Run `Select-String -Path pnpm-lock.yaml -Pattern 'fast-check@4|vitest@5|typebox@1|ajv@8'`; pass when each name appears
    - **Stop condition:** install fails, or pnpm reports a missing peer that Req 1.6 or 1.7 does not list → stop and ask the user before adding anything (Req 1.9)
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 2. `@dreame/schema`: contracts, composer, parser, URL check and codegen
  - [x] 2.1 Write the limits, contracts, diagnostics and node-type descriptor modules
    - Create `packages/schema/src/ids.ts` (`MAX_MANIFEST_JSON_BYTES`, `HARD_LIMITS`, the seven patterns), `src/contracts.ts` (TypeBox schemas and static types, `condDefs(maxDepth)`, `EdgeSchemaRef`, branded `ValidManifest`), `src/diagnostics.ts` (`Stage`, `Severity`, `DiagnosticCode`, `Diagnostic`, `severityOf`, `sortDiagnostics`) and `src/node-type.ts` (`JsonSchema`, `ValueType`, `GraphCtx`, `NodeTypeDescriptor`, `StandaloneValidate`, `ProfileDescriptor`)
    - `severityOf` returns `'warning'` for `requires-unused` and `'error'` for every other code
    - `sortDiagnostics` sorts a copy by stage order `parse`, `schema`, `caps`, `ids`, `refs`, `dag`, `terminal`, `conditions`, then `path`, then `code`, with final tie-breaks on `message`, `severity` and `nodeId` so equal keys sort the same for every input order
    - `condDefs(8)` returns `CondD1` (leaf only) to `CondD8`, where `CondDk` refers only to the leaf and `CondD(k-1)`
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 7.9, 7.10_

  - [x] 2.2 Write unit tests for IDs, limits and diagnostics helpers
    - Create `packages/schema/test/ids.test.ts`: each pattern accepts and rejects examples, `__proto__` and `_a` fail `NODE_ID_PATTERN`, `HARD_LIMITS` and `MAX_MANIFEST_JSON_BYTES` have the Req 2.2 values, `severityOf` gives `warning` only for `requires-unused`, and `sortDiagnostics` orders a hand-built list as Req 7.9 states
    - Verify: `pnpm exec vitest run packages/schema/test/ids.test.ts; $LASTEXITCODE`
    - _Requirements: 2.2, 2.3, 2.4, 7.9, 7.10_

  - [x] 2.3 Implement the schema composer
    - Create `packages/schema/src/compose.ts` with `toPlainJsonSchema`, `composeManifestSchema` and `composeResponseSchemas` as in design Component 1
    - Create `packages/schema/test/compose.test.ts`: `$id` and `profile` const, `nodes` 1–200 items, the `$defs` names, `Node` `oneOf` with the discriminator and one closed branch per node type in input order, deep-equal output on two calls, no `~kind` key anywhere in the output, no `CondDk` that refers to itself, `Error` on duplicate or malformed type names
    - Verify: `pnpm exec vitest run packages/schema/test/compose.test.ts; $LASTEXITCODE`
    - _Requirements: 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 2.4 Implement the byte cap and parser
    - Create `packages/schema/src/parse.ts` with `utf8ByteLength` (counts code points by range, no allocation) and `parseManifestText` (cap check before `JSON.parse`; `parse/too-large`; `parse/invalid-json` carrying the parser's position message)
    - Create `packages/schema/test/parse.test.ts`: boundary examples at 65,536 and 65,537 bytes built from multi-byte characters, lone surrogates counted as 3 bytes like `TextEncoder`, invalid JSON message, valid JSON value returned
    - Verify: `pnpm exec vitest run packages/schema/test/parse.test.ts; $LASTEXITCODE`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.5 Implement the HTTPS URL check
    - Create `packages/schema/src/url.ts` with `SHORTENER_HOSTS` (the ten hosts of Req 6.3) and `checkHttpsUrl` (length ≤ 2,048, `new URL` inside a `try` that returns `unsafe-url` on a parse error, `https:` only, non-empty host, no credentials, host lower-cased with a leading `www.` removed not in `SHORTENER_HOSTS`)
    - Create `packages/schema/test/url.test.ts`: `https://wa.me/...` passes; `javascript:`, `http:`, `data:`, each shortener (with and without `www.`), credentials, an empty host and a 2,049-character URL fail with `unsafe-url` at the given path
    - Verify: `pnpm exec vitest run packages/schema/test/url.test.ts; $LASTEXITCODE`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.6 Implement the build-time codegen module
    - Create `packages/schema/src/codegen/index.ts` with `ALLOWED_RUNTIME_HELPERS`, `assertSelfContained` and `buildProfileModule` using the Ajv options of Req 4.2, including `unicode: false` (Decision D6), so `ucs2length` is no longer expected in the output; replace any allowlisted helper `require` call that Ajv still emits with the inlined function; throw an `Error` naming any other helper or forbidden pattern
    - Build the forbidden-pattern regexes from string fragments (for example `'ev' + 'al'`), so that the literal call tokens do not appear in the source and the task 2.7 scan stays clean
    - Create `packages/schema/test/fixtures/descriptors.ts` (two small `NodeTypeDescriptor` objects with TypeBox schemas) and `packages/schema/test/codegen.test.ts`: the output `js` passes `assertSelfContained`; writing it to a temp folder under `os.tmpdir()` and loading it with `import(pathToFileURL(file).href)` gives a `validateManifest` that accepts a minimal valid manifest and rejects one with an extra property; a string of 2 emoji (4 UTF-16 code units) fails a `maxLength: 3` schema (D6); `assertSelfContained` throws on each forbidden pattern; an unknown helper name throws
    - Verify: `pnpm exec vitest run packages/schema/test/codegen.test.ts; $LASTEXITCODE`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.7 Wire the browser-safe barrel and add the source scan test
    - Replace `packages/schema/src/index.ts` with re-exports of `ids.ts`, `contracts.ts`, `diagnostics.ts`, `node-type.ts`, `compose.ts`, `parse.ts` and `url.ts`; do not re-export `codegen`
    - Create `packages/schema/test/source-scan.test.ts`: (a) no `.ts` or `.js` file under `packages/` or `tools/` (excluding `node_modules` and `generated`) calls `eval` or `new Function` or uses `innerHTML` or `dangerouslySetInnerHTML`, with the patterns built from fragments so this file does not match itself; (b) following relative imports from `packages/schema/src/index.ts` never reaches a file that imports `ajv`; (c) only `packages/schema/src/codegen/` imports `ajv` among files under `packages/*/src` and `tools/*/src`
    - Verify: `pnpm exec vitest run packages/schema; $LASTEXITCODE`, then `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 4.1, 4.8, 6.5, 14.6, 14.7_

- [x] 3. `@dreame/runtime`: RNG, conditions, effects, registry and reducer
  - [x] 3.1 Implement the seeded RNG
    - Create `packages/runtime/src/rng.ts` with `SeededRng` and `createRng` (mulberry32; `RangeError` for a non-uint32 state; `nextInt` `RangeError` outside 1 to 2^32; `shuffle` as Fisher–Yates on a copy)
    - Create `packages/runtime/test/rng.test.ts`: the first outputs for seeds 0, 1 and 2^32 − 1 match a reference mulberry32 written out step by step in the test; `RangeError` cases for `createRng(-1)`, `createRng(1.5)`, `createRng(2 ** 32)`, `nextInt(0)` and `nextInt(2 ** 32 + 1)`; continuing from `createRng(rng.state)` gives the same next values
    - Verify: `pnpm exec vitest run packages/runtime/test/rng.test.ts; $LASTEXITCODE`
    - _Requirements: 12.1, 12.2, 12.5, 12.7_

  - [x] 3.2 Define the runtime state and node-type types
    - Create `packages/runtime/src/state.ts` (`Status`, `RuntimeEvent`, `AttemptState`, `Action`, `Clock`, `Env`, `JsonValue`) and `packages/runtime/src/node-type.ts` (`NodeType<C, R>` extending `NodeTypeDescriptor`, `AnyNodeType`) as in design Component 2
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 15.1, 15.12_

  - [x] 3.3 Implement the condition evaluator
    - Create `packages/runtime/src/conditions.ts` with `readRef` (`Object.hasOwn` lookups only) and `evaluateCond` (rules of Req 13.2 and 13.3)
    - Create `packages/runtime/test/conditions.test.ts`: one example per operator, a missing answer reads `undefined` and its leaf is `false`, a `__proto__` or `constructor` key is never read, the input state is unchanged (deep-frozen input)
    - Verify: `pnpm exec vitest run packages/runtime/test/conditions.test.ts; $LASTEXITCODE`
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [x] 3.4 Implement effects with clamping
    - Create `packages/runtime/src/effects.ts` with `applyEffects` and `clampToDecl` as in design Component 2: `set` stores the value; `add` stores `clampToDecl(current + value, decl)`, using `-Number.MAX_VALUE` and `Number.MAX_VALUE` for missing bounds; returns a new state
    - Create `packages/runtime/test/effects.test.ts`: `set` and `add` examples, `add` clamped at `max` and at `min`, an unbounded `add` of `Number.MAX_VALUE` twice stays finite, effects applied in order, deep-frozen input unchanged
    - Verify: `pnpm exec vitest run packages/runtime/test/effects.test.ts; $LASTEXITCODE`
    - _Requirements: 13.4, 13.5, 13.6_

  - [x] 3.5 Implement the registry and profile builder
    - Create `packages/runtime/src/registry.ts` (`createRegistry`, `Error` on duplicate names) and `packages/runtime/src/profile.ts` (`defineProfile`, `Error` when a node type has no response validator; `validateResponse` calls the precompiled validator)
    - Create `packages/runtime/test/registry.test.ts` with hand-written `StandaloneValidate` functions (no `ajv`): `get`, `list`, duplicate names, missing response validator, `validateResponse`
    - Verify: `pnpm exec vitest run packages/runtime/test/registry.test.ts; $LASTEXITCODE`
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 3.6 Implement the reducer
    - Create `packages/runtime/src/reducer.ts` with `createRuntime`, `createAttempt`, `checkAction` and `reduce` as in design Component 2 and the "One reducer step" sequence: `createAttempt` calls the entry node type's `enter` with `createRng(seed)` and stores the RNG state; rejection order `not-playing`, `unknown-action`, `wrong-node`, `invalid-response`; a rejected action returns the same object; first matching edge after the node type's `reduce`; limit fallback with `limit_reached`; `finished` event on entering a terminal; `enter` on each entered node; `rngState` and `updatedAt` set on every new state
    - Create `packages/runtime/test/fixtures/node-types.ts` (a non-terminal fixture type with an `enter` that draws from `env.rng`, a terminal fixture type, hand-written validators, and a test-only `asValidManifest` cast) and `packages/runtime/test/reducer.test.ts`: `createAttempt` fields and `enter` call, each rejection reason and `===` return, edge order, an edge reading the node's own answer, limit fallback at `maxTransitions` 0 and 1, `finished` event, `path` and `transitions` updates, deep-frozen inputs unchanged
    - Verify: `pnpm exec vitest run packages/runtime/test/reducer.test.ts; $LASTEXITCODE`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11_

  - [x] 3.7 Wire the runtime barrel and add the boundary test
    - Replace `packages/runtime/src/index.ts` with re-exports of `rng.ts`, `state.ts`, `node-type.ts`, `conditions.ts`, `effects.ts`, `registry.ts`, `profile.ts` and `reducer.ts`
    - Create `packages/runtime/test/boundaries.test.ts`: no file under `packages/runtime` imports `react`, `react-dom` or a path containing `apps/`; `packages/runtime/package.json` has no `@dreame/node-types` dependency; no file under `packages/runtime/src` or `packages/node-types/src` contains `Date.now`, `new Date(` or `Math.random` (scan whichever files exist)
    - Verify: `pnpm exec vitest run packages/runtime; $LASTEXITCODE`, then `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 14.5, 15.11_

- [x] 4. `@dreame/node-types`: shared node types and the `core` profile
  - [x] 4.1 Implement `content`, `choice` and `outcome`
    - Create `packages/node-types/src/content.ts`, `src/choice.ts`, `src/outcome.ts` with the configs, responses, `answerType`, `enter`, `reduce`, `isValidResponse` and `validate` rules in the design Component 3 table; `choice` applies option effects with `applyEffects` and stores `nodeState[nodeId] = { order: env.rng.shuffle(ids) }` on `enter` when `shuffle` is true; `isValidResponse` for `choice` checks that `optionId` is one of the node's option IDs
    - Create `packages/node-types/src/core-types.ts` exporting `coreNodeTypes = [content, choice, outcome]` with no import of generated code
    - No `Render` member on any of the three
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.11_

  - [x] 4.2 Write the codegen script and generate the `core` validators
    - Create `packages/node-types/scripts/codegen.ts`: import `coreNodeTypes` and `buildProfileModule` from `@dreame/schema/codegen`; create `generated/` when missing; write `core.validators.js` and `core.validators.d.ts` with LF endings; print one line with both paths and the JS byte size; no `try`/`catch`, so errors exit non-zero
    - Verify: `pnpm --filter @dreame/node-types run codegen; $LASTEXITCODE`; `Test-Path packages/node-types/generated/core.validators.js`; `git check-ignore -v packages/node-types/generated/core.validators.js; $LASTEXITCODE` (pass when output names `packages/*/generated/` and exit is 0); `Select-String -Path packages/node-types/generated/core.validators.js -Pattern 'require\('` (pass on no output)
    - _Requirements: 4.2, 4.3, 4.5, 4.6, 4.7_

  - [x] 4.3 Bind the `core` profile and the package barrel
    - Create `packages/node-types/src/core-profile.ts` (`coreProfile` from `defineProfile` with ID `core`, `coreNodeTypes`, the generated `validateManifest` and `response_content`, `response_choice`, `response_outcome`)
    - Replace `packages/node-types/src/index.ts` with re-exports of the three node types, `core-types.ts` and `core-profile.ts`
    - Verify: `pnpm --filter @dreame/node-types run codegen; $LASTEXITCODE`, then `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 16.10_

  - [x] 4.4 Write node-type unit tests
    - Create `packages/node-types/test/node-types.test.ts` with a stub `GraphCtx` built in the test: config examples accepted and rejected by the generated validators, `answerType` values, `choice` `reduce` sets the answer and applies effects, `enter` with `shuffle` stores a permutation, `isValidResponse` rejects an unknown `optionId`, `validate` reports `blank-text`, `duplicate-option-id`, `effect-invalid` (through the stub `checkEffect`) and `unsafe-url`, `reduce` of `content` and `outcome` returns the input state
    - Verify: `pnpm exec vitest run packages/node-types/test/node-types.test.ts; $LASTEXITCODE`
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_

- [x] 5. Graph validator in `packages/schema/src/graph.ts`
  - [x] 5.1 Map Ajv errors to diagnostics
    - Create `packages/schema/src/ajv-errors.ts` with `mapSchemaErrors(errors, input, profile)`: one `schema/schema` per Ajv error at its `instancePath`; a discriminator failure on a node's `type` becomes `schema/unknown-node-type` for that node; for each edge `when` deeper than 8 levels (iterative depth walk that stops at 9) one `schema/cond-too-deep` at the `when` path replaces the Ajv errors inside it
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 8.1, 8.2, 11.1_

  - [x] 5.2 Implement stages 1–4 and the result contract
    - Create `packages/schema/src/graph.ts` with `validateManifest` and `validateManifestText`: stage 1 (`profile.validateSchema`, `mapSchemaErrors`, `profile-mismatch`), stage 2 (`node-cap`, `transition-cap`), stage 3 (`duplicate-node-id`, `duplicate-var-id`), stage 4 (`dangling-ref`, `undeclared-var`, `requires-missing`, `requires-version`, `requires-unknown`, and `requires-unused` as a warning); stop after the first stage with an error while keeping earlier warnings; `severityOf` for every diagnostic; `sortDiagnostics`; at most 50 diagnostics; no mutation of `input` and no `try`/`catch` around the stages; `validateManifestText` returns `parse` diagnostics without running stages 1–7
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.10, 8.1, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 5.3 Implement stages 5 and 6
    - Extend `packages/schema/src/graph.ts`: stage 5 `cycle` with an iterative three-color DFS; stage 6 `dead-end`, `terminal-has-edges`, `last-edge-conditional`, `fallback-not-terminal`, `unreachable-node` (forward reachability from `entryNodeId`), `no-terminal-reachable` (reverse reachability from terminals) and `limit-below-longest-path` (longest entry-to-terminal path by edge count over a topological order)
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 5.4 Implement stage 7 and `GraphCtx`
    - Extend `packages/schema/src/graph.ts`: `type-mismatch`, `ref-not-answerable`, `answer-not-upstream` (dominator check on the DAG, with the holding node counted as on every path), `var-decl-invalid`, `invalid-date` (real calendar date), and a `GraphCtx` whose `checkEffect` follows design Component 1 (undeclared variable, `add` on a non-number, `set` value outside the declared type, range or `values`), `checkHttpsUrl` and `checkText` (`blank-text`); call each node type's `validate(cfg, ctx)` and include its diagnostics
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

  - [x] 5.5 Export the validator from the schema barrel
    - Edit `packages/schema/src/index.ts`: add re-exports of `graph.ts` (`validateManifest`, `validateManifestText`, `ValidationResult`); keep `ajv-errors.ts` internal and keep `codegen` out
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`, then `pnpm exec vitest run packages/schema/test/source-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 4.1, 14.6_

  - [x] 5.6 Write validator example tests
    - Create `packages/node-types/test/validator.test.ts` against `coreProfile`: one manifest per diagnostic code of design "Stage and severity of each code" (except the CLI-only `parse` codes), asserting `stage`, `code`, `severity` and `path`; depth 8 passes and depth 9 gives `schema/cond-too-deep`; 200 nodes pass the schema and 201 fail; `requires-unused` alone gives `ok: true` with one warning; a later-stage error keeps an earlier `requires-unused` warning; a stage-3 error skips stages 4–7; an own-answer edge condition passes; an `answer` ref to a node off some path gives `answer-not-upstream`
    - Verify: `pnpm --filter @dreame/node-types run codegen; $LASTEXITCODE`, then `pnpm exec vitest run packages/node-types/test/validator.test.ts; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.3, 7.10, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

- [x] 6. Property tests
  - [x] 6.1 Write the shared arbitraries
    - Create `packages/node-types/test/arbitraries.ts` (not a test file): a valid-manifest arbitrary that orders node IDs, adds edges only from lower to higher positions, ends every path in an `outcome`, makes the last edge of each node unconditional, uses only upstream or own answers in conditions, includes bounded and unbounded `number` variables with `add` effects large enough to cross the bounds, sets `requires` to exactly the used types, and sets `limits.maxTransitions` to at least the longest path; defect injectors for the six defects of Property 5; an accepted-response arbitrary for the current node; a driver that plays a manifest from `createAttempt` and returns every state
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 18.11_

  - [x] 6.2 Write the property test for termination
    - Create `packages/node-types/test/termination.property.test.ts`
    - **Property 1: Valid manifests reach an outcome within `maxTransitions`**
    - **Validates: Requirements 15.12, 15.15**
    - Verify: `pnpm exec vitest run packages/node-types/test/termination.property.test.ts; $LASTEXITCODE`

  - [x] 6.3 Write the property test for validator robustness
    - Create `packages/node-types/test/validator.property.test.ts`; inputs from `fc.jsonValue()`, manifest-shaped values with random field types, and `fc.string()`; inputs deep-frozen
    - **Property 2: The validator does not throw on random input**
    - **Validates: Requirements 7.2, 7.4, 7.5, 7.6, 7.7, 7.10**
    - Verify: `pnpm exec vitest run packages/node-types/test/validator.property.test.ts; $LASTEXITCODE`

  - [x] 6.4 Write the property test for replay determinism
    - Create `packages/node-types/test/replay.property.test.ts`; include the JSON round trip of an intermediate state
    - **Property 3: Same seed and actions give the same result**
    - **Validates: Requirements 12.7, 15.13, 15.14, 16.5**
    - Verify: `pnpm exec vitest run packages/node-types/test/replay.property.test.ts; $LASTEXITCODE`

  - [x] 6.5 Write the property test for generated manifests passing validation
    - Add to `packages/node-types/test/validator.property.test.ts`
    - **Property 4: Generated valid manifests pass validation**
    - **Validates: Requirements 7.3, 16.9**
    - Verify: `pnpm exec vitest run packages/node-types/test/validator.property.test.ts; $LASTEXITCODE`

  - [x] 6.6 Write the property test for injected defects
    - Add to `packages/node-types/test/validator.property.test.ts`; one injected defect per case, expected `stage/code` per design Property 5
    - **Property 5: Injected defects are reported at the expected stage**
    - **Validates: Requirements 7.1, 9.1, 9.3, 10.1, 10.2, 11.2, 11.8, 16.8**
    - Verify: `pnpm exec vitest run packages/node-types/test/validator.property.test.ts; $LASTEXITCODE`

  - [x] 6.7 Write the property test for rejected actions
    - Add to `packages/node-types/test/replay.property.test.ts`; states deep-frozen; random actions including wrong node IDs, unknown types, invalid responses and actions after the end
    - **Property 6: Rejected actions leave the state unchanged**
    - **Validates: Requirements 15.4, 15.11, 16.7**
    - Verify: `pnpm exec vitest run packages/node-types/test/replay.property.test.ts; $LASTEXITCODE`

  - [x] 6.8 Write the property test for `AttemptState` invariants
    - Add to `packages/node-types/test/termination.property.test.ts`; check every invariant in design Data Models, including declared type and range of every variable
    - **Property 7: `AttemptState` invariants hold after every step**
    - **Validates: Requirements 15.2, 15.8, 15.12**
    - Verify: `pnpm exec vitest run packages/node-types/test/termination.property.test.ts; $LASTEXITCODE`

  - [x] 6.9 Write the property test for the byte cap
    - Add to `packages/schema/test/parse.test.ts`; spy on `JSON.parse` with `vi.spyOn` and restore it after each case
    - **Property 8: The 64 KB cap is checked before `JSON.parse`**
    - **Validates: Requirements 5.1, 5.2**
    - Verify: `pnpm exec vitest run packages/schema/test/parse.test.ts; $LASTEXITCODE`

  - [x] 6.10 Write the property test for condition evaluation
    - Add to `packages/runtime/test/conditions.test.ts`; conditions up to depth 8 with a reference model written in the test
    - **Property 9: Condition evaluation matches a reference model**
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - Verify: `pnpm exec vitest run packages/runtime/test/conditions.test.ts; $LASTEXITCODE`

  - [x] 6.11 Write the property test for the seeded RNG
    - Add to `packages/runtime/test/rng.test.ts`
    - **Property 10: Seeded RNG is reproducible and in range**
    - **Validates: Requirements 12.3, 12.4, 12.6**
    - Verify: `pnpm exec vitest run packages/runtime/test/rng.test.ts; $LASTEXITCODE`

  - [x] 6.12 Write the property test for the URL check
    - Add to `packages/schema/test/url.test.ts`
    - **Property 11: Only `https:` URLs pass the URL check**
    - **Validates: Requirements 6.1, 6.2**
    - Verify: `pnpm exec vitest run packages/schema/test/url.test.ts; $LASTEXITCODE`

  - [x] 6.13 Write the property test for diagnostic sorting
    - Create `packages/schema/test/diagnostics.test.ts`
    - **Property 12: Diagnostic sorting is stable and order-independent**
    - **Validates: Requirements 7.9**
    - Verify: `pnpm exec vitest run packages/schema/test/diagnostics.test.ts; $LASTEXITCODE`

  - [x] 6.14 Write the property test for clamped effects
    - Add to `packages/runtime/test/effects.test.ts`; reference fold written in the test
    - **Property 13: `add` effects are clamped to the declared range**
    - **Validates: Requirements 13.4, 13.6, 15.12**
    - Verify: `pnpm exec vitest run packages/runtime/test/effects.test.ts; $LASTEXITCODE`

- [x] 7. `tools/validate` CLI
  - [x] 7.1 Implement wildcard expansion
    - Create `tools/validate/src/expand.ts` with `DirReader`, `ExpandResult` and `expandArgs`: `*` and `?` in the last segment only, files only, sorted by code-unit order, de-duplicated; an argument without a wildcard is passed through as one file path; `**`, a wildcard in a directory segment, or a pattern with no match goes to `errors`
    - Create `tools/validate/test/expand.test.ts` with a fake `DirReader`: `activities/*.json` matches, `?` matches one character, sorting and de-duplication, an already-expanded list gives the same result as the pattern, `**` and `a*/b.json` rejected, a plain path kept even when the file does not exist
    - Verify: `pnpm exec vitest run tools/validate/test/expand.test.ts; $LASTEXITCODE`
    - _Requirements: 17.1, 17.2, 17.3, 17.12_

  - [x] 7.2 Implement output formatting and `run`
    - Create `tools/validate/src/format.ts` (`formatDiagnostic` as `  <severity> <stage>/<code> at <path>: <message>`) and `tools/validate/src/run.ts` (`CliIo`, `PROFILES = { core: coreProfile }`, `run`): byte cap on raw bytes before decoding; `TextDecoder('utf-8', { fatal: true })` for `parse/invalid-utf8`; `parseManifestText`; `parse/unknown-profile` when `profile` names no entry; `validateManifest`; `PASS` with indented warnings or `FAIL` with up to 50 diagnostics; a missing or unreadable file gives `FAIL`; a per-file `try`/`catch` prints `FAIL … internal error: <message>` without a stack trace; exit `0`, `1` or `2` as in design Component 4
    - Verify: `pnpm exec tsc -p tsconfig.json; $LASTEXITCODE`
    - _Requirements: 5.5, 5.6, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12_

  - [x] 7.3 Wire the CLI entry point
    - Create `tools/validate/src/cli.ts`: implement `CliIo` with `node:fs` (`readFileSync` returning `null` on error, `readdirSync` with `withFileTypes` for files only) and `process.stdout`/`process.stderr`; pass `process.argv.slice(2)` to `run`; set `process.exitCode` and never call `process.exit`
    - Replace `tools/validate/src/index.ts` with re-exports of `expand.ts`, `format.ts` and `run.ts`
    - Verify: `pnpm --filter @dreame/node-types run codegen; $LASTEXITCODE`, then `node --experimental-strip-types tools/validate/src/cli.ts; $LASTEXITCODE` (pass when the usage message prints and the exit code is 2)
    - _Requirements: 17.12, 17.13_

  - [x] 7.4 Write CLI tests with a fake `CliIo`
    - Create `tools/validate/test/run.test.ts` using in-memory files: exit 0 with `PASS` for a valid manifest, `PASS` plus an indented `requires-unused` warning and exit 0, exit 1 for a dangling edge, oversize bytes give `parse/too-large` without decoding, invalid UTF-8 bytes give `parse/invalid-utf8`, invalid JSON, `unknown-profile`, a missing plain path gives `FAIL` and exit 1, an `internal error` from a throwing reader gives `FAIL` without a stack trace and later files still run, exit 2 for no arguments and for a pattern with no match
    - Verify: `pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`
    - _Requirements: 5.5, 5.6, 17.2, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12_

- [x] 8. Demo manifest and broken fixture
  - [x] 8.1 Write the demo manifest
    - Create `activities/core-demo-study-break.json`: `schemaVersion` 1, `profile` `core`, `requires` exactly `{ "content": 1, "choice": 1, "outcome": 1 }`, at least one node of each type, made-up content about planning a study break, no real names, brands or phone numbers; any CTA uses an `https:` website URL such as `https://example.com/...`; `validUntil` omitted or 2027-12-31 or later
    - Verify: `node --experimental-strip-types tools/validate/src/cli.ts activities/core-demo-study-break.json; $LASTEXITCODE` (pass on `PASS` and exit 0); `Select-String -Path activities/core-demo-study-break.json -Pattern <pattern>` where `<pattern>` joins the Banned_Phrase_List phrases from `.kiro/steering/product.md` with `|` (pass on no output)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [x] 8.2 Write the broken fixture and its README
    - Create `activities/fixtures/broken-dangling-edge.json`: synthetic data, passes stages 1–3, exactly one defect (an edge `to` an ID that names no node)
    - Create `activities/fixtures/README.md` stating that the fixture is invalid on purpose and is used by tests
    - Verify: `node --experimental-strip-types tools/validate/src/cli.ts activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (pass on `FAIL`, a `refs/dangling-ref` line and exit 1)
    - _Requirements: 19.7, 19.8, 19.9_

  - [x] 8.3 Write the demo manifest validator test
    - Create `packages/node-types/test/demo-manifest.test.ts`: read both files with `node:fs`; `validateManifestText(demo, coreProfile)` gives `ok: true` with no diagnostics; the fixture gives `ok: false` with exactly one error, `refs/dangling-ref`; the demo text contains no Banned_Phrase_List phrase (read the list from `.kiro/steering/product.md` in the test)
    - Verify: `pnpm exec vitest run packages/node-types/test/demo-manifest.test.ts; $LASTEXITCODE`
    - _Requirements: 19.1, 19.6, 19.7_

  - [x] 8.4 Add real-file CLI cases
    - Add to `tools/validate/test/run.test.ts` a `CliIo` backed by `node:fs`: `activities/*.json` expands to `activities/core-demo-study-break.json` only (the fixture under `activities/fixtures/` is not matched) and exits 0; the broken fixture exits 1 with `refs/dangling-ref` in the output
    - Verify: `pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`
    - _Requirements: 19.2, 19.8, 19.10_

- [x] 9. Root scripts and `pnpm check`
  - [x] 9.1 Replace the root scripts
    - Edit `package.json` `scripts` to the exact values in design Component 5: `codegen`, `typecheck`, `test:shared`, `validate`, `check`, and `postinstall` unchanged; keep the `simple-git-hooks` field unchanged; no single-quoted arguments, environment variables or shell utilities in any script value
    - _Requirements: 18.1, 18.2, 18.4, 18.5, 18.6, 18.7, 18.8_

  - [x] 9.2 Run the full pipeline and repository checks
    - Run each command and record its exit code: `pnpm codegen; $LASTEXITCODE`; `pnpm typecheck; $LASTEXITCODE`; `pnpm test:shared; $LASTEXITCODE`; `pnpm validate activities/*.json; $LASTEXITCODE` (exit 0, one `PASS` line for the demo only); `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (exit 1); `pnpm validate; $LASTEXITCODE` (exit 2); `pnpm check; $LASTEXITCODE` (exit 0)
    - Run `git diff --exit-code -- .github/workflows/ci.yml; $LASTEXITCODE` (exit 0) and `git status --porcelain -- .kiro/hooks packages/node-types/generated` (pass on no output)
    - Run `Test-Path package-lock.json; Test-Path yarn.lock` (both `False`)
    - **Stop condition:** a command fails after one fix attempt → report the command, its output and exit code to the user
    - _Requirements: 1.11, 4.6, 17.10, 17.11, 17.12, 17.14, 18.6, 18.9, 18.10, 19.2, 19.8, 19.10_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Ask the user whether to commit the work; if yes, stage files by explicit path and include `pnpm-lock.yaml` in the same commit as the dependency changes (Req 1.10); never stage `packages/node-types/generated/` or `design-refs/`.

## Notes

- No task is optional. Property tests are sub-tasks of task 6 so that they run after the code they test exists; example tests sit with the code in tasks 2–5 and 7–8.
- Each property sub-task names its design property number and the requirement clauses it validates.
- `pnpm check` is also the pre-commit hook command, so after task 9.1 every commit runs the full pipeline.
- The open dependency on `Kiro_Setup_and_Operating_Playbook.md` remains: no Kiro hook is created in this spec.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6"] },
    { "id": 5, "tasks": ["2.7"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 9, "tasks": ["3.6"] },
    { "id": 10, "tasks": ["3.7"] },
    { "id": 11, "tasks": ["4.1"] },
    { "id": 12, "tasks": ["4.2"] },
    { "id": 13, "tasks": ["4.3"] },
    { "id": 14, "tasks": ["4.4", "5.1"] },
    { "id": 15, "tasks": ["5.2"] },
    { "id": 16, "tasks": ["5.3"] },
    { "id": 17, "tasks": ["5.4"] },
    { "id": 18, "tasks": ["5.5"] },
    { "id": 19, "tasks": ["5.6", "6.1"] },
    { "id": 20, "tasks": ["6.2", "6.3", "6.4", "6.9", "6.10", "6.11", "6.12", "6.13", "6.14"] },
    { "id": 21, "tasks": ["6.5", "6.7", "6.8"] },
    { "id": 22, "tasks": ["6.6"] },
    { "id": 23, "tasks": ["7.1"] },
    { "id": 24, "tasks": ["7.2"] },
    { "id": 25, "tasks": ["7.3"] },
    { "id": 26, "tasks": ["7.4"] },
    { "id": 27, "tasks": ["8.1", "8.2"] },
    { "id": 28, "tasks": ["8.3", "8.4"] },
    { "id": 29, "tasks": ["9.1"] },
    { "id": 30, "tasks": ["9.2"] }
  ]
}
```
