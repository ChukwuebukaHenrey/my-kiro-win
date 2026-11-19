# Implementation Plan: DREAME Day 1 Workspace Setup

## Overview

Tasks follow the design's execution flow: pre-checks, steering files, config and workspace files, `pnpm install` and verification gates, pre-stage housekeeping, `KIRO_LOG.md`, commit, push, final report. All file content comes from `design.md` (exact content blocks and the Steering_Set content plan). Source line numbers are in the design's Overview table.

Conventions for every task:
- Write files with the editor tool (UTF-8, no BOM). Never use `Set-Content -Encoding UTF8` in PowerShell 5.1.
- Run PowerShell commands that work in PowerShell 5.1 and 7. Separate commands with `;` or separate calls. Never use `&&` or `||` (Req 11.1).
- Record every command run, in order, with its exact text and exit code, for the final report (Req 11.5).
- **Stop rule:** when a task's stop condition fires, do not start later tasks. Report the failure to the user and go straight to task 11.1 to produce the partial report (Req 11.7). Leave every created file in place.

## Tasks

- [x] 1. Pre-checks and always-on steering files
  - [x] 1.1 Run pre-checks before writing anything
    - Run `Test-Path` for each of the seven Steering_Set paths in `.kiro/steering/` and for `.kiro/settings/mcp.json`; list `.kiro/steering` contents with `Get-ChildItem .kiro/steering -Force` if the folder exists
    - Run `node --version` and `pnpm --version`; record both outputs (pnpm version is used for `packageManager`, expected 12.21.0)
    - Run `Test-Path .kiro/hooks` and record the result
    - **Stop conditions:** a Steering_Set file already exists → leave it unchanged, skip that file, ask the user whether to overwrite (Req 1.11); `mcp.json` exists → leave it unchanged, report its server names, wait for user confirmation (Req 5.5); Node major < 22 → do not run `pnpm install` later, report the version, record it for KIRO_LOG, keep files (Req 6.9)
    - _Requirements: 1.11, 5.5, 6.3, 6.9_

  - [x] 1.2 Write `.kiro/steering/product.md`
    - Front_Matter `inclusion: always` only; first heading `# DREAME`
    - Copy the Brief §0 problem-framing paragraph (line 20), the §0a "What we claim" statement (line 29) and the §0a differentiation statement (line 32) verbatim, emphasis and `>` markers removed, under the headings in the design, each with a `Source:` line
    - Add the `## Claim rules` bullets from the design (Claim_Source wording only; no advantage claim before comparison gate; quoted "Do not use" banned-phrase rule)
    - No other description sentences, no "GDevelop", no parity statement
    - **Stop condition:** a source passage cannot be found → leave it out, no paraphrase, report which passage (Req 2.10)
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 1.3 Write `.kiro/steering/tech.md` and `.kiro/steering/structure.md`
    - Both: Front_Matter `inclusion: always` only
    - tech.md: `## Toolchain` (Source: Architecture Spec §A2; Brief B5) and `## Hosting and backend` (Source: Architecture Spec §A1, §A8) rules as listed in the design
    - structure.md: `## Layout` code block copied from Architecture Spec §A6 (lines 119–141) with every path and comment, `docs/planning/` shown as `docs/`; `## Apps` table from Brief §2 (lines 102–110) with Folder, Real audience, Mechanic, Own node types, emphasis removed; `## Boundaries` (Brief §3) and `## Node type placement` (Brief §2; Architecture Spec §A6) rules
    - **Stop condition:** no source text for a planned rule → omit it and note topic and file for the final report (Req 1.10)
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 1.9, 1.10, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.4 Write `.kiro/steering/security.md`
    - Front_Matter `inclusion: always` only
    - Headings and rules from the design: `## Code execution and DOM` (Brief C1, B5), `## Links` (Brief C1), `## Privacy` (Brief C3), `## Import limits` (Brief C2; Architecture Spec §A3), `## Secrets` (Source: DREAME Day 1 project decision (spec dreame-day1-workspace-setup)), `## Reference files` (Architecture Spec Part C)
    - **Stop condition:** as in 1.3 (Req 1.10)
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 1.9, 1.10, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 2. Context-specific steering files and Steering_Set checks
  - [x] 2.1 Write `.kiro/steering/activity-authoring.md`
    - Front_Matter `inclusion: fileMatch` and `fileMatchPattern: "activities/**/*.json"`
    - `## Graph shape` (Brief §B1, §B2, §B8), `## Conditions` (Brief §B2), `## Demo data` (Brief §C3, §C4; Submission Checklist §2), `## CTA URLs` (Brief §C1) rules from the design
    - _Requirements: 1.2, 1.4, 1.7, 1.8, 1.9, 4.1, 4.2, 4.7, 4.8_

  - [x] 2.2 Write `.kiro/steering/testing.md` and `.kiro/steering/new-node-type.md`
    - testing.md: Front_Matter `inclusion: fileMatch`, `fileMatchPattern: "**/*.test.ts"`; `## Tools and commands`, `## Required property tests` (properties a, b, c), `## Describing results` from the design
    - new-node-type.md: Front_Matter `inclusion: manual` only; `## Steps` numbered 1–12 in the Req 4.5 order; `## Purity` rule
    - _Requirements: 1.2, 1.5, 1.6, 1.7, 1.8, 1.9, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.3 Verify the whole Steering_Set
    - Run the design's checks for Req 1.1 (exactly seven names, no other files or subfolders), 1.2–1.6 (front matter lines), 1.7 (no bullet over 30 words), 1.9 (`Source:` line per rule heading), 2.2–2.4 (normalized `Contains` comparison against Brief lines 20, 29, 32), 2.7 (banned phrases only in the quoted "Do not use" rule), 2.9 (no "GDevelop"), and the key-term matches for 3.4–3.12 and 4.x
    - Fix any failing file and re-run its check
    - **Stop condition:** a check still fails after one fix attempt → report the file, check and output to the user
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 2.2, 2.3, 2.4, 2.7, 2.9_

