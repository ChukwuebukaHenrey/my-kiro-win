# Implementation Plan: Practice Path (DREAME Days 8 and 9)

## Overview

Tasks follow the build order in design.md "Testing Strategy" → "Notes for the tasks run". The order is: the KIRO_LOG Day 6–7 entries and their commit first (Requirement 1.1); the two package manifests and one workspace install; the App_Wiring_Files W5–W7, the Practice_Codegen and the `extending-doc.test.ts` change; the validate CLI profile entry; the practice rules and node state readers; the `recall`, `reviewQueue` and `masterySummary` node types with the Tutor_Share_Link builder and Properties 1–7; the validator size test; the three practice profile properties and a timing check; a checkpoint; `@dreame/storage` and the Progress_Model with Properties 11–16; `onFinish` in `ActivityPlayer`; the three views with Properties 17–19 and a second timing check; the Demo_Lesson and the Practice_Fixture; the app shell, routes and views; the scans, Boundary_Rules, `PRIVACY.md` and the built output check; a checkpoint with both app builds; `vercel.json` and Property 20; the `ci.yml` build step; the third timing check and the full-pipeline checks; a checkpoint that asks before the commit for the deploy; the deploy steps for URL #2; and a final checkpoint. File names, interfaces and exact file contents come from design.md; each task names its files, its design section and how to verify it. All code is TypeScript under `strict`.

### Task conventions

These conventions apply to every task (Requirement 24).

- Write files with the editor tool, as UTF-8 without BOM and with LF line endings (Requirement 24.7). Write no file under `.kiro/settings/`, run no `Remove-Item`, and start no `npm` or `yarn` command; when a task needs a deletion or a settings change, stop and ask the user to do it by hand (Requirement 24.5). Edit no file under `packages/*/generated/` or `apps/*/generated/` by hand (Requirement 24.6).
- Every command must work in Windows PowerShell 5.1: separate commands with `;`, check exit codes with `; $LASTEXITCODE`, and never use `&&` or `||` (`&&` appears only inside `package.json` script values) (Requirement 24.2). A Verify step passes only when every listed command prints the expected exit code (0 unless the step says otherwise) and meets the stated condition (Requirement 24.1).
- Run Vitest only as `pnpm exec vitest run <path>`, never in watch mode. App tests import generated validators, so a Verify step that runs them starts with `pnpm codegen;`. Every command must finish within 180,000 ms, except a full `pnpm check` (including the timing runs and a commit whose pre-commit hook runs `pnpm check`), which gets 600,000 ms; if a command takes longer, stop and report the command and its time to the user (Requirement 24.3).
- Each task ends with its Verify step, which runs a test or a checked command (Requirement 24.10). Each sub-task creates or changes one or two files where it can, so one sub-agent run finishes it (Requirement 24.4). Each of design Properties 1–20 is its own required sub-task, placed right after the sub-task that writes the code it tests; no task is optional (Requirement 24.11).
- Property tests use fast-check with `numRuns` of at least 100 and carry the tag `Feature: practice-path, Property N: <title>` in the `describe` or `it` title, with the comment `**Validates: Requirements …**`; comments and titles describe results as evidence for the properties tested (Requirements 10.4, 24.8). When a property fails, fix the code, then copy the printed seed and shrunk counterexample into the same file as an example test. If a property run takes longer than 180,000 ms, shrink the generated sizes (never `numRuns` below 100) and report it.
- Relative imports use explicit `.ts` or `.tsx` extensions; use only erasable syntax (no `enum`, `namespace` or constructor parameter properties) (Requirement 3.11).
- Add no dependency. The design adds no external package (Resolved question 16); if one seems needed, stop and ask the user (Requirement 3.8).
- Never stage files under `packages/*/generated/`, `apps/*/generated/`, `apps/*/dist/` or `design-refs/`, nor `.vercel`, nor the five untracked files `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` and `docs/ui-illustration-builder.txt`. Never use `git add -A`, `git add .`, `--no-verify`, `--amend` or a co-author trailer (Requirements 2.3, 2.6). Commit only with the user's approval and only as `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "<message>"; $LASTEXITCODE`. Push only when the user asks, after reporting `git rev-list --count origin/main..HEAD; $LASTEXITCODE` (Requirement 2.7).
- Use no phrase from the "Do not use" line of `.kiro/steering/product.md` in any file (Requirement 24.9). Claims about the toolkit use only the Brief §0 and §0a wording quoted there (Requirement 18.17).
- Leave the four files in `.kiro/hooks/` unchanged (Requirement 23.8). If a hook change seems needed, stop and ask the user.
- Kiro hooks already run on agent edits: the Activity_Hook (H1, 30 s) on `activities/**/*.json`; the Regression_Hook (H2, `pnpm -s test:shared`, 180 s) on `.ts` saves in `packages/runtime`, `packages/schema` and `packages/node-types`, which in this spec are only tasks 20.3 and 20.4 (write each of those files in one save); and the Wiring_Hook (H3) on `apps/practice-path/src/node-types/<type>.ts` and `apps/practice-path/src/views/<Type>NodeView.tsx`. The Post_Task_Hook (H4) runs `pnpm -s check` after every task, with a 600 s timeout (Requirement 24.12). Read its result and fix any failure in the same session. If the Post_Task_Hook times out outside the timing tasks 10.4, 17.5 and 24.1, stop and ask the user.
- Tasks run one at a time, in order. Checkpoint tasks are not in the task dependency graph; run each checkpoint by hand (Requirement 24.16).
- Model switching: before dispatching, apply `.kiro/steering/model-switching.md` — stop and ask the user to switch to a named cheaper model for tasks that fit it, and have the cheaper model ask to switch back when they are done. See the model-fit table in `docs/HANDOFF.md` §6.

## Tasks

- [x] 1. KIRO_LOG Day 6–7 entries and their commit (first task, Requirement 1.1)
  - [x] 1.1 Write the Day 6–7 entries in `KIRO_LOG.md`
    - Design: C1
    - Before writing, tell the user that you cannot take screenshots and ask for the file names of any Day 6 or Day 7 screenshots saved in `docs/kiro-evidence/`; run `Test-Path` on each named file and reference only files that exist, by Workspace-relative path inside a field line (Requirements 1.8, 1.9)
    - Read the facts at run time, not from the design table: `docs/HANDOFF.md`, `.kiro/specs/shop-challenge/design.md` ("Decisions for the user" and "Testing Strategy"), the count of tasks marked done in `.kiro/specs/shop-challenge/tasks.md` (`(Select-String -Path .kiro/specs/shop-challenge/tasks.md -Pattern '^\s*- \[x\]').Count`), the shop final checkpoint results that a Fact_Source records, the Shop_Deploy_URL in `apps/shop-challenge/README.md`, and `git log -1 --format=%ad --date=short 02117a2; $LASTEXITCODE` for the date in every new heading (Requirements 1.4, 1.5). Where `docs/HANDOFF.md` and the Workspace disagree, use the Workspace (`git log`, `tasks.md`)
    - Append one entry per row of the design C1 table whose event a Fact_Source records, after the last existing entry (`## 2026-11-21 — Rejection focus and CI enforcement deferred`): a `## <date> — <title>` heading, then `Spec:`, `Kiro did:`, `Caught by:`, `Fix:`, `Kiro features:`, one line each. The Spec_Done_Entry names `shop-challenge`, the done count, the Shop_Deploy_URL and the path `.kiro/specs/shop-challenge/design.md`, and its `Caught by:` field lists each final check with its command and exit code. Leave the bracketed Fact_Source notes out of the log. Change no existing line (Requirements 1.2, 1.3, 1.5, 1.6, 1.7)
    - No entry holds a commit hash, a commit message, a statement about a commit or a push (words such as "pre-commit" included), or a list of created files (Requirement 1.10)
    - Verify (template, run as one line; pass when it prints the number of new entries N (6 when every C1 event has a Fact_Source), then 5 × N, then nothing else): `$new = Get-Content -Encoding UTF8 KIRO_LOG.md | Select-Object -Skip ((Select-String -Path KIRO_LOG.md -Pattern '^## \d{4}-\d{2}-\d{2} ')[10].LineNumber - 1); ($new | Select-String -Pattern '^## \d{4}-\d{2}-\d{2} ').Count; ($new | Select-String -Pattern '^(Spec|Kiro did|Caught by|Fix|Kiro features): ').Count; $new | Where-Object { $_ -ne '' -and $_ -notmatch '^## \d{4}-\d{2}-\d{2} ' -and $_ -notmatch '^(Spec|Kiro did|Caught by|Fix|Kiro features): ' }`
    - Verify (existing lines unchanged): `git diff --numstat -- KIRO_LOG.md; $LASTEXITCODE`; pass when the deleted-lines column is `0` and the exit code is 0
    - Verify (no hash, commit wording, file list or secret; run as one line; pass on no output): `$new = Get-Content -Encoding UTF8 KIRO_LOG.md | Select-Object -Skip ((Select-String -Path KIRO_LOG.md -Pattern '^## \d{4}-\d{2}-\d{2} ')[10].LineNumber - 1); $new | Select-String -CaseSensitive -Pattern '\b[0-9a-f]{7,40}\b'; $new | Select-String -Pattern '\b(commit|commits|committed|push|pushed|pushes)\b', 'Files created', '(api[_-]?key|token|password|secret)\s*[:=]'`
    - Verify (banned phrases; pass when it prints `8` and nothing else): `$l = (Select-String -Path .kiro/steering/product.md -Pattern '^- Do not use "' | Select-Object -First 1).Line; $ph = [regex]::Matches($l, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }; $ph.Count; Select-String -Path KIRO_LOG.md -SimpleMatch -Pattern $ph`
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  - [x] 1.2 Ask the user, then commit the log, the leftover status files and this spec
    - Design: C1 "Commit"
    - Show the user the output of `git status --porcelain; git diff --stat` and ask whether to commit, in one commit, `KIRO_LOG.md`, the Leftover_Status_Files `.kiro/specs/shop-challenge/tasks.md` and `.kiro/specs/shop-challenge/tasks.meta.json`, and the files of `.kiro/specs/practice-path/` (`.config.kiro`, `requirements.md`, `design.md`, `tasks.md`, and `tasks.meta.json` when it exists), and `.kiro/steering/model-switching.md`. Recommend yes for the spec folder, because `repo-text.test.ts` scans `.kiro/specs/practice-path/*.md` from task 20.5 on (Requirement 2.1)
    - If the user approves: `git add -- <each approved path>; $LASTEXITCODE`, then `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "docs: KIRO_LOG Day 6-7 entries, shop-challenge task status and practice-path spec"; $LASTEXITCODE` (or the message the user gives). No `--no-verify`, no `--amend`, no co-author trailer; the pre-commit hook runs `pnpm check` (600,000 ms limit) (Requirements 2.2, 2.3)
    - Stage nothing else (Requirement 2.6)
    - **Stop condition:** if the pre-commit `pnpm check` fails, report the failing command, its output and exit code, and create no commit until the user decides (Requirement 2.5)
    - If the user declines, leave the files unstaged and record the decision in the task report (Requirement 2.4)
    - Before any push request, report the count from `git rev-list --count origin/main..HEAD; $LASTEXITCODE`; push only when the user asks (Requirement 2.7)
    - Verify (approved): `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when it shows the Commit_Identity name and email and exactly the approved paths, then `git status --porcelain -- KIRO_LOG.md .kiro/specs/shop-challenge .kiro/specs/practice-path; $LASTEXITCODE` prints no file
    - Verify (declined): `git diff --cached --name-only; $LASTEXITCODE`; pass on no output
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 2. Package manifests and the workspace install
  - [x] 2.1 Create the Storage_Package and Practice_App manifests, add the validate dependency, and install once
    - Design: C2, C9, "Dependencies"; Resolved questions 15 and 16
    - Create `packages/storage/package.json` and `packages/storage/tsconfig.json` with the exact content of design C9; keep the existing `packages/storage/README.md`
    - Create `apps/practice-path/package.json`, `apps/practice-path/tsconfig.json` and `apps/practice-path/vite.config.ts` with the exact content of design C2; keep the existing `apps/practice-path/README.md`
    - Edit `tools/validate/package.json`: add `"@dreame/practice-path": "workspace:*"` to `dependencies`
    - These files are copied from the design and must all exist before the one `pnpm install` of design build order step 2, so this sub-task holds all of them
    - Before `pnpm install`, show the user the three `package.json` changes and ask the user to confirm that the install adds workspace links only; run nothing until the user answers
    - Add no `react-router-dom`, no `@vitejs/plugin-react` and no other package (shop D49; Requirement 3.8)
    - Do not commit here: the `package.json` files and `pnpm-lock.yaml` go into one commit in task 25 (Requirement 3.10)
    - **Stop condition:** if pnpm adds an external package, blocks a package by its minimum release age, or reports a missing peer, stop and ask the user
    - Verify: `pnpm install; $LASTEXITCODE`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `Select-String -Path pnpm-lock.yaml -SimpleMatch -Pattern 'apps/practice-path:', 'packages/storage:'`; pass when each pattern appears
    - Verify: `git diff -U0 -- pnpm-lock.yaml; $LASTEXITCODE`; pass when every added line belongs to the `importers:` section and the `packages:` and `snapshots:` sections gain no key; report `git diff --stat -- pnpm-lock.yaml` to the user
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8, 3.10, 3.12, 11.1, 18.1, 18.2_

- [x] 3. App wiring files and the Practice_Codegen (before any Own_File, Requirement 23.1)
  - [x] 3.1 Write W5 with the core types, the Practice_Codegen and the root `codegen` script
    - Design: C3, C4 (W5), shop D47
    - Create `apps/practice-path/src/node-types/index.ts` (W5) as the design C4 "Final W5" file without the three app node type imports and `export *` lines: `practiceNodeTypes` is `[...coreNodeTypes]`. Creating it fires the Wiring_Hook, which must reply "no wiring needed"; record the reply in the task report
    - Create `apps/practice-path/scripts/codegen.ts` with the exact content of design C3
    - Edit the root `package.json` script `codegen` to `pnpm --filter @dreame/node-types run codegen && pnpm --filter @dreame/shop-challenge run codegen && pnpm --filter @dreame/practice-path run codegen`; change no other script
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when it prints one `codegen: wrote` line each for `core`, `shop-challenge` and `practice-path`, each with raw and gzip byte counts
    - Verify: `Test-Path apps/practice-path/generated/practice-path.validators.js; Test-Path apps/practice-path/generated/practice-path.validators.d.ts; git status --porcelain -- apps/practice-path/generated`; pass when it prints `True`, `True` and no file
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 23.1_
  - [x] 3.2 Write W6 with the core types and the profile test
    - Design: C4 (W6), C2
    - Create `apps/practice-path/src/profile.ts` (W6) as the design C4 "Final W6" file without the `response_recall`, `response_reviewQueue` and `response_masterySummary` imports and entries
    - Create `apps/practice-path/test/profile.test.ts` (node): `practiceProfile.id` is `practice-path`; the node type names equal `practiceNodeTypes.map((t) => t.type)`, start with the `coreNodeTypes` names in order and hold no repeat; the generated module exports `validateManifest` and one `response_<type>` function per node type in `practiceNodeTypes`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 3.2, 3.3, 3.4, 3.12, 4.2_
  - [x] 3.3 Write W7 with the core views
    - Design: C4 (W7)
    - Create `apps/practice-path/src/views/registry.ts` (W7) as the design C4 "Final W7" file without the three app view imports, their export and their `practiceViews` entries
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `Test-Path apps/practice-path/src/node-types/index.ts; Test-Path apps/practice-path/src/profile.ts; Test-Path apps/practice-path/src/views/registry.ts`; pass when all three print `True`
    - _Requirements: 23.1, 23.3_
  - [x] 3.4 Update the EXTENDING.md test for the second app
    - Design: C4 "`tools/validate/test/extending-doc.test.ts`"
    - Edit `tools/validate/test/extending-doc.test.ts`: import `practiceNodeTypes` from `@dreame/practice-path/node-types` next to `shopNodeTypes`; `APPS` lists `shop-challenge` and then `practice-path`, each with its non-core node types in profile order; the expected `###` headings are the core types, then the shop app types, then the practice app types; `appViewPath(app, type)` returns `apps/<app>/src/views/<Type>NodeView.tsx`, and the `View` line names that path when the file exists and reads `- View: not written yet` when it does not; every listed path must exist
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `git diff --exit-code -- EXTENDING.md; $LASTEXITCODE`
    - _Requirements: 23.4, 23.5_

