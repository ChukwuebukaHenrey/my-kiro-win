# Implementation Plan: Shop Challenge (DREAME Days 6 and 7)

## Overview

Tasks follow the build order in design.md "Testing Strategy" → "Notes for the tasks run", with two changes: the contact channels (design C8b) come right before the `recommendOutcome` node type, and the deploy comes before `tools/lint` (user decision 2026-11-20). The order is: the KIRO_LOG Day 5 entries and their commit first (Requirement 1.1), then the shared schema changes, the Shop_App package and root configuration, the App_Wiring_Files W5–W7 and the Shop_Codegen, the bundle rules, the validate CLI profile entry, the `collectionSelect` node type, the contact channels and the `recommendOutcome` node type with their properties, the validator size test, the three shop profile properties, a checkpoint, rejection handling in `@dreame/ui`, the two views, the demo manifest and fixture, the app shell, the scans and `PRIVACY.md`, `vercel.json`, the timing and full-pipeline checks, a commit before the deploy, the deploy steps, `tools/lint`, the `ci.yml` build step, a second timing and full-pipeline check, and a final checkpoint that asks the user before committing. File names, interfaces and exact file contents come from design.md; each task names its files, its design section and how to verify it. All code is TypeScript under `strict`.

Conventions for every task (Requirement 20):

- Write files with the editor tool (UTF-8, no BOM, LF line endings) (Requirement 20.7). Write no file under `.kiro/settings/`, run no `Remove-Item`, and start no `npm` or `yarn` command; when a task needs a deletion or a settings change, stop and ask the user to do it by hand (Requirement 20.5). Edit no file under `packages/*/generated/` or `apps/*/generated/` by hand (Requirement 20.6).
- Every command must work in Windows PowerShell 5.1: separate commands with `;`, check exit codes with `; $LASTEXITCODE`, and never use `&&` or `||` (`&&` appears only inside `package.json` script values) (Requirement 20.2). A Verify step passes only when every listed command prints the expected exit code (0 unless the step says otherwise) and meets the stated condition (Requirement 20.1).
- Run Vitest only as `pnpm exec vitest run <path>`, never in watch mode. App tests import generated code, so a Verify step that runs them starts with `pnpm codegen;`. Every command must finish within 180,000 ms, except a full `pnpm check`, which gets 600,000 ms; if a command takes longer, stop and report the command and its time to the user (Requirement 20.3).
- Each task ends with its Verify step, which runs a test or a checked command (Requirement 20.10). Each of design Properties 1–14 is its own required task, placed right after the task that writes the code it tests; no task is optional (Requirement 20.11).
- Property tests use fast-check with `numRuns` of at least 100 and carry the tag `Feature: shop-challenge, Property N: <title>` in the `describe` or `it` title; comments and titles describe results as evidence for the properties tested (Requirements 9.4, 20.8). When a property fails, fix the code, then copy the printed seed and shrunk counterexample into the same file as an example test. If a property run takes longer than 180,000 ms, shrink the generated sizes (never `numRuns` below 100) and report it.
- Relative imports use explicit `.ts` or `.tsx` extensions; use only erasable syntax (no `enum`, `namespace` or constructor parameter properties) (Requirement 3.10).
- Add no dependency other than those in design.md "Dependencies". If another one seems needed, stop and ask the user (Requirement 3.7).
- Never stage files under `packages/*/generated/`, `apps/*/generated/` or `design-refs/`, nor `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` or `docs/ui-illustration-builder.txt`. Never use `git add -A`, `git add .`, `--no-verify` or `--amend` (Requirement 2.6). Commit only with the user's approval and only with the Commit_Identity; push only when the user asks.
- Use no phrase from the "Do not use" line of `.kiro/steering/product.md` in any file (Requirement 20.9). Claims about the toolkit use only the Brief §0 and §0a wording quoted there (Requirement 13.10).
- Leave the four files in `.kiro/hooks/` unchanged (Requirement 19.8), except the one D53 change in task 20.1 or 25.1 if the user approves it.
- Kiro hooks already run on agent edits: the Activity_Hook (H1) on `activities/**/*.json`, the Regression_Hook (H2, `pnpm -s test:shared`, 180 s timeout) on `.ts` saves in `packages/runtime`, `packages/schema` and `packages/node-types`, and the Wiring_Hook (H3) on `apps/shop-challenge/src/node-types/<type>.ts` and `apps/shop-challenge/src/views/<Type>NodeView.tsx`. Write each shared-package file in one save. The Post_Task_Hook (H4) already runs `pnpm -s check` after every task, from task 1.1 on (Requirement 20.12). Read its result and fix any failure in the same session. If the Post_Task_Hook times out at 300 s outside the timing tasks 20.1 and 25.1, stop and ask the user (D53).

## Tasks