- [x] 3. MCP config and git ignore / line-ending files
  - [x] 3.1 Write `.kiro/settings/mcp.json`
    - Exact content from the design (only `mcpServers.context7` with `command: "npx"`, `args: ["-y", "@upstash/context7-mcp"]`); no `env`, `headers` or secrets
    - Verify no BOM and the compressed `context7` JSON with the design's 5.1–5.3 check
    - Do not run `npx -y @upstash/context7-mcp` (Req 5.8)
    - Skip this sub-task if task 1.1 found an existing `mcp.json` and the user has not confirmed replacement (Req 5.5)
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.8_

  - [x] 3.2 Write `.gitignore` and `.gitattributes`
    - `.gitignore`: exact lines from the design (`node_modules`, `dist`, `.env*`, `design-refs/`, `coverage/`, `*.log`, `.DS_Store`); no line containing `.kiro`, no `.*` or `*` pattern
    - `.gitattributes`: the single line `* text=auto eol=lf`
    - Do not touch `.git.ignore` here (handled in task 6.2)
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 4. Workspace files, placeholder folders and CI
  - [x] 4.1 Write `pnpm-workspace.yaml`, `package.json` and `tsconfig.base.json`
    - Use the exact content blocks in the design; set `packageManager` to `pnpm@<version from task 1.1>`
    - `pnpm-workspace.yaml` keeps exactly the three `packages` globs plus the build-policy key (Decision 4)
    - Stub scripts use `node -e "console.log('not implemented yet')"`; `postinstall` is exactly `simple-git-hooks`; `simple-git-hooks.pre-commit` is `pnpm check`; only `typescript` and `simple-git-hooks` in `devDependencies`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 7.4, 7.6, 7.7, 11.2_

  - [x] 4.2 Write the 12 Folder_Stubs
    - Create `README.md` in each Placeholder_Folder with line 1 `# <folder path>` and the one sentence from the design's Folder_Stubs table; no other files and no `package.json`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.3 Write `.github/workflows/ci.yml`
    - Exact content from the design: `push`/`pull_request` on `main` only, `permissions: contents: read`, one `ubuntu-latest` job with checkout, `pnpm/action-setup@v4` (no `version` input), `actions/setup-node@v4` with `node-version: 22`, `pnpm install --frozen-lockfile`, `pnpm check`; no secrets
    - _Requirements: 7.10, 7.11, 7.12, 7.13_

  - [x] 4.4 Verify the static files
    - Run the design's checks for 6.1–6.6 (workspace globs, `packageManager`, `engines.node`, two dev deps, `strict` is `True`), 7.1–7.3 (each of the 12 folders contains only `README.md`), and 7.14 (`Test-Path .kiro/hooks`; no file created there by this setup)
    - Parse `ci.yml` by inspection against the design block
    - **Stop condition:** any check fails after one fix attempt → report it to the user
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.3, 7.10, 7.14_

