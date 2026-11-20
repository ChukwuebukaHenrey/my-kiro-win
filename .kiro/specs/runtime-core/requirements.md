# Requirements Document

## Introduction

This spec covers Days 2–4 of the DREAME 16-day plan (Brief §8). DREAME is the toolkit described in `docs/Skeleton_Crew_Audit_and_Brief_v2.md` (the Brief) and `docs/Architecture_and_UI_Spec.md` (the Architecture Spec). The requirements below are derived from `.kiro/specs/runtime-core/design.md` (the Design), whose decisions D1–D12 the user approved on 2026-11-19.

The toolkit checks activity definitions against documented structural and supported semantic rules before playback (Brief §0). These checks catch the specified errors only. They do not establish factual accuracy, accessibility, or the correctness of custom node-type code. The property tests in this spec give evidence for the properties they test, over the inputs fast-check generates; they are not a proof of correctness.

The environment is Windows with PowerShell 5.1, Node v22.23.5, pnpm 12.21.0 and TypeScript 7.0.2 at the root. Registry versions checked on 2026-11-19: `typebox` 1.4.7, `ajv` 8.20.0, `vitest` 5.1.1, `vite` 8.3.8, `fast-check` 4.10.3, `@types/node@22` 22.20.5.

### Scope

- `packages/schema`: TypeBox contracts, ID patterns and hard limits, the schema composer, the build-time Ajv standalone codegen helper, the 64 KB byte cap and parser, the HTTPS URL check, and the graph validator with its seven stages in Brief §3 order.
- `packages/runtime`: the seeded RNG, the condition evaluator, effects, the registry, profiles and the pure reducer, with no React and no app imports.
- `packages/node-types`: the shared node types `content`, `choice` and `outcome`, the `core` profile, and its generated validators.
- `tools/validate`: the CLI `pnpm validate activities/*.json` with exit codes 0, 1 and 2.
- Root scripts `codegen`, `typecheck`, `test:shared`, `validate` and `check`; the root `tsconfig.json` and `vitest.config.ts`; additions to `tsconfig.base.json` and `.gitignore`.
- `activities/`: one valid demo manifest and one deliberately broken fixture, both with synthetic data.
- Unit tests and fast-check property tests, and the dependencies with their approvals.

### Out of scope

- React renderers and every `Render` UI module, including rendering links with `rel="noopener noreferrer"` (Day 5).
- App-specific node types `collectionSelect`, `recommendOutcome`, `recall` and `reviewQueue` (Days 6 and 8), and `apps/shop-challenge` and `apps/practice-path`.
- `packages/link` (encode, decode, the 8 KB encoded-link cap, SHA-256 hash) and `packages/storage` (AttemptRecord persistence).
- Kiro hooks, including "hooks 1 and 2" of Brief §8 Day 4, and Kiro powers.
- The `DraftDoc` permissive schema (Brief B10), `schemaVersion` upgraders (B9), `collections` (B3), the review and retry policy (B1), dependency-cruiser, ESLint, Playwright and `pnpm audit` in CI.

### Open dependency and approved decisions

1. **Missing playbook (open dependency).** `Kiro_Setup_and_Operating_Playbook.md` is not in the workspace. Brief §5 defers hook setup to it, and Brief §8 Day 4 lists "hooks 1 and 2". This spec creates no files under `.kiro/hooks/` (Requirement 17.14). The CLI output and exit codes are designed so a hook can call `pnpm validate <file>` once the playbook defines the hooks.
2. **Approved decisions.** The user approved Design decisions D1–D12 on 2026-11-19, including `vite` (D11) and `@types/node` (D12) as root devDependencies (Requirements 1.7 and 1.8), generated validators in `packages/node-types/generated/` (D2, Requirement 4.5), and codegen before typecheck with generated files gitignored (D3, Requirements 4.6 and 18.6).

## Glossary

