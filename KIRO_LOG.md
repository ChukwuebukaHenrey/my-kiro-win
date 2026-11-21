# KIRO_LOG — DREAME

> Entries from Days 2–4 on use the entry template in §6 of `docs/Kiro_Setup_and_Operating_Playbook.md`.
> The Day 1 entry was written before that playbook was in the workspace and keeps its original format.

## 2026-11-18 — Day 1

- **Goal:** Set up the empty pnpm/TypeScript workspace, the Kiro steering files and the Context7 MCP configuration for DREAME.
- **Kiro features used:**
  - Spec workflow: the requirements, design and task list for the Day 1 setup were written and executed task by task. `.kiro/specs/dreame-day1-workspace-setup/`
  - Steering: seven steering files were written with rules taken from the Brief, the Architecture Spec and the Submission Checklist. `.kiro/steering/product.md`
  - MCP: connected; confirmed by the user in the Kiro MCP panel. `.kiro/settings/mcp.json`
- **Failed actions:**
  - Writing `.kiro/settings/mcp.json` with the editor tool failed: the write was denied by a Kiro permission rule (kiro-scope) covering `.kiro/settings/`. The user created the file by hand.
  - `Remove-Item .git.ignore` was blocked by Kiro's safety policy as a destructive delete. A manual deletion did not take effect, and the user chose to keep the file.
  - The first Context7 connection attempt in Kiro, with `npx` as the command, failed. The error text was not captured.