- [x] 5. Install and verification gates
  - [x] 5.1 Run `pnpm install`
    - Precondition: every file from tasks 1–4 exists and Node major ≥ 22 (Req 6.9, 10.1)
    - Run `pnpm install; $LASTEXITCODE; Test-Path pnpm-lock.yaml`
    - If pnpm warns about or fails on the ignored `simple-git-hooks` build, switch the build-policy key in `pnpm-workspace.yaml` to the name pnpm 12 gives in the message, re-run install once, and note the change for KIRO_LOG (design Decision 4)
    - **Stop condition:** non-zero exit or no lockfile → report the pnpm output, stage nothing, create no commit (Req 10.10)
    - _Requirements: 6.9, 10.1, 10.10_

  - [x] 5.2 Check the TypeScript compiler
    - Run `pnpm exec tsc --version; $LASTEXITCODE` and `Select-String -Path pnpm-lock.yaml -Pattern 'typescript@(\d+\.\d+\.\d+)'`; pass when exit 0, output matches `Version X.Y.Z`, and X.Y.Z equals the lockfile version
    - **Stop condition:** non-zero exit or no `Version` line → report output and exit code, note the failure for KIRO_LOG, no commit; offer the design Decision 3 fallback (`pnpm view "typescript@<7" version`, change the `typescript` range, re-run install and this check) and apply it only with the user's agreement (Req 6.10)
    - _Requirements: 6.5, 6.7, 6.10_

  - [x] 5.3 Check the pre-commit hook and stub scripts
    - Run `Select-String -Path .git/hooks/pre-commit -Pattern 'pnpm check'`; pass on one match (Req 7.8)
    - For each of `check`, `validate`, `test:shared`: `$a = git status --porcelain; pnpm <script> extra; $LASTEXITCODE; $b = git status --porcelain; Compare-Object $a $b`; pass when output has the line `not implemented yet`, exit 0, no diff
    - Repeat `pnpm check` through `powershell -NoProfile -Command "pnpm check"` and `pwsh -NoProfile -Command "pnpm check"` (skip `pwsh` if not installed and note it)
    - **Stop condition:** hook missing or lacks `pnpm check` → report the observed hook state, no commit until the user decides (Req 7.9); a stub script fails → report output and exit code
    - _Requirements: 7.4, 7.5, 7.6, 7.8, 7.9, 11.2_

  - [x] 5.4 Run ignore and line-ending checks
    - Run `git check-ignore -v <path>; $LASTEXITCODE` for `.kiro/steering/product.md`, `.kiro/settings/mcp.json`, `pnpm-lock.yaml`, `KIRO_LOG.md`; pass on no output and exit 1 (Req 8.3)
    - Run `git ls-files design-refs`; if empty, run `git check-ignore -v design-refs/linktree.webp; $LASTEXITCODE`; pass when exit 0 and output names `.gitignore` and `design-refs/` (Req 8.4)
    - Run `git ls-files --eol LICENSE README.md` and `git status --porcelain` to find line-ending-only changes in tracked files (Req 8.8)
    - **Stop conditions:** any check-ignore result differs → no commit, report path, full output and exit code (Req 8.9); `git ls-files design-refs` lists files → list them, do not untrack without confirmation, warn that pushed history keeps them (Req 8.10); line-ending-only changes → list each path, exclude from the commit unless the user confirms (Req 8.8)
    - _Requirements: 8.3, 8.4, 8.8, 8.9, 8.10_