- [x] 4. Validate CLI profile entry (before any `activities/practice-*.json`)
  - [x] 4.1 Add the `practice-path` profile to the validate CLI
    - Design: C18 "`tools/validate/src/run.ts`"; Resolved question 15
    - Edit `tools/validate/src/run.ts`: import `practiceProfile` from `@dreame/practice-path/profile` and add `'practice-path': practiceProfile` to `PROFILES` after `'shop-challenge'`
    - Edit `tools/validate/test/run.test.ts`: add one case in the `fakeIo` form where `validManifest()` with `profile` set to `practice-path` prints PASS and exits 0; the existing `toContain('one of: core')` check stays
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE`; pass when it prints two PASS lines and exit code 0
    - Verify: `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1)
    - _Requirements: 22.7_

- [x] 5. Practice rules and node state readers
  - [x] 5.1 Write the node state schemas and readers
    - Design: C5 "`practice-state.ts`", "Data Models" → "Node state", D70
    - Create `apps/practice-path/src/node-types/practice-state.ts` with the TypeBox schemas and static types of design "Data Models" → "Node state" and the readers `readRecallNodeState`, `readReviewQueueState` and `readMasteryResult`: hand-written checks that read own properties only, check every field the schema names, reject extra keys, and return `null` for a value of the wrong shape. The hyphenated name does not match the Wiring_Hook matcher
    - Create `apps/practice-path/test/practice-rules.test.ts` (node) with the reader cases: each reader accepts a well-formed value with and without its optional fields, and returns `null` for `undefined`, a non-object, an array, a missing field, a field of the wrong type, an extra key, and a value that carries `__proto__` as an own key
    - Verify: `pnpm exec vitest run apps/practice-path/test/practice-rules.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 6.5, 8.1, 8.2, 9.9_
  - [x] 5.2 Write the Try_Rules, Item_Result rule and Queue functions
    - Design: C5 "`practice-rules.ts`"
    - Create `apps/practice-path/src/node-types/practice-rules.ts` with `TryRulesConfig`, `meetsTryRules`, `firstTryResult`, `triesLeft`, `itemResult`, `buildQueue`, `reviewResults` and `summarize` as in design C5 (no React, no clock, no randomness; `reviewResults` uses a `Map` keyed by the first answer per Item_ID)
    - Edit `apps/practice-path/test/practice-rules.test.ts`: `meetsTryRules` accepts and rejects one case per Try_Rule (unknown option, repeated option, more than `maxRetries + 1` Tries, a correct Try before the last, a wrong last Try with Tries left, an empty list); `firstTryResult`; `triesLeft` never below 0; the full `itemResult` table; `buildQueue` keeps order and lists each Item_ID once; `reviewResults` ignores unknown Item_IDs, uses the first answer per Item_ID, gives `incorrect` for a missing answer, and treats the IDs `__proto__` and `toString` as plain IDs; `summarize` keeps `topic` only when set
    - Verify: `pnpm exec vitest run apps/practice-path/test/practice-rules.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 6.2, 6.3, 8.1, 8.7, 8.8, 9.9, 12.4_