- **Implementing_Agent**: The Kiro agent that carries out the tasks of this spec.
- **Workspace**: The repository at `c:\Users\ADMIN\my-kiro-win`, including every workspace package under `packages/` and `tools/`.
- **Root_Manifest**: The root `package.json`.
- **Base_TSConfig**: The root `tsconfig.base.json`.
- **Root_TSConfig**: The root `tsconfig.json`, the single program that `pnpm typecheck` and `pnpm check` compile.
- **Root_Test_Config**: The root `vitest.config.ts`.
- **Ignore_File**: The root `.gitignore`.
- **CI_Workflow**: The file `.github/workflows/ci.yml`.
- **Lockfile**: The root `pnpm-lock.yaml`.
- **Schema_Package**: The workspace package `@dreame/schema` in `packages/schema`.
- **Runtime_Package**: The workspace package `@dreame/runtime` in `packages/runtime`.
- **Node_Types_Package**: The workspace package `@dreame/node-types` in `packages/node-types`.
- **Validate_CLI**: The workspace package `@dreame/validate` in `tools/validate`, run as `pnpm validate <args>`.
- **Manifest**: A JSON activity definition with the fields of the Design's `Manifest` interface.
- **Valid_Manifest**: A Manifest that passed all seven validator stages, typed as the branded `ValidManifest`.
- **Node_Type**: A node type definition (`NodeTypeDescriptor` in the Schema_Package, extended to `NodeType` in the Runtime_Package).
- **Profile**: A named set of Node_Types with its precompiled validators (`ProfileDescriptor`, extended to `Profile` by `defineProfile`).
- **Core_Profile**: The Profile with ID `core` that contains `content`, `choice` and `outcome`, exported as `coreProfile`.
- **Composer**: The functions `toPlainJsonSchema`, `composeManifestSchema` and `composeResponseSchemas` in `packages/schema/src/compose.ts`.
- **Codegen**: The Node-only module `@dreame/schema/codegen` (`packages/schema/src/codegen/index.ts`), which exports `buildProfileModule`, `ALLOWED_RUNTIME_HELPERS` and `assertSelfContained`.
- **Codegen_Script**: The file `packages/node-types/scripts/codegen.ts`, run by `pnpm codegen`.
- **Generated_Validators**: The files `packages/node-types/generated/core.validators.js` and `core.validators.d.ts`.
- **Parser**: The functions `utf8ByteLength` and `parseManifestText` in `packages/schema/src/parse.ts`.
- **Byte_Cap**: 65,536 bytes of UTF-8, exported as `MAX_MANIFEST_JSON_BYTES`.
- **URL_Check**: The function `checkHttpsUrl` and the list `SHORTENER_HOSTS` in `packages/schema/src/url.ts`.
- **Graph_Validator**: The functions `validateManifest` and `validateManifestText` in `packages/schema/src/graph.ts`.
- **Stage**: One of `parse`, `schema`, `caps`, `ids`, `refs`, `dag`, `terminal`, `conditions`. Stages 1–7 are `schema` through `conditions`, in Brief §3 order.
- **Diagnostic**: An object with `severity` (`error` or `warning`), `stage`, `code`, `path` (a JSON Pointer into the Manifest, `""` for the root), `message` and optional `nodeId`. A diagnostic is written `<stage>/<code>` in this document, for example `refs/dangling-ref`.
- **Diagnostic_Sorter**: The function `sortDiagnostics` in `packages/schema/src/diagnostics.ts`.
- **Hard_Limits**: The constant `HARD_LIMITS` in `packages/schema/src/ids.ts`.
- **Seeded_RNG**: The mulberry32 generator returned by `createRng` in `packages/runtime/src/rng.ts`.
- **Condition_Evaluator**: The functions `readRef` and `evaluateCond` in `packages/runtime/src/conditions.ts`.
- **Effect_Applier**: The function `applyEffects` in `packages/runtime/src/effects.ts`.
- **Registry**: The object returned by `createRegistry` in `packages/runtime/src/registry.ts`.
- **Profile_Builder**: The function `defineProfile` in `packages/runtime/src/profile.ts`.
- **Reducer**: The functions `createRuntime`, `createAttempt`, `checkAction` and `reduce` in `packages/runtime/src/reducer.ts`.
- **Attempt_State**: The JSON-serializable `AttemptState` object that the Reducer produces.
- **Accepted_Action**: An `Action` for which `checkAction` returns `null`.
- **Terminal_Node**: A manifest node whose Node_Type has `terminal: true`.
- **Content_Node_Type**, **Choice_Node_Type**, **Outcome_Node_Type**: The Node_Types `content`, `choice` and `outcome` in the Node_Types_Package, each at version 1.
- **Demo_Manifest**: The file `activities/core-demo-study-break.json`.
- **Broken_Fixture**: The file `activities/fixtures/broken-dangling-edge.json`.
- **Fixture_Readme**: The file `activities/fixtures/README.md`.
- **Property_Test**: A fast-check test that checks one Correctness Property of the Design.
- **Banned_Phrase_List**: The phrases listed in the last bullet of "Claim rules" in `.kiro/steering/product.md`, matched case-insensitively as substrings, so that inflected forms also count.

## Requirements

### Requirement 1: Workspace packages, dependencies and TypeScript configuration

**User Story:** As the solo builder, I want four strict TypeScript workspace packages with only approved dependencies, so that the runtime core builds on the Day 1 toolchain without unreviewed additions.

#### Acceptance Criteria

1. THE Workspace SHALL contain four workspace packages, each with `"private": true` and `"type": "module"` in its `package.json`: `@dreame/schema` in `packages/schema`, `@dreame/runtime` in `packages/runtime`, `@dreame/node-types` in `packages/node-types` and `@dreame/validate` in `tools/validate` (Decision D1).
2. THE Workspace SHALL give each of the four packages a `tsconfig.json` that extends `../../tsconfig.base.json` and sets `compilerOptions.strict` to `true`.
3. THE Base_TSConfig SHALL keep `compilerOptions.strict` set to `true` and SHALL add `noEmit`, `allowImportingTsExtensions` and `erasableSyntaxOnly`, each set to `true`.
4. THE Root_TSConfig SHALL extend `./tsconfig.base.json`, set `compilerOptions.strict` to `true`, and include `packages/*/src/**/*.ts`, `packages/*/scripts/**/*.ts`, `packages/*/test/**/*.ts`, `packages/*/generated/*.d.ts`, `tools/*/src/**/*.ts`, `tools/*/test/**/*.ts` and `vitest.config.ts`.
5. THE Workspace SHALL write every relative TypeScript import with an explicit `.ts` extension and SHALL use only erasable TypeScript syntax, with no `enum`, `namespace` or constructor parameter properties (Decision D4).
6. THE Workspace SHALL declare these package dependencies: `typebox` `^1.4.7` in `dependencies` of `@dreame/schema` and `@dreame/node-types`; `ajv` `^8.20.0` in `devDependencies` of `@dreame/schema`; `@dreame/schema` as `workspace:*` in `dependencies` of `@dreame/runtime`; `@dreame/runtime` and `@dreame/schema` as `workspace:*` in `dependencies` of `@dreame/node-types`; and `@dreame/node-types` and `@dreame/schema` as `workspace:*` in `dependencies` of `@dreame/validate`.
7. THE Root_Manifest SHALL list exactly these six `devDependencies`: the Day 1 entries `typescript` and `simple-git-hooks`, and the added entries `vitest` `^5.1.1`, `vite` `^8.3.8`, `fast-check` `^4.10.3` and `@types/node` `^22.20.5`.
8. THE Root_Manifest SHALL be the only `package.json` that lists `vite` or `@types/node`, matching the user's approval on 2026-11-19 of both as root devDependencies (Decisions D11 and D12).
9. IF the Implementing_Agent finds that a dependency not listed in criteria 6 and 7 is needed, THEN THE Implementing_Agent SHALL stop and ask the user before adding the dependency (tech.md).
10. WHEN the Implementing_Agent adds the dependencies of criteria 6 and 7, THE Implementing_Agent SHALL commit the updated Lockfile in the same commit, so that `pnpm install --frozen-lockfile` in the CI_Workflow succeeds.
11. THE Root_Manifest SHALL keep `engines.node` set to `>=22`, and THE Workspace SHALL contain no `package-lock.json` and no `yarn.lock`.

### Requirement 2: Manifest contracts, ID patterns and hard limits

**User Story:** As a developer extending DREAME, I want one TypeBox source of truth for the manifest shape and its limits, so that the schema, the validator and the runtime agree on what a manifest is.

#### Acceptance Criteria

