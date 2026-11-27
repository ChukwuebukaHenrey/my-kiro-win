# Implementation Plan: create-app

## Overview

Build the Scaffold as a pure planner plus an I/O shell, a plain `.tmpl` template, three small shared-wiring edits, a third app built by the Scaffold, a shared-foundation test, and the `EXTENDING.md` section. Each task builds on the last and ends wired in. Follow the Task conventions below.

## Task conventions

These apply to every task (mirrors `.kiro/specs/practice-path/tasks.md`).

- Write files with the editor tool, UTF-8 without BOM, LF endings. Write no file under `.kiro/settings/`, run no `Remove-Item`, start no `npm`/`yarn`. Edit no file under `packages/*/generated/` or `apps/*/generated/` by hand.
- Commands must run in Windows PowerShell 5.1: separate with `;`, check `; $LASTEXITCODE`, never `&&` or `||`. A Verify step passes only when each command prints the expected exit code (0 unless stated) and meets its condition.
- Run Vitest only as `pnpm exec vitest run <path>`, never watch mode. App/validate tests import generated validators, so a Verify that runs them starts with `pnpm codegen;`. Each command finishes within 180,000 ms, except a full `pnpm check`, which gets 600,000 ms; if longer, stop and report.
- Relative imports use explicit `.ts`/`.tsx` extensions; erasable syntax only (no `enum`, `namespace`, parameter properties).
- Add no dependency; the design adds none. If one seems needed, stop and ask the user.
- Never stage `packages/*/generated/`, `apps/*/generated/`, `apps/*/dist/`, `design-refs/`, `.vercel`, nor the five untracked files (`.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt`, `docs/ui-illustration-builder.txt`). Never `git add -A`/`git add .`, `--no-verify`, `--amend` or a co-author trailer. Commit only with the user's approval and only as `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "<message>"; $LASTEXITCODE`. Push only when the user asks, after reporting `git rev-list --count origin/main..HEAD; $LASTEXITCODE`.
- Use no phrase from the "Do not use" line of `.kiro/steering/product.md` in any file. Claims use only Brief §0/§0a wording.
- Leave the four files in `.kiro/hooks/` unchanged. The Post_Task_Hook (H4) runs `pnpm -s check` (600 s) after each task; read its result and fix failures in the same session.
- Property test P1 uses fast-check, `numRuns >= 100`, tag `Feature: create-app, Property 1: <title>`, comment `**Validates: Requirements 1.1, 2.4, 3.1**`.
- Model switching per `.kiro/steering/model-switching.md`; see the per-task model-fit column. Ask the user to switch only for a run of two or more consecutive cheaper sub-tasks or one long-running task.

## Tasks