- [x] 6. `recall` node type
  - [x] 6.1 Create `recall.ts` with its schemas and run-time hooks
    - Design: C6, D55, D56
    - Create `apps/practice-path/src/node-types/recall.ts`: `RECALL_LIMITS`, `RecallOptionSchema`, `RecallConfigSchema`, `RecallResponseSchema`, their `Static` types, and `recallNodeType` with `type`, `version`, `terminal`, `answerType`, `isValidResponse`, `enter` and `reduce` exactly as in design C6. In this task `validate` runs only step 1 (`ctx.checkText` on `prompt`, each option `label` and `explanation`); task 6.5 adds steps 2–4. Every object schema sets `additionalProperties: false`
    - Creating the file fires the Wiring_Hook: it adds the W5 lines and the W6 `response_recall` lines, writes the `### recall` section of `EXTENDING.md` with `- View: not written yet`, creates `apps/practice-path/test/recall.test.ts` and `apps/practice-path/test/recall.property.test.ts`, and runs `pnpm -s test:shared` (about 100–180 s inside this task). Record the hook reply in the task report (Requirement 23.7)
    - **Stop condition:** if the Wiring_Hook does not fire, reports a missing App_Wiring_File, writes any file other than those listed above, or reports a failing `pnpm -s test:shared`, stop and report it to the user; add no wiring line by hand until the user answers
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when the `practice-path` line prints its byte counts
    - Verify (wiring, pass when it prints `1`, `1`, `1`, `True`, `True`): `(Select-String -Path apps/practice-path/src/node-types/index.ts -SimpleMatch -Pattern "export * from './recall.ts';").Count; (Select-String -Path apps/practice-path/src/profile.ts -SimpleMatch -Pattern 'recall: response_recall,').Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern '### recall').Count; Test-Path apps/practice-path/test/recall.test.ts; Test-Path apps/practice-path/test/recall.property.test.ts`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts apps/practice-path/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 23.1, 23.2, 23.4, 23.6, 23.7_
  - [x] 6.2 Complete the `recall` example tests for schemas and run-time hooks
    - Design: C6, Testing Strategy "Example tests"
    - Edit `apps/practice-path/test/recall.test.ts` (keep the hook's `validate` and `reduce` tests if they pass and follow design C6; replace them if they do not): descriptor fields; `answerType` returns `{ kind: 'enum', values: ['correct', 'incorrect'] }`; schema limits at both sides of each bound of the design C6 "String limits" table and of `RECALL_LIMITS` (1, 2, 5 and 6 options; `maxRetries` -1, 0, 3, 4 and 1.5; 0, 1, 4 and 5 Tries), checked with the precompiled `validateManifest` and `response_recall`; an extra key in the config, an option and the response is rejected; blank `prompt`, option `label` and `explanation` give `conditions/blank-text` at their paths; `enter` with `shuffle: true` stores an `order` that is a permutation of the option IDs and without `shuffle` returns the state unchanged; a `reduce` example stores the First_Try_Result as the answer and the Item_Snapshot of design "Data Models"
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/recall.test.ts; $LASTEXITCODE`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.9, 6.1, 6.4, 6.5, 6.6, 23.6_
  - [x] 6.3 Write the property test for recall response acceptance
    - **Property 1: Recall response acceptance matches the Try_Rules model**
    - Design: Property 1, Testing Strategy "Property test configuration"
    - Create `apps/practice-path/test/practice-arbitraries.ts` with `recallConfigArb` (2–5 options with unique IDs, a `correctOptionId` among them, `maxRetries` 0–3, optional `topic` and `shuffle`), `acceptedTriesArb(cfg)` and `candidateTriesArb(cfg)`
    - Replace the hook's property in `apps/practice-path/test/recall.property.test.ts` with this property and keep the file name: `checkAction` on an attempt at the node accepts a candidate response (Try lists of 0–6 entries drawn from option IDs and unknown IDs, with repeats, a correct Try before the last, too few or too many Tries, non-string entries, extra keys, or random JSON) exactly when a reference model in the test accepts it; a rejection has the code `invalid-response`. The file keeps referencing `recallNodeType`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/recall.property.test.ts; $LASTEXITCODE`
    - _Requirements: 6.1, 6.2, 6.3, 6.8_
  - [x] 6.4 Write the property test for the stored recall state
    - **Property 2: Recall stores the First_Try_Result and an unchanged Item_Snapshot**
    - Design: Property 2
    - Add this property to `apps/practice-path/test/recall.property.test.ts`: for generated configs, seeds and accepted Try lists, `enter` then `reduce` stores the answer `correct` exactly when the first Try equals `correctOptionId` (one of the `answerType` values); the stored state passes `readRecallNodeState`; its Item_Snapshot holds the Tries unchanged, the options in config order, the config `itemId`, `prompt`, `correctOptionId`, `explanation` and `topic`, and the matching `firstTry`; with `shuffle: true` the stored `order` is a permutation of the option IDs equal to the order `enter` stored
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/recall.property.test.ts; $LASTEXITCODE`
    - _Requirements: 5.9, 6.4, 6.5, 6.6, 6.9_
  - [x] 6.5 Add the `recall` graph checks and their example tests
    - Design: C6 "`validate(cfg, ctx)`" steps 2–4, D56, "Error Handling"
    - Edit `apps/practice-path/src/node-types/recall.ts`: add steps 2–4 of design C6 (`duplicate-option-id`, `dangling-ref` on `correctOptionId`, and `duplicate-item-id` found by scanning `ctx.manifest.nodes` before the current index) with the exact messages of design C6. Saving the file fires the Wiring_Hook a second time, which should reply "already wired" and run nothing; record the reply in the task report (Requirement 23.7)
    - Edit `apps/practice-path/test/recall.test.ts`: one manifest per diagnostic (a repeated option ID at `/config/options/1/id`; a `correctOptionId` that names no option at `/config/correctOptionId`; two `recall` nodes with one `itemId`, reported on the later node at `/config/itemId` with a message that names the earlier node), each checked with `validateManifest(manifest, practiceProfile)` for code, stage, path, severity and `nodeId`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/recall.test.ts apps/practice-path/test/recall.property.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.5, 5.6, 5.8, 23.7_

- [x] 7. `reviewQueue` node type
  - [x] 7.1 Create `reviewQueue.ts`
    - Design: C7, D57, D58
    - Create `apps/practice-path/src/node-types/reviewQueue.ts`: `REVIEW_LIMITS`, `ReviewQueueConfigSchema` (with `uniqueItems: true` on `from`), `ReviewAnswerSchema`, `ReviewQueueResponseSchema`, their `Static` types, `reviewQueueState`, and `reviewQueueNodeType` with `type`, `version`, `terminal`, `answerType`, `validate` (`checkText` on `title`, then `dangling-ref`, `type-mismatch` or `answer-not-upstream` per `from` entry at `/config/from/<i>`), `isValidResponse`, `enter` and `reduce` exactly as in design C7. Every object schema sets `additionalProperties: false`
    - Creating the file fires the Wiring_Hook: it adds the W5 and W6 lines, writes the `### reviewQueue` section of `EXTENDING.md` with `- View: not written yet`, creates `apps/practice-path/test/reviewQueue.test.ts` and `apps/practice-path/test/reviewQueue.property.test.ts`, and runs `pnpm -s test:shared`. Record the hook reply in the task report (Requirement 23.7)
    - **Stop condition:** as in task 6.1. Also, if `pnpm codegen` fails because Ajv needs the `equal` helper for `uniqueItems`, stop and ask the user whether to allowlist the helper or move the check into `validate` (D58)
    - Verify: `pnpm codegen; $LASTEXITCODE`
    - Verify (wiring, pass when it prints `1`, `1`, `1`, `True`, `True`): `(Select-String -Path apps/practice-path/src/node-types/index.ts -SimpleMatch -Pattern "export * from './reviewQueue.ts';").Count; (Select-String -Path apps/practice-path/src/profile.ts -SimpleMatch -Pattern 'reviewQueue: response_reviewQueue,').Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern '### reviewQueue').Count; Test-Path apps/practice-path/test/reviewQueue.test.ts; Test-Path apps/practice-path/test/reviewQueue.property.test.ts`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts apps/practice-path/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 23.1, 23.2, 23.4, 23.6, 23.7_
  - [x] 7.2 Complete the `reviewQueue` example tests
    - Design: C7, Testing Strategy "Example tests"
    - Edit `apps/practice-path/test/reviewQueue.test.ts` (keep the hook's tests if they pass and follow design C7): descriptor fields; `answerType` returns `null`; schema limits at both sides of each bound (0, 1, 24 and 25 `from` entries; `title` 120 and 121; `intro` 500 and 501; `emptyText` 300 and 301; 24 and 25 `answers`); the precompiled validator rejects `from: ['q1', 'q1']`; an extra key in the config, an answer and the response is rejected; a `from` entry that is dangling, of type `content`, and not upstream gives `dangling-ref`, `type-mismatch` and `answer-not-upstream` at `/config/from/<i>`; blank `title` gives `conditions/blank-text`; `enter` with no Recall snapshot stores empty `items` and `queue`; `reduce` without `enter` recomputes the Queue; `reduce` ignores answers for unknown Item_IDs; a repeated `itemId` makes `isValidResponse` return `false`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/reviewQueue.test.ts; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.3, 8.4, 8.6, 8.8, 23.6_
  - [x] 7.3 Write the property test for the Queue
    - **Property 4: The Queue holds exactly the first-try misses in `from` order**
    - Design: Property 4
    - Edit `apps/practice-path/test/practice-arbitraries.ts`: add `snapshotArb`, `reviewQueueConfigArb` and `reviewStateArb` (an attempt state in which each `from` node has no state, a damaged state, or an Item_Snapshot with `firstTry` `correct` or `incorrect`)
    - Replace the hook's property in `apps/practice-path/test/reviewQueue.property.test.ts` with this property and keep the file name: for `from` lists of 1–24 node IDs, the state stored by `reviewQueue.enter` has `items` equal to the summaries of the found snapshots in `from` order and `queue` equal to the found snapshots whose `firstTry` is `incorrect`, in `from` order, with no Item_ID twice, and an empty `queue` when no found snapshot is `incorrect`. The file keeps referencing `reviewQueueNodeType`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/reviewQueue.property.test.ts; $LASTEXITCODE`
    - _Requirements: 8.1, 8.2, 8.3, 8.10_
  - [x] 7.4 Write the property test for review responses and results
    - **Property 5: Review responses and Review_Results match the reference model**
    - Design: Property 5
    - Edit `apps/practice-path/test/practice-arbitraries.ts`: add `queueArb` (0–24 Item_Snapshots with unique Item_IDs)
    - Add this property to `apps/practice-path/test/reviewQueue.property.test.ts`: for generated Queues and candidate responses (0–30 answers with Queue Item_IDs, unknown IDs and repeats, correct and wrong option IDs, extra keys, or random JSON), `checkAction` accepts exactly when a reference model accepts; for every accepted response, `reduce` stores one Review_Result per Queue Item in Queue order, `correct` exactly when the response has an answer for that Item_ID whose `optionId` equals the Item's `correctOptionId`, with answers for unknown Item_IDs ignored
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/reviewQueue.property.test.ts; $LASTEXITCODE`
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.11_

- [x] 8. `masterySummary` node type and the Tutor_Share_Link
  - [x] 8.1 Create `masterySummary.ts`
    - Design: C8
    - Create `apps/practice-path/src/node-types/masterySummary.ts`: `TUTOR_SHARE_URL_PATTERN`, `MasterySummaryConfigSchema` (with the optional closed `tutorShare`), `MasterySummaryResponseSchema` (closed empty object), their `Static` types, `masteryResult`, and `masterySummaryNodeType` with `type`, `version`, `terminal: true`, `answerType`, `validate` (`checkText` on `title`, `checkHttpsUrl` on `tutorShare.url` at `/config/tutorShare/url`, and the `from` checks), `isValidResponse` (the `outcome` rule), `enter` and `reduce` (returns `s`) exactly as in design C8. Every object schema sets `additionalProperties: false`
    - Creating the file fires the Wiring_Hook: it adds the W5 and W6 lines, writes the `### masterySummary` section of `EXTENDING.md` with `- View: not written yet`, creates `apps/practice-path/test/masterySummary.test.ts` and `apps/practice-path/test/masterySummary.property.test.ts`, and runs `pnpm -s test:shared`. Record the hook reply in the task report (Requirement 23.7)
    - **Stop condition:** as in task 6.1
    - Verify: `pnpm codegen; $LASTEXITCODE`
    - Verify (wiring, pass when it prints `1`, `1`, `1`, `True`, `True`): `(Select-String -Path apps/practice-path/src/node-types/index.ts -SimpleMatch -Pattern "export * from './masterySummary.ts';").Count; (Select-String -Path apps/practice-path/src/profile.ts -SimpleMatch -Pattern 'masterySummary: response_masterySummary,').Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern '### masterySummary').Count; Test-Path apps/practice-path/test/masterySummary.test.ts; Test-Path apps/practice-path/test/masterySummary.property.test.ts`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts apps/practice-path/test/profile.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 23.1, 23.2, 23.4, 23.6, 23.7_
  - [x] 8.2 Complete the `masterySummary` example tests
    - Design: C8, Testing Strategy "Example tests"
    - Edit `apps/practice-path/test/masterySummary.test.ts` (keep the hook's tests if they pass and follow design C8): descriptor fields; `answerType` returns `null`; the empty response object is accepted and an extra key is rejected; `title` 120 and 121, `body` 2,000 and 2,001, `tutorShare.label` 60 and 61; the `tutorShare.url` pattern with 5, 6, 15 and 16 digits, an `http:` URL and another host; `from` dangling, of type `recall`, and not upstream give `dangling-ref`, `type-mismatch` and `answer-not-upstream` at `/config/from`; blank `title` gives `conditions/blank-text`; `validate` called directly with a test `GraphCtx` that uses the real `checkHttpsUrl` reports `conditions/unsafe-url` at `/config/tutorShare/url` for an `http:` URL (the schema stage rejects that URL first in `validateManifest`); `enter` with a `from` state stores the Mastery_Result of design C8, and without one stores no items, all counts 0 and empty lists
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/masterySummary.test.ts; $LASTEXITCODE`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 23.6_
  - [x] 8.3 Write the property test for the Mastery_Result
    - **Property 6: Mastery_Result follows the Item_Result rule**
    - Design: Property 6
    - Edit `apps/practice-path/test/practice-arbitraries.ts`: add `reviewNodeStateArb` (Review_Queue node states with items of any Topics and `firstTry` values and any subset of Review_Results, or a missing or damaged state)
    - Replace the hook's property in `apps/practice-path/test/masterySummary.property.test.ts` with this property and keep the file name: the Mastery_Result stored by `masterySummary.enter` lists the items in the stored order with `result` equal to the Item_Result rule; its counts sum to the number of items and equal the count of each result; `nextReview` equals the Item_IDs of the `reviewed` and `missed` items in order; `missedTopics` equals the distinct Topics of the `missed` items in first-occurrence order; a missing or damaged state gives empty lists and zero counts. The file keeps referencing `masterySummaryNodeType`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/masterySummary.property.test.ts; $LASTEXITCODE`
    - _Requirements: 9.9, 9.10, 9.12_
  - [x] 8.4 Write the Tutor_Share_Link builder and its example test
    - Design: C8 "Tutor_Share_Link", D59, D60
    - Create `apps/practice-path/src/share.ts` (React-free, pure) with `SHARE_TEXT_MAX`, `SHARE_LINK_MAX`, `wellFormed`, `shareText` and `tutorShareLink` as in design C8. The file is outside `src/node-types/`, so the Wiring_Hook does not fire on it
    - Create `apps/practice-path/test/share.test.ts` (node): the four-line Share_Text; "Topics to review: none" with no Missed_Topics; Topics dropped from the end at the 500 code-unit limit; a lone surrogate in the title becomes U+FFFD and `encodeURIComponent` does not throw; the link starts with the `tutorShare` URL followed by `?text=`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/share.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 9.13, 9.15_
  - [x] 8.5 Write the property test for the Tutor_Share_Link
    - **Property 7: The Tutor_Share_Link is safe and short and round-trips its text**
    - Design: Property 7
    - Edit `apps/practice-path/test/practice-arbitraries.ts`: add `waMeUrlArb` (`https://wa.me/` and 6–15 digits), `titleArb` (at most 120 code units, including markup, non-ASCII text, emoji and lone surrogates) and `masteryResultArb` (0–24 items, Topics of 1–60 code units)
    - Create `apps/practice-path/test/share.property.test.ts` (node): `tutorShareLink` returns a URL for which `checkHttpsUrl` reports nothing, whose host is `wa.me` and whose length is at most 2,048; decoding its `text` parameter gives exactly `shareText(title, result, k)` for the largest `k` whose text is at most 500 code units and whose link is at most 2,048; that text holds only the well-formed title, the three counts and the first `k` Missed_Topics
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/share.property.test.ts; $LASTEXITCODE`
    - _Requirements: 9.13, 9.14, 9.15_
  - [x] 8.6 Write the property test for hook purity
    - **Property 3: Practice node type hooks leave their inputs unchanged and are deterministic**
    - Design: Property 3
    - Create `apps/practice-path/test/purity.property.test.ts` (node), referencing `recallNodeType`, `reviewQueueNodeType` and `masterySummaryNodeType`: call `recall.enter`, `recall.reduce`, `reviewQueue.enter`, `reviewQueue.reduce` and `masterySummary.enter` on deep-frozen generated inputs; no error is thrown, the inputs stay deep-equal to copies taken before the call, `rngState` changes only through `env.rng`, and a second call with the same inputs and an `Env` built from the same seed returns a deep-equal state
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/purity.property.test.ts; $LASTEXITCODE`
    - _Requirements: 6.7, 6.10, 8.9, 8.12, 9.11_

- [x] 9. Validator size and the final profile list
  - [x] 9.1 Measure the Practice_Validator_Module and add the size test
    - Design: C3
    - Run `pnpm codegen; $LASTEXITCODE` and read the `practice-path` raw and gzip byte counts
    - Edit the C3 table in `.kiro/specs/practice-path/design.md` (the design asks this task to fill it in): write the measured raw and gzip bytes, the raw limit (measured × 1.10, rounded up to a multiple of 1,000) and the gzip limit (measured × 1.10, rounded up to a multiple of 500); change nothing else in design.md
    - Create `apps/practice-path/test/validator-size.test.ts` (node): reads `apps/practice-path/generated/practice-path.validators.js` and fails above either limit
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/validator-size.test.ts; $LASTEXITCODE`
    - _Requirements: 4.4, 4.5_
  - [x] 9.2 Pin the six profile node types in the profile test
    - Design: C4 "Final W5", "Final W6"
    - Edit `apps/practice-path/test/profile.test.ts`: the node type names equal `['content', 'choice', 'outcome', 'recall', 'reviewQueue', 'masterySummary']`, and the generated module exports `response_recall`, `response_reviewQueue` and `response_masterySummary`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/profile.test.ts; $LASTEXITCODE`
    - _Requirements: 3.3, 4.2, 23.2_

- [x] 10. Practice profile property tests and the first timing check
  - [x] 10.1 Write the property test for termination
    - **Property 8: Practice manifests that pass validation finish within `maxTransitions`**
    - Design: Property 8, Testing Strategy "Property test configuration"
    - Edit `apps/practice-path/test/practice-arbitraries.ts`: add `lessonManifestArb` (an optional `content` intro, 1–8 `recall` nodes with optional `eq` branches through a `content` hint node that rejoins the chain, a `reviewQueue` naming every `recall` node and a `masterySummary`), `practiceManifestArb` (`lessonManifestArb` or a `validManifestArb` manifest from `packages/node-types/test/arbitraries.ts` with `profile` set to `practice-path`, imported by relative path and not changed), `practiceAcceptedResponse(rt, s, pick)` and `playPracticeManifest(rt, opts)`
    - Create `apps/practice-path/test/termination.property.test.ts` (node): for manifests that pass `validateManifest(m, practiceProfile)`, any seed and generated accepted responses, the attempt reaches `finished` or `limit_reached` within `limits.maxTransitions` transitions
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/termination.property.test.ts; $LASTEXITCODE`
    - _Requirements: 10.1, 10.4_
  - [x] 10.2 Write the property test for validator robustness
    - **Property 9: The validator does not crash on random input with the practice profile**
    - Design: Property 9
    - Create `apps/practice-path/test/validator.property.test.ts` (node): random JSON values, and valid `practiceManifestArb` manifests with one value replaced by random JSON; `validateManifest(value, practiceProfile)` throws no error and returns `ok` with at most 50 diagnostics
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/validator.property.test.ts; $LASTEXITCODE`
    - _Requirements: 10.2, 10.4_
  - [x] 10.3 Write the property test for replay
    - **Property 10: Same seed and same actions give the same attempt**
    - Design: Property 10
    - Create `apps/practice-path/test/replay.property.test.ts` (node): manifests that pass validation, any uint32 seed, sequences of accepted, rejected and random JSON responses, and any clock sequence; two runs of `createAttempt` and `reduce` with equal inputs give deep-equal states after every step
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/replay.property.test.ts; $LASTEXITCODE`
    - _Requirements: 10.3, 10.4_
  - [x] 10.4 Measure `pnpm -s check` with the first practice properties in the check
    - Design: "Notes for the tasks run" → "Post_Task_Hook time" (after build order step 10)
    - Ask the user to close other heavy processes first (HANDOFF §4) and wait for the answer
    - Run `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s check; $LASTEXITCODE; $sw.Elapsed.TotalSeconds` (600,000 ms limit) and record the exit code and wall time in the task report (Requirement 24.13)
    - **Stop condition:** if the time exceeds 480 s (80% of the 600 s Post_Task_Hook timeout), report it to the user and ask whether to narrow the Check_Pipeline or split tests; change neither the timeout nor `check` without the user's answer (Requirement 24.14)
    - Verify: the measured run prints exit code 0 and a time of at most 480 s
    - _Requirements: 24.12, 24.13, 24.14_

- [x] 11. Checkpoint - Ensure all tests pass after the node types
  - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
  - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
  - Verify: `git diff --exit-code -- .kiro/hooks .github/workflows/ci.yml packages/runtime/src packages/schema/src packages/node-types; $LASTEXITCODE`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. `@dreame/storage`
  - [x] 12.1 Write the Storage_Wrapper and its example tests
    - Design: C9, D62
    - Create `packages/storage/src/index.ts` with `StorageError`, `StoreResult`, `StorageBackend`, `Json`, `VALUE_CAP`, `browserStorage`, `readJson`, `writeJson`, `removeKey` and `isQuotaError` following the C9 rules; the file imports nothing, every function wraps its body in `try`/`catch`, and it is the only source file that names the browser storage global (Requirement 19.3). `.ts` saves in `packages/storage` do not fire the Regression_Hook
    - Create `packages/storage/test/storage.test.ts` (node), with an in-memory backend: one case per C9 rule (backend `null`; `getItem` throws; nothing stored gives `{ ok: true, value: null }`; a non-string result; text over `VALUE_CAP` gives `too-large` before `JSON.parse` runs; non-JSON; an Envelope with an extra key or a non-integer `v`; a version mismatch gives `version` even when the check would fail; a check that returns `false` or throws; a write over `VALUE_CAP` makes no `setItem` call; a value that `JSON.stringify` cannot serialize gives `corrupt`; `DOMException('…', 'QuotaExceededError')`, the name `NS_ERROR_DOM_QUOTA_REACHED` and the codes 22 and 1014 give `quota`; another throw gives `unavailable`; `removeKey` success and failure)
    - Verify: `pnpm exec vitest run packages/storage/test/storage.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 11.2, 11.3, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13_
  - [x] 12.2 Write the browser storage test and the package README paragraph
    - Design: C9
    - Create `packages/storage/test/browser-storage.test.tsx` (jsdom): `browserStorage()` returns the jsdom storage object; it returns `null` when a stubbed global getter throws and when the global is `undefined`; restore each stub after its case
    - Edit `packages/storage/README.md`: add one paragraph on the API (`readJson`, `writeJson`, `removeKey`, `browserStorage`, the five Storage_Errors and the 65,536 code-unit Value_Cap)
    - Verify: `pnpm exec vitest run packages/storage/test/browser-storage.test.tsx; $LASTEXITCODE`
    - _Requirements: 11.4_
  - [x] 12.3 Write the property test for the storage round trip
    - **Property 11: A stored value reads back unchanged**
    - Design: Property 11
    - Create `packages/storage/test/storage.property.test.ts` (node) with `jsonValueArb`: for generated keys, versions and JSON values whose Envelope text fits `VALUE_CAP`, `writeJson` then `readJson` with the same key and version and an accepting check on an in-memory backend returns `{ ok: true, value }` with `value` deep-equal to the written value; the stored text is `{"v":<version>,"data":<value>}`; a read of a key never written returns `{ ok: true, value: null }`
    - Verify: `pnpm exec vitest run packages/storage/test/storage.property.test.ts; $LASTEXITCODE`
    - _Requirements: 11.6, 11.7, 11.14_
  - [x] 12.4 Write the property test for storage error handling
    - **Property 12: Storage calls return a Store_Result for every backend behaviour**
    - Design: Property 12
    - Edit `packages/storage/test/storage.property.test.ts`: add `backendBehaviourArb` (`null`; methods that return any string, `null` or a non-string; methods that throw a quota error, another `Error` or a non-error value) and this property: for generated behaviours, stored texts (Envelopes of the same or another version, Envelopes with extra keys, non-JSON, JSON that is not an Envelope, text over `VALUE_CAP`) and values (fitting or over `VALUE_CAP`), every call of `readJson`, `writeJson` and `removeKey` returns a Store_Result without throwing, with the error a reference model of the C9 rules predicts; a write over `VALUE_CAP` leaves the stored text unchanged and makes no `setItem` call
    - Verify: `pnpm exec vitest run packages/storage/test/storage.property.test.ts; $LASTEXITCODE`
    - _Requirements: 11.5, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.15_

- [x] 13. Progress_Model
  - [x] 13.1 Write `progress.ts` and its example tests
    - Design: C10, D63 (accepted 2026-11-21), "Data Models" → "Device storage format, version 1" and "Progress_File"
    - Create `apps/practice-path/src/progress.ts` (React-free, pure, no `Date.now`, `new Date()` or `Math.random`) with the constants, types and functions of design C10: `progressKey`, `isProgressStore`, `lessonItemIds`, `answeredItems`, `updateProgress`, `recordAttempt`, `dueCount`, `isDueForReview`, `mergeProgress`, `buildProgressFile`, `parseProgressFile` and the internal `trim`, which drops the oldest records outside `keep` until at most `RECORD_CAP` records remain and `buildProgressFile(store).length` is at most `PROGRESS_FILE_MAX`. Keys of every result are sorted by code unit. It re-exports `ItemResult` from `./node-types/practice-state.ts`
    - Create `apps/practice-path/test/progress.test.ts` (node): the key format; `isDueForReview` and `dueCount`; `answeredItems` on a scripted attempt over a small in-test lesson (two `recall` nodes, a `reviewQueue` and a `masterySummary`; the Demo_Lesson is written later, in task 18.2), including a Queue Item with no Review_Result counted as `missed`; `updateProgress` on a new and an existing key; trimming at `RECORD_CAP` and at the 65,536-character file limit with the (`lastSeenAt`, key) tie order and the current attempt's records kept; `parseProgressFile` on a wrong `format`, a wrong `version`, an extra key and non-JSON
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.5, 13.6_
  - [x] 13.2 Write the property test for progress updates
    - **Property 13: A progress update counts each answered Item once and keeps every other record**
    - Design: Property 13
    - Edit `apps/practice-path/test/practice-arbitraries.ts`: add `progressStoreArb` (stores within the caps, with keys that match `PROGRESS_KEY_PATTERN`)
    - Create `apps/practice-path/test/progress.property.test.ts` (node) with this property: for generated stores, activity IDs, answered Items with unique Item_IDs and a `now` not earlier than any stored `lastSeenAt`, `updateProgress` gives each answered Item `seen` one more (1 when new), `firstTryMisses` one more exactly when its First_Try_Result is `incorrect`, `last` equal to its Item_Result and `lastSeenAt` equal to `now`; every other remaining record is deep-equal to its old value; at most `RECORD_CAP` records remain and the Progress_File text is at most 65,536 characters; the answered Items' records are kept; the removed records are the first in the (`lastSeenAt`, key) order. For attempts played with `playPracticeManifest` on `lessonManifestArb` lessons, `answeredItems` lists each `recall` node with a stored answer once, with the Item_Result rule applied and a missing Review_Result counted as `missed`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress.property.test.ts; $LASTEXITCODE`
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.9_
  - [x] 13.3 Write the property test for the progress data check
    - **Property 14: The progress data check accepts stores and rejects extra fields**
    - Design: Property 14
    - Add this property to `apps/practice-path/test/progress.property.test.ts`: `isProgressStore` returns `true` for every generated store within the caps, and `false` for each such store with one change (an extra field in one Item_Record, a missing field, a field of the wrong type, `firstTryMisses` above `seen`, a key that does not match `PROGRESS_KEY_PATTERN`, or more than `RECORD_CAP` records)
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress.property.test.ts; $LASTEXITCODE`
    - _Requirements: 12.2, 12.10_
  - [x] 13.4 Write the property test for the Progress_File round trip
    - **Property 15: The Progress_File round-trips**
    - Design: Property 15
    - Add this property to `apps/practice-path/test/progress.property.test.ts`: for generated stores within the caps, `parseProgressFile(buildProgressFile(store))` merged into an empty store gives a store deep-equal to the original, and the file text is at most 65,536 bytes
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress.property.test.ts; $LASTEXITCODE`
    - _Requirements: 13.8_
  - [x] 13.5 Write the property test for merging
    - **Property 16: Merging keeps the later record and is idempotent**
    - Design: Property 16
    - Add this property to `apps/practice-path/test/progress.property.test.ts`: for generated stores `a` and `b` within the caps, `mergeProgress(a, b)` holds for each key the record with the later `lastSeenAt` and the record of `a` on equal times (before trimming), `mergeProgress(a, a)` equals `a`, and `mergeProgress(mergeProgress(a, b), b)` equals `mergeProgress(a, b)`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress.property.test.ts; $LASTEXITCODE`
    - _Requirements: 13.6, 13.9_

- [x] 14. Attempt-end callback in `@dreame/ui`
  - [x] 14.1 Add `onFinish` to `ActivityPlayer` and its test
    - Design: C11, D61
    - Edit `packages/ui/src/components/ActivityPlayer.tsx`: the optional `onFinish` prop with its doc comment, the `onFinishRef` and `finishReported` refs and the two effects of design C11; change nothing else. `.tsx` saves under `packages/ui` do not fire the Regression_Hook
    - Create `packages/ui/test/ActivityPlayer.finish.test.tsx` (jsdom): no call while playing; one call with `status: 'finished'` after the outcome; one call under `<StrictMode>`; one call for a manifest whose entry node is terminal; one call with `limit_reached`; no call and no error with no prop. Change no existing `@dreame/ui` test (Requirement 14.6)
    - Verify: `pnpm codegen; pnpm exec vitest run packages/ui/test/ActivityPlayer.finish.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm codegen; pnpm exec vitest run packages/ui/; $LASTEXITCODE` (includes the `@dreame/ui` Privacy_Scan)
    - Verify: `git diff --name-only -- packages/ui/test; $LASTEXITCODE`; pass on no file listed (existing tests unchanged)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [x] 15. `RecallNodeView`
  - [x] 15.1 Write `RecallNodeView.tsx`
    - Design: C12, D55, shop D48
    - Create `apps/practice-path/src/views/RecallNodeView.tsx` as in design C12: the form, `fieldset` with `aria-describedby` while the error shows, `legend`, one radio per option of `orderedOptions(cfg, nodeState)` from `@dreame/ui`, tried options disabled, the inline error with `role="alert"`, the Check button, the focused feedback element with the retry, correct and out-of-tries texts, the Continue button, the once-only flag reset on `rejections`, `useId` for IDs, no `style` attribute, and node state read only through `readRecallNodeState`
    - Creating the file fires the Wiring_Hook: it adds the W7 import, export and `practiceViews` entry, and changes the `recall` `View` line of `EXTENDING.md` to the view path. Record the hook reply in the task report (Requirement 23.7)
    - **Stop condition:** as in task 6.1
    - Verify (wiring, pass when it prints `1` and `1`): `(Select-String -Path apps/practice-path/src/views/registry.ts -SimpleMatch -Pattern "{ type: 'recall', Render: RecallNodeView }").Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern 'apps/practice-path/src/views/RecallNodeView.tsx').Count`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 23.2, 23.4, 23.7_
  - [x] 15.2 Write the `RecallNodeView` example tests
    - Design: C12, Testing Strategy "Example tests"
    - Create `apps/practice-path/test/RecallNodeView.test.tsx` (jsdom): the group is named by `prompt` and holds one radio per option in the stored order or in config order; Check with no selection shows "Choose an answer first." linked by `aria-describedby` and records no Try; a correct Try shows "Correct", the explanation and Continue; a wrong Try with Tries left shows "Not quite. Try again." and "1 try left", disables the tried option and shows neither the explanation nor the correct option; a wrong last Try shows "Not this time", "The answer is: <label>" and the explanation; focus moves to the feedback element; Continue calls `onRespond` once with `{ tries }` and a second click is ignored until `rejections` changes; arrow keys and Enter pick and check an option (user-event)
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/RecallNodeView.test.tsx; $LASTEXITCODE`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_
  - [x] 15.3 Write the property test for recall view responses
    - **Property 17: The recall view sends only valid responses**
    - Design: Property 17
    - Create `apps/practice-path/test/RecallNodeView.property.test.tsx` (jsdom) with `fireEvent`: for generated `recall` configs (with or without `shuffle` and a stored order) and sequences of 0–12 option picks and Check activations followed by 1–3 Continue activations, the view disables each tried option, shows neither the explanation nor the correct option while Tries remain after a wrong Try, calls `onRespond` at most once, and when it does, passes `{ tries }` in the order made, which passes `recallNodeType.isValidResponse` and `response_recall`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/RecallNodeView.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 15.4, 15.7, 15.8, 15.10_

- [x] 16. `ReviewQueueNodeView`
  - [x] 16.1 Write `ReviewQueueNodeView.tsx`
    - Design: C13
    - Create `apps/practice-path/src/views/ReviewQueueNodeView.tsx` as in design C13: the empty and damaged-state view with `emptyText` or the default text and a Continue control that sends `{ answers: [] }` once; the intro with `title`, `intro` and "<n> questions to review" ("1 question to review"); one Queue Item at a time with "Question <k> of <n>", a radio group and Check; one Try per Item with the result text, "The answer is: <label>", the explanation and Next; `onRespond({ answers })` once on the last Next, reset on `rejections`; focus on the `h3` of each new Item and on the feedback element; node state read only through `readReviewQueueState`; no `style` attribute
    - Creating the file fires the Wiring_Hook for W7 and the `reviewQueue` `View` line. Record the hook reply in the task report (Requirement 23.7)
    - **Stop condition:** as in task 6.1
    - Verify (wiring, pass when it prints `1` and `1`): `(Select-String -Path apps/practice-path/src/views/registry.ts -SimpleMatch -Pattern "{ type: 'reviewQueue', Render: ReviewQueueNodeView }").Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern 'apps/practice-path/src/views/ReviewQueueNodeView.tsx').Count`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 23.2, 23.4, 23.7_
  - [x] 16.2 Write the `ReviewQueueNodeView` example tests
    - Design: C13, Testing Strategy "Example tests"
    - Create `apps/practice-path/test/ReviewQueueNodeView.test.tsx` (jsdom): "1 question to review" and "3 questions to review"; `intro` shown when set; the empty and the damaged state with the default text and with a custom `emptyText`, each with a Continue that sends `{ answers: [] }` once; Check with no selection shows the linked message; one Try per Item (radios disabled after Check); focus on each new Item heading and on the feedback element; the last Next sends one answer per Queue Item in Queue order
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/ReviewQueueNodeView.test.tsx; $LASTEXITCODE`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_
  - [x] 16.3 Write the property test for review view responses
    - **Property 18: The review view sends one answer per Queue Item in Queue order**
    - Design: Property 18
    - Create `apps/practice-path/test/ReviewQueueNodeView.property.test.tsx` (jsdom) with `fireEvent`: for generated non-empty Queues given through the node state that `enter` stores and generated option picks per Item, completing the Review_Round shows "Question k of n" for each Item in Queue order and calls `onRespond` once with `{ answers }` that lists every Queue Item_ID exactly once in Queue order with the picked option IDs, and passes `reviewQueueNodeType.isValidResponse` and `response_reviewQueue`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/ReviewQueueNodeView.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 16.2, 16.4, 16.8_

- [x] 17. `MasterySummaryNodeView`, the view registry test, text rendering and the second timing check
  - [x] 17.1 Write `MasterySummaryNodeView.tsx`
    - Design: C14
    - Create `apps/practice-path/src/views/MasterySummaryNodeView.tsx` as in design C14: `h2` with `tabIndex={-1}`, `.dr-body`, the two score lines, "Your answers" with `RESULT_TEXT`, "Topics to practise" when Missed_Topics exist, "Review next time" or "Nothing to review next time.", one `ExternalLinkButton` with the `tutorShare` label when `tutorShareLink` (from `../share.ts`) gives a link that `checkHttpsUrl` accepts, the note "No results to show for this attempt." for a missing or damaged state with no share button, node state read only through `readMasteryResult`, no control that calls `onRespond`, no `style` attribute
    - Creating the file fires the Wiring_Hook for W7 and the `masterySummary` `View` line. Record the hook reply in the task report (Requirement 23.7)
    - **Stop condition:** as in task 6.1
    - Verify (wiring, pass when it prints `1` and `1`): `(Select-String -Path apps/practice-path/src/views/registry.ts -SimpleMatch -Pattern "{ type: 'masterySummary', Render: MasterySummaryNodeView }").Count; (Select-String -Path EXTENDING.md -SimpleMatch -Pattern 'apps/practice-path/src/views/MasterySummaryNodeView.tsx').Count`
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/extending-doc.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 19.5, 23.2, 23.4, 23.7_
  - [x] 17.2 Write the `MasterySummaryNodeView` example tests
    - Design: C14, Testing Strategy "Example tests"
    - Create `apps/practice-path/test/MasterySummaryNodeView.test.tsx` (jsdom): heading text; body line breaks kept in `.dr-body`; "First try: <a> of <n>" and "After review: <b> of <n>"; each item with its prompt and result text; the Topics heading only when Missed_Topics exist; "Review next time" and "Nothing to review next time."; the share button shows the `wa.me` host and its confirm step, and after confirming the anchor has the Tutor_Share_Link `href`, `target="_blank"` and `rel="noopener noreferrer"`; no share button without `tutorShare` or with a damaged state; a missing state shows title, body and the note; no control calls `onRespond`
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/MasterySummaryNodeView.test.tsx; $LASTEXITCODE`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_
  - [x] 17.3 Write the view registry test
    - Design: C4 "Practice_Views test"
    - Create `apps/practice-path/test/registry.test.tsx` (jsdom): `practiceViews.types()` equals `practiceProfile.nodeTypes.map((t) => t.type)`, and `practiceViews.get` returns the three shared-package views and the three app views by type
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/registry.test.tsx; $LASTEXITCODE`
    - _Requirements: 23.3_
  - [x] 17.4 Write the property test for text rendering
    - **Property 19: Practice views show manifest and stored strings as text**
    - Design: Property 19
    - Create `apps/practice-path/test/text-rendering.property.test.tsx` (jsdom): generated strings, including markup such as `<b>x</b>` and `<img src=x>`, as every string field of design Property 19 across the three views; each displayed string is the `textContent` of an element or contained in it, and no element named by the markup is created
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/text-rendering.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 15.9, 16.7, 17.9, 17.10_
  - [x] 17.5 Measure `pnpm -s check` with the component properties in the check
    - Design: "Notes for the tasks run" → "Post_Task_Hook time" (after build order step 14)
    - Ask the user to close other heavy processes first (HANDOFF §4) and wait for the answer
    - Run `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s check; $LASTEXITCODE; $sw.Elapsed.TotalSeconds` (600,000 ms limit) and record the exit code and wall time in the task report, next to the task 10.4 time (Requirement 24.13)
    - **Stop condition:** as in task 10.4: above 480 s, report and ask; change neither the timeout nor `check` without the user's answer (Requirement 24.14)
    - Verify: the measured run prints exit code 0 and a time of at most 480 s
    - _Requirements: 24.12, 24.13, 24.14_

- [x] 18. Demo lesson and fixture
  - [x] 18.1 Show the user the synthetic lesson draft (manual step)
    - Design: C18 "Demo_Lesson", D68; Resolved questions 8 and 10
    - Write in the chat, not in a file, a synthetic draft of 6 questions on "Fractions and percentages", one per planned Topic ("Equivalent fractions", "Adding fractions", "Fraction of an amount", "Percent of an amount", "Fractions as percentages", "Percentage change"), each with a prompt, 2–5 options, the correct option and an explanation; check each answer by arithmetic before showing it. Also show the node plan of the design C18 table and the fictional `tutorShare` URL `https://wa.me/12125550142` (Requirements 22.1, 22.3)
    - Ask the user to approve the draft, correct it, or give replacement questions (Requirement 22.2)
    - **Stop condition:** stop until the user answers; write no file under `activities/` before that (Requirement 22.2)
    - The draft holds only synthetic data: no real people's names or details and no brand names or logos (Requirement 22.6). Record the approved questions in the task report
    - Verify: `git status --porcelain --untracked-files=all -- activities; $LASTEXITCODE`; pass when it prints no file and exit code 0 (nothing written before approval)
    - _Requirements: 22.1, 22.2, 22.3, 22.6_
  - [x] 18.2 Write the Demo_Lesson
    - Design: C18 "Demo_Lesson"
    - Create `activities/practice-fractions.json` with the approved questions and the graph of design C18 (`intro` → `q1` … `q6` → `review` → `result`; `itemId` `fractions-1` … `fractions-6`, `maxRetries: 1`, `topic`, `shuffle: true`; `review` with `from` naming all six `recall` nodes; `result` with `from: "review"` and `tutorShare: { "label": "Send result to tutor", "url": "https://wa.me/12125550142" }`; `requires`, `entryNodeId`, `fallbackOutcomeId`, `limits`, `variables`, `theme`, no `validUntil`). Write no other WhatsApp number under `activities/` (Requirement 22.3). The Activity_Hook validates the file on save
    - Edit `tools/validate/test/run.test.ts`: the "expands activities/*.json" case now expects three PASS lines, with `activities/practice-fractions.json` in the order the CLI prints it
    - **Stop condition:** if the Activity_Hook times out at 30 s (`validate:hook` now runs three codegen steps), report the time to the user and ask; change no hook file
    - Verify: `pnpm -s validate activities/practice-fractions.json; $LASTEXITCODE`; pass when it prints PASS and exit code 0
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE`; pass when it prints three PASS lines and exit code 0
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`
    - _Requirements: 22.3, 22.4, 22.5, 22.6, 22.7_
  - [x] 18.3 Bundle the demo and write the play test
    - Design: C15 "`src/demos.ts`", C18 "Play test"
    - Create `apps/practice-path/src/demos.ts` with `DemoEntry`, `DEMOS` and `findDemo` (a `Map` lookup, so `__proto__` and `toString` return `undefined`)
    - Create `apps/practice-path/test/demo-manifest.test.ts` (node): the Demo_Lesson passes `validateManifest(m, practiceProfile)`; it has 6–8 `recall` nodes, one `reviewQueue` whose `from` names every `recall` node, and one `masterySummary` whose `from` names it; playing with a fixed seed (Start; a wrong first Try then the correct option at `q1` and `q4`; the correct option first at the other four; a review response that answers `fractions-1` correctly and `fractions-4` wrongly) gives a Queue of exactly `fractions-1` and `fractions-4`, status `finished` at `result`, and counts `{ firstTry: 4, reviewed: 1, missed: 1 }`; every `DEMOS` ID equals its manifest's `activityId`; `findDemo('__proto__')` is `undefined`; the manifest has no `validUntil` or one of `2027-12-31` or later
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/demo-manifest.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 18.4, 22.4, 22.5, 22.10_
  - [x] 18.4 Write the Practice_Fixture and its CLI test
    - Design: C18 "Practice_Fixture"
    - Create `activities/fixtures/broken-practice-answer-key.json`: the Demo_Lesson shape with one `recall` node whose `correctOptionId` is `"zz"`. The Activity_Hook reports `FAIL` and `dangling-ref` on save, which is the expected result
    - Edit `activities/fixtures/README.md`: add one paragraph in the existing form naming the fixture and its expected `conditions/dangling-ref` diagnostic (Requirement 22.9)
    - Edit `tools/validate/test/run.test.ts`: add one real-file case where the Demo_Lesson passes with exit 0 and the Practice_Fixture gives one `conditions/dangling-ref` at `/nodes/<n>/config/correctOptionId` and exit 1
    - Verify: `pnpm -s validate activities/fixtures/broken-practice-answer-key.json; $LASTEXITCODE`; pass when it prints `FAIL`, one `dangling-ref` diagnostic and exit code 1
    - Verify: `pnpm codegen; pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`
    - _Requirements: 22.7, 22.8, 22.9_

- [x] 19. App shell, progress provider, routes and views
  - [x] 19.1 Write the lesson-end helpers and the Save_Status texts
    - Design: C15 "`src/lesson-end.ts`", "SaveStatus" tables
    - Create `apps/practice-path/src/lesson-end.ts` (`localDateString`, `isLessonEnded`; the shop `offer.ts` logic under the app's own names, with no import from `apps/shop-challenge`, Requirement 3.5) and `apps/practice-path/src/app/save-status-text.ts` (the status texts and the Storage_Error reasons of the two design C15 tables, exactly)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `Select-String -Path apps/practice-path/src/app/save-status-text.ts -SimpleMatch -Pattern 'export to keep', 'Not saved on this device', 'could not be read'`; pass when each pattern appears
    - _Requirements: 3.5, 18.7, 18.9, 18.10, 18.21_
  - [x] 19.2 Write the ProgressProvider and its test
    - Design: C15 "ProgressProvider", D64, D65
    - Create `apps/practice-path/src/app/ProgressProvider.tsx` with `SaveStatusValue`, `ImportOutcome`, `ProgressApi`, `ProgressProviderProps`, `ProgressProvider` and `useProgress` as in design C15 (start read, save, export through the `download` prop with the default Blob download, import with the size check before `file.text()`, clear). It is the only module that imports `@dreame/storage`
    - Create `apps/practice-path/test/progress-provider.test.tsx` (jsdom) with a test consumer of `useProgress`: start with an empty, a valid, a damaged and another-version stored value; a `null` backend gives `backendAvailable: false`; `recordAttempt` writes the key with `v: 1` and sets `saved`; a quota error sets `not-saved` with `quota`; a successful save after `read-failed` replaces the stored text; export with a `null` backend calls the download recorder with `practice-path-progress.json`; import of a 65,537-byte file gives `too-large` and never reads the text; import of non-JSON gives `invalid`; import of a valid file merges and saves; clear removes the key and empties the store
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress-provider.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 12.1, 12.11, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 18.8_
  - [x] 19.3 Write `SaveStatus` and its cases
    - Design: C15 "SaveStatus"
    - Create `apps/practice-path/src/app/SaveStatus.tsx`: `<p className="pp-save-status" role="status">` with the texts of `save-status-text.ts`; `not-saved` adds the Export button; `idle` renders nothing
    - Edit `apps/practice-path/test/progress-provider.test.tsx`: one case per status (`saved`, `not-saved` with each reason and the Export button, `read-failed` with its reason, `idle` with no element)
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress-provider.test.tsx; $LASTEXITCODE`
    - _Requirements: 18.9, 18.10, 18.21_
  - [x] 19.4 Write `ProgressControls` and its cases
    - Design: C15 "ProgressControls", D67
    - Create `apps/practice-path/src/app/ProgressControls.tsx`: the "Export progress" button; the labelled file input "Import progress" with `accept="application/json,.json"` and the three result messages in a `role="status"` paragraph; the "Clear progress" button with the inline "Clear all progress saved on this device?" group and its "Yes, clear" and "Cancel" buttons
    - Edit `apps/practice-path/test/progress-provider.test.tsx`: export calls the download recorder; each import message; Cancel keeps the store; "Yes, clear" removes the key
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/progress-provider.test.tsx; $LASTEXITCODE`
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.7, 19.1_
  - [x] 19.5 Write the not-found view, the lesson-ended view and the footer
    - Design: C15 view table
    - Create `apps/practice-path/src/app/NotFoundView.tsx`, `apps/practice-path/src/app/LessonEndedView.tsx` and `apps/practice-path/src/app/Footer.tsx` with the exact texts and links of the design C15 view table; the three footer anchors ("MIT License", "Source on GitHub", "Shop Challenge, the sister app") have https `href` values, `target="_blank"`, `rel="noopener noreferrer"` and the visible text "(opens in a new tab)"
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `(Select-String -Path apps/practice-path/src/app/Footer.tsx -SimpleMatch -Pattern 'rel="noopener noreferrer"').Count`; pass when it prints `3`
    - _Requirements: 18.6, 18.7, 18.16, 19.5_
  - [x] 19.6 Write the demo route
    - Design: C15 "PlayDemoRoute"
    - Create `apps/practice-path/src/app/PlayDemoRoute.tsx`: steps 1–5 of design C15 (lookup, validation with `InvalidActivityView` and "Back to home", lesson-ended check, the player with a `crypto.getRandomValues` seed, `practiceViews` and `onFinish`, the Save_Status and "Practice again"). It takes an optional `demos` prop that defaults to `DEMOS`, so a test can pass an invalid manifest
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 18.4, 18.5, 18.6, 18.7, 18.8, 18.11_
  - [x] 19.7 Write the landing view and the routes
    - Design: C15 "`src/app/App.tsx`", view table
    - Create `apps/practice-path/src/app/LandingView.tsx` (the exact texts of the design C15 table, one `Link` per `DEMOS` entry with "<k> to review on this device" from `dueCount` over `lessonItemIds` of the validated manifest, the storage note when `backendAvailable` is `false`, `<SaveStatus />` and `<ProgressControls />`) and `apps/practice-path/src/app/App.tsx` (the three routes and the footer), with `Link`, `Routes`, `Route`, `useParams` and `useNavigate` from `react-router`
    - The only toolkit statement on the landing page is the Brief §0 sentence quoted in design C15; the page makes no claim about learning gains or exam results (Requirement 18.17)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 18.3, 18.12, 18.13, 18.14, 18.15, 18.17_
  - [x] 19.8 Write the entry files and the `index.html` test
    - Design: C15 "`apps/practice-path/index.html`", "`src/app/main.tsx`", "`practice.css`"
    - Create `apps/practice-path/index.html` with the exact content of design C15, `apps/practice-path/src/app/main.tsx` (imports `@dreame/ui/tokens.css`, `@dreame/ui/components.css` and `./practice.css`; throws an `Error` when `#root` is missing; renders `<StrictMode><BrowserRouter><ProgressProvider><App /></ProgressProvider></BrowserRouter></StrictMode>`), `apps/practice-path/src/app/css.d.ts` (a copy of the shop file) and `apps/practice-path/src/app/practice.css` (the `pp-` layout rules, using only `var(--dr-*)` tokens)
    - Create `apps/practice-path/test/index-html.test.ts` (node): `index.html` has a `<title>`, `og:title`, `og:description`, no inline script and no inline style
    - Verify: `pnpm exec vitest run apps/practice-path/test/index-html.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 18.1, 18.18, 18.19, 19.6_
  - [x] 19.9 Write the routes test
    - Design: C15, Testing Strategy "Example tests"
    - Create `apps/practice-path/test/routes.test.tsx` (jsdom) with `MemoryRouter` and a `ProgressProvider` over an in-memory backend: `/` shows the app name, the audience sentence, a link to `/play/demo/practice-fractions` with its due count, "No sign-up · No tracking · Open source", the device-only note, the practice-only note, and the storage note with a `null` backend; `/play/demo/practice-fractions` shows the player at `intro`; `/play/demo/nope` and `/x` show "Page not found" with a link to `/`; an invalid manifest through the `demos` prop shows `InvalidActivityView` with "Back to home"; a demo with a past `validUntil` shows "This lesson has ended"; `isLessonEnded` with a past, the same and a future date; after the attempt ends the Save_Status reads the saved text and "Practice again" starts a new attempt at `intro`; the footer with its three links on every route
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/routes.test.tsx; $LASTEXITCODE`
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.11, 18.12, 18.13, 18.14, 18.15, 18.16_
  - [x] 19.10 Write the app axe test
    - Design: Testing Strategy "Example tests", ui-renderer D17
    - Create `apps/practice-path/test/a11y.test.tsx` (jsdom): `axe.run` from `axe-core` with the WCAG 2.x A and AA tags and `color-contrast` disabled, as `packages/ui/test/a11y.test.tsx` does, on the landing, not-found and lesson-ended views, the Save_Status in its saved, not-saved and read-failed states, the three practice views, and the player on each node of the Demo_Lesson; `expect(result.violations).toEqual([])`
    - **Stop condition:** fix violations in the components; disable no rule other than `color-contrast` without asking the user
    - Verify: `pnpm codegen; pnpm exec vitest run apps/practice-path/test/a11y.test.tsx; $LASTEXITCODE`
    - _Requirements: 18.20_

- [x] 20. Scans, Boundary_Rules, `PRIVACY.md` and the built output check
  - [x] 20.1 Write the app privacy scan
    - Design: C16 table, row `apps/practice-path/test/privacy-scan.test.ts`
    - Create `apps/practice-path/test/privacy-scan.test.ts` (node) over every file in `apps/practice-path/src`: no network call, browser storage name, `sessionStorage` or `indexedDB` of design C16; every `<input` tag has `type` `radio` or `file`, and no `<textarea` or `<select`; no JSX `style=`; every `<a` tag has an https `href` (literal or same-file constant), `target="_blank"` and `rel="noopener noreferrer"`. It asserts that the scan finds the radio inputs of `RecallNodeView.tsx`, the file input of `ProgressControls.tsx` and 3 anchors in `Footer.tsx`. Build the tokens from fragments, as in `packages/ui/test/privacy-scan.test.ts`, and add a sample-code case that checks each pattern matches
    - Verify: `pnpm exec vitest run apps/practice-path/test/privacy-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 19.1, 19.2, 19.5, 19.6_
  - [x] 20.2 Write the storage privacy scan
    - Design: C16 table, row `packages/storage/test/privacy-scan.test.ts`
    - Create `packages/storage/test/privacy-scan.test.ts` (node): over `packages/storage/src`, no network call, `sessionStorage` or `indexedDB`, and no `react`, `react-dom`, `@dreame/ui` or `apps/` import; over every `.ts` and `.tsx` file in `apps/*/src`, `packages/*/src` and `tools/*/src`, the files that name the browser storage global are exactly `packages/storage/src/index.ts`. Build the tokens from fragments
    - Verify: `pnpm exec vitest run packages/storage/test/privacy-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 11.2, 19.2, 19.3_
  - [x] 20.3 Extend the source scan to the new app and package
    - Design: C16 table, row `source-scan.test.ts`
    - Edit `packages/schema/test/source-scan.test.ts`: test (a) also asserts a `.tsx` file under `apps/practice-path/src/` and a `.ts` file under `packages/storage/src/`; test (c) also asserts that `apps/practice-path/src` and `packages/storage/src` are scanned. Write the file in one save; the save fires the Regression_Hook (about 100–180 s)
    - Verify: `pnpm exec vitest run packages/schema/test/source-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 4.7, 19.4_
  - [x] 20.4 Extend the boundary test to the React-free and pure practice files
    - Design: C16 table, row `boundaries.test.ts`
    - Edit `packages/runtime/test/boundaries.test.ts`: `NO_UI_DIRS` adds `apps/practice-path/src/node-types` and `packages/storage/src`; single-file cases scan `apps/practice-path/src/profile.ts`, `progress.ts` and `share.ts`; `PURITY_DIRS` adds `apps/practice-path/src/node-types`, and the purity case also scans `progress.ts` and `share.ts` for the wall clock and `Math.random`. Write the file in one save; the save fires the Regression_Hook
    - Verify: `pnpm exec vitest run packages/runtime/test/boundaries.test.ts; $LASTEXITCODE`
    - _Requirements: 3.4, 12.7, 19.8_
  - [x] 20.5 Extend the repository text scan
    - Design: C16 table, row `repo-text.test.ts`
    - Edit `tools/validate/test/repo-text.test.ts`: add the describe "practice-path repository text (Requirement 19.10)" over `.kiro/specs/practice-path/*.md`, every file under `apps/practice-path/src`, `apps/practice-path/index.html`, `apps/practice-path/README.md` and `packages/storage/README.md`; `PRIVACY.md` stays in the shop block
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 19.10, 24.9_
  - [x] 20.6 Add the Boundary_Rules and their lint test cases
    - Design: C16 "Boundary_Rules", D66
    - Edit `tools/lint/src/depcruise-rules.ts`: extend `react-free-no-ui` and add `storage-no-imports` and `apps-no-sibling-apps` exactly as in design C16; change no other rule
    - Edit `tools/lint/test/lint-rules.test.ts`: two cases in the existing temporary-folder form: `packages/storage/src/sample.ts` importing `react` reports `react-free-no-ui` and `storage-no-imports`; `apps/practice-path/src/sample.ts` importing `../../shop-challenge/src/format.ts` reports `apps-no-sibling-apps`. No violating file is written under `apps/`, `packages/` or `tools/`
    - **Stop condition:** if `pnpm -s depcruise` or `pnpm -s lint` reports a finding in an existing file, report each file and rule to the user and stop; turn off or lower no rule and add no inline disable comment
    - Verify: `pnpm -s depcruise; $LASTEXITCODE`
    - Verify: `pnpm -s lint; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run tools/lint/test/lint-rules.test.ts; $LASTEXITCODE`
    - Verify: `git status --porcelain --untracked-files=all -- apps packages tools | Select-String -SimpleMatch -Pattern 'sample'`; pass on no output
    - _Requirements: 3.5, 11.1, 11.2, 19.8, 19.9_
  - [x] 20.7 Write the two-app `PRIVACY.md`
    - Design: C16 "`PRIVACY.md`"
    - Replace the content of `PRIVACY.md` with the exact new content of design C16
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - Verify: `Select-String -Path PRIVACY.md -SimpleMatch -Pattern 'dreame.practice-path.progress', 'firstTryMisses', 'Clear progress', 'practice-path-progress.json', 'Send result to tutor'`; pass when each pattern appears
    - _Requirements: 19.11_
  - [x] 20.8 Write the built output check
    - Design: C16 table, row `check-dist.ts`
    - Create `apps/practice-path/scripts/check-dist.ts` as an exact copy of `apps/shop-challenge/scripts/check-dist.ts` with the first comment line changed to "Built-output checks for the Practice_App (practice-path Requirements 19.6, 19.7)"; it imports only `node:*` modules
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `Test-Path apps/practice-path/dist; node --experimental-strip-types apps/practice-path/scripts/check-dist.ts; $LASTEXITCODE`; pass when, with no `dist` folder, it prints `False`, a plain error naming the missing `dist/index.html`, and exit code 1 (checkpoint 21 runs it on a real build)
    - _Requirements: 19.6, 19.7_

- [x] 21. Checkpoint - Ensure all tests pass and both apps build
  - Verify: `pnpm --filter @dreame/practice-path build; $LASTEXITCODE`; pass when `check-dist.ts` reports no inline script or style and a JS total under 153,600 gzip bytes, and the exit code is 0
  - Verify: `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`
  - Verify: `git status --porcelain --untracked-files=all -- apps/practice-path/dist apps/practice-path/generated apps/shop-challenge/dist; $LASTEXITCODE`; pass when it prints no file
  - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Static hosting configuration
  - [x] 22.1 Write `vercel.json` and its example test
    - Design: C17
    - Create `apps/practice-path/vercel.json` with the exact content of design C17
    - Create `apps/practice-path/test/vercel-config.test.ts` (node): parses the file; the install command, build command and output directory equal design C17; the rewrite is `/(.*)` → `/index.html`; the four headers have the CSP_Value and the other three values; no `env`, `build` or `buildEnv` key exists
    - Verify: `pnpm exec vitest run apps/practice-path/test/vercel-config.test.ts; $LASTEXITCODE`
    - _Requirements: 20.3, 20.4, 20.6_
  - [x] 22.2 Write the property test for the hosting headers
    - **Property 20: The hosting headers and rewrite apply to every path**
    - Design: Property 20
    - Create `apps/practice-path/test/vercel-config.property.test.ts` (node): generated request paths starting with `/` (routes, assets, deep paths, encoded characters); the header rule `source` and the rewrite `source`, read as `/(.*)`, match each path; the header rule sets exactly the four headers of Architecture Spec §A3, each byte-equal to the value parsed from `docs/Architecture_and_UI_Spec.md` at run time; the rewrite destination is `/index.html`
    - Verify: `pnpm exec vitest run apps/practice-path/test/vercel-config.property.test.ts; $LASTEXITCODE`
    - _Requirements: 20.1, 20.2, 20.5_

- [x] 23. CI build step
  - [x] 23.1 Add the Practice_App build step to `ci.yml`
    - Design: C2 "Root and shared changes"; Resolved question 11
    - Edit `.github/workflows/ci.yml`: add one line `      - run: pnpm --filter @dreame/practice-path build` after `      - run: pnpm --filter @dreame/shop-challenge build`; change nothing else and keep `node-version: 22`. This is the only task that edits `ci.yml`
    - Verify: `git diff --numstat -- .github/workflows/ci.yml; $LASTEXITCODE`; pass when it prints `1` added and `0` deleted lines for the file
    - Verify: `Select-String -Path .github/workflows/ci.yml -SimpleMatch -Pattern 'node-version: 22', 'run: pnpm check', 'run: pnpm --filter @dreame/shop-challenge build', 'run: pnpm --filter @dreame/practice-path build'`; pass when it prints four lines, in that order
    - _Requirements: 24.15_

- [x] 24. Timing and full-pipeline checks before the deploy
  - [x] 24.1 Measure `pnpm -s check` before the deploy
    - Design: "Notes for the tasks run" → "Post_Task_Hook time" (build order step 20)
    - Ask the user to close other heavy processes first (HANDOFF §4) and wait for the answer
    - Run `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s check; $LASTEXITCODE; $sw.Elapsed.TotalSeconds` (600,000 ms limit) and record the exit code and wall time in the task report, next to the times of tasks 10.4 and 17.5 (Requirement 24.13)
    - **Stop condition:** as in task 10.4: above 480 s, report and ask; change neither the timeout nor `check` without the user's answer (Requirement 24.14)
    - Verify: the measured run prints exit code 0 and a time of at most 480 s
    - _Requirements: 24.12, 24.13, 24.14_
  - [x] 24.2 Run the full pipeline checks before the deploy
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when the three printed module sizes are within their limits (core: 180,000 and 14,000; shop: 255,000 and 19,000; practice: the design C3 table)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE` (expect 0, three PASS lines); `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1); `pnpm validate activities/fixtures/broken-shop-over-budget.json; $LASTEXITCODE` (expect 1); `pnpm validate activities/fixtures/broken-practice-answer-key.json; $LASTEXITCODE` (expect 1); `pnpm validate; $LASTEXITCODE` (expect 2)
    - Verify: `pnpm -s depcruise; $LASTEXITCODE`; `pnpm -s lint; $LASTEXITCODE`
    - Verify: `pnpm --filter @dreame/practice-path build; $LASTEXITCODE`; `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`
    - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
    - Verify: `git diff --exit-code -- .kiro/hooks; $LASTEXITCODE`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `git ls-files packages/*/generated apps/*/generated apps/*/dist design-refs .vercel; $LASTEXITCODE`; pass when it lists no file, and `git status --porcelain -- .kiro/settings` prints nothing
    - Verify: `git diff --name-only -- apps/shop-challenge packages/runtime/src packages/schema/src packages/node-types; $LASTEXITCODE`; pass on no file listed
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 3.6, 3.10, 4.5, 18.2, 19.6, 19.7, 22.7, 22.8, 23.5, 23.8, 24.6_

- [-] 25. Checkpoint - Ensure all tests pass, then ask before committing the app (before the deploy)
  - Ensure all tests pass, ask the user if questions arise.
  - Show the user `git status --porcelain --untracked-files=all; git diff --stat` and ask: whether to commit; whether the work goes in one commit or several; which of the listed files to include
  - On approval, stage each approved file by explicit path with `git add -- <path> ...`. The root `package.json`, `apps/practice-path/package.json`, `packages/storage/package.json`, `tools/validate/package.json` and `pnpm-lock.yaml` go in the same commit (Requirement 3.10). The design.md C3 table edit of task 9.1 goes in with the rest when the user approves it. Never stage `packages/*/generated/`, `apps/*/generated/`, `apps/*/dist/`, `design-refs/`, `.vercel` or the five untracked files named in the conventions
  - Commit with `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "<message the user approves>"; $LASTEXITCODE`; no `--no-verify`, no `--amend`, no co-author trailer; the pre-commit hook runs `pnpm check` (600,000 ms limit)
  - **Stop condition:** if the pre-commit `pnpm check` fails, report the command, output and exit code, and create no commit until the user decides (Requirement 2.5)
  - Tell the user that Vercel imports the repository from GitHub, so the deploy in task 26 needs this commit on GitHub, and that a push to `main` also rebuilds Shop Challenge. Do not push before `apps/practice-path/vercel.json` exists: check `Test-Path apps/practice-path/vercel.json` prints `True`. When the user asks for a push, first run `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE` and `pnpm --filter @dreame/practice-path build; $LASTEXITCODE` and confirm both exit 0 (Requirement 21.3); report `git rev-list --count origin/main..HEAD; $LASTEXITCODE`; push only if the user asks (Requirement 2.7)
  - Verify: `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when the author is the Commit_Identity and the file list holds only approved paths, with the four `package.json` files and `pnpm-lock.yaml` together
  - Verify: `git ls-files packages/*/generated apps/*/generated apps/*/dist design-refs .vercel`; pass on no output
  - _Requirements: 2.2, 2.3, 2.5, 2.6, 2.7, 3.10, 21.3, 24.17_

- [ ] 26. Deploy URL #2 (manual steps with the user)
  - [ ] 26.1 Give the user the Vercel deploy steps
    - Design: C17 "Deploy steps for the user", shop D52
    - Give the user these steps and state that the user performs them with the user's own Vercel account (Requirement 21.1): (1) confirm that the task 25 commit is on GitHub; (2) in Vercel, "Add New… → Project" and import `ChukwuebukaHenrey/my-kiro-win` again, which creates a second project next to the Shop Challenge project; (3) set Root Directory to `apps/practice-path`, Framework Preset to Vite and Node.js Version to 22.x, and keep "Include files outside the root directory in the Build Step" on, because the build reads `packages/`, `activities/` and the lockfile; (4) add no environment variable; (5) deploy, then send the pnpm version line of the first build log and the Deploy_URL_2
    - Write no Vercel token, project ID, organisation ID or other account data to any file (Requirement 21.2)
    - **Stop condition (shop D52):** if the first build fails on the pnpm version, report the build-log error and ask the user whether to set the project variable `ENABLE_EXPERIMENTAL_COREPACK=1` (not a secret); the user makes the change in Vercel; change no Vercel setting and no file for it
    - Verify: `git rev-list --count origin/main..HEAD; $LASTEXITCODE`; pass when it prints `0` (the deployed commit is on GitHub)
    - Verify: `git ls-files .vercel apps/practice-path/.vercel; git check-ignore apps/practice-path/.vercel; $LASTEXITCODE`; pass when `ls-files` lists nothing and `check-ignore` prints the path with exit code 0
    - _Requirements: 20.6, 21.1, 21.2_
  - [ ] 26.2 Check the deployed routes and headers
    - Design: C17 "Deploy checks"
    - For `/` and `/play/demo/practice-fractions` at the Deploy_URL_2, run the PowerShell 5.1 `Invoke-WebRequest` command of design C17 and report each status code and whether each of the four headers equals the Vercel_Config value (Requirement 21.4)
    - **Stop condition:** if a status is not 200 or a header differs, report the URL, the status and the differing header to the user, and change no Vercel setting (Requirement 21.5)
    - Verify: both requests print status `200` and the four expected header values
    - _Requirements: 21.4, 21.5_
  - [ ] 26.3 Record Deploy_URL_2 in the app README
    - Design: C17
    - Edit `apps/practice-path/README.md`: add the Deploy_URL_2 and the note "No login needed" (Requirement 21.6)
    - Verify: `Select-String -Path apps/practice-path/README.md -SimpleMatch -Pattern 'No login needed'`; pass when it prints one line
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 21.6_
  - [ ] 26.4 Ask the user for the Android, keyboard and screen-reader checks (manual step)
    - Design: C17, "Manual steps for the user"
    - Ask the user to open the Deploy_URL_2 on an Android phone, play the Demo_Lesson with at least one wrong first answer, confirm that the missed question returns in the Review_Round, return to the landing view to see the Due_For_Review count, export the Progress_File, and open the confirm step of the Tutor_Share_Link; record the reported result in the task report (Requirement 21.8)
    - Also ask the user for a keyboard pass and a screen-reader pass of the same flow; record each answer, or that the user deferred it
    - Verify: `try { (Invoke-WebRequest -Uri "<Deploy_URL_2>/" -UseBasicParsing -MaximumRedirection 0).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }`; pass when it prints `200`
    - _Requirements: 21.8_
  - [ ] 26.5 Add the Practice Path link to the Shop Challenge footer
    - Design: C17; Resolved question 12
    - Edit `apps/shop-challenge/src/app/Footer.tsx`: add a third anchor "Practice Path, the sister app" with the https Deploy_URL_2 as `href`, `target="_blank"`, `rel="noopener noreferrer"` and the visible text "(opens in a new tab)"
    - Edit `apps/shop-challenge/test/routes.test.tsx` (the new link and its `href`) and `apps/shop-challenge/test/privacy-scan.test.ts` (3 footer anchors). These three files are the only change to `apps/shop-challenge` in this spec (Requirement 21.7)
    - Verify: `pnpm codegen; pnpm exec vitest run apps/shop-challenge/test/routes.test.tsx apps/shop-challenge/test/privacy-scan.test.ts; $LASTEXITCODE`
    - Verify: `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`
    - Verify: `git diff --name-only -- apps/shop-challenge; $LASTEXITCODE`; pass when it lists exactly the three files above
    - _Requirements: 21.7_

- [ ] 27. Final checkpoint - Ensure all tests pass, then ask before committing
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: `pnpm check; $LASTEXITCODE` (600,000 ms limit)
  - Verify: `pnpm --filter @dreame/shop-challenge build; $LASTEXITCODE`; `pnpm --filter @dreame/practice-path build; $LASTEXITCODE`
  - Verify: `git diff --exit-code -- .kiro/hooks; $LASTEXITCODE` (Requirement 23.8)
  - Show the user `git status --porcelain --untracked-files=all; git diff --stat` and ask whether to commit the README change (task 26.3), the Shop Challenge footer change (task 26.5) and the task status files (`.kiro/specs/practice-path/tasks.md`, and `tasks.meta.json` when it exists), and which paths to include
  - On approval, stage each approved file by explicit path and commit with the Commit_Identity as in task 25; no `--no-verify`, no `--amend`, no co-author trailer. **Stop condition:** if the pre-commit `pnpm check` fails, report it and create no commit until the user decides
  - Tell the user that a push of this commit starts new Vercel builds of both apps; before any push, confirm that both app builds above exited 0 (Requirement 21.3), report `git rev-list --count origin/main..HEAD; $LASTEXITCODE`, and push only if the user asks
  - Verify: `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when the author is the Commit_Identity and the file list holds only approved paths
  - Verify: `git diff --exit-code -- .kiro/hooks .github/workflows/ci.yml; $LASTEXITCODE`; pass on exit code 0
  - _Requirements: 2.2, 2.3, 2.5, 2.6, 2.7, 21.3, 23.8, 24.17_

## Notes

- No task is optional. Each of design Properties 1–20 is its own required sub-task: Property 1 (6.3), 2 (6.4), 3 (8.6), 4 (7.3), 5 (7.4), 6 (8.3), 7 (8.5), 8 (10.1), 9 (10.2), 10 (10.3), 11 (12.3), 12 (12.4), 13 (13.2), 14 (13.3), 15 (13.4), 16 (13.5), 17 (15.3), 18 (16.3), 19 (17.4), 20 (22.2). Each sits right after the sub-task that writes the code it tests.
- Checkpoint tasks 11, 21, 25 and 27 are not part of the task dependency graph below, so the orchestrator does not start them by itself: run each checkpoint by hand when the waves before it are done. Tasks run one at a time, in order, so every wave holds one sub-task (Requirement 24.16).
- The Post_Task_Hook runs `pnpm -s check` after every task (about 140–240 s at the start of this spec, more as tests are added; 600 s timeout). The timing tasks 10.4, 17.5 and 24.1 follow design build order steps 10, 14 and 20 and stop above 480 s (Requirements 24.13, 24.14).
- Order changes against design "Notes for the tasks run", made so that each property follows its code and each sub-task stays small: build order step 2 is one sub-task (2.1), because the five manifest files are copied from the design and must exist together before the one `pnpm install`; `recall.ts` is saved twice (6.1 run-time hooks, 6.5 graph checks), so Properties 1 and 2 run before the graph checks and the second save gives the "already wired" reply that Requirement 23.7 asks for; `share.ts` (8.4) comes after the `masterySummary` example tests and before Property 7; `progress.test.ts` (13.1) uses a small in-test lesson because the Demo_Lesson is written later (18.2); the `vercel.json` and `ci.yml` tasks (22, 23) come after the app-build checkpoint (21).
- Task 1 is first because Requirement 1.1 says so. Tasks 1.2, 25 and 27 wait for the user before any commit; nothing is pushed unless the user asks, and no push happens before `apps/practice-path/vercel.json` exists.
- The App_Wiring_Files W5–W7 (tasks 3.1–3.3) exist before the first Own_File (task 6.1), so the Wiring_Hook finds them (Requirement 23.1). Expected hook replies: "no wiring needed" for `index.ts` (3.1); wiring plus `pnpm -s test:shared` on the first create of `recall.ts` (6.1), `reviewQueue.ts` (7.1), `masterySummary.ts` (8.1) and the three view files (15.1, 16.1, 17.1); "already wired" with no run on the second save of `recall.ts` (6.5). `practice-rules.ts`, `practice-state.ts`, `progress.ts`, `share.ts` and the `app/` files do not match the hook.
- The validate CLI knows the `practice-path` profile (task 4.1) before any `activities/practice-*.json` is written (task 18.2), so the Activity_Hook can check it. The Practice_Fixture (18.4) fails the Activity_Hook by design.
- The only design.md edit is the C3 size table in task 9.1, which the design asks that task to fill in. The only `ci.yml` edit is task 23.1 (one added line). The only `apps/shop-challenge` edit is task 26.5.
- The install (task 2.1) leaves the root `package.json`, `apps/practice-path/package.json`, `packages/storage/package.json`, `tools/validate/package.json` and `pnpm-lock.yaml` uncommitted until task 25, which commits them together (Requirement 3.10).
- Manual steps for the user, in order: screenshot file names (1.1); the first commit approval (1.2); confirming that the install adds workspace links only (2.1); closing heavy processes and any decision above 480 s (10.4, 17.5, 24.1); approval or correction of the Demo_Lesson draft (18.1); the commit and push before the deploy (25); the second Vercel project, its first deploy and the Corepack fallback decision (26.1); the Android, keyboard and screen-reader checks (26.4); the final commit and any push (27).
- Tasks that write the same file sit in different waves: `practice-rules.test.ts` (5.1, 5.2), `recall.ts` (6.1, 6.5), `recall.test.ts` (6.2, 6.5), `recall.property.test.ts` (6.3, 6.4), `practice-arbitraries.ts` (6.3, 7.3, 7.4, 8.3, 8.5, 10.1, 13.2), `reviewQueue.property.test.ts` (7.3, 7.4), `profile.test.ts` (3.2, 9.2), `storage.property.test.ts` (12.3, 12.4), `progress.property.test.ts` (13.2–13.5), `progress-provider.test.tsx` (19.2–19.4), `run.test.ts` (4.1, 18.2, 18.4), `EXTENDING.md` and the wiring files through the Wiring_Hook (6.1, 7.1, 8.1, 15.1, 16.1, 17.1), and `repo-text.test.ts` (20.5).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2"] },
    { "id": 10, "tasks": ["6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["6.3"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["6.5"] },
    { "id": 15, "tasks": ["7.1"] },
    { "id": 16, "tasks": ["7.2"] },
    { "id": 17, "tasks": ["7.3"] },
    { "id": 18, "tasks": ["7.4"] },
    { "id": 19, "tasks": ["8.1"] },
    { "id": 20, "tasks": ["8.2"] },
    { "id": 21, "tasks": ["8.3"] },
    { "id": 22, "tasks": ["8.4"] },
    { "id": 23, "tasks": ["8.5"] },
    { "id": 24, "tasks": ["8.6"] },
    { "id": 25, "tasks": ["9.1"] },
    { "id": 26, "tasks": ["9.2"] },
    { "id": 27, "tasks": ["10.1"] },
    { "id": 28, "tasks": ["10.2"] },
    { "id": 29, "tasks": ["10.3"] },
    { "id": 30, "tasks": ["10.4"] },
    { "id": 31, "tasks": ["12.1"] },
    { "id": 32, "tasks": ["12.2"] },
    { "id": 33, "tasks": ["12.3"] },
    { "id": 34, "tasks": ["12.4"] },
    { "id": 35, "tasks": ["13.1"] },
    { "id": 36, "tasks": ["13.2"] },
    { "id": 37, "tasks": ["13.3"] },
    { "id": 38, "tasks": ["13.4"] },
    { "id": 39, "tasks": ["13.5"] },
    { "id": 40, "tasks": ["14.1"] },
    { "id": 41, "tasks": ["15.1"] },
    { "id": 42, "tasks": ["15.2"] },
    { "id": 43, "tasks": ["15.3"] },
    { "id": 44, "tasks": ["16.1"] },
    { "id": 45, "tasks": ["16.2"] },
    { "id": 46, "tasks": ["16.3"] },
    { "id": 47, "tasks": ["17.1"] },
    { "id": 48, "tasks": ["17.2"] },
    { "id": 49, "tasks": ["17.3"] },
    { "id": 50, "tasks": ["17.4"] },
    { "id": 51, "tasks": ["17.5"] },
    { "id": 52, "tasks": ["18.1"] },
    { "id": 53, "tasks": ["18.2"] },
    { "id": 54, "tasks": ["18.3"] },
    { "id": 55, "tasks": ["18.4"] },
    { "id": 56, "tasks": ["19.1"] },
    { "id": 57, "tasks": ["19.2"] },
    { "id": 58, "tasks": ["19.3"] },
    { "id": 59, "tasks": ["19.4"] },
    { "id": 60, "tasks": ["19.5"] },
    { "id": 61, "tasks": ["19.6"] },
    { "id": 62, "tasks": ["19.7"] },
    { "id": 63, "tasks": ["19.8"] },
    { "id": 64, "tasks": ["19.9"] },
    { "id": 65, "tasks": ["19.10"] },
    { "id": 66, "tasks": ["20.1"] },
    { "id": 67, "tasks": ["20.2"] },
    { "id": 68, "tasks": ["20.3"] },
    { "id": 69, "tasks": ["20.4"] },
    { "id": 70, "tasks": ["20.5"] },
    { "id": 71, "tasks": ["20.6"] },
    { "id": 72, "tasks": ["20.7"] },
    { "id": 73, "tasks": ["20.8"] },
    { "id": 74, "tasks": ["22.1"] },
    { "id": 75, "tasks": ["22.2"] },
    { "id": 76, "tasks": ["23.1"] },
    { "id": 77, "tasks": ["24.1"] },
    { "id": 78, "tasks": ["24.2"] },
    { "id": 79, "tasks": ["26.1"] },
    { "id": 80, "tasks": ["26.2"] },
    { "id": 81, "tasks": ["26.3"] },
    { "id": 82, "tasks": ["26.4"] },
    { "id": 83, "tasks": ["26.5"] }
  ]
}
```