1. THE Schema_Package SHALL define, with TypeBox in `src/contracts.ts`, closed schemas and matching static types for `Ref`, `Scalar`, `VarDecl`, `Effect`, `Edge`, `Limits`, `ManifestNode` and `Manifest` with the fields listed in the Design's Component 1.
2. THE Schema_Package SHALL export `MAX_MANIFEST_JSON_BYTES` with the value 65,536 and Hard_Limits with these values: `maxNodes` 200, `maxTransitions` 1,000, `maxEdgesPerNode` 16, `maxVariables` 32, `maxCondDepth` 8, `maxCondArgs` 8, `maxOptions` 8, `maxEffectsPerOption` 8, `maxTextLength` 2,000 and `maxDiagnostics` 50 (Decisions D7 and D10).
3. THE Schema_Package SHALL export the ID patterns `NODE_ID_PATTERN` (`^[A-Za-z][A-Za-z0-9_-]{0,63}$`), `VAR_ID_PATTERN` (`^[A-Za-z][A-Za-z0-9_]{0,31}$`), `TYPE_NAME_PATTERN` (`^[a-z][A-Za-z0-9]{0,31}$`), `ACTIVITY_ID_PATTERN` (`^[a-z0-9][a-z0-9-]{0,63}$`), `THEME_PATTERN` (`^[a-z0-9-]{1,32}$`), `DATE_PATTERN` (`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`) and `HTTPS_PREFIX_PATTERN` (`^https://`).
4. THE Schema_Package SHALL use `NODE_ID_PATTERN` for every node ID, so that every node ID that starts with `_`, including `__proto__`, fails the schema.
5. THE Manifest schema in the Schema_Package SHALL require `schemaVersion` equal to `1`, `profile`, `activityId`, `version` as a positive integer, `requires`, `entryNodeId`, `fallbackOutcomeId`, `limits`, `variables`, `nodes` and `theme`, SHALL allow an optional `validUntil` matching `DATE_PATTERN`, and SHALL reject any other property.
6. THE `VarDecl` schema in the Schema_Package SHALL be a union discriminated on `type` with three closed variants: `number` (number `initial`, optional `min` and `max`), `boolean` (boolean `initial`) and `enum` (string `initial` and string array `values`).
7. THE Schema_Package SHALL build the condition schema with `condDefs(8)` as the definitions `CondD1` to `CondD8`, where `CondD1` is the leaf only and each `CondDk` for k ≥ 2 refers only to the leaf and to `CondD(k-1)`, so that no definition refers to itself (Decision D5).
8. THE condition schema in the Schema_Package SHALL allow only the operators `eq`, `gte`, `lte`, `includes`, `and`, `or` and `not`, SHALL require 1 to 8 items in `args`, and SHALL limit string `Scalar` values to 64 characters.
9. THE `Limits` schema in the Schema_Package SHALL accept `maxNodes` as an integer from 1 to 200 and `maxTransitions` as an integer from 0 to 1,000.
10. THE Schema_Package SHALL measure every text length limit in UTF-16 code units, as returned by `string.length` (Decision D6).
11. THE Schema_Package SHALL define `ValidManifest` as a branded type that only the Graph_Validator returns.

### Requirement 3: Schema composer

**User Story:** As a developer extending DREAME, I want each profile's manifest schema composed from its node types, so that adding a node type extends validation without editing the base schema.

#### Acceptance Criteria

1. WHEN `composeManifestSchema(profileId, nodeTypes)` is called, THE Composer SHALL return a closed plain JSON Schema with `$id` set to `urn:dreame:manifest:<profileId>` and `profile` constrained to `{ "const": profileId }`.
2. THE Composer SHALL constrain `nodes` to an array of 1 to `HARD_LIMITS.maxNodes` items that refer to `#/$defs/Node`, and SHALL include the definitions `CondD1` to `CondD8`, `Ref`, `Scalar`, `Edge`, `Effect`, `VarDecl` and `Node` under `$defs`.
3. THE Composer SHALL define `Node` as a `oneOf` with `discriminator: { propertyName: "type" }` and one closed branch per Node_Type, where each branch requires `id` (matching `NODE_ID_PATTERN`), `type` (`const` of the Node_Type name), `config` (the Node_Type `configSchema` as plain JSON Schema) and `edges` (an array of at most 16 `Edge` items).
4. WHEN `composeManifestSchema` is called twice with the same arguments, THE Composer SHALL return deep-equal schemas whose `Node` branches follow the order of `nodeTypes`.
5. IF `nodeTypes` contains two Node_Types with the same name, or a name that does not match `TYPE_NAME_PATTERN`, THEN THE Composer SHALL throw an `Error`.
6. WHEN `composeResponseSchemas(nodeTypes)` is called, THE Composer SHALL return one plain JSON Schema per Node_Type, keyed by the Node_Type name.
7. WHEN `toPlainJsonSchema(schema)` is called, THE Composer SHALL return a JSON round-tripped copy of the schema that contains no TypeBox `~kind` marker.

### Requirement 4: Build-time validator code generation

**User Story:** As the solo builder, I want validators precompiled with Ajv standalone code at build time, so that no schema is compiled at runtime and no browser code imports `ajv` (tech.md, Brief B5).

#### Acceptance Criteria

1. THE Schema_Package SHALL expose the Codegen only through the `./codegen` export, SHALL make the Codegen the only Schema_Package module that imports `ajv`, and SHALL leave the Codegen out of `src/index.ts`.
2. WHEN `buildProfileModule(profileId, nodeTypes)` is called, THE Codegen SHALL compile the composed manifest schema and one response schema per Node_Type (`$id` `urn:dreame:response:<type>`) with the Ajv options `code: { source: true, esm: true, lines: true }`, `strict: true`, `allErrors: true`, `discriminator: true` and `unicode: false` (so that `maxLength` and `minLength` count UTF-16 code units, Decision D6), and SHALL return `{ js, dts }` where `js` exports `validateManifest` and one `response_<type>` function per Node_Type.
3. WHEN the Ajv standalone output contains a `require` call for a helper listed in `ALLOWED_RUNTIME_HELPERS`, THE Codegen SHALL replace that call with the inlined local function from `ALLOWED_RUNTIME_HELPERS`.
4. IF the Ajv standalone output needs a helper not listed in `ALLOWED_RUNTIME_HELPERS`, or the final `js` contains `require(`, `import`, `eval(`, `new Function` or `Function(`, THEN THE Codegen SHALL throw an `Error` that names the helper or the pattern found.
5. WHEN `pnpm codegen` runs, THE Codegen_Script SHALL create `packages/node-types/generated/` if it is missing, SHALL write the Generated_Validators with LF line endings, where `core.validators.d.ts` declares each export as `StandaloneValidate` imported with `import type` from `@dreame/schema`, and SHALL print one line with both file paths and the JS byte size (Decision D2).
6. THE Ignore_File SHALL contain the line `packages/*/generated/`, so that the Generated_Validators are not committed (Decision D3).
7. IF `buildProfileModule` throws or a file write fails, THEN THE Codegen_Script SHALL exit with a non-zero code, so that `pnpm check` and the pre-commit hook stop.
8. THE Runtime_Package, the Node_Types_Package files under `src/` and the Validate_CLI SHALL check schemas only through the Generated_Validators and SHALL NOT import `ajv`.