- [x] 1. Name rules and placeholders
  - [x] 1.1 Create `tools/create-app/package.json` (name `@dreame/create-app`, `bin.create-app` -> `src/cli.ts`) and `src/name.ts` with `RESERVED_NAMES`, `isValidName` (regex `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, length 2..31, not reserved) and `derive`
    - Design: C1, D3. _Requirements: 1.1_
    - Model fit: Claude Opus 5.5 (new shared tool code).
  - [x] 1.2 Write `test/name.test.ts` for valid names, bad patterns, length bounds and each reserved name
    - _Requirements: 1.1_
    - Model fit: Sonnet 5.5 (single-file example test on a given predicate).
    - Verify: `pnpm exec vitest run tools/create-app/test/name.test.ts; $LASTEXITCODE`

- [x] 2. Template files
  - [x] 2.1 Add the `.tmpl` template tree under `tools/create-app/template/` (app files, routes, profile, registry, codegen, check-dist, vercel.json with §A3 headers, README, one test, and `activities/__APP_ID__-sample.json.tmpl`), deriving the minimal app from `apps/practice-path`, using only its listed dependencies, core node types only, and placeholders from D3
    - Design: C2 tree, D1, D3, D7; mirror `apps/practice-path` src/app and vercel.json. _Requirements: 2.1, 2.2, 2.3, 10.3_
    - Model fit: Claude Opus 5.5 (deriving the template is design work).
  - [x] 2.2 Verify the template is inert and complete
    - _Requirements: 2.1_
    - Model fit: Sonnet 5.5 (verify-only).
    - Verify: `(Get-ChildItem -Recurse -File tools/create-app/template | Where-Object { $_.Extension -ne '.tmpl' }).Count` prints `0`; `Select-String -Path tools/create-app/template/* -Pattern 'innerHTML|dangerouslySetInnerHTML|eval\(|new Function'` prints nothing

- [ ] 3. Planner and property test
  - [-] 3.1 Write `src/plan.ts` (`planFiles`, `PlannedFile`, `PlanResult`): list the template, map `__APP_ID__` paths, render placeholders, assert no `__APP_` remains, reject invalid names
    - Design: C2, D2. _Requirements: 1.1, 2.4, 3.1, 3.3_
    - Model fit: Claude Opus 5.5 (core shared logic).
  - [ ] 3.2 Write `test/plan.property.test.ts` — **Property 1: The planner obeys the name rule, write scope and placeholder rule**
    - **Validates: Requirements 1.1, 2.4, 3.1**
    - Model fit: Claude Opus 5.5 (property test for a shared package).
    - Verify: `pnpm exec vitest run tools/create-app/test/plan.property.test.ts; $LASTEXITCODE`

- [ ] 4. CLI shell and wiring to root scripts
  - [ ] 4.1 Write `src/next-steps.ts` (`NEXT_STEPS`), `src/run.ts` (`run`, `CliIo`: checks, existence, write, print) and `src/cli.ts` (real `CliIo` over `node:fs`/`node:path`/`process`, `--root`); add the root `create-app` script and point the root `codegen` script at `codegen-all.ts`
    - Design: C3, D2, D6; edit root `package.json` only. _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 10.1_
    - Model fit: Claude Opus 5.5 (shared tool + root script).
  - [ ] 4.2 Write `src/codegen-all.ts` (node-types then each `apps/*` with a `codegen` script) and `test/run.test.ts` (rejections, existing-path refusal, success in a temp Root, UTF-8/no-BOM/LF bytes, output and next-steps lines, import scan)
    - Design: C4, D4. _Requirements: 1.2, 1.3, 3.1, 3.3, 4.1, 4.2, 5.1, 10.1_
    - Model fit: Claude Opus 5.5 (discovery script + CLI tests).
    - Verify: `pnpm codegen; $LASTEXITCODE` prints `0` (discovers all apps); `pnpm exec vitest run tools/create-app/test/run.test.ts; $LASTEXITCODE`

- [ ] 5. Generalise the lint rule
  - [ ] 5.1 Change the `react-free-no-ui` `from` path in `tools/lint/src/depcruise-rules.ts` to match `apps/[^/]+/src/node-types/` and `apps/[^/]+/src/profile.ts`, keeping `practice-path`'s `progress`/`share`; update `tools/lint/test/lint-rules.test.ts` to cover a new app folder
    - Design: D5. _Requirements: 5.2_
    - Model fit: Claude Opus 5.5 (shared lint rule).
    - Verify: `pnpm exec vitest run tools/lint/test/lint-rules.test.ts; $LASTEXITCODE`

- [ ] 6. Checkpoint — Scaffold ready
  - Ensure all tests pass, ask the user if questions arise.
  - Model fit: Sonnet 5.5 (checkpoint run).

- [ ] 7. Create the third app with the Scaffold
  - [ ] 7.1 Run `pnpm create-app quiz-sprint`, then apply the three printed Next_Steps edits by hand (`tools/validate/package.json` dep, `tools/validate/src/run.ts` import + `PROFILES` entry, the Shared_Foundation_Test import + entry) and edit `activities/quiz-sprint-sample.json` to the three-question score quiz of D8; record the Scaffold wall time, files/lines written, and files/lines changed by hand
    - Design: D6, D8, C5. _Requirements: 6.1, 6.2, 7.1_
    - Model fit: Claude Opus 5.5 (runs the tool, applies edits, needs judgement on any failure).
    - Verify: `pnpm codegen; $LASTEXITCODE` prints `0`; `pnpm exec vitest run tools/validate/test/run.test.ts; $LASTEXITCODE`

- [ ] 8. Shared-foundation test
  - [ ] 8.1 Write `tools/validate/test/shared-foundation.test.ts`: for each profile in `PROFILES`, assert the `content`/`choice`/`outcome` node-type objects are identical to `coreNodeTypes`; for each app `./views`, assert the core Render components are identical to `@dreame/ui`'s; replay one fixed core manifest through each profile and assert equal final status and outcome. Add a comment that this is evidence for the properties tested, not a universal proof
    - Design: C5, D10. _Requirements: 8.1, 8.2, 8.3, 5.3_
    - Model fit: Claude Opus 5.5 (shared test touching runtime and all apps).
    - Verify: `pnpm codegen; $LASTEXITCODE` prints `0`; `pnpm exec vitest run tools/validate/test/shared-foundation.test.ts; $LASTEXITCODE`

- [ ] 9. EXTENDING.md section
  - [ ] 9.1 Add a `## Create a new app` section to `EXTENDING.md` after `## Node types` with the command, the name rule and the Next_Steps; extend `tools/validate/test/extending-doc.test.ts` to check the section holds the command and each Next_Steps line
    - Design: C3 NEXT_STEPS. _Requirements: 9.1, 9.2_
    - Model fit: Sonnet 5.5 (doc text from given facts + one test edit).
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts tools/validate/test/repo-text.test.ts; $LASTEXITCODE`

- [ ] 10. Measure effort and record the log
  - [ ] 10.1 Build the third app and record wall time; write the `KIRO_LOG.md` entry with the Scaffold wall time, files/lines written, files/lines changed by hand and every manual fix
    - Design: D9. _Requirements: 6.3, 7.1, 7.2_
    - Model fit: Sonnet 5.5 (timing run + log text from recorded facts).
    - Verify: `pnpm --filter @dreame/quiz-sprint run build; $LASTEXITCODE` prints `0`

- [ ] 11. Final checkpoint — full check
  - [ ] 11.1 Run one full `pnpm check`
    - _Requirements: 6.3, 10.2_
    - Model fit: Sonnet 5.5 (one long verify-only run; 600,000 ms).
    - Verify: `pnpm check; $LASTEXITCODE` prints `0`

- [ ] 12. Commit checkpoint
  - Ask the user before committing. If approved, stage only this spec's new/changed tracked files (the `tools/create-app` sources and template, `apps/quiz-sprint` sources, `activities/quiz-sprint-sample.json`, the edited shared files, `EXTENDING.md`, `KIRO_LOG.md`) by explicit path — never `git add .`, never the five untracked files, never `generated`/`dist`. Then ask whether to push, reporting `git rev-list --count origin/main..HEAD; $LASTEXITCODE` first.
  - Model fit: Sonnet 5.5 (approved git steps).

## Notes

- No sub-task is optional: each references its requirements and is placed next to the code it checks.
- Property 1 is the only property test (plan instruction); all other checks are example, integration or smoke per the design prework.
- Checkpoints (tasks 6, 11, 12) run by hand and are not in the dependency graph.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["8.1", "9.1"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["11.1"] }
  ]
}
```