- [ ] 1. KIRO_LOG Day 5 entries and their commit (first task, Requirement 1.1)
  - [x] 1.1 Write the Day 5 entries in `KIRO_LOG.md`
    - Design: C1
    - Before writing, tell the user that you cannot take screenshots and ask for the file names of any Day 5 screenshots saved in `docs/kiro-evidence/`; run `Test-Path` on each named file and reference only files that exist, by Workspace-relative path inside a field line (Requirements 1.8, 1.9)
    - Read the facts at run time, not from the design table: `docs/HANDOFF.md` §2–§4, `.kiro/specs/ui-renderer/design.md` "User answers (2026-11-20)", the count of tasks marked done in `.kiro/specs/ui-renderer/tasks.md` (`(Select-String -Path .kiro/specs/ui-renderer/tasks.md -Pattern '^\s*- \[x\]').Count`), and `git log -1 --format=%ad --date=short 082ed51; $LASTEXITCODE` for the date in every new heading (Requirements 1.4, 1.5)
    - Append the five entries of the design C1 table after the last existing entry (`## 2026-11-20 — Day 4 hooks not created`): a `## <date> — <title>` heading, then `Spec:`, `Kiro did:`, `Caught by:`, `Fix:`, `Kiro features:`, one line each. Leave the bracketed Fact_Source notes out of the log. Change no existing line (Requirements 1.2, 1.3, 1.5, 1.6, 1.7)
    - No entry holds a commit hash, a commit message, a statement about a commit or a push, or a list of created files (Requirement 1.10)
    - Verify (template, run as one line; pass when it prints `5`, then `25`, then nothing else): `$new = Get-Content -Encoding UTF8 KIRO_LOG.md | Select-Object -Skip ((Select-String -Path KIRO_LOG.md -Pattern '^## \d{4}-\d{2}-\d{2} ')[5].LineNumber - 1); ($new | Select-String -Pattern '^## \d{4}-\d{2}-\d{2} ').Count; ($new | Select-String -Pattern '^(Spec|Kiro did|Caught by|Fix|Kiro features): ').Count; $new | Where-Object { $_ -ne '' -and $_ -notmatch '^## \d{4}-\d{2}-\d{2} ' -and $_ -notmatch '^(Spec|Kiro did|Caught by|Fix|Kiro features): ' }`
    - Verify (existing lines unchanged): `git diff --numstat -- KIRO_LOG.md; $LASTEXITCODE`; pass when the deleted-lines column is `0` and the exit code is 0
    - Verify (no hash, commit wording, file list or secret; run as one line; pass on no output): `$new = Get-Content -Encoding UTF8 KIRO_LOG.md | Select-Object -Skip ((Select-String -Path KIRO_LOG.md -Pattern '^## \d{4}-\d{2}-\d{2} ')[5].LineNumber - 1); $new | Select-String -CaseSensitive -Pattern '\b[0-9a-f]{7,40}\b'; $new | Select-String -Pattern '\b(commit|commits|committed|push|pushed|pushes)\b', 'Files created', '(api[_-]?key|token|password|secret)\s*[:=]'`
    - Verify (banned phrases; pass when it prints `8` and nothing else): `$l = (Select-String -Path .kiro/steering/product.md -Pattern '^- Do not use "' | Select-Object -First 1).Line; $ph = [regex]::Matches($l, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }; $ph.Count; Select-String -Path KIRO_LOG.md -SimpleMatch -Pattern $ph`
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  - [-] 1.2 Ask the user, then commit the log and the leftover status files
    - Design: C1 "Commit"
    - Show the user the output of `git status --porcelain; git diff --stat` and ask: whether to commit `KIRO_LOG.md`, `.kiro/specs/ui-renderer/tasks.md` and `.kiro/specs/ui-renderer/tasks.meta.json`; and whether to include `.kiro/specs/shop-challenge/` (`.config.kiro`, `requirements.md`, `design.md`, `tasks.md`) in the same commit. Recommend yes for the spec folder, because `repo-text.test.ts` will scan `.kiro/specs/shop-challenge/*.md` from task 17.4 on (Requirement 2.1)
    - If the user approves: `git add -- <each approved path>; $LASTEXITCODE`, then `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "docs: KIRO_LOG Day 5 entries and ui-renderer task status"; $LASTEXITCODE` (add "and shop-challenge spec" to the message when the spec folder is included). No `--no-verify`, no `--amend`, no co-author trailer; the pre-commit hook runs `pnpm check` (about 265 s) (Requirements 2.2, 2.3)
    - Stage nothing else (Requirement 2.6)
    - **Stop condition:** if the pre-commit `pnpm check` fails, report the failing command, its output and exit code, and create no commit until the user decides (Requirement 2.5)
    - If the user declines, leave the files unstaged and record the decision in the task report (Requirement 2.4)
    - Before any push request, report the count from `git rev-list --count origin/main..HEAD; $LASTEXITCODE`; push only when the user asks (Requirement 2.7)
    - Verify (approved): `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when it shows the Commit_Identity name and email and exactly the approved paths, then `git status --porcelain -- KIRO_LOG.md .kiro/specs/ui-renderer; $LASTEXITCODE` prints no file
    - Verify (declined): `git diff --cached --name-only; $LASTEXITCODE`; pass on no output
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 2. Shared schema changes
  - [~] 2.1 Add the two diagnostic codes
    - Design: C4, D28
    - Edit `packages/schema/src/diagnostics.ts`: add `'duplicate-item-id'` and `'select-unsatisfiable'` to `DiagnosticCode`; `severityOf` returns `'error'` for both without a change
    - Edit `packages/schema/test/ids.test.ts`: add both codes to `ALL_CODES`
    - Write each file in one save; each save fires the Regression_Hook (`pnpm -s test:shared`, about 99 s)
    - Verify: `pnpm exec vitest run packages/schema/test/ids.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.5, 5.11_
  - [~] 2.2 Add `isUpstream` to `GraphCtx`
    - Design: C4, D46
    - Edit `packages/schema/src/node-type.ts`: add `isUpstream(nodeId: string): boolean` with the doc comment of design C4
    - Edit `packages/schema/src/graph.ts` `stageConditions`: add the `isUpstream` member that reads the existing `dom` array and excludes the node itself; `checkLeaves` stays unchanged
    - Edit `packages/node-types/test/node-types.test.ts`: the stub `ctx()` gains `isUpstream: () => true`; change nothing else in the file
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/schema/ packages/node-types/test/node-types.test.ts; $LASTEXITCODE`
    - _Requirements: 5.9, 7.9_
  - [~] 2.3 Write the upstream test
    - Design: C4
    - Create `packages/schema/test/graph-upstream.test.ts` (node): a diamond graph `a → b → d`, `a → c → d` and a test node type whose `validate` records `ctx.isUpstream` answers; at `d`, `isUpstream('a')` is `true`, `isUpstream('b')` is `false`, `isUpstream('d')` is `false` and `isUpstream('zz')` is `false`
    - Verify: `pnpm exec vitest run packages/schema/test/graph-upstream.test.ts; $LASTEXITCODE`
    - _Requirements: 5.9, 7.9_

- [ ] 3. Shop_App package and workspace configuration
  - [~] 3.1 Create the package manifest and install the dependencies
    - Design: C2, "Dependencies", D40, D45, D49
    - Show the user the dependency list of the `apps/shop-challenge/package.json` in design C2 (with `react-router` `^8.5.2` approved on 2026-11-20 and the test tooling approved in ui-renderer) and ask the user to confirm it before `pnpm install`
    - Create `apps/shop-challenge/package.json` with the exact content in design C2, `apps/shop-challenge/tsconfig.json` (extends `../../tsconfig.base.json`, `"strict": true`, `"types": ["node"]`, the `include` list of design C2) and `apps/shop-challenge/vite.config.ts` with the exact content in design C2; keep the existing `apps/shop-challenge/README.md`
    - Edit `tools/validate/package.json`: add `"@dreame/shop-challenge": "workspace:*"` to its dependencies (D45)
    - Do not add `react-router-dom` or `@vitejs/plugin-react` (D49)
    - Do not commit here: `package.json` files and `pnpm-lock.yaml` go into one commit in task 21 (Requirement 3.9)
    - **Stop condition:** if pnpm blocks a package by its minimum release age, or reports a missing peer that is not in design "Dependencies", stop and ask the user whether to add a `minimumReleaseAgeExclude` entry or pin the newest older release
    - Verify: `pnpm install; $LASTEXITCODE`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `Select-String -Path pnpm-lock.yaml -SimpleMatch -Pattern 'react-router@8', "apps/shop-challenge:"`; pass when each pattern appears
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 3.1, 3.7, 3.8, 3.9, 13.1_
  - [~] 3.2 Configure the root program, the two Vitest projects and `.gitignore`
    - Design: C2 "Root changes"
    - Edit the root `tsconfig.json`: add `apps/*/src/**/*.ts`, `apps/*/src/**/*.tsx`, `apps/*/scripts/**/*.ts`, `apps/*/test/**/*.ts`, `apps/*/test/**/*.tsx`, `apps/*/generated/*.d.ts` and `apps/*/vite.config.ts` to `include`
    - Edit `vitest.config.ts`: the `node` project adds `apps/*/test/**/*.test.ts`; the `dom` project adds `apps/*/test/**/*.test.tsx` and keeps `setupFiles: ['packages/ui/test/setup.ts']`
    - Edit `.gitignore`: add `apps/*/generated/` and `.vercel`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/ui/test/environment.test.tsx packages/ui/test/environment.test.ts; $LASTEXITCODE`
    - Verify: `git check-ignore apps/shop-challenge/generated/x.js .vercel; $LASTEXITCODE`; pass when it prints both paths and exit code 0
    - _Requirements: 3.5, 3.6, 4.3, 15.6_

- [ ] 4. App wiring files and the Shop_Codegen (before any Own_File, Requirement 19.1)
  - [~] 4.1 Write W5 with the core types and the Shop_Codegen
    - Design: C3, C5 (W5), D47
    - Create `apps/shop-challenge/src/node-types/index.ts` (W5) as the design C5 "Final W5" file without the two app node type lines: `shopNodeTypes` is `[...coreNodeTypes]`. Creating it fires the Wiring_Hook, which must reply "no wiring needed" (hook step 1)
    - Create `apps/shop-challenge/scripts/codegen.ts` as in design C3: a copy of `packages/node-types/scripts/codegen.ts` that imports `shopNodeTypes` from `../src/node-types/index.ts`, calls `buildProfileModule('shop-challenge', shopNodeTypes)` with the default options (D14), writes `../generated/shop-challenge.validators.js` and `.d.ts`, and prints the same line form
    - Edit the root `package.json` script `codegen` to `pnpm --filter @dreame/node-types run codegen && pnpm --filter @dreame/shop-challenge run codegen`
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when it prints one `codegen: wrote` line for `core` and one for `shop-challenge`, each with raw and gzip byte counts
    - Verify: `Test-Path apps/shop-challenge/generated/shop-challenge.validators.js; Test-Path apps/shop-challenge/generated/shop-challenge.validators.d.ts; git status --porcelain -- apps/shop-challenge/generated`; pass when it prints `True`, `True` and no file
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 19.1_
  - [~] 4.2 Write W6 with the core types and the profile test
    - Design: C5 (W6), C2
    - Create `apps/shop-challenge/src/profile.ts` (W6) as the design C5 "Final W6" file without the `response_collectionSelect` and `response_recommendOutcome` lines
    - Create `apps/shop-challenge/test/profile.test.ts` (node): `shopProfile.id` is `shop-challenge`; the node type names equal `shopNodeTypes.map((t) => t.type)`, start with the `coreNodeTypes` names in order and hold no repeat; the generated module exports `validateManifest` and one `response_<type>` function per node type in `shopNodeTypes`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 3.2, 3.3, 3.4, 4.2_
  - [~] 4.3 Write W7 with the core views
    - Design: C5 (W7)
    - Create `apps/shop-challenge/src/views/registry.ts` (W7) as the design C5 "Final W7" file without the two app view imports, their export and their `shopViews` entries
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `Test-Path apps/shop-challenge/src/node-types/index.ts; Test-Path apps/shop-challenge/src/profile.ts; Test-Path apps/shop-challenge/src/views/registry.ts`; pass when all three print `True`
    - _Requirements: 3.2, 19.1, 19.3_
  - [~] 4.4 Update the EXTENDING.md test for app node types
    - Design: C5 "`tools/validate/test/extending-doc.test.ts`"
    - Edit `tools/validate/test/extending-doc.test.ts`: the expected `###` headings are the `coreNodeTypes` names followed by the names in `shopNodeTypes` (imported from `@dreame/shop-challenge/node-types`) that are not core names; every listed path must exist; for an app node type, the `View` line names `apps/shop-challenge/src/views/<Type>NodeView.tsx` when that file exists and reads `- View: not written yet` when it does not
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `git diff --exit-code -- EXTENDING.md; $LASTEXITCODE`
    - _Requirements: 19.4, 19.5_

- [ ] 5. Bundle rules and price formatting
  - [~] 5.1 Write the Selection and Suggestion rules
    - Design: C6
    - Create `apps/shop-challenge/src/node-types/bundle-rules.ts` with `RuleItem`, `SelectionRules`, `RuleBreak`, `offeredItems`, `selectionTotal`, `checkSelection`, `Unsatisfiable`, `unsatisfiable`, `WhereClause`, `RecommendRules`, `suggestItems`, `BudgetStatus` and `budgetStatus` as in design C6 (no React, no clock, no randomness; `budgetStatus` uses integer comparisons only). The hyphenated name does not match the Wiring_Hook matcher
    - Create `apps/shop-challenge/test/bundle-rules.test.ts` (node): `checkSelection` reports `unknown-item`, `repeated-item`, `too-few`, `too-many` and `over-budget` in that order with their counts; `unsatisfiable` gives each of its three reasons and `null` for a Satisfiable config; `offeredItems` with `null` and with an occasion; `suggestItems` keeps config order on price ties; `budgetStatus` at exactly 80% and 100% of the budget
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/bundle-rules.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.11, 6.2, 6.3, 8.2, 8.7, 10.5, 10.6_
  - [~] 5.2 Write the node state types and readers
    - Design: "Data Models" → "Node state"
    - Edit `apps/shop-challenge/src/node-types/bundle-rules.ts`: add `CollectionSelectNodeState`, `ItemSnapshot`, `BundleResultState`, `BundleLine`, `readSelectNodeState` and `readBundleResult` (own properties only; `null` for any field of the wrong JSON type; optional fields left out, never `undefined`)
    - Edit `apps/shop-challenge/test/bundle-rules.test.ts`: both readers accept a well-formed value and return `null` for `undefined`, a non-object, an array, a missing field, a wrong field type, a value whose `items` entry has a numeric `name`, and a value that carries `__proto__` as an own key; `readBundleResult` returns `null` when `selection` is not empty and `currency` is `null`
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/bundle-rules.test.ts; $LASTEXITCODE`
    - _Requirements: 6.5, 8.1, 11.8_
  - [~] 5.3 Write `formatPrice` and `hintText`
    - Design: C6 "`apps/shop-challenge/src/format.ts`", D33
    - Create `apps/shop-challenge/src/format.ts` with `formatPrice` (`Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 })`, cached per currency in a `Map`) and `hintText`
    - Edit `apps/shop-challenge/test/bundle-rules.test.ts`: `formatPrice(12, 'USD')` is `$12`; `hintText` gives "Add 1 more item", "Add 2 more items", "Remove 1 item", "Remove 2 items" and "$2 over budget", and `null` for no break and for the two ID rules
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/bundle-rules.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 10.4, 10.6_
  - [~] 5.4 Write the property test for budget status and hints
    - **Property 13: Budget status and hint follow the thresholds and rule order**
    - Create `apps/shop-challenge/test/bundle-rules.property.test.ts` (node): integers `total` 0–2,400,000,000 and `budget` 1–1,000,000,000 checked against an exact rational comparison with `BigInt`; generated Item lists, rules and selections where the hint names the first broken rule in the order count below `min`, count above `max`, total above `budget`, with the count to add or remove or the formatted amount over budget, and is `null` when no rule is broken
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/bundle-rules.property.test.ts; $LASTEXITCODE`
    - _Requirements: 10.5, 10.6_

- [ ] 6. Validate CLI profile entry (before any `activities/shop-*.json`)
  - [~] 6.1 Add the `shop-challenge` profile to the validate CLI
    - Design: C16 "`tools/validate/src/run.ts`", D45
    - Edit `tools/validate/src/run.ts`: import `shopProfile` from `@dreame/shop-challenge/profile` and add `'shop-challenge': shopProfile` to `PROFILES`
    - Verify: `pnpm exec vitest run tools/validate/; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE`; pass when it prints one PASS line for `activities/core-demo-study-break.json` and exit code 0
    - Verify: `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1)
    - _Requirements: 17.7_

- [ ] 7. `collectionSelect` node type
  - [~] 7.1 Create `collectionSelect.ts` with its schemas and run-time hooks
    - Design: C7, D27, D30, D34
    - Create `apps/shop-challenge/src/node-types/collectionSelect.ts`: `SELECT_LIMITS`, `SelectItemSchema`, `CollectionSelectConfigSchema`, `CollectionSelectResponseSchema`, their `Static` types, `occasionOf`, `selectNodeState`, and `collectionSelectNodeType` with `type`, `version`, `terminal`, `answerType`, `enter`, `isValidResponse` and `reduce` exactly as in design C7. In this task `validate` runs only step 1 (`ctx.checkText` on `prompt` and every Item `name`); task 7.5 adds steps 2–5. Every object schema sets `additionalProperties: false`
    - Creating the file fires the Wiring_Hook: it adds the W5 lines and the W6 `response_collectionSelect` lines, writes the `### collectionSelect` section of `EXTENDING.md` with `- View: not written yet`, creates `apps/shop-challenge/test/collectionSelect.test.ts` and `apps/shop-challenge/test/collectionSelect.property.test.ts`, and runs `pnpm -s test:shared`. Record the hook reply in the task report (Requirement 19.7)
    - **Stop condition:** if the Wiring_Hook does not fire, reports a missing App_Wiring_File, writes any file other than those listed above, or reports a failing `pnpm -s test:shared`, stop and report it to the user; add no wiring line by hand until the user answers
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when the `shop-challenge` line prints its byte counts
    - Verify (wiring, pass when it prints `1`, `1`, `1`, `True`, `True`): `(Select-String -Path apps/shop-challenge/src/node-types/index.ts -SimpleMatch -Pattern "export * from './collectionSelect.ts';").Count; (Select-String -Path apps/shop-challenge/src/profile.ts -SimpleMatch -Pattern 'collectionSelect: response_collectionSelect,').Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern '### collectionSelect').Count; Test-Path apps/shop-challenge/test/collectionSelect.test.ts; Test-Path apps/shop-challenge/test/collectionSelect.property.test.ts`
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts apps/shop-challenge/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.12, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 19.1, 19.2, 19.4, 19.6, 19.7_
  - [~] 7.2 Complete the `collectionSelect` example tests for schemas and run-time hooks
    - Design: C7, Testing Strategy "Example tests"
    - Edit `apps/shop-challenge/test/collectionSelect.test.ts` (keep the hook's `validate` and `reduce` tests if they pass; replace them if they do not follow design C7): descriptor fields; `answerType` returns `{ kind: 'set', values }` with the Item IDs in config order; schema limits at both sides of each bound in the design C7 "String limits" table and of `SELECT_LIMITS`, checked with the precompiled `validateManifest` and `response_collectionSelect`; an extra key in the config, an Item and the response is rejected; `prompt` and Item `name` blank give `conditions/blank-text` at their paths; a `reduce` example stores the IDs in config order and the node state of design "Data Models"
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/collectionSelect.test.ts; $LASTEXITCODE`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.12, 6.1, 6.4, 6.5, 19.6_
  - [~] 7.3 Write the property test for response acceptance
    - **Property 1: Response acceptance matches the Selection_Rules model**
    - Create `apps/shop-challenge/test/shop-arbitraries.ts` with `selectItemArb`, `selectConfigArb` (unique IDs, 1–24 Items; an option for at most 10 Items) and `acceptedSelectResponse(cfg, nodeState, pick)`
    - Replace the hook's property in `apps/shop-challenge/test/collectionSelect.property.test.ts` with this property and keep the file name: `checkAction` on an attempt at the node accepts a candidate response (subsets in any order, repeated IDs, unknown IDs, more than 24 entries, non-string entries, extra keys, random JSON) exactly when a reference model in the test accepts it; a rejection has the code `invalid-response`. The file keeps referencing `collectionSelectNodeType`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/collectionSelect.property.test.ts; $LASTEXITCODE`
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 19.6_
  - [~] 7.4 Write the property test for the stored selection
    - **Property 2: An accepted selection is stored as an ordered set with the offered Item data**
    - Add this property to `apps/shop-challenge/test/collectionSelect.property.test.ts`: for generated configs, occasion values and accepted responses, `reduce` stores each response ID once, in config order, as a subset of the `answerType` `values`, and a node state that `readSelectNodeState` accepts, with the config `currency` and the Offered_Items for that occasion in config order
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/collectionSelect.property.test.ts; $LASTEXITCODE`
    - _Requirements: 5.12, 6.4, 6.5_
  - [~] 7.5 Add the `collectionSelect` graph checks and their example tests
    - Design: C7 "`validate(cfg, ctx)`" steps 2–5, "Error Handling"
    - Edit `apps/shop-challenge/src/node-types/collectionSelect.ts`: add steps 2–5 of design C7 (`duplicate-item-id`, the Occasion_Source checks with `ctx.isUpstream`, the `occasions` entry checks, and one `select-unsatisfiable` per unsatisfiable occasion value with the exact messages of design C7). Saving the file fires the Wiring_Hook, which should reply "already wired"; record the reply in the task report (Requirement 19.7)
    - Edit `apps/shop-challenge/test/collectionSelect.test.ts`: one manifest per diagnostic (repeated Item ID at `/items/1`; `occasionFrom` dangling, of type `content`, and not upstream; an `occasions` entry that is not an option and one with no `occasionFrom`; each of the three `select-unsatisfiable` messages with and without an occasion), each checked with `validateManifest(manifest, shopProfile)` for code, stage, path, severity and `nodeId`; after `dangling-ref` or `type-mismatch` on `occasionFrom`, no occasion or satisfiability diagnostic follows
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/collectionSelect.test.ts apps/shop-challenge/test/collectionSelect.property.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.5, 5.7, 5.8, 5.9, 5.10, 5.11, 19.7_
  - [~] 7.6 Write the property test for the satisfiability check
    - **Property 4: The `select-unsatisfiable` check agrees with an exhaustive search**
    - Edit `apps/shop-challenge/test/shop-arbitraries.ts`: add `occasionChoiceArb` (a `choice` node with option IDs) and `occasions` lists drawn from its option IDs
    - Create `apps/shop-challenge/test/satisfiable.property.test.ts` (node): configs with at most 10 Items, with or without an Occasion_Source, inside an otherwise valid `shop-challenge` manifest; `validateManifest` reports `select-unsatisfiable` for value `v` exactly when an exhaustive subset search over the Offered_Items for `v` finds no subset that meets the Selection_Rules, and the manifest passes exactly when no value is unsatisfiable
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/satisfiable.property.test.ts; $LASTEXITCODE`
    - _Requirements: 5.11, 5.13_

- [ ] 8. Contact channels and the `recommendOutcome` node type
  - [~] 8.1 Write the contact channels and their test
    - Design: C8b, D54
    - Create `apps/shop-challenge/src/contact/channel.ts` (`ContactChannel`), `apps/shop-challenge/src/contact/whatsapp.ts` (`whatsappChannel`, hosts `wa.me` and `api.whatsapp.com`), `apps/shop-challenge/src/contact/telegram.ts` (`telegramChannel`, host `t.me`) and `apps/shop-challenge/src/contact/channels.ts` (`CONTACT_CHANNELS` and `channelFor`) exactly as in design C8b. Each Channel_Module imports only `./channel.ts`; no file in the folder imports `react` or `react-dom` or calls `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` or `WebSocket`
    - These files are not node type or view files, so the Wiring_Hook (H3) does not fire on them
    - Create `apps/shop-challenge/test/contact-channels.test.ts` (node): each Contact_Channel matches its hosts (`wa.me` and `api.whatsapp.com` for WhatsApp, `t.me` for Telegram); the hosts `wa.me.evil.com`, `evilwa.me` and `t.me.example.org` and the URL `http://t.me/x` match no channel; `channelFor` returns the first match, and `undefined` for no match and for unparsable input; a scan of `src/contact/` checks that each Channel_Module imports only `./channel.ts` and finds no `react` or `react-dom` import and no network call
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/contact-channels.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 11.11, 11.12, 11.13, 11.14_
  - [~] 8.2 Create `recommendOutcome.ts`
    - Design: C8, D31, D54
    - Create `apps/shop-challenge/src/node-types/recommendOutcome.ts`: `WhereClauseSchema`, `RecommendSchema`, `RecommendOutcomeConfigSchema` (with the optional `contacts` list of 0–3 closed `{ label, url }` Contact_Links), `RecommendOutcomeResponseSchema`, their `Static` types, `bundleResult`, and `recommendOutcomeNodeType` with `type`, `version`, `terminal`, `answerType`, `validate` (`checkText` on `title`, `checkHttpsUrl` on each `contacts[i].url` at `/config/contacts/<i>/url`, and the `from` checks), `isValidResponse`, `reduce` and `enter` exactly as in design C8. Every object schema sets `additionalProperties: false`
    - The file imports nothing from `../contact/`: no Channel_Module and no Channel_List (Requirement 7.12)
    - Creating the file fires the Wiring_Hook: it adds the W5 and W6 lines, writes the `### recommendOutcome` section of `EXTENDING.md` with `- View: not written yet`, creates `apps/shop-challenge/test/recommendOutcome.test.ts` and `apps/shop-challenge/test/recommendOutcome.property.test.ts`, and runs `pnpm -s test:shared`. Record the hook reply in the task report (Requirement 19.7)
    - **Stop condition:** as in task 7.1
    - Verify: `pnpm codegen; $LASTEXITCODE`
    - Verify (wiring, pass when it prints `1`, `1`, `1`, `True`, `True`): `(Select-String -Path apps/shop-challenge/src/node-types/index.ts -SimpleMatch -Pattern "export * from './recommendOutcome.ts';").Count; (Select-String -Path apps/shop-challenge/src/profile.ts -SimpleMatch -Pattern 'recommendOutcome: response_recommendOutcome,').Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern '### recommendOutcome').Count; Test-Path apps/shop-challenge/test/recommendOutcome.test.ts; Test-Path apps/shop-challenge/test/recommendOutcome.property.test.ts`
    - Verify (import rule; pass on no output): `Select-String -Path apps/shop-challenge/src/node-types/recommendOutcome.ts -SimpleMatch -Pattern 'contact/'`
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts apps/shop-challenge/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 8.1, 8.2, 8.3, 8.4, 8.5, 19.1, 19.2, 19.4, 19.6, 19.7_
  - [~] 8.3 Complete the `recommendOutcome` example tests
    - Design: C8, Testing Strategy "Example tests"
    - Edit `apps/shop-challenge/test/recommendOutcome.test.ts` (keep the hook's tests if they pass and follow design C8): descriptor fields; `answerType` returns `null`; schema limits at both sides of each bound in design "Data Models"; `where` with `eq` is rejected; a `contacts` list of 4 entries fails the schema, and an absent and an empty `contacts` list both pass; the empty response object is accepted and an extra key is rejected; `from` dangling, of type `choice`, and not upstream give `dangling-ref`, `type-mismatch` and `answer-not-upstream` at `/config/from`; blank `title` gives `conditions/blank-text`; `https://wa.me/12125550142` and `https://t.me/dreame_demo_shop` pass and an `http:` URL in the first Contact_Link gives `conditions/unsafe-url` at `/config/contacts/0/url`; the source of `recommendOutcome.ts` imports nothing from `../contact/` (Requirement 7.12); `enter` with a `from` answer stores the lines, total and Suggestions, and without one stores an empty selection, total 0 and no Suggestions; without `recommend`, Suggestions are empty
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/recommendOutcome.test.ts; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 8.3, 8.4, 19.6_
  - [~] 8.4 Write the property test for the bundle result
    - **Property 5: Bundle total and Suggestions are within the rules and deterministic**
    - Edit `apps/shop-challenge/test/shop-arbitraries.ts`: add `recommendArb` (absent, or 0–4 `where` clauses, either `sortBy`, `limit` 1–8)
    - Replace the hook's property in `apps/shop-challenge/test/recommendOutcome.property.test.ts` with this property and keep the file name: with the `from` answer present or absent, the state stored by `recommendOutcome.enter` meets every clause of design Property 5. The file keeps referencing `recommendOutcomeNodeType`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/recommendOutcome.property.test.ts; $LASTEXITCODE`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 19.6_
  - [~] 8.5 Write the property test for hook purity
    - **Property 3: Node type hooks leave their inputs unchanged and are deterministic**
    - Add this property to `apps/shop-challenge/test/collectionSelect.property.test.ts`, referencing `collectionSelectNodeType` and `recommendOutcomeNodeType`: call `collectionSelect.enter`, `collectionSelect.reduce` and `recommendOutcome.enter` on deep-frozen inputs; no error is thrown, the inputs stay deep-equal to copies taken before the call, `rngState` is unchanged, and a second call with the same inputs and `Env` returns a deep-equal state
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/collectionSelect.property.test.ts; $LASTEXITCODE`
    - _Requirements: 6.6, 6.8, 8.5_

- [ ] 9. Validator size and the final profile list
  - [~] 9.1 Measure the Shop_Validator_Module and add the size test
    - Design: C3, D44
    - Run `pnpm codegen; $LASTEXITCODE` and read the `shop-challenge` raw and gzip byte counts
    - Edit the C3 table in `.kiro/specs/shop-challenge/design.md`: write the measured raw and gzip bytes, the raw limit (measured × 1.10, rounded up to a multiple of 1,000) and the gzip limit (measured × 1.10, rounded up to a multiple of 500); change nothing else in design.md
    - Create `apps/shop-challenge/test/validator-size.test.ts` (node): reads `apps/shop-challenge/generated/shop-challenge.validators.js` and fails above either limit
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/validator-size.test.ts; $LASTEXITCODE`
    - _Requirements: 4.4, 4.5_
  - [~] 9.2 Pin the five profile node types in the profile test
    - Design: C5 "Final W5", "Final W6"
    - Edit `apps/shop-challenge/test/profile.test.ts`: the node type names equal `['content', 'choice', 'outcome', 'collectionSelect', 'recommendOutcome']`, and the generated module exports `response_collectionSelect` and `response_recommendOutcome`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/profile.test.ts; $LASTEXITCODE`
    - _Requirements: 3.3, 4.2, 19.2_

- [ ] 10. Shop profile property tests
  - [~] 10.1 Write the property test for termination
    - **Property 6: Shop manifests that pass validation finish within `maxTransitions`**
    - Edit `apps/shop-challenge/test/shop-arbitraries.ts`: add `bundleManifestArb` (optional occasion `choice`, a `collectionSelect`, optional `includes` edges on its answer, a `recommendOutcome`), `shopManifestArb` (`bundleManifestArb` or a `validManifestArb` manifest from `packages/node-types/test/arbitraries.ts` with `profile` set to `shop-challenge`, imported by relative path and not changed) and `playShopManifest(rt, opts)`
    - Create `apps/shop-challenge/test/termination.property.test.ts` (node): for manifests that pass `validateManifest(m, shopProfile)`, any seed and generated accepted responses, the attempt reaches `finished` or `limit_reached` within `limits.maxTransitions` transitions
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/termination.property.test.ts; $LASTEXITCODE`
    - _Requirements: 9.1, 9.4_
  - [~] 10.2 Write the property test for validator robustness
    - **Property 7: The validator does not crash on random input with the shop profile**
    - Create `apps/shop-challenge/test/validator.property.test.ts` (node): random JSON values, and valid `shopManifestArb` manifests with one value replaced by random JSON; `validateManifest(value, shopProfile)` throws no error and returns `ok` with at most 50 diagnostics
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/validator.property.test.ts; $LASTEXITCODE`
    - _Requirements: 9.2, 9.4_
  - [~] 10.3 Write the property test for replay
    - **Property 8: Same seed and same actions give the same attempt**
    - Create `apps/shop-challenge/test/replay.property.test.ts` (node): manifests that pass validation, any uint32 seed, sequences of accepted, rejected and random JSON responses, and any clock sequence; two runs of `createAttempt` and `reduce` with equal inputs give deep-equal states after every step
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/replay.property.test.ts; $LASTEXITCODE`
    - _Requirements: 9.3, 9.4_

- [~] 11. Checkpoint - Ensure all tests pass after the node types
  - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
  - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
  - Verify: `git diff --exit-code -- .kiro/hooks .github/workflows/ci.yml; $LASTEXITCODE`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Rejection handling in `@dreame/ui`
  - [~] 12.1 Add the `rejections` prop to the render contract
    - Design: C11 part 1, D48
    - Edit `packages/ui/src/render.ts`: `RenderProps` gains the optional `readonly rejections?: number` with the doc comment of design C11
    - Edit `packages/ui/src/components/NodeRenderer.tsx`: `NodeRendererProps` gains `readonly rejections?: number`, passed through to the view
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/ui/test/NodeRenderer.test.tsx packages/ui/test/render-registry.test.ts; $LASTEXITCODE`
    - _Requirements: 12.5, 12.6, 12.9_
  - [~] 12.2 Give each Rejection a new focused alert and keep the view mounted
    - Design: C11 part 2
    - Edit `packages/ui/src/components/ActivityPlayer.tsx`: `alertRef`, the focus effect on `[rejections, view.rejected]`, the alert `<p key={rejections} ref={alertRef} className="dr-error" role="alert" tabIndex={-1}>`, `viewKey={currentNodeId}` and `rejections={rejections}` on `NodeRenderer`
    - Edit `packages/ui/src/player-state.ts`: only the comment text "part of the view key" changes
    - Edit `packages/ui/test/ActivityPlayer.test.tsx`: the test "shows the rejection message and stays on the node…" now expects the same view button element after the Rejection (`toBe(before)`), focus on the alert, a second click that is sent again, and a second alert that is a different object from the first and has focus; add a check that an accepted response after a Rejection removes the alert and focuses the new node's `h2` or the container (Requirements 12.4, 12.7). Change no other test in the file
    - Verify: `pnpm exec vitest run packages/ui/test/ActivityPlayer.test.tsx packages/ui/test/player-state.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.7, 12.9_
  - [~] 12.3 Re-enable submit in the content and choice views after a Rejection
    - Design: C11 part 3
    - Edit `packages/ui/src/views/ContentNodeView.tsx` and `packages/ui/src/views/ChoiceNodeView.tsx`: read the `rejections` prop and add `useEffect(() => { responded.current = false; }, [rejections]);`
    - Edit `packages/ui/test/ContentNodeView.test.tsx` and `packages/ui/test/ChoiceNodeView.test.tsx`: one case each where a change of the `rejections` prop (through `rerender`) re-enables submit; the choice case also checks that the selected option stays selected
    - Verify: `pnpm exec vitest run packages/ui/test/ContentNodeView.test.tsx packages/ui/test/ChoiceNodeView.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/ui/; $LASTEXITCODE`
    - _Requirements: 12.5, 12.6, 12.9_
  - [~] 12.4 Scan the player after a Rejection with axe
    - Design: C11 "Existing `@dreame/ui` tests that change"
    - Edit `packages/ui/test/a11y.test.tsx`: add one case, the ActivityPlayer with a stub choice view that sends an invalid response, scanned after one Rejection with the existing axe options
    - **Stop condition:** fix violations in the components; disable no rule other than `color-contrast` without asking the user
    - Verify: `pnpm exec vitest run packages/ui/test/a11y.test.tsx; $LASTEXITCODE`
    - _Requirements: 12.8, 12.9_

- [ ] 13. `CollectionSelectNodeView`
  - [~] 13.1 Write `CollectionSelectNodeView.tsx`
    - Design: C9, D29, D30
    - Create `apps/shop-challenge/src/views/CollectionSelectNodeView.tsx` as in design C9: the form, `fieldset` with `aria-describedby`, `legend`, the optional `pricesAsOf` note, one checkbox row per shown Item, the bundle bar with the polite live region, the hint, the inline error with `role="alert"`, the submit button, the once-only flag reset on `rejections`, `useId` for IDs, no `style` attribute, and node state read only through `readSelectNodeState`
    - Creating the file fires the Wiring_Hook: it adds the W7 import, export and `shopViews` entry, and changes the `collectionSelect` `View` line of `EXTENDING.md` to the view path. Record the hook reply in the task report (Requirement 19.7)
    - **Stop condition:** as in task 7.1
    - Verify (wiring, pass when it prints `1` and `1`): `(Select-String -Path apps/shop-challenge/src/views/registry.ts -SimpleMatch -Pattern "{ type: 'collectionSelect', Render: CollectionSelectNodeView }").Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern 'apps/shop-challenge/src/views/CollectionSelectNodeView.tsx').Count`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 12.5, 12.6, 19.2, 19.4_
  - [~] 13.2 Write the `CollectionSelectNodeView` example tests
    - Design: C9, Testing Strategy "Example tests"
    - Create `apps/shop-challenge/test/CollectionSelectNodeView.test.tsx` (jsdom): the group is named by `prompt`; each checkbox's accessible name holds the name and the formatted US dollar price (for example `$12`); the emoji has `aria-hidden="true"`; tags show as text; the `pricesAsOf` note text; "Under budget" at exactly 80%, "Close to budget" at exactly 100% and "Over budget" above; the hint text for too few, too many and over budget; continue with a broken Selection shows the inline message linked by `aria-describedby` and leaves `onRespond` uncalled; a valid Selection calls `onRespond` once with `{ itemIds }` in config order and a second click is ignored; Space toggles a checkbox (user-event); a damaged `nodeState` shows every config Item
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/CollectionSelectNodeView.test.tsx; $LASTEXITCODE`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11_
  - [~] 13.3 Write the property test for selection view responses
    - **Property 12: The selection view sends only valid responses of offered Items**
    - Create `apps/shop-challenge/test/CollectionSelectNodeView.property.test.tsx` (jsdom): generated configs, occasion values given through the node state that `enter` stores, 0–30 checkbox toggles and 1–4 continue activations with `fireEvent`; one checkbox per Offered_Item in config order; `onRespond` is called once at the first activation that finds the Selection_Rules met and never otherwise; the response holds only Offered_Item IDs in config order and passes `collectionSelectNodeType.isValidResponse` and `response_collectionSelect`; while the rules are broken at an activation, the inline message is shown and linked with `aria-describedby`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/CollectionSelectNodeView.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 10.1, 10.7, 10.8, 10.9, 10.12_
  - [~] 13.4 Write the property test for rejection handling
    - **Property 9: A Rejection adds a new focused alert and keeps the picks**
    - Create `apps/shop-challenge/test/rejection.property.test.tsx` (jsdom): generated `collectionSelect` configs in a small manifest, generated picks, and 1–4 forced Rejections through a profile wrapper whose `isValidResponse` rejects the first `k` responses; after each Rejection exactly one `role="alert"` element exists, it is a different object from the previous alert, `document.activeElement` is that element, the checked checkboxes equal the picks, and the next submit calls `onRespond` again
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/rejection.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_

- [ ] 14. `RecommendOutcomeNodeView`, the view registry test and text rendering
  - [~] 14.1 Write `RecommendOutcomeNodeView.tsx`
    - Design: C10, C8b, D54
    - Create `apps/shop-challenge/src/views/RecommendOutcomeNodeView.tsx` as in design C10: `h2` with `tabIndex={-1}`, `.dr-body`, the "Your bundle" section with lines and total, the "No bundle was chosen." note, `whyText`, the "You might also like" section, the `ul.shop-contacts` list with one `ExternalLinkButton` per Contact_Link in config order and a "via <name>" note when `channelFor(url)` (design C8b) returns a Contact_Channel and no note when it returns `undefined`, node state read only through `readBundleResult`, no control that calls `onRespond`, no `style` attribute
    - Creating the file fires the Wiring_Hook for W7 and the `recommendOutcome` `View` line. Record the hook reply in the task report (Requirement 19.7)
    - **Stop condition:** as in task 7.1
    - Verify (wiring, pass when it prints `1` and `1`): `(Select-String -Path apps/shop-challenge/src/views/registry.ts -SimpleMatch -Pattern "{ type: 'recommendOutcome', Render: RecommendOutcomeNodeView }").Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern 'apps/shop-challenge/src/views/RecommendOutcomeNodeView.tsx').Count`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 19.2, 19.4_
  - [~] 14.2 Write the `RecommendOutcomeNodeView` example tests
    - Design: C10, Testing Strategy "Example tests"
    - Create `apps/shop-challenge/test/RecommendOutcomeNodeView.test.tsx` (jsdom): heading text; body line breaks kept in `.dr-body`; each line with name and formatted price (for example `$12`); the formatted total; `whyText`; the Suggestions heading only when Suggestions exist; the empty-selection note; one link button per Contact_Link in config order, each with a confirm step that shows its host; "via WhatsApp" next to the `https://wa.me/12125550142` link and "via Telegram" next to the `https://t.me/dreame_demo_shop` link; no "via" note for another https host such as `https://example.com/shop`; a missing and a damaged `nodeState` show title, body, the Contact_Links and the note; no control calls `onRespond`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/RecommendOutcomeNodeView.test.tsx; $LASTEXITCODE`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_
  - [~] 14.3 Write the property test for Contact_Link safety
    - **Property 10: A recommendOutcome Contact_Link becomes an anchor only for a safe https URL**
    - Edit `apps/shop-challenge/test/shop-arbitraries.ts`: add `SAFE_CONTACT_URLS` (including `https://wa.me/<digits>` and `https://t.me/<name>` forms), `UNSAFE_CONTACT_URLS` and `contactsArb` (0–3 Contact_Links drawn from both)
    - Create `apps/shop-challenge/test/RecommendOutcomeNodeView.property.test.tsx` (jsdom): lists of 0–3 Contact_Links whose URLs are generated safe `https:` URLs (including `https://wa.me/<digits>` and `https://t.me/<name>`), `http:`, `javascript:` and `data:` URLs, shortener hosts, credentials, over-long URLs and random strings; `recommendOutcome.validate` reports `unsafe-url` at `/config/contacts/<i>/url` exactly for the indexes where `checkHttpsUrl(url, '')` returns a diagnostic; after each link button is activated, an anchor exists for every contact whose URL is a Safe_Url and for no other, with `href` equal to the input, `target="_blank"` and `rel="noopener noreferrer"`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/RecommendOutcomeNodeView.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 7.6, 11.6, 14.4_
  - [~] 14.4 Write the view registry test
    - Design: C5 "Shop_Views test"
    - Create `apps/shop-challenge/test/registry.test.tsx` (jsdom): `shopViews.types()` equals `shopProfile.nodeTypes.map((t) => t.type)`, and `shopViews.get` returns the two shared-package views and the two app views by type
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/registry.test.tsx; $LASTEXITCODE`
    - _Requirements: 19.3_
  - [~] 14.5 Write the property test for text rendering
    - **Property 14: Shop views show manifest strings as text**
    - Create `apps/shop-challenge/test/text-rendering.property.test.tsx` (jsdom): generated strings, including markup such as `<b>x</b>` and `<img src=x>`, as every string field of design Property 14 across both views; each string is the `textContent` of an element or contained in it, each checkbox name holds the Item name and formatted price, and no element named by the markup is created
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/text-rendering.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 10.2, 10.11, 11.1, 11.2, 11.4_

- [ ] 15. Demo activity and fixture
  - [~] 15.1 Show the user the demo draft and the placeholder Contact_Links (manual step)
    - Design: C16 "Demo_Manifest", D33, D37, D54
    - Show the user the USD product draft table of design C16 (8 synthetic Items: `candle` 18, `chocolate` 12, `perfume` 32, `mug` 9, `card` 4, `bracelet` 22, `cookies` 7, `plant` 14, with their names, tags, occasions and emoji; `min: 2`, `max: 3`, `budget: 50`, `currency: "USD"`) and the two placeholder Contact_Link URLs: `https://wa.me/12125550142` ("Order on WhatsApp"; `+1 212 555 0142` is in the 555-0100 to 555-0199 range kept for fictional use) and `https://t.me/dreame_demo_shop` ("Order on Telegram"; a placeholder name, not checked against Telegram)
    - Ask the user: whether to keep the draft list or supply 5–8 products (names, prices in US dollars, tags, emoji), and whether to keep the two placeholder URLs or replace them with real shop handles that the user agrees to publish (Requirement 17.1)
    - **Stop condition:** stop until the user answers; write no file under `activities/` before that (Requirements 17.1, 17.3)
    - Write no Contact_Link URL that the user has not supplied or approved, and no personal WhatsApp number or personal Telegram account (Requirement 17.3). A user-supplied list holds no real brand or person (Requirements 17.2, 17.6). Record the approved list and both URLs in the task report
    - Verify: `git status --porcelain --untracked-files=all -- activities; $LASTEXITCODE`; pass when it prints no file and exit code 0 (nothing written before approval)
    - _Requirements: 17.1, 17.2, 17.3, 17.6_
  - [~] 15.2 Write the Demo_Manifest
    - Design: C16 "Graph"
    - Create `activities/shop-gift-bundle.json` with the approved products and the two approved Contact_Link URLs and the graph of design C16 (`intro` → `pick-occasion` → `pick` → `result`; `pick` with `occasionFrom: "pick-occasion"`, `min: 2`, `max: 3`, `budget: 50`, `currency: "USD"` and `pricesAsOf` the task date; `result` with `from: "pick"`, `whyText`, `recommend: { sortBy: "priceAsc", limit: 2 }` and `contacts` holding "Order on WhatsApp" and "Order on Telegram" in that order; `requires`, `entryNodeId`, `fallbackOutcomeId`, `limits`, `variables`, `theme`, no `validUntil`). Check by hand that every occasion is Satisfiable with the approved list before saving. The Activity_Hook validates the file on save
    - Verify: `pnpm -s validate activities/shop-gift-bundle.json; $LASTEXITCODE`; pass when it prints PASS and exit code 0
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE`; pass when it prints two PASS lines and exit code 0
    - _Requirements: 17.4, 17.5, 17.6, 17.7_
  - [~] 15.3 Bundle the demo and write the play test
    - Design: C12 "`src/demos.ts`", C16 "Play test"
    - Create `apps/shop-challenge/src/demos.ts` with `DemoEntry`, `DEMOS` and `findDemo` (a `Map` lookup, so `__proto__` and `toString` return `undefined`)
    - Create `apps/shop-challenge/test/demo-manifest.test.ts` (node): the manifest passes `validateManifest(m, shopProfile)`; playing Start, option `birthday` and `{ itemIds: ['chocolate', 'card'] }` (or the matching IDs of the approved list) ends `finished` at `result` with that stored selection and a total of 16 (or the matching total of the approved list); every `DEMOS` ID equals its manifest's `activityId`; `findDemo('__proto__')` is `undefined`; the graph has no `validUntil` or one of `2027-12-31` or later
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/demo-manifest.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 13.4, 17.4, 17.5, 17.9_
  - [~] 15.4 Write the Shop_Fixture and its CLI test
    - Design: C16 "Shop_Fixture"
    - Create `activities/fixtures/broken-shop-over-budget.json` as in design C16: a `content` node, a `collectionSelect` node with no `occasionFrom`, `min: 2`, `budget: 10` and two Items priced 15 and 20, and a `recommendOutcome` node; the Activity_Hook reports `FAIL` and `select-unsatisfiable` on save, which is the expected result
    - Edit `activities/fixtures/README.md`: add one line for the new fixture
    - Edit `tools/validate/test/run.test.ts`: add one case where the Demo_Manifest passes with exit 0 and the Shop_Fixture gives one `conditions/select-unsatisfiable` diagnostic and exit 1; the existing `toContain('one of: core')` check stays
    - Verify: `pnpm -s validate activities/fixtures/broken-shop-over-budget.json; $LASTEXITCODE`; pass when it prints `FAIL`, one `select-unsatisfiable` diagnostic and exit code 1
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`
    - _Requirements: 17.7, 17.8_

- [ ] 16. App shell, routes and views
  - [~] 16.1 Write the offer date helpers and the small views
    - Design: C12 "`src/offer.ts`" and the view table
    - Create `apps/shop-challenge/src/offer.ts` (`localDateString`, `isOfferEnded`), `apps/shop-challenge/src/app/NotFoundView.tsx`, `apps/shop-challenge/src/app/OfferEndedView.tsx` and `apps/shop-challenge/src/app/Footer.tsx` with the exact texts and links of the design C12 view table; footer anchors have `target="_blank"`, `rel="noopener noreferrer"` and the visible text "(opens in a new tab)"
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `Select-String -Path apps/shop-challenge/src/app/Footer.tsx -SimpleMatch -Pattern 'rel="noopener noreferrer"'`; pass when it prints two lines
    - _Requirements: 13.6, 13.7, 13.9, 14.4_
  - [~] 16.2 Write the landing view, the demo route and the routes
    - Design: C12 "`src/app/App.tsx`", "PlayDemoRoute", view table, D40, D41
    - Create `apps/shop-challenge/src/app/LandingView.tsx` (the exact texts of the design C12 table and one `Link` per `DEMOS` entry), `apps/shop-challenge/src/app/PlayDemoRoute.tsx` (steps 1–4 of design C12; it takes an optional `demos` prop that defaults to `DEMOS`, so a test can pass an invalid manifest) and `apps/shop-challenge/src/app/App.tsx` (the three routes and the footer), with `Link`, `Routes`, `Route`, `useParams` and `useNavigate` from `react-router`
    - The only toolkit statement on the landing page is the Brief §0 sentence quoted in design C12 (Requirement 13.10)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.10_
  - [~] 16.3 Write the entry files and the `index.html` test
    - Design: C12 "`apps/shop-challenge/index.html`", "`src/app/main.tsx`", "`src/app/shop.css`"
    - Create `apps/shop-challenge/index.html` with the exact content of design C12, `apps/shop-challenge/src/app/main.tsx` (imports `@dreame/ui/tokens.css`, `@dreame/ui/components.css` and `./shop.css`; throws an `Error` when `#root` is missing; renders `<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>`) and `apps/shop-challenge/src/app/shop.css` (layout rules that use only `var(--dr-*)` tokens; the bundle bar is `position: sticky; bottom: 0`)
    - `@dreame/ui` already exports `./tokens.css` and `./components.css`. If `tsc` reports the three stylesheet imports as unresolved side-effect imports, add `apps/shop-challenge/src/app/css.d.ts` with `declare module '*.css';` and record that in the task report; change no compiler option
    - Create `apps/shop-challenge/test/index-html.test.ts` (node): `index.html` has a `<title>`, `og:title`, `og:description`, no inline script and no inline style
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/index-html.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 13.1, 13.11, 13.12, 14.5_
  - [~] 16.4 Write the routes test
    - Design: C12, Testing Strategy "Example tests"
    - Create `apps/shop-challenge/test/routes.test.tsx` (jsdom) with `MemoryRouter`: `/` shows the app name, the audience sentence, a link to `/play/demo/shop-gift-bundle` and the trust text; `/play/demo/shop-gift-bundle` shows the player at `intro`; `/play/demo/nope` and `/x` show "Page not found" with a link to `/`; an invalid manifest through the `demos` prop shows `InvalidActivityView` with "Back to home"; a demo with a past `validUntil` shows "This offer has ended"; `isOfferEnded` with a past, the same and a future date; the footer on every route
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/routes.test.tsx; $LASTEXITCODE`
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_
  - [~] 16.5 Write the app axe test
    - Design: Testing Strategy "Example tests", ui-renderer D17
    - Create `apps/shop-challenge/test/a11y.test.tsx` (jsdom): `axe.run` from `axe-core` with the WCAG 2.x A and AA tags and `color-contrast` disabled, as `packages/ui/test/a11y.test.tsx` does, on the landing, not-found and offer-ended views, both shop views, and the player on each node of the Demo_Manifest; `expect(result.violations).toEqual([])`
    - **Stop condition:** fix violations in the components; disable no rule other than `color-contrast` without asking the user
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/a11y.test.tsx; $LASTEXITCODE`
    - _Requirements: 13.13_

- [ ] 17. Scans, `PRIVACY.md` and the built output check
  - [~] 17.1 Extend the source scan to `apps/`
    - Design: C13 table, row `source-scan.test.ts`
    - Edit `packages/schema/test/source-scan.test.ts`: test (a) scans `apps/` as well as `packages/` and `tools/` and asserts that the file list holds a `.tsx` file under `apps/shop-challenge/src/`; test (c) `listSrcDirs` also reads `apps/`. Write the file in one save (Regression_Hook)
    - Verify: `pnpm exec vitest run packages/schema/test/source-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 4.6, 14.3_
  - [~] 17.2 Extend the boundary test to the app node types and profile
    - Design: C13 table, row `boundaries.test.ts`
    - Edit `packages/runtime/test/boundaries.test.ts`: `NO_UI_DIRS` adds `apps/shop-challenge/src/node-types`, and a new case scans the single file `apps/shop-challenge/src/profile.ts`; also flag `.tsx` specifiers in both. Write the file in one save (Regression_Hook)
    - Verify: `pnpm exec vitest run packages/runtime/test/boundaries.test.ts; $LASTEXITCODE`
    - _Requirements: 3.4, 18.2_
  - [~] 17.3 Write the app privacy scan
    - Design: C13 table, row `privacy-scan.test.ts`
    - Create `apps/shop-challenge/test/privacy-scan.test.ts` (node) over every file in `apps/shop-challenge/src`: no network or storage API of design C13; no `<input` whose `type` is not `checkbox`, no `<textarea` or `<select`; no JSX `style=`; every `<a` tag has an `href` starting with `https://`, `target="_blank"` and `rel="noopener noreferrer"`. Build the tokens from fragments, as in `packages/ui/test/privacy-scan.test.ts`, and add a sample-code case that checks each pattern matches
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/privacy-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 14.1, 14.2, 14.4, 14.5, 14.8_
  - [~] 17.4 Write `PRIVACY.md` and extend the repository text scan
    - Design: C13 "`PRIVACY.md`", D43
    - Create `PRIVACY.md` at the Workspace root with the exact content of design C13
    - Edit `tools/validate/test/repo-text.test.ts`: add cases for `.kiro/specs/shop-challenge/*.md`, every file under `apps/shop-challenge/src`, `apps/shop-challenge/index.html`, `apps/shop-challenge/README.md` and `PRIVACY.md`
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 13.10, 14.7, 14.8_
  - [~] 17.5 Write the built output check
    - Design: C13 table, row `check-dist.ts`, D44
    - Create `apps/shop-challenge/scripts/check-dist.ts`: reads `dist/index.html` and exits 1 on a `<script` tag without `src=`, a `<style` tag or a `style=` attribute; sums the `gzipSync` sizes of `dist/assets/*.js` and exits 1 above 153,600 bytes; prints both results. It imports only `node:*` modules
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `Test-Path apps/shop-challenge/dist; node --experimental-strip-types apps/shop-challenge/scripts/check-dist.ts; $LASTEXITCODE`; pass when, with no `dist` folder, it prints `False`, a plain error naming the missing `dist/index.html`, and exit code 1 (task 18 runs it on a real build)
    - _Requirements: 14.6_

- [~] 18. Checkpoint - Ensure all tests pass and the app builds
  - Verify: `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`; pass when `check-dist.ts` reports no inline script or style and a JS total under 153,600 gzip bytes, and the exit code is 0
  - Verify: `git status --porcelain --untracked-files=all -- apps/shop-challenge/dist apps/shop-challenge/generated; $LASTEXITCODE`; pass when it prints no file
  - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Static hosting configuration
  - [~] 19.1 Write `vercel.json` and its example test
    - Design: C14, D52
    - Create `apps/shop-challenge/vercel.json` with the exact content of design C14
    - Create `apps/shop-challenge/test/vercel-config.test.ts` (node): parses the file; the install command, build command and output directory equal design C14; the rewrite is `/(.*)` → `/index.html`; no `env`, `build` or `buildEnv` key exists
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/vercel-config.test.ts; $LASTEXITCODE`
    - _Requirements: 15.3, 15.4, 15.5_
  - [~] 19.2 Write the property test for the hosting headers
    - **Property 11: The hosting headers and rewrite apply to every path**
    - Create `apps/shop-challenge/test/vercel-config.property.test.ts` (node): generated request paths starting with `/` (routes, assets, deep paths, encoded characters); the header rule `source` and the rewrite `source`, read as `/(.*)`, match each path; the header rule sets exactly the four headers of Architecture Spec §A3, each byte-equal to the value parsed from `docs/Architecture_and_UI_Spec.md` at run time; the rewrite destination is `/index.html`
    - Verify: `pnpm exec vitest run apps/shop-challenge/test/vercel-config.property.test.ts; $LASTEXITCODE`
    - _Requirements: 15.1, 15.2_

- [ ] 20. Timing and full-pipeline checks before the deploy
  - [~] 20.1 Measure `pnpm -s check` against 240 s before the deploy
    - Design: C15 "Timing", D53 (accepted 2026-11-20); "Notes for the tasks run" → "Post_Task_Hook time"
    - Ask the user to close other heavy processes first (HANDOFF §4)
    - Run `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s check; $LASTEXITCODE; $sw.Elapsed.TotalSeconds` and record the exit code and wall time in the task report. The Boundary_Rules and the Lint_Check are not in `check` yet; task 25.1 measures again after they join
    - **Stop condition (D53):** if the time exceeds 240 s, report it to the user and ask. Raise the Post_Task_Hook timeout to 600 s in `.kiro/hooks/post-task-check.json` (one field, an exception to Requirement 19.8) only after the user approves; narrow nothing in `check` without the user's answer
    - Verify: the measured run prints exit code 0
    - _Requirements: 20.3, 20.12_
  - [~] 20.2 Run the full pipeline checks before the deploy
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when both printed module sizes are within their limits (core: 180,000 and 14,000; shop: the design C3 table)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE` (expect 0, two PASS lines); `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1); `pnpm validate activities/fixtures/broken-shop-over-budget.json; $LASTEXITCODE` (expect 1); `pnpm validate; $LASTEXITCODE` (expect 2)
    - Verify: `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`
    - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
    - Verify: `git diff --exit-code -- .kiro/hooks; $LASTEXITCODE`; pass on exit code 0, or, when the user approved the D53 change in task 20.1, when the diff shows only the `timeout` field of `post-task-check.json`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `git ls-files packages/*/generated apps/*/generated apps/shop-challenge/dist design-refs .vercel; $LASTEXITCODE`; pass when it lists no file, and `git status --porcelain -- .kiro/settings` prints nothing
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 3.5, 3.9, 4.5, 13.2, 14.6, 17.7, 17.8, 19.5, 19.8, 20.6_

- [~] 21. Checkpoint - Ensure all tests pass, then ask before committing the app (before the deploy)
  - Ensure all tests pass, ask the user if questions arise.
  - Show the user `git status --porcelain --untracked-files=all; git diff --stat` and ask: whether to commit; whether the work goes in one commit or several; which of the listed files to include
  - On approval, stage each approved file by explicit path with `git add -- <path> ...`. `package.json`, `apps/shop-challenge/package.json`, `tools/validate/package.json` and `pnpm-lock.yaml` go in the same commit (Requirement 3.9). When the user approved the D53 change in task 20.1, ask whether to include `.kiro/hooks/post-task-check.json`. Never stage `packages/*/generated/`, `apps/*/generated/`, `apps/shop-challenge/dist/`, `design-refs/` or the five untracked files named in the conventions
  - Commit with `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "<message the user approves>"; $LASTEXITCODE`; no `--no-verify`, no `--amend`, no co-author trailer
  - **Stop condition:** if the pre-commit `pnpm check` fails, report the command, output and exit code, and create no commit until the user decides (Requirement 2.5)
  - Tell the user that Vercel imports the repository from GitHub, so the deploy in task 22 needs this commit on GitHub; report `git rev-list --count origin/main..HEAD; $LASTEXITCODE`, and push only if the user asks (Requirement 2.7)
  - Verify: `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when the author is the Commit_Identity and the file list holds only approved paths, with `package.json`, `apps/shop-challenge/package.json`, `tools/validate/package.json` and `pnpm-lock.yaml` together
  - Verify: `git ls-files packages/*/generated apps/*/generated design-refs`; pass on no output
  - _Requirements: 2.2, 2.3, 2.5, 2.6, 2.7, 3.9_

- [ ] 22. Deploy URL #1 (manual steps with the user)
  - [~] 22.1 Give the user the Vercel deploy steps
    - Design: C14 "Deploy steps for the user", D52 (accepted 2026-11-20: no environment variable)
    - Give the user the five steps of design C14 and state that the user performs them with the user's own Vercel account (Requirement 16.1). Write no Vercel token, project ID, organisation ID or other account data to any file (Requirement 16.2)
    - Ask the user to send the pnpm version line of the first build log and the Deploy_URL
    - **Stop condition (D52):** if the first build fails on the pnpm version, report the build-log error and ask the user whether to set the project variable `ENABLE_EXPERIMENTAL_COREPACK=1` (not a secret; an exception to Requirement 15.5). The user makes the change in Vercel; change no Vercel setting and no file for it
    - Verify: `git rev-list --count origin/main..HEAD; $LASTEXITCODE`; pass when it prints `0` (the deployed commit is on GitHub)
    - Verify: `git ls-files .vercel apps/shop-challenge/.vercel; git check-ignore apps/shop-challenge/.vercel; $LASTEXITCODE`; pass when `ls-files` lists nothing and `check-ignore` prints the path with exit code 0
    - _Requirements: 15.5, 15.6, 16.1, 16.2_
  - [~] 22.2 Check the deployed routes and headers
    - Design: C14 "Deploy checks"
    - For `/` and `/play/demo/shop-gift-bundle` at the Deploy_URL, run the PowerShell 5.1 `Invoke-WebRequest` command of design C14 and report each status code and whether each of the four headers equals the design C14 value (Requirement 16.3)
    - **Stop condition:** if a status is not 200 or a header differs, report the URL, the status and the differing header, and change no Vercel setting (Requirement 16.4)
    - Verify: both requests print status `200` and the four expected header values
    - _Requirements: 16.3, 16.4_
  - [~] 22.3 Record the Deploy_URL in the app README
    - Design: C14
    - Edit `apps/shop-challenge/README.md`: add the Deploy_URL and the note "No login needed" (Requirement 16.5)
    - Verify: `Select-String -Path apps/shop-challenge/README.md -SimpleMatch -Pattern 'No login needed'`; pass when it prints one line
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 16.5_
  - [~] 22.4 Ask the user for the Android check (manual step)
    - Design: C14, "Manual steps for the user"
    - Ask the user to open the Deploy_URL on an Android phone, play the Demo_Manifest to its result and open the confirm step of each Contact_Link (WhatsApp and Telegram), and record the reported result in the task report (Requirement 16.6)
    - Also ask the user for a keyboard and screen-reader pass and to check the license in the GitHub About panel (D42); record each answer, or that the user deferred it
    - Verify: `try { (Invoke-WebRequest -Uri "<Deploy_URL>/" -UseBasicParsing -MaximumRedirection 0).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }`; pass when it prints `200`
    - _Requirements: 16.6_

- [ ] 23. Boundary rules and lint check (`tools/lint`)
  - [~] 23.1 Create `tools/lint` and install the lint tools
    - Design: C15 "Package", "Dependencies", D38, D50, D51 (accepted 2026-11-20: ESLint 9.39.5, and `typescript` 6.0.3 in `tools/lint` for the linters only)
    - Create `tools/lint/package.json` with the exact content of design C15 and `tools/lint/tsconfig.json` (extends `../../tsconfig.base.json`, `"strict": true`, `"types": ["node"]`, includes `src/**/*.ts` and `test/**/*.ts`)
    - Edit `pnpm-workspace.yaml`: add the `packageExtensions` entry of design C15; change nothing else
    - Add no `prettier` (Requirement 18.1). Do not commit here: the `package.json` files, `pnpm-workspace.yaml` and `pnpm-lock.yaml` go into one commit in task 26 (Requirement 3.9)
    - **Stop condition:** if pnpm blocks a package by its minimum release age, or reports a missing peer that is not in design "Dependencies", stop and ask the user
    - Verify: `pnpm install; $LASTEXITCODE`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `Select-String -Path pnpm-lock.yaml -SimpleMatch -Pattern 'dependency-cruiser@18', 'eslint@9', 'typescript@6.0.3', 'typescript-eslint@8', 'eslint-plugin-react@7', 'eslint-plugin-jsx-a11y@6'`; pass when each pattern appears
    - Verify (D51): `pnpm --filter @dreame/lint exec depcruise --info; $LASTEXITCODE`; pass when it lists `typescript` as available at 6.0.3. **Stop condition:** if it does not, report the output and stop; without it `.ts` files are not parsed and the Boundary_Rules would pass without checking
    - Verify: `pnpm exec tsc --version; $LASTEXITCODE`; pass when the root `tsc` still prints 7.0.2
    - _Requirements: 3.7, 3.8, 3.9, 18.1_
  - [~] 23.2 Write the Boundary_Rules and the `depcruise` script
    - Design: C15 "Boundary_Rules", "depcruise CLI"
    - Create `tools/lint/src/depcruise-rules.ts` (`BOUNDARY_RULES` with the four rules of the design C15 table, all `severity: 'error'`, and `cruiseOptions(root)`) and `tools/lint/src/depcruise-cli.ts`
    - Edit the root `package.json`: add the script `depcruise` of design C15; do not change `check` yet
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm -s depcruise; $LASTEXITCODE`; pass on exit code 0. If it reports violations, record each file and rule in the task report and continue with task 23.3
    - _Requirements: 18.3, 18.4, 18.5_
  - [~] 23.3 Fix any boundary violations in existing files
    - Design: C15, design "Notes for the tasks run" item 18
    - When task 23.2 reported no violation, record "no violations" and change no file
    - Otherwise report each violation to the user, then fix one named file at a time, re-running `pnpm -s depcruise; $LASTEXITCODE` after each fix. **Stop condition:** if a fix needs a change to a rule, to more than one file, or to a file in `packages/runtime` that alters behaviour, stop and ask the user
    - Verify: `pnpm -s depcruise; $LASTEXITCODE`
    - _Requirements: 18.3, 18.4, 18.5_
  - [~] 23.4 Write the ESLint config and the `lint` script
    - Design: C15 "ESLint config", "ESLint CLI"
    - Create `tools/lint/src/eslint-config.ts` (`LINT_IGNORES`, `eslintConfig()` and `asErrors` as in design C15), `tools/lint/src/eslint-cli.ts` and `tools/lint/src/untyped-modules.d.ts` (declares `eslint-plugin-jsx-a11y`, and `eslint-plugin-react` only if `tsc` reports it has no types; no `@types/*` package)
    - Edit the root `package.json`: add the script `lint` of design C15; do not change `check` yet
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm -s lint; $LASTEXITCODE`; pass on exit code 0. If it reports findings, record each file and rule in the task report and continue with task 23.5
    - _Requirements: 18.6, 18.7_
  - [~] 23.5 Fix any lint findings in existing files
    - Design: C15, design "Notes for the tasks run" item 18
    - When task 23.4 reported no finding, record "no findings" and change no file
    - Otherwise report each finding to the user, then fix one named file at a time, re-running `pnpm -s lint; $LASTEXITCODE` and that file's tests after each fix. **Stop condition:** if a fix needs a rule to be turned off or lowered, an inline disable comment, or a change to more than one file, stop and ask the user
    - Verify: `pnpm -s lint; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/ui/ apps/shop-challenge/test/a11y.test.tsx; $LASTEXITCODE`
    - _Requirements: 18.6, 18.7_
  - [~] 23.6 Write the lint and boundary rule test
    - Design: C15 "Rule test"
    - Create `tools/lint/test/lint-rules.test.ts` (node): ESLint `lintText` on an in-memory sample built from string fragments that uses the React raw-HTML prop reports `react/no-danger` at severity 2; `<img src="x.png" />` reports `jsx-a11y/alt-text`; a clean sample reports nothing; dependency-cruiser on `packages/runtime/src/sample.ts` with an import of `react`, written into a `mkdtempSync(join(tmpdir(), 'dreame-depcruise-'))` folder and removed with `rmSync` in `afterAll`, reports one `runtime-no-ui-or-apps` violation. No violating file is written under `apps/`, `packages/` or `tools/`
    - Check that the root `vitest.config.ts` `node` project already includes `tools/*/test/**/*.test.ts`
    - Verify: `pnpm exec vitest run tools/lint/test/lint-rules.test.ts; $LASTEXITCODE`
    - Verify: `git status --porcelain --untracked-files=all -- apps packages tools | Select-String -SimpleMatch -Pattern 'sample'`; pass on no output
    - _Requirements: 18.9_
  - [~] 23.7 Run the Boundary_Rules and the Lint_Check in `pnpm check`
    - Design: C15 "Root scripts"
    - Edit the root `package.json`: `check` becomes the exact string of design C15 ("`pnpm codegen && tsc -p tsconfig.json && pnpm -s depcruise && pnpm -s lint && vitest run && node --experimental-strip-types tools/validate/src/cli.ts activities/*.json`")
    - Verify: `Select-String -Path package.json -SimpleMatch -Pattern 'pnpm -s depcruise && pnpm -s lint && vitest run'`; pass when it prints one line
    - Verify: `pnpm -s depcruise; $LASTEXITCODE`
    - Verify: `pnpm -s lint; $LASTEXITCODE`
    - _Requirements: 18.8_

- [ ] 24. CI build step
  - [~] 24.1 Add the app build step to `ci.yml`
    - Design: C2 "Root changes", D39
    - Edit `.github/workflows/ci.yml`: add one line `      - run: pnpm --filter @dreame/shop-challenge build` after `      - run: pnpm check`; change nothing else and keep `node-version: 22`
    - Verify: `git diff --numstat -- .github/workflows/ci.yml; $LASTEXITCODE`; pass when it prints `1` added and `0` deleted lines for the file
    - Verify: `Select-String -Path .github/workflows/ci.yml -SimpleMatch -Pattern 'node-version: 22', 'run: pnpm check', 'run: pnpm --filter @dreame/shop-challenge build'`; pass when it prints three lines, in that order
    - _Requirements: 18.10_

- [ ] 25. Timing and full-pipeline checks after the lint work
  - [~] 25.1 Measure `pnpm -s check` against 240 s with the lint tools in `check`
    - Design: C15 "Timing", D53 (accepted 2026-11-20)
    - Ask the user to close other heavy processes first (HANDOFF §4)
    - Run `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s check; $LASTEXITCODE; $sw.Elapsed.TotalSeconds` and record the exit code and wall time in the task report, next to the task 20.1 time (Requirement 18.11)
    - **Stop condition (D53):** if the time exceeds 240 s, report it to the user and ask. Raise the Post_Task_Hook timeout to 600 s in `.kiro/hooks/post-task-check.json` (one field, an exception to Requirement 19.8) only after the user approves, unless the user already approved it in task 20.1; narrow nothing in `check` without the user's answer (Requirement 18.12)
    - Verify: the measured run prints exit code 0
    - _Requirements: 18.11, 18.12_
  - [~] 25.2 Run the full pipeline checks after the lint work
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when both printed module sizes are within their limits (core: 180,000 and 14,000; shop: the design C3 table)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE` (expect 0, two PASS lines); `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1); `pnpm validate activities/fixtures/broken-shop-over-budget.json; $LASTEXITCODE` (expect 1); `pnpm validate; $LASTEXITCODE` (expect 2)
    - Verify: `pnpm -s depcruise; $LASTEXITCODE`; `pnpm -s lint; $LASTEXITCODE`
    - Verify: `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`
    - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
    - Verify: `git diff --exit-code -- .kiro/hooks; $LASTEXITCODE`; pass on exit code 0, or, when the user approved the D53 change in task 20.1 or 25.1 and it is not committed yet, when the diff shows only the `timeout` field of `post-task-check.json`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `git ls-files packages/*/generated apps/*/generated apps/shop-challenge/dist design-refs .vercel; $LASTEXITCODE`; pass when it lists no file, and `git status --porcelain -- .kiro/settings` prints nothing
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 3.5, 3.9, 4.5, 13.2, 14.6, 17.7, 17.8, 18.8, 19.5, 19.8, 20.6_

- [~] 26. Final checkpoint - Ensure all tests pass, then ask before committing
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
  - Show the user `git status --porcelain --untracked-files=all; git diff --stat` and ask whether to commit the lint work (task 23), the `ci.yml` step (task 24), the README change (task 22.3), any approved D53 change not yet committed, and the task status files, and which paths to include
  - On approval, stage each approved file by explicit path and commit with the Commit_Identity as in task 21; no `--no-verify`, no `--amend`, no co-author trailer. `package.json`, `tools/lint/package.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml` go in the same commit (Requirement 3.9). **Stop condition:** if the pre-commit `pnpm check` fails, report it and create no commit until the user decides
  - Tell the user that a push of this commit starts a new Vercel build of `main`; report `git rev-list --count origin/main..HEAD; $LASTEXITCODE` and push only if the user asks
  - Verify: `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when the author is the Commit_Identity and the file list holds only approved paths, with `package.json`, `tools/lint/package.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml` together
  - Verify: `git diff --exit-code -- .kiro/hooks .github/workflows/ci.yml; $LASTEXITCODE`; pass on exit code 0 (no uncommitted change to the hook files or `ci.yml` after this commit)
  - _Requirements: 2.2, 2.3, 2.5, 2.6, 2.7, 3.9, 16.5, 18.10_

## Notes

- No task is optional. Each of design Properties 1–14 is its own required task: Property 1 (7.3), 2 (7.4), 3 (8.5), 4 (7.6), 5 (8.4), 6 (10.1), 7 (10.2), 8 (10.3), 9 (13.4), 10 (14.3), 11 (19.2), 12 (13.3), 13 (5.4), 14 (14.5). Each sits right after the task that writes the code it tests.
- Order changes against design "Notes for the tasks run", made so that each property follows its code: Property 13 (5.4) follows `format.ts` (5.3) instead of the view; Property 9 (13.4) follows `CollectionSelectNodeView` (13.1) instead of `RecommendOutcomeNodeView`; `collectionSelect.ts` is saved twice (7.1 run-time hooks, 7.5 graph checks), so Properties 1 and 2 run before the graph checks and the second save gives the "already wired" reply that Requirement 19.7 asks for. The contact channels (8.1) come before `recommendOutcome.ts` (8.2) instead of right before the view, so `contact-channels.test.ts` passes before any file that reads the channels exists.
- The deploy (tasks 20–22) runs before the `tools/lint` work (task 23) on purpose (user decision 2026-11-20): the live URL is a MUST item, and the lint work (D51, the second TypeScript 6.0.3 copy) is the riskiest part. This changes design "Notes for the tasks run" items 18–22. The timing and full-pipeline checks run twice: before the deploy (task 20) and after the lint work (task 25); the D53 stop condition over 240 s applies to both.
- Task 1 is first because Requirement 1.1 says so. Tasks 1.2, 21 and 26 wait for the user before any commit; nothing is pushed unless the user asks.
- The App_Wiring_Files W5–W7 (tasks 4.1–4.3) exist before the first Own_File (task 7.1), so the Wiring_Hook finds them (Requirement 19.1). The validate CLI knows the `shop-challenge` profile (task 6.1) before any `activities/shop-*.json` is written (task 15.2), so the Activity_Hook can check it. The files in `src/contact/` (task 8.1) are not node type or view files, so the Wiring_Hook does not fire on them.
- The demo uses US dollars (D33): the draft of design C16 has 8 Items and a budget of 50, the play test total is 16 (`chocolate` 12 + `card` 4), and the Shop_Fixture has a budget of 10 with Items priced 15 and 20. The two Contact_Link URLs `https://wa.me/12125550142` and `https://t.me/dreame_demo_shop` are placeholders that the user keeps or replaces in task 15.1, before the deploy.
- The first dependency install (task 3.1) leaves `package.json`, `apps/shop-challenge/package.json`, `tools/validate/package.json` and `pnpm-lock.yaml` uncommitted until task 21, which commits them together. The lint install (task 23.1) leaves `package.json`, `tools/lint/package.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml` uncommitted until task 26, which commits them together (Requirement 3.9).
- Task 18 runs the app build, the first point at which `scripts/check-dist.ts` can pass; design "Verification commands" keeps the app build and the full check in checkpoint tasks.
- Task 21 commits before the deploy because Vercel builds from GitHub. Task 26 is the final checkpoint for the lint work, the `ci.yml` step and the README change of task 22.3; a push of that commit starts a new Vercel build.
- Manual steps for the user: screenshot file names (1.1), commit approvals (1.2, 21, 26), the dependency list (3.1), the demo product draft and the keep-or-replace decision for the two placeholder Contact_Link URLs (15.1), the timing decision if over 240 s (20.1 and 25.1, D53), the push before the deploy (21), the Vercel project, its first deploy and the Corepack fallback decision (22.1, D52), the Android, keyboard, screen-reader and GitHub About checks (22.4), and any push after the final commit (26).
- Tasks that write the same file sit in different waves: `bundle-rules.ts` and `bundle-rules.test.ts` (5.1–5.3), `collectionSelect.ts` (7.1, 7.5), `collectionSelect.test.ts` (7.2, 7.5), `collectionSelect.property.test.ts` (7.3, 7.4, 8.5), `shop-arbitraries.ts` (7.3, 7.6, 8.4, 10.1, 14.3), `recommendOutcome.property.test.ts` (8.4), `profile.test.ts` (4.2, 9.2), `EXTENDING.md` and `registry.ts` through the Wiring_Hook (7.1, 8.2, 13.1, 14.1), the root `package.json` (4.1, 23.2, 23.4, 23.7), `apps/shop-challenge/README.md` (22.3), `.kiro/hooks/post-task-check.json` when the user approves the D53 change (20.1, 25.1), and `tools/validate/test/repo-text.test.ts` (17.4) with the runs that read it.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["4.2"] },
    { "id": 9, "tasks": ["4.3", "4.4"] },
    { "id": 10, "tasks": ["5.1", "6.1"] },
    { "id": 11, "tasks": ["5.2"] },
    { "id": 12, "tasks": ["5.3"] },
    { "id": 13, "tasks": ["5.4"] },
    { "id": 14, "tasks": ["7.1"] },
    { "id": 15, "tasks": ["7.2"] },
    { "id": 16, "tasks": ["7.3"] },
    { "id": 17, "tasks": ["7.4"] },
    { "id": 18, "tasks": ["7.5"] },
    { "id": 19, "tasks": ["7.6", "8.1"] },
    { "id": 20, "tasks": ["8.2"] },
    { "id": 21, "tasks": ["8.3"] },
    { "id": 22, "tasks": ["8.4"] },
    { "id": 23, "tasks": ["8.5", "9.1"] },
    { "id": 24, "tasks": ["9.2", "10.1"] },
    { "id": 25, "tasks": ["10.2", "10.3"] },
    { "id": 26, "tasks": ["12.1"] },
    { "id": 27, "tasks": ["12.2"] },
    { "id": 28, "tasks": ["12.3"] },
    { "id": 29, "tasks": ["12.4"] },
    { "id": 30, "tasks": ["13.1"] },
    { "id": 31, "tasks": ["13.2"] },
    { "id": 32, "tasks": ["13.3", "13.4"] },
    { "id": 33, "tasks": ["14.1"] },
    { "id": 34, "tasks": ["14.2", "14.4"] },
    { "id": 35, "tasks": ["14.3", "14.5"] },
    { "id": 36, "tasks": ["15.1"] },
    { "id": 37, "tasks": ["15.2"] },
    { "id": 38, "tasks": ["15.3", "15.4"] },
    { "id": 39, "tasks": ["16.1"] },
    { "id": 40, "tasks": ["16.2"] },
    { "id": 41, "tasks": ["16.3"] },
    { "id": 42, "tasks": ["16.4", "16.5"] },
    { "id": 43, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 44, "tasks": ["19.1"] },
    { "id": 45, "tasks": ["19.2"] },
    { "id": 46, "tasks": ["20.1"] },
    { "id": 47, "tasks": ["20.2"] },
    { "id": 48, "tasks": ["22.1"] },
    { "id": 49, "tasks": ["22.2"] },
    { "id": 50, "tasks": ["22.3"] },
    { "id": 51, "tasks": ["22.4"] },
    { "id": 52, "tasks": ["23.1"] },
    { "id": 53, "tasks": ["23.2"] },
    { "id": 54, "tasks": ["23.3"] },
    { "id": 55, "tasks": ["23.4"] },
    { "id": 56, "tasks": ["23.5"] },
    { "id": 57, "tasks": ["23.6"] },
    { "id": 58, "tasks": ["23.7"] },
    { "id": 59, "tasks": ["24.1"] },
    { "id": 60, "tasks": ["25.1"] },
    { "id": 61, "tasks": ["25.2"] }
  ]
}
```