### Requirement 5: Manifest byte cap and parsing

**User Story:** As a player of a shared activity, I want oversized manifests rejected before parsing, so that a large file cannot stall the page (Brief C2, security.md).

#### Acceptance Criteria

1. WHEN `utf8ByteLength(text)` is called, THE Parser SHALL return the same number as `new TextEncoder().encode(text).length` without allocating an encoded copy of `text`.
2. WHEN `parseManifestText(text)` receives text whose UTF-8 length exceeds the Byte_Cap, THE Parser SHALL return exactly one Diagnostic `parse/too-large` without calling `JSON.parse`.
3. WHEN `parseManifestText(text)` receives valid JSON text whose UTF-8 length is at most the Byte_Cap, THE Parser SHALL return `{ ok: true, value }` with the parsed value.
4. IF the text given to `parseManifestText` is not valid JSON, THEN THE Parser SHALL return a Diagnostic `parse/invalid-json` whose message contains the JSON parser's position message.
5. WHEN the Validate_CLI reads a file larger than the Byte_Cap, THE Validate_CLI SHALL report `parse/too-large` for that file before decoding or parsing its bytes.
6. IF the bytes of a file read by the Validate_CLI are not valid UTF-8, THEN THE Validate_CLI SHALL report `parse/invalid-utf8` for that file.

### Requirement 6: HTTPS URL check

**User Story:** As a player, I want every CTA link checked for a safe scheme and host, so that a manifest cannot send me to a script URL, an unencrypted page or a hidden redirect (Brief C1, Architecture Spec §A5).

#### Acceptance Criteria

1. WHEN `checkHttpsUrl(url, path)` receives a URL of at most 2,048 characters that parses with `new URL`, has protocol `https:`, a non-empty hostname, no username, no password, and a hostname that, lower-cased and without a leading `www.`, is not in `SHORTENER_HOSTS`, THE URL_Check SHALL return no Diagnostics.
2. IF a URL given to `checkHttpsUrl` breaks any rule of criterion 1, including a `javascript:`, `http:` or `data:` scheme, THEN THE URL_Check SHALL return a Diagnostic with code `unsafe-url` at the given `path`.
3. THE URL_Check SHALL list exactly these hosts in `SHORTENER_HOSTS`: `bit.ly`, `tinyurl.com`, `t.co`, `goo.gl`, `ow.ly`, `is.gd`, `buff.ly`, `cutt.ly`, `rebrand.ly` and `shorturl.at`.
4. WHEN `checkHttpsUrl` receives an `https://wa.me/` URL that meets the other rules of criterion 1, THE URL_Check SHALL return no Diagnostics.
5. THE Schema_Package SHALL export `checkHttpsUrl` from its browser-safe `src/index.ts`, so that the Day 5 renderer can apply the same check.

### Requirement 7: Graph validator stage order and result contract

**User Story:** As an author, I want the validator to run its checks in a fixed order and report plain-language diagnostics, so that I can fix the first problem and re-run.

#### Acceptance Criteria

1. WHEN `validateManifest(input, profile)` is called, THE Graph_Validator SHALL run the Stages in Brief §3 order: 1 `schema`, 2 `caps`, 3 `ids`, 4 `refs`, 5 `dag`, 6 `terminal`, 7 `conditions`.
2. WHEN a Stage reports at least one error, THE Graph_Validator SHALL skip every later Stage and return `{ ok: false, diagnostics }`, so that all error Diagnostics in the result share one Stage.
3. WHEN all seven Stages report no error, THE Graph_Validator SHALL return `{ ok: true, manifest, diagnostics }`, where `manifest` is the Valid_Manifest and `diagnostics` contains warnings only.
4. THE Graph_Validator SHALL return at most 50 Diagnostics, ordered by the Diagnostic_Sorter.
5. WHEN `validateManifest` returns, THE Graph_Validator SHALL leave `input` deep-equal to its value before the call.
6. WHEN `validateManifest` receives any value, or `validateManifestText` receives any string, THE Graph_Validator SHALL return a result without throwing.
7. WHEN `validateManifestText(text, profile)` receives text that `parseManifestText` rejects, THE Graph_Validator SHALL return the `parse` Diagnostics without running Stages 1–7.
8. THE Graph_Validator SHALL give every Diagnostic a `path` that is a JSON Pointer into the Manifest (`""` for the root) and a plain-language `message` without a stack trace.
9. WHEN `sortDiagnostics(list)` is called, THE Diagnostic_Sorter SHALL order Diagnostics by Stage in the order `parse`, `schema`, `caps`, `ids`, `refs`, `dag`, `terminal`, `conditions`, then by `path`, then by `code`, returning the same output for every permutation of `list` and the same output when applied to its own result.
10. THE Graph_Validator SHALL give every Diagnostic with code `requires-unused` the severity `warning` and every Diagnostic with any other code the severity `error`, so that a warning neither stops later Stages nor fails the Manifest.

### Requirement 8: Validator stages 1 and 2, schema and size caps

**User Story:** As an author, I want structural and size errors reported first, so that later graph checks run only on manifests of a known shape and size.

#### Acceptance Criteria