- [x] 6. Pre-stage housekeeping
  - [x] 6.1 Restore the root README.md
    - Run `git restore -- README.md; git status --porcelain -- README.md; git diff HEAD -- README.md`; pass when both outputs are empty
    - **Stop condition:** either output is non-empty → report it, stage nothing
    - _Requirements: 10.3, 10.4_

  - [x] 6.2 Handle `.git.ignore`
    - Run `(Get-Content .git.ignore -Raw).Trim() -ceq 'design-refs'`
    - If `True` and `.gitignore` contains the line `design-refs/`, run `Remove-Item .git.ignore` and record "deleted because `.gitignore` supersedes it"
    - If `False`, leave the file unchanged and unstaged, report its content, and record "kept" for the final report (Req 8.7)
    - _Requirements: 8.6, 8.7, 8.11_

  - [x] 6.3 Scan the Planning_Docs for secrets and personal data
    - Run `Select-String` (case-insensitive) on each of the three Planning_Docs with the design's patterns: key/secret/token/password assignments, `AKIA…`, `ghp_…`, `sk-…`, email, and the two phone patterns
    - Record which Planning_Docs are clean; only clean docs are staged in task 9.1
    - **Stop condition (per file):** a match → leave that doc unstaged and report file path and line number of each match (Req 10.14)
    - Do not modify any Planning_Doc, `LICENSE` or `docs/README.md` (Req 10.3)
    - _Requirements: 10.3, 10.13, 10.14_

- [x] 7. Checkpoint - Ensure all checks pass
  - Ensure all checks in tasks 2.3, 4.4, 5.1–5.4 and 6.1–6.3 passed, ask the user if questions arise.