- **Files created:**
  - `.kiro/steering/product.md`
  - `.kiro/steering/tech.md`
  - `.kiro/steering/structure.md`
  - `.kiro/steering/security.md`
  - `.kiro/steering/activity-authoring.md`
  - `.kiro/steering/testing.md`
  - `.kiro/steering/new-node-type.md`
  - `.kiro/specs/dreame-day1-workspace-setup/requirements.md`
  - `.kiro/specs/dreame-day1-workspace-setup/design.md`
  - `.kiro/specs/dreame-day1-workspace-setup/tasks.md`
  - `.kiro/specs/dreame-day1-workspace-setup/.config.kiro`
  - `.kiro/specs/dreame-day1-workspace-setup/tasks.meta.json` (Kiro's task-tracking file)
  - `.kiro/settings/mcp.json` (written by hand by the user, see Failed actions)
  - `pnpm-workspace.yaml`
  - `package.json`
  - `tsconfig.base.json`
  - `apps/shop-challenge/README.md`
  - `apps/practice-path/README.md`
  - `packages/schema/README.md`
  - `packages/runtime/README.md`
  - `packages/node-types/README.md`
  - `packages/link/README.md`
  - `packages/storage/README.md`
  - `packages/ui/README.md`
  - `tools/create-app/README.md`
  - `tools/validate/README.md`
  - `activities/README.md`
  - `docs/kiro-evidence/README.md`
  - `.github/workflows/ci.yml`
  - `.gitignore`
  - `.gitattributes`
  - `KIRO_LOG.md`
  - `pnpm-lock.yaml`
- **Commands and results** (PowerShell 5.1.22000.2538, run from the workspace root):
  - `node --version` → `v22.23.5`, exit 0
  - `pnpm --version` → `12.21.0`, exit 0
  - `Test-Path .kiro/hooks` → `False`
  - `.kiro/settings/mcp.json` check → no BOM; `context7` = `{"command":"npx","args":["-y","@upstash/context7-mcp"]}`. `npx -y @upstash/context7-mcp` was not run.
  - `pnpm install` → exit 0; `pnpm-lock.yaml` created with typescript 7.0.2 and simple-git-hooks 2.14.0; the postinstall script wrote `.git/hooks/pre-commit` running `pnpm check`; no ignored-build warning
  - `pnpm exec tsc --version` → `Version 7.0.2`, exit 0, matches the lockfile version
  - `Select-String -Path .git/hooks/pre-commit -Pattern 'pnpm check'` → 1 match (line 9)
  - `pnpm check extra` → `not implemented yet`, exit 0, no `git status` change
  - `pnpm validate extra` → `not implemented yet`, exit 0, no `git status` change
  - `pnpm test:shared extra` → `not implemented yet`, exit 0, no `git status` change
  - `powershell -NoProfile -Command "pnpm check"` → `not implemented yet`, exit 0
  - `git check-ignore -v .kiro/steering/product.md` → no output, exit 1
  - `git check-ignore -v .kiro/settings/mcp.json` → no output, exit 1
  - `git check-ignore -v pnpm-lock.yaml` → no output, exit 1
  - `git check-ignore -v KIRO_LOG.md` → no output, exit 1
  - `git ls-files design-refs` → no output
  - `git check-ignore -v design-refs/linktree.webp` → `.gitignore:4:design-refs/`, exit 0
  - `git ls-files --eol LICENSE README.md` → no line-ending-only changes
  - `git restore -- README.md` → exit 0; `git status --porcelain -- README.md` and `git diff HEAD -- README.md` print nothing
  - Planning_Docs scan (`Select-String` with the seven secret and personal-data patterns from the design) → 0 matches in all three docs
  - `Remove-Item .git.ignore` → blocked by Kiro's safety policy (see Failed actions)
  - `git diff --stat -- .kiro/settings/mcp.json` → no output, exit 0; the file is unchanged, with no BOM and no `env` or `headers` fields
- **Decisions:**
  - typescript 7.0.2 printed a `Version` line, so the Decision 3 fallback to an older TypeScript line was not needed.
  - `pnpm install` showed no ignored-build warning, so the `allowBuilds` key in `pnpm-workspace.yaml` was kept unchanged (no Decision 4 change).
  - `.git.ignore` contained exactly `design-refs` and `.gitignore` has `design-refs/`, so its deletion was authorized; after the blocked delete, the user chose to keep it untracked and unstaged.
- **Problems and fixes:**
  - The editor-tool write of `.kiro/settings/mcp.json` was denied; the user created the file by hand. The file has CRLF line endings on disk, which `.gitattributes` (`* text=auto eol=lf`) normalizes to LF in the repository.
  - `pwsh` is not installed, so the PowerShell 7 repeat of `pnpm check` was skipped.
  - The first Context7 connection attempt with `npx` as the command failed (error text not captured). Changing the command to `cmd` with args `/c npx -y @upstash/context7-mcp` was suggested, but `git diff --stat -- .kiro/settings/mcp.json` printed nothing and the file still has `"command": "npx"`, so that change was not made. The user later confirmed Context7 as connected in the Kiro MCP panel with the unchanged file.
- **Open items:**
  - `Kiro_Setup_and_Operating_Playbook.md` is missing from the workspace.
  - `.git.ignore` is still present, untracked and unstaged.
  - The PowerShell 7 check of the stub scripts has not been run.

## 2026-11-20 — runtime-core spec done

Spec: `runtime-core / tasks 1–10`
Kiro did: Built the schema composer, the Ajv standalone build, the reducer and registry, the graph validator, the property tests and the validate CLI; 62 of 62 runtime-core tasks are done; decisions D1–D12 were approved by the user on 2026-11-19 and are listed in "Decisions for the user" of `.kiro/specs/runtime-core/design.md`.
Caught by: Task 9.2 checks: `pnpm codegen` exit 0, `pnpm typecheck` exit 0, `pnpm test:shared` exit 0 with 21 test files and 378 tests, `pnpm validate activities/*.json` exit 0 with one PASS line, `pnpm validate activities/fixtures/broken-dangling-edge.json` exit 1 with one `refs/dangling-ref` diagnostic, `pnpm validate` with no arguments exit 2, and `pnpm check` exit 0; the three most recent GitHub Actions CI runs on `main` passed.
Fix: None needed.
Kiro features: Spec workflow and tasks, steering, Context7 MCP, sub-agent task runs, fast-check property tests.

## 2026-11-20 — Sub-agent runs timed out

Spec: `runtime-core / tasks 3.6, 5.2, 9.1`
Kiro did: Ran each of these tasks in one sub-agent run.
Caught by: The sub-agent runs for tasks 3.6, 5.2 and 9.1 timed out or aborted.
Fix: Split each of these tasks into smaller tasks.
Kiro features: Spec tasks, sub-agents.

## 2026-11-20 — Generated validators too large

Spec: `runtime-core / Ajv standalone build`
Kiro did: Generated `packages/node-types/generated/core.validators.js`.
Caught by: `pnpm codegen` printed 428,768 bytes JS for that file.
Fix: Requirement 3 of spec `ui-renderer` sets a byte budget for the generated validators.
Kiro features: Spec tasks.

## 2026-11-20 — Day 4 hooks not created

Spec: `runtime-core`
Kiro did: Finished Days 2–4 without creating the Kiro hooks of Brief §8 Day 4.
Caught by: The HANDOFF review of deferred items in `docs/HANDOFF.md` §3.
Fix: Requirement 17 of spec `ui-renderer` adds the Kiro hooks.
Kiro features: Spec workflow.

## 2026-11-21 — ui-renderer spec done

Spec: `ui-renderer`
Kiro did: Built `@dreame/ui`, the smaller validator module, the scans, `EXTENDING.md`, `validate:hook` and the four Kiro hook files; 59 of 59 ui-renderer tasks are marked done in `.kiro/specs/ui-renderer/tasks.md`; decisions D13–D23 and the Playbook reconciliation P1–P12 are in `.kiro/specs/ui-renderer/design.md`.
Caught by: Task 9 checkpoint: `pnpm check` exit 0 on the re-run, with 513 tests; task 12.2: `pnpm check` exit 0, with 52 test files and 550 tests in 84 s, Properties 1–10 passing and axe reporting 0 violations (`color-contrast` disabled under jsdom; the tokens test checks contrast).
Fix: None needed.
Kiro features: Spec workflow and tasks, steering, agent hooks, sub-agent task runs, fast-check property tests.

## 2026-11-21 — Validator module over budget

Spec: `ui-renderer / Requirement 3`
Kiro did: Generated the `core` validator module.
Caught by: `pnpm codegen` printed 428,768 bytes JS before the change.
Fix: Set Ajv `inlineRefs: false` and `code.lines: false` (D14); the module is now 167,384 bytes raw and 11,465 bytes gzip, against limits of 180,000 and 14,000.
Kiro features: Spec tasks.

## 2026-11-21 — Check failed under machine load

Spec: `ui-renderer / task 9`
Kiro did: Ran `pnpm check` at the task 9 checkpoint.
Caught by: `pnpm check` exited 1 after 428.8 s; Vitest reported 6 `[vitest-pool]: Failed to start forks worker ... Timeout waiting for worker to respond` errors, and all 486 tests that ran passed; the cause was machine load, with CPU at 100% and another project's `vite build` running.
Fix: A re-run with no code change passed with exit 0, 513 tests and Vitest 265.2 s.
Kiro features: Spec tasks.

## 2026-11-21 — Regression hook timeout raised

Spec: `ui-renderer / task 12.1`
Kiro did: Measured `pnpm -s test:shared` at 98.82 s, over the 96 s threshold of the 120 s Regression_Hook (H2) timeout.
Caught by: The Requirement 17.10 timing step, checked against the Requirement 17.11 threshold.
Fix: The user raised the H2 timeout from 120 s to 180 s and kept `pnpm -s test:shared`; the new threshold is 144 s.
Kiro features: Agent hooks.

## 2026-11-21 — Rejection focus and CI enforcement deferred

Spec: `ui-renderer`
Kiro did: Left focus after a rejected response, and dependency-cruiser and ESLint `react/no-danger` CI enforcement, out of the ui-renderer scope.
Caught by: Design questions answered by the user on 2026-11-20, recorded in "User answers (2026-11-20)" of `.kiro/specs/ui-renderer/design.md`.
Fix: Both moved to the shop-challenge spec: Requirement 12 covers rejection handling and Requirement 18 covers CI enforcement of the boundary and DOM rules.
Kiro features: Spec workflow.