1. WHEN Stage 1 runs, THE Graph_Validator SHALL check the input with `profile.validateSchema` from the Generated_Validators and SHALL map each Ajv error to a Diagnostic `schema/schema` whose `path` is the Ajv `instancePath`.
2. IF a node's `type` is not the name of a Node_Type in the Profile, THEN THE Graph_Validator SHALL report `schema/unknown-node-type` for that node instead of the Ajv discriminator error.
3. IF the Manifest `profile` differs from the ID of the Profile passed to the Graph_Validator, THEN THE Graph_Validator SHALL report `schema/profile-mismatch`.
4. IF `nodes.length` exceeds `limits.maxNodes`, or `limits.maxNodes` exceeds `HARD_LIMITS.maxNodes`, THEN THE Graph_Validator SHALL report `caps/node-cap` in Stage 2.
5. IF `limits.maxTransitions` exceeds `HARD_LIMITS.maxTransitions`, THEN THE Graph_Validator SHALL report `caps/transition-cap` in Stage 2.
6. THE Graph_Validator SHALL apply the node-count cap, through the schema `maxItems` of 200 in Stage 1 and the `node-cap` check in Stage 2, before any graph check of Stages 3–7 runs (security.md).

### Requirement 9: Validator stages 3 and 4, unique IDs and references

**User Story:** As an author, I want duplicate IDs and references to missing nodes, variables or node types reported, so that no branch points nowhere.

#### Acceptance Criteria

1. IF two nodes share an `id`, THEN THE Graph_Validator SHALL report `ids/duplicate-node-id` in Stage 3.
2. IF two variables share an `id`, THEN THE Graph_Validator SHALL report `ids/duplicate-var-id` in Stage 3.
3. IF an edge `to`, the `entryNodeId`, the `fallbackOutcomeId` or an `answer` ref names no node in the Manifest, THEN THE Graph_Validator SHALL report `refs/dangling-ref` in Stage 4.
4. IF a `var` ref names no declared variable, THEN THE Graph_Validator SHALL report `refs/undeclared-var` in Stage 4.
5. IF a Node_Type used by a node is missing from `requires`, THEN THE Graph_Validator SHALL report `refs/requires-missing` in Stage 4.
6. IF `requires` gives a Node_Type a version that the Profile does not support, THEN THE Graph_Validator SHALL report `refs/requires-version` in Stage 4.
7. IF `requires` names a Node_Type that is not in the Profile, THEN THE Graph_Validator SHALL report `refs/requires-unknown` in Stage 4.
8. IF `requires` names a Node_Type of the Profile that no node uses, THEN THE Graph_Validator SHALL report `refs/requires-unused` in Stage 4 with severity `warning` and SHALL continue with Stage 5.

### Requirement 10: Validator stages 5 and 6, acyclic graph and terminal reachability

**User Story:** As a player, I want every accepted activity to be a loop-free graph in which every node leads to an outcome, so that no activity traps me (Brief B1, B8).

#### Acceptance Criteria

1. IF the edges of the Manifest form a cycle, THEN THE Graph_Validator SHALL report `dag/cycle` in Stage 5.
2. IF a node that is not a Terminal_Node has no edges, THEN THE Graph_Validator SHALL report `terminal/dead-end` in Stage 6.
3. IF a Terminal_Node has one or more edges, THEN THE Graph_Validator SHALL report `terminal/terminal-has-edges` in Stage 6.
4. IF the last edge of a node has a `when` condition, THEN THE Graph_Validator SHALL report `terminal/last-edge-conditional` in Stage 6.
5. IF `fallbackOutcomeId` names a node that is not a Terminal_Node, THEN THE Graph_Validator SHALL report `terminal/fallback-not-terminal` in Stage 6.
6. IF a node cannot be reached from `entryNodeId`, THEN THE Graph_Validator SHALL report `terminal/unreachable-node` in Stage 6.
7. IF a node has no path to a Terminal_Node, THEN THE Graph_Validator SHALL report `terminal/no-terminal-reachable` in Stage 6.
8. IF `limits.maxTransitions` is less than the number of edges on the longest path from `entryNodeId` to a Terminal_Node, THEN THE Graph_Validator SHALL report `terminal/limit-below-longest-path` in Stage 6.

### Requirement 11: Validator stage 7, type-checked conditions and node-type checks

**User Story:** As an author, I want conditions, variables, dates, text and node configs checked by type, so that a condition cannot compare a number with a string or read an answer that does not exist yet.

#### Acceptance Criteria

1. IF a condition nests deeper than 8 levels, THEN THE Graph_Validator SHALL report `schema/cond-too-deep` in Stage 1, in place of the Ajv errors inside that condition, because the `CondD1` to `CondD8` schema enforces the depth.
2. IF a `gte` or `lte` leaf has a ref whose type is not `number` or a value that is not a number, or an `includes` leaf has a ref whose type is not `set` or a value that is not one of the set's `values`, or an `eq` leaf has a value that does not match the ref's type or, for an `enum` ref, is not one of its `values`, THEN THE Graph_Validator SHALL report `conditions/type-mismatch`.
3. IF an `answer` ref names a node whose Node_Type returns `null` from `answerType`, THEN THE Graph_Validator SHALL report `conditions/ref-not-answerable`.
4. IF an `answer` ref names a node that does not lie on every path from `entryNodeId` to the node that holds the condition, THEN THE Graph_Validator SHALL report `conditions/answer-not-upstream`, treating the holding node itself as lying on every such path.
5. IF a `number` variable has `min` or `max` and its `initial` is outside those bounds, or an `enum` variable has empty or duplicate `values` or an `initial` not in `values`, THEN THE Graph_Validator SHALL report `conditions/var-decl-invalid`.
6. IF an effect names an undeclared variable, a `set` effect has a value that does not match the variable's declared type, or an `add` effect targets a variable whose type is not `number`, THEN THE Graph_Validator SHALL report `conditions/effect-invalid` through `GraphCtx.checkEffect`, where a `set` value matches the declared type only when it is a number within the declared `min` and `max` for a `number` variable, a boolean for a `boolean` variable, or one of `values` for an `enum` variable.
7. IF `validUntil` is not a real calendar date, THEN THE Graph_Validator SHALL report `conditions/invalid-date`.
8. WHEN Stage 7 runs, THE Graph_Validator SHALL call each node's Node_Type `validate(cfg, ctx)` with a `GraphCtx` that provides `checkEffect`, `checkHttpsUrl` and `checkText`, and SHALL include the returned Diagnostics in the result.
9. IF a text field passed to `GraphCtx.checkText` is empty or contains only whitespace, THEN THE Graph_Validator SHALL report `conditions/blank-text`.