- [x] 8. Write the Kiro log
  - [x] 8.1 Write `KIRO_LOG.md`
    - Use the provisional format in the design: note above the entry that the §6 template of `Kiro_Setup_and_Operating_Playbook.md` is not in the workspace and the format is provisional; do not label anything as the §6 template
    - Exactly one entry with heading containing `2026-11-18`
    - Kiro features: spec workflow (`.kiro/specs/dreame-day1-workspace-setup/`), steering (a Steering_File path), MCP described as "configured; connection not yet confirmed by the user" (`.kiro/settings/mcp.json`); record any feature that failed with its error text (Req 9.7)
    - Files created: one path each, equal to the planned staged set minus the Planning_Docs (steering files, the four spec files `requirements.md`, `design.md`, `tasks.md`, `.config.kiro`, `mcp.json`, `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, 12 Folder_Stubs, `ci.yml`, `.gitignore`, `.gitattributes`, `KIRO_LOG.md`, `pnpm-lock.yaml`); exclude `LICENSE`, `README.md`, `docs/README.md`, Planning_Docs, `.git.ignore`, `design-refs/`
    - Commands and results: only commands already run with their exit codes; record any Decision 3 or Decision 4 change; no statement about the commit or push
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_

  - [x] 8.2 Verify `KIRO_LOG.md`
    - Run `Select-String -Path KIRO_LOG.md -Pattern 'correct by construction|novel|production ready|production-ready|without hallucinations|guarantee|better than|first ever|commit|push'` and fix any match (the word "commit" may appear only inside file or command names already run)
    - Confirm one `2026-11-18` heading and the exact MCP status phrase
    - _Requirements: 9.2, 9.5, 9.8, 9.9_

- [x] 9. Stage, commit and verify the commit
  - [x] 9.1 Stage files by explicit paths
    - Run one `git add` listing the seven steering paths, `.kiro/specs/dreame-day1-workspace-setup`, `.kiro/settings/mcp.json`, `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, the 12 Folder_Stub paths, `.github/workflows/ci.yml`, `.gitignore`, `.gitattributes`, `KIRO_LOG.md`, `pnpm-lock.yaml`, and each clean Planning_Doc from task 6.3
    - Never use `git add .`, `-A`, `--all` or `git add docs`; do not stage line-ending-only changes the user excluded in task 5.4
    - Run `git status --porcelain` and confirm `docs/README.md` and the two `.txt` notes are still untracked and unstaged
    - _Requirements: 10.2, 10.3, 8.8_

  - [x] 9.2 Create the Init_Commit
    - Run `git commit -m "chore: init workspace + .kiro"`; confirm the output contains `not implemented yet` from the hook; run `git log -1 --format=%s` and confirm the exact subject
    - **Stop condition:** hook or commit exits non-zero → report the output, leave files staged, never retry with `--no-verify` (Req 10.11)
    - _Requirements: 10.5, 10.11_

  - [x] 9.3 Verify commit contents
    - Run `git ls-files design-refs node_modules .git.ignore` (pass when empty) and `git show --name-only --format= HEAD` (pass when every path is in the 9.1 staged set)
    - Record the abbreviated hash with `git rev-parse --short HEAD`
    - **Stop condition:** either check fails → do not push, report the output to the user
    - _Requirements: 10.6, 11.6_

- [x] 10. Push to origin
  - [x] 10.1 Check branch and remote
    - Run `git branch --show-current` and `git remote get-url origin`; pass when `main` and `https://github.com/ChukwuebukaHenrey/my-kiro-win.git`
    - **Stop condition:** either differs → do not push, ask the user how to proceed (Req 10.12)
    - _Requirements: 10.12_

  - [x] 10.2 Push the Init_Commit
    - Precondition: tasks 6.1, 9.2 and 9.3 passed (Req 10.7)
    - Run `git push origin main` with no force option
    - **Stop condition:** non-zero exit → report the git error text, keep the commit local, do not run `git pull`, `git rebase`, `git reset` or a forced push without user confirmation (Req 10.8)
    - _Requirements: 10.7, 10.8_

  - [x] 10.3 Confirm the remote matches
    - Run `git rev-parse HEAD` and `git rev-parse origin/main`; pass when the hashes are equal
    - _Requirements: 10.9_

- [x] 11. Final report and user confirmations
  - [x] 11.1 Present the final (or partial) report
    - Show the tree from `Get-ChildItem -Recurse -Force -Name | Where-Object { $_ -notmatch '^(\.git|node_modules|design-refs)(\\|$)' }` (Req 11.3)
    - List every command run, in order, with exact text and exit code (Req 11.5)
    - Give pass/fail for Req 6.7, 7.8, 8.3, 8.4, 10.1, 10.5, 10.6, the abbreviated Init_Commit hash, and push success or failure (Req 11.6)
    - State whether `.git.ignore` was deleted and why (Req 8.11); list omitted rules and target files (Req 1.10) and missing Brief passages (Req 2.10), if any
    - List open items with the input each needs: Introduction item 1 (Missing playbook) and the Context7 confirmation (Req 11.4)
    - If setup stopped early, name the failed step, its error text and the steps not run (Req 11.7)
    - _Requirements: 1.10, 2.10, 8.11, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [-] 11.2 Ask the user to confirm Context7 and the GitHub page
    - Ask the user to confirm in the Kiro MCP panel that `context7` is connected with at least one tool listed (Req 5.6)
    - If the push succeeded and hashes matched, ask the user to confirm the GitHub About section shows the MIT license and `.kiro` appears in the root file list (Req 10.9)
    - If the user reports a Context7 error: keep `mcp.json` unchanged, ask before any change to `command` or `args`, and, with the user's agreement, record the error text and "unresolved" status in `KIRO_LOG.md` in a new follow-up commit (never `--amend`) (Req 5.4, 5.7, 9.7)
    - _Requirements: 5.4, 5.6, 5.7, 9.7, 9.9, 10.9_

## Notes

- No optional tasks and no property-based test tasks: the design's Correctness Properties section states PBT does not apply. Verification is the command-level checks inside each task.
- Each task references requirement clauses for traceability; exact file content is in `design.md`.
- Any stop condition ends the flow at that point and jumps to task 11.1 for the partial report.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "4.3"] },
    { "id": 2, "tasks": ["2.3", "4.4"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3"] },
    { "id": 6, "tasks": ["5.4"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2"] },
    { "id": 12, "tasks": ["9.3"] },
    { "id": 13, "tasks": ["10.1"] },
    { "id": 14, "tasks": ["10.2"] },
    { "id": 15, "tasks": ["10.3"] },
    { "id": 16, "tasks": ["11.1"] },
    { "id": 17, "tasks": ["11.2"] }
  ]
}
```