### Requirement 12: Seeded random number generator

**User Story:** As a player, I want randomness to come from a seed stored in my attempt, so that a reload or replay gives the same option order (Brief B6, B7).

#### Acceptance Criteria

1. WHEN `createRng(state)` is called with a uint32 `state`, THE Seeded_RNG SHALL produce the mulberry32 output sequence for that state.
2. IF `createRng` is called with a value that is not a uint32, THEN THE Seeded_RNG SHALL throw a `RangeError`.
3. WHEN two Seeded_RNG instances are created from the same state, THE Seeded_RNG SHALL produce the same `nextUint32` sequence from both instances.
4. THE Seeded_RNG SHALL return `nextUint32()` values from 0 to 2^32 − 1, `nextFloat()` values in [0, 1), and `nextInt(n)` values in [0, n) for every integer n with 1 ≤ n ≤ 2^32.
5. IF `nextInt` is called with a value outside 1 to 2^32, THEN THE Seeded_RNG SHALL throw a `RangeError`.
6. WHEN `shuffle(items)` is called, THE Seeded_RNG SHALL return a Fisher–Yates permutation of a copy of `items` and SHALL leave `items` unchanged.
7. WHEN a Seeded_RNG is created from another Seeded_RNG's `state`, THE Seeded_RNG SHALL continue the same output sequence from that position.

### Requirement 13: Condition evaluation and effects

**User Story:** As a developer extending DREAME, I want conditions and effects evaluated by small pure functions, so that routing behaves the same in tests, the CLI and the player.

#### Acceptance Criteria

1. WHEN `readRef(ref, state)` is called, THE Condition_Evaluator SHALL look up answers and variables with `Object.hasOwn` only, returning `undefined` for a missing key and never reading a prototype key.
2. WHEN `evaluateCond(cond, state)` is called, THE Condition_Evaluator SHALL return the negation of `arg` for `not`, the result of `every` over `args` for `and`, the result of `some` over `args` for `or`, and `false` for a leaf whose ref reads `undefined`.
3. WHEN a leaf ref reads a defined value, THE Condition_Evaluator SHALL return `ref === value` for `eq`, `ref >= value` for `gte`, `ref <= value` for `lte`, and whether the ref's array contains `value` for `includes`.
4. WHEN `applyEffects(effects, state, vars)` is called, THE Effect_Applier SHALL apply the effects in order, setting the variable to `value` for `set` and, for `add`, setting the number variable to the sum of its current value and `value` clamped to the declared `min` and `max`, and SHALL return a new Attempt_State.
5. WHEN `evaluateCond` or `applyEffects` returns, THE Condition_Evaluator and THE Effect_Applier SHALL leave their input state deep-equal to its value before the call.
6. WHERE a `number` variable declares no `min` or no `max`, THE Effect_Applier SHALL clamp an `add` result to `-Number.MAX_VALUE` in place of the missing `min` and to `Number.MAX_VALUE` in place of the missing `max`, so that the variable stays finite.

### Requirement 14: Registry, profile and package boundaries

**User Story:** As a developer extending DREAME, I want node types registered through one profile and the runtime kept free of UI and app code, so that apps can add node types without forking the core (Brief §3, structure.md).

#### Acceptance Criteria

1. WHEN `createRegistry(types)` is called, THE Registry SHALL return `get(type)` that returns the Node_Type with that name or `undefined`, and `list()` that returns every registered Node_Type.
2. IF `createRegistry` receives two Node_Types with the same name, THEN THE Registry SHALL throw an `Error`.
3. IF `defineProfile` receives a Node_Type that has no entry in `responseValidators`, THEN THE Profile_Builder SHALL throw an `Error`.
4. WHEN `defineProfile` succeeds, THE Profile_Builder SHALL return a Profile with `id`, `nodeTypes`, `validateSchema`, a `registry` built with `createRegistry`, and `validateResponse(type, response)` that calls that type's precompiled response validator.
5. THE Runtime_Package SHALL contain no file that imports `react`, `react-dom` or any module under `apps/`, and SHALL NOT depend on `@dreame/node-types` (structure.md).
6. THE Schema_Package SHALL keep `ajv` unreachable from `src/index.ts` through its import graph.
7. THE Workspace SHALL contain no call to `eval` or `new Function` and no use of `innerHTML` or `dangerouslySetInnerHTML` in any source file under `packages/` or `tools/` (security.md).

### Requirement 15: Pure runtime reducer

**User Story:** As a player, I want each answer to move the activity forward by a pure, repeatable step that always ends at an outcome, so that I am never stuck and a reload resumes where I was.

#### Acceptance Criteria

1. THE Reducer SHALL accept only a Valid_Manifest in `createRuntime(profile, manifest)` and SHALL build lookup maps of nodes and variables from it.
2. WHEN `createAttempt(rt, seed, clock)` is called with a uint32 `seed`, THE Reducer SHALL return an Attempt_State with `seed` equal to `seed`, `currentNodeId` equal to `entryNodeId`, every declared variable set to its `initial`, empty `answers`, `path` equal to one entry for `entryNodeId` at `clock.now`, `transitions` 0, and `startedAt` and `updatedAt` equal to `clock.now`, SHALL then call the entry Node_Type's `enter` with `env` `{ now: clock.now, rng: createRng(seed) }` when one is defined, and SHALL set `rngState` to the `state` of that Seeded_RNG afterwards, which equals `seed` when `enter` is absent or draws no numbers.
3. WHEN `checkAction(rt, state, action)` is called, THE Reducer SHALL return the first matching rejection in this order: `not-playing` (status is not `playing`), `unknown-action` (`type` is not `respond`), `wrong-node` (`nodeId` differs from `currentNodeId`), `invalid-response` (the precompiled response validator or `isValidResponse` fails), and SHALL return `null` otherwise.
4. WHEN `reduce` receives an action that `checkAction` rejects, THE Reducer SHALL return the input Attempt_State object itself (`===`).
5. WHEN `reduce` receives an Accepted_Action, THE Reducer SHALL build `env` as `{ now: clock.now, rng: createRng(state.rngState) }`, call the current Node_Type's `reduce(cfg, state, response, env)`, and then select the first edge of the current node whose `when` is absent or evaluates to `true`.
6. IF `transitions + 1` would exceed `limits.maxTransitions`, THEN THE Reducer SHALL enter `fallbackOutcomeId` instead of the selected edge's target, set `status` to `limit_reached`, add a `limit_reached` event with `at`, `fromNodeId` and `outcomeId`, and leave `transitions` unchanged.
7. WHEN the transition limit is not exceeded, THE Reducer SHALL enter the selected edge's `to` node, add 1 to `transitions`, and append `{ nodeId, at: clock.now }` to `path`.
8. WHEN the Reducer enters a Terminal_Node other than through the transition limit, THE Reducer SHALL set `status` to `finished` and add a `finished` event with `at` and `outcomeId`.
9. WHEN the Reducer enters a node, THE Reducer SHALL call that node's Node_Type `enter(cfg, state, env)` when one is defined, with `currentNodeId` already set to the entered node.
10. WHEN `reduce` returns a new Attempt_State, THE Reducer SHALL set its `rngState` to the `state` of `env.rng` and its `updatedAt` to `clock.now`.
11. THE Reducer SHALL leave every input Attempt_State deep-equal to its value before the call, SHALL take time only from `clock.now` and randomness only from `env.rng`, and SHALL contain no call to `Date.now`, `new Date()` or `Math.random` in any file under `packages/runtime/src` or `packages/node-types/src`.
12. THE Reducer SHALL keep these Attempt_State invariants after every step: `JSON.parse(JSON.stringify(state))` is deep-equal to `state`; `seed` and `rngState` are uint32; `0 ≤ transitions ≤ limits.maxTransitions`; `path` is non-empty and its last entry is `currentNodeId`; `status` is `playing` exactly when `currentNodeId` names a node that is not a Terminal_Node; and `vars` holds exactly the declared variable IDs, each with a value of its declared type and range, where a `number` variable is finite and within its declared `min` and `max` and an `enum` variable is one of its `values`.
13. WHEN `createAttempt` and `reduce` run twice with the same Valid_Manifest, seed, actions and clock values, THE Reducer SHALL produce deep-equal Attempt_State sequences.
14. WHEN an intermediate Attempt_State is serialized with `JSON.stringify` and parsed back before the remaining actions are applied, THE Reducer SHALL produce the same final Attempt_State as the uninterrupted run.
15. WHEN play starts from `createAttempt` on a Valid_Manifest and continues with Accepted_Actions, THE Reducer SHALL reach an Attempt_State whose `status` is not `playing` and whose `currentNodeId` names a Terminal_Node after at most `limits.maxTransitions + 1` Accepted_Actions.

### Requirement 16: Shared node types and core profile

**User Story:** As an author, I want `content`, `choice` and `outcome` node types shared by both apps, so that simple branching activities need no app-specific code.

#### Acceptance Criteria

1. THE Node_Types_Package SHALL export the Content_Node_Type, the Choice_Node_Type and the Outcome_Node_Type, each with `version` 1, with `terminal` set to `false`, `false` and `true` respectively, and SHALL export them as `coreNodeTypes` in that order from `src/core-types.ts`, which imports no generated code.
2. THE Content_Node_Type SHALL use the closed config `{ title?: string ≤ 120, body: string ≤ 2,000, continueLabel?: string ≤ 40 }`, the closed response `{}`, an `answerType` of `null`, and a `reduce` that returns the input state.
3. THE Choice_Node_Type SHALL use the closed config `{ prompt: string ≤ 500, options: 2 to 8 items of { id: matching NODE_ID_PATTERN, label: string ≤ 200, effects?: at most 8 Effects }, shuffle?: boolean }`, the closed response `{ optionId: string }`, and an `answerType` of `{ kind: "enum", values: <option ids> }`.
4. THE Outcome_Node_Type SHALL use the closed config `{ title: string ≤ 120, body: string ≤ 2,000, cta?: { label: string ≤ 60, url: string matching ^https:// } }`, the closed response `{}`, an `answerType` of `null`, and a `reduce` that returns the input state.
5. WHEN a Choice_Node_Type node with `shuffle: true` is entered, THE Choice_Node_Type SHALL store `nodeState[nodeId] = { order: env.rng.shuffle(<option ids>) }`.
6. WHEN the Choice_Node_Type `reduce` receives a response, THE Choice_Node_Type SHALL set `answers[nodeId]` to `optionId` and apply the chosen option's effects with the Effect_Applier.
7. IF a Choice_Node_Type response names an `optionId` that is not one of the node's option IDs, THEN THE Choice_Node_Type `isValidResponse` SHALL return `false`.
8. WHEN `validate(cfg, ctx)` runs, THE Content_Node_Type SHALL check `body`, and `title` when present, with `checkText`; THE Choice_Node_Type SHALL check `prompt` and every option `label` with `checkText`, report `duplicate-option-id` for repeated option IDs, and check every effect with `checkEffect`; and THE Outcome_Node_Type SHALL check `title` with `checkText` and `cta.url`, when present, with `checkHttpsUrl`.
9. WHEN `validate` receives a config that passed Stage 1, THE Content_Node_Type, THE Choice_Node_Type and THE Outcome_Node_Type SHALL return Diagnostics without throwing.
10. THE Node_Types_Package SHALL export the Core_Profile from `src/core-profile.ts`, built with `defineProfile` from ID `core`, `coreNodeTypes`, the generated `validateManifest`, and the generated `response_content`, `response_choice` and `response_outcome` validators.
11. THE Workspace SHALL place the Content_Node_Type, the Choice_Node_Type and the Outcome_Node_Type in `packages/node-types` only, and SHALL add no `Render` member to them in this spec (structure.md, Decision D9).

### Requirement 17: Validate CLI

**User Story:** As the solo builder, I want `pnpm validate activities/*.json` to report each file's result and exit with a meaningful code, so that CI, the pre-commit hook and a later Kiro hook can rely on it.

#### Acceptance Criteria

1. WHEN the Validate_CLI receives an argument whose last path segment contains `*` or `?`, THE Validate_CLI SHALL expand the argument to the matching files in that directory, excluding directories.
2. WHEN the Validate_CLI receives an argument without a wildcard, THE Validate_CLI SHALL treat the argument as one file path, so that a missing file is reported under criterion 8 and leads to exit code 1 under criterion 11.
3. THE Validate_CLI SHALL sort the expanded file list by UTF-16 code-unit order and remove duplicates, so that the result is the same whether `cmd.exe` passes the pattern unexpanded or `sh` expands it.
4. WHEN the Validate_CLI checks a file, THE Validate_CLI SHALL apply the Byte_Cap to the raw bytes, decode them as UTF-8, call `parseManifestText`, select the Profile named by the parsed `profile` field from `PROFILES` (`{ core: coreProfile }`), and call `validateManifest`.
5. IF the parsed `profile` field names no entry in `PROFILES`, THEN THE Validate_CLI SHALL report `unknown-profile` for that file and count the file as failed.
6. WHEN a file passes, THE Validate_CLI SHALL print one `PASS` line naming the file, followed by its warnings indented below the line.
7. WHEN a file fails, THE Validate_CLI SHALL print one `FAIL` line naming the file, followed by up to 50 Diagnostics formatted as `  <severity> <stage>/<code> at <path>: <message>`, and SHALL continue with the remaining files.
8. IF a matched file is missing or unreadable, THEN THE Validate_CLI SHALL print a `FAIL` line for that file and continue with the remaining files.
9. IF an unexpected exception occurs while the Validate_CLI checks a file, THEN THE Validate_CLI SHALL print a `FAIL` line with `internal error` and the error message, without a stack trace, and SHALL continue with the remaining files.
10. WHEN every checked file passes, with or without warnings, THE Validate_CLI SHALL exit with code 0.
11. WHEN at least one checked file fails or causes an internal error, THE Validate_CLI SHALL exit with code 1.
12. IF the Validate_CLI receives no arguments, or a pattern that matches no files, or an argument containing `**` or a wildcard in a directory segment, THEN THE Validate_CLI SHALL print a usage message on standard error and exit with code 2.
13. THE Validate_CLI SHALL set `process.exitCode` in `src/cli.ts` instead of calling `process.exit`, so that all output is flushed before Node exits.
14. THE Implementing_Agent SHALL create no files under `.kiro/hooks/` in this spec, because the hook definitions depend on the missing `Kiro_Setup_and_Operating_Playbook.md`.

### Requirement 18: Root scripts and test configuration

**User Story:** As the solo builder, I want the Day 1 stub scripts replaced with real commands, so that `pnpm check` on commit and in CI runs codegen, typecheck, tests and manifest validation.

#### Acceptance Criteria

1. THE Root_Manifest SHALL set the `codegen` script to `pnpm --filter @dreame/node-types run codegen`.
2. THE Root_Manifest SHALL set the `typecheck` script to `pnpm codegen && tsc -p tsconfig.json`.
3. THE Root_Test_Config SHALL use `defineConfig` from `vitest/config` with `test.include` set to `packages/*/test/**/*.test.ts` and `tools/*/test/**/*.test.ts` and `test.environment` set to `node`.
4. THE Root_Manifest SHALL set the `test:shared` script to `pnpm codegen && vitest run`.
5. THE Root_Manifest SHALL set the `validate` script to `pnpm codegen && node --experimental-strip-types tools/validate/src/cli.ts`, so that pnpm appends the caller's arguments to the CLI command.
6. THE Root_Manifest SHALL set the `check` script to `pnpm codegen && tsc -p tsconfig.json && vitest run && node --experimental-strip-types tools/validate/src/cli.ts activities/*.json`, running codegen once and before typecheck (Decision D3).
7. THE Root_Manifest SHALL keep the `postinstall` script as `simple-git-hooks` and the `simple-git-hooks` field as `{ "pre-commit": "pnpm check" }`.
8. THE Root_Manifest SHALL use no single-quoted arguments, environment variables or shell utilities in any script value, so that each script runs the same under `cmd.exe` and `sh` (Day 1 Requirement 11.2).
9. THE Implementing_Agent SHALL leave the CI_Workflow unchanged, so that CI runs `pnpm install --frozen-lockfile` and then `pnpm check` on Node 22.
10. THE Workspace SHALL run every test command once without watch mode, through `vitest run` in `pnpm test:shared` and `pnpm check`.
11. THE Workspace SHALL run each Property_Test with at least 100 generated cases and SHALL name each Property_Test with the tag `Feature: runtime-core, Property N: <title>` in its `describe` or `it` title.

### Requirement 19: Demo manifest and broken fixture

**User Story:** As the solo builder, I want one valid demo activity and one deliberately broken fixture with made-up data, so that CI shows a passing manifest and tests show the validator catching a dangling edge.

#### Acceptance Criteria

1. THE Demo_Manifest SHALL set `profile` to `core` and `schemaVersion` to `1`, SHALL use at least one node of each of `content`, `choice` and `outcome`, and SHALL list exactly `{ "content": 1, "choice": 1, "outcome": 1 }` in `requires`.
2. WHEN `pnpm validate activities/core-demo-study-break.json` runs, THE Validate_CLI SHALL print `PASS` for the Demo_Manifest and exit with code 0.
3. THE Demo_Manifest SHALL contain only synthetic data, with no real person's name or details, no product brand logos, and no personal WhatsApp number (Brief C3, C4).
4. WHERE the Demo_Manifest contains a CTA, THE Demo_Manifest SHALL use an `https:` website URL that passes the URL_Check.
5. THE Demo_Manifest SHALL either omit `validUntil` or set `validUntil` to 2027-12-31 or later.
6. THE Demo_Manifest SHALL contain no case-insensitive match of any phrase in the Banned_Phrase_List.
7. THE Broken_Fixture SHALL use synthetic data, SHALL pass Stages 1–3, and SHALL contain exactly one defect: an edge whose `to` names no node, so that the Graph_Validator reports `refs/dangling-ref`.
8. WHEN the Validate_CLI checks the Broken_Fixture, THE Validate_CLI SHALL print `FAIL` with `refs/dangling-ref` and exit with code 1.
9. THE Fixture_Readme SHALL state that the Broken_Fixture is invalid on purpose and is used by tests.
10. WHEN `pnpm check` runs, THE Validate_CLI SHALL check only the files directly under `activities/` that match `*.json`, so that the Broken_Fixture under `activities/fixtures/` is left out.
