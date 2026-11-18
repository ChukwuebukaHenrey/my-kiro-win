# Requirements Document

## Introduction

This spec covers Day 1 (18 Nov 2026) of the DREAME build for the Kiroween 2026 Skeleton Crew category. DREAME is the project name for the toolkit described in `docs/Skeleton_Crew_Audit_and_Brief_v2.md` (the Brief) and `docs/Architecture_and_UI_Spec.md` (the Architecture Spec). The GDevelop PDFs in `design-refs/` are the product reference. The logo is out of scope for Day 1.

Day 1 produces the repository foundation only: Kiro steering, the Context7 MCP configuration, an empty pnpm/TypeScript workspace with placeholder folders and scripts, a pre-commit hook, a CI skeleton, git ignore and line-ending rules, the first Kiro log entry, and the first commit and push. No application code, Kiro hooks, or runtime dependencies are added.

The environment is Windows with PowerShell. On 18 Nov 2026 the installed tools were Node v22.23.5 and pnpm 12.21.0. The remote was `origin` → `https://github.com/ChukwuebukaHenrey/my-kiro-win.git`, on branch `main`.

### Open dependencies, assumptions and flagged issues

1. **Missing playbook (open dependency).** `Kiro_Setup_and_Operating_Playbook.md` is not in the workspace. The KIRO_LOG template in its §6 is unavailable. Requirement 9 therefore asks for a provisional entry that is marked as pending that template. The Setup_Agent must not invent the template.
2. **Doc paths.** The docs referenced as `docs/planning/...` are directly in `docs/`. This spec uses the actual paths and does not move any doc.
3. **Root README deletion (resolved).** At session start `git status` showed the tracked root `README.md` deleted in the working tree. The user said to keep README.md, so the Setup_Agent restores the tracked root `README.md` from HEAD before staging (Requirements 10.3 and 10.4).
4. **Misnamed ignore file (resolved).** An untracked file named `.git.ignore` (containing `design-refs`) exists at the Workspace_Root. Git does not read it; it is a misnamed `.gitignore`. Decision: delete it, because the Ignore_File supersedes it. The Setup_Agent deletes it only if its trimmed content is exactly `design-refs`, and reports the outcome (Requirements 8.6, 8.7 and 8.11).
5. **Untracked docs (resolved).** `docs/` is untracked. Decision: the Init_Commit includes the three Planning_Docs unmodified, because the steering files cite them. `docs/README.md` and the two personal prompt notes (`read as soon as you finish kiro agent.txt`, `ui-illustration-builder.txt`) stay untracked and unstaged. Before staging, the Setup_Agent scans the Planning_Docs for secrets and personal data (Requirements 10.13 and 10.14).
6. **product.md scope (assumption).** The user asked that product.md describe the product and its claims using only Brief §0 and §0a wording. App mechanics and audiences (Brief §2) therefore go in structure.md, not product.md.
7. **Dependency allowlist.** Only TypeScript and simple-git-hooks are installed today. Both are named in the user request. Neither the Architecture Spec nor the Brief names simple-git-hooks; the Submission Checklist §3 step 8 does.
8. **GDevelop reference.** No steering file reproduces GDevelop branding or claims parity with GDevelop.

## Glossary

- **Setup_Agent**: The Kiro agent that carries out the Day 1 setup tasks in this spec.
- **Workspace_Root**: The repository root, `c:\Users\ADMIN\my-kiro-win`.
- **Steering_Set**: The seven files in `.kiro/steering/`: product.md, tech.md, structure.md, security.md, activity-authoring.md, testing.md, new-node-type.md.
- **Steering_File**: Any single file in the Steering_Set.
- **Front_Matter**: A YAML block delimited by `---` lines that starts on line 1 of a Steering_File and sets `inclusion` (and `fileMatchPattern` where needed).
- **Steering_Rule**: One bullet in a Steering_File that states one instruction.
- **Claim_Source**: The text of Brief §0 ("Problem framing" paragraph) and Brief §0a, as found in `docs/Skeleton_Crew_Audit_and_Brief_v2.md`.
- **Banned_Phrase_List**: The case-insensitive phrases "correct by construction", "novel", "production ready", "production-ready", "without hallucinations", "guarantee", "better than", "first ever".
- **MCP_Config**: The file `.kiro/settings/mcp.json`.
- **Root_Manifest**: The root `package.json`.
- **Workspace_Config**: The root `pnpm-workspace.yaml`.
- **Base_TSConfig**: The root `tsconfig.base.json`.
- **Placeholder_Folder**: Each of `apps/shop-challenge`, `apps/practice-path`, `packages/schema`, `packages/runtime`, `packages/node-types`, `packages/link`, `packages/storage`, `packages/ui`, `tools/create-app`, `tools/validate`, `activities`, `docs/kiro-evidence`.
- **Folder_Stub**: The `README.md` file inside a Placeholder_Folder.
- **Stub_Script**: Each of the root scripts `check`, `validate` and `test:shared`.
- **Git_Hook_Config**: The simple-git-hooks configuration and the `postinstall` script in the Root_Manifest.
- **CI_Workflow**: The file `.github/workflows/ci.yml`.
- **Ignore_File**: The root `.gitignore`.
- **Attributes_File**: The root `.gitattributes`.
- **Kiro_Log**: The root `KIRO_LOG.md`.
- **Init_Commit**: The git commit with message `chore: init workspace + .kiro`.
- **Lockfile**: The root `pnpm-lock.yaml`.
- **Planning_Docs**: The three files `docs/Skeleton_Crew_Audit_and_Brief_v2.md`, `docs/Architecture_and_UI_Spec.md` and `docs/Submission_Checklist_and_Compliance.md`.
- **Supported_Shells**: Windows PowerShell 5.1, PowerShell 7, and bash (Git Bash on Windows, or bash on Linux in CI). Whichever Supported_Shell invokes pnpm, pnpm runs package scripts through `cmd.exe` on Windows and through `sh` on Linux.

## Requirements

### Requirement 1: Steering file set and front matter

**User Story:** As the solo builder, I want seven steering files with correct inclusion settings, so that Kiro loads the right rules at the right time.

#### Acceptance Criteria

1. THE Setup_Agent SHALL create exactly the seven files of the Steering_Set in `.kiro/steering/`, named exactly product.md, tech.md, structure.md, security.md, activity-authoring.md, testing.md and new-node-type.md in lowercase, so that `.kiro/steering/` contains no other files or subfolders when the Setup_Agent finishes.
2. THE Setup_Agent SHALL write the Front_Matter of every Steering_File so that line 1 of the file is `---`, the block ends at the next line that is exactly `---`, the block parses as valid YAML, and the block contains no keys other than `inclusion` and `fileMatchPattern`.
3. THE Front_Matter of product.md, tech.md, structure.md and security.md SHALL set `inclusion: always` and SHALL NOT contain a `fileMatchPattern` key.
4. THE Front_Matter of activity-authoring.md SHALL set `inclusion: fileMatch` and `fileMatchPattern: "activities/**/*.json"`.
5. THE Front_Matter of testing.md SHALL set `inclusion: fileMatch` and `fileMatchPattern: "**/*.test.ts"`.
6. THE Front_Matter of new-node-type.md SHALL set `inclusion: manual` and SHALL NOT contain a `fileMatchPattern` key.
7. THE Steering_Set SHALL contain at least one Steering_Rule in every Steering_File, and SHALL express each Steering_Rule as a single bullet that starts with an imperative verb and contains at most 30 words, counted as whitespace-separated tokens and excluding the bullet marker.
8. THE Steering_Set SHALL state each Steering_Rule so that it names at least one concrete checkable item (a file or folder path, a script or command name, a configuration key, a dependency name, or a quoted text pattern) and a reviewer can decide pass or fail by inspecting that item in code, configuration or a command result.
9. THE Steering_Set SHALL take every Steering_Rule from the Brief, the Architecture Spec, or the Submission Checklist, and SHALL cite the source next to each group of rules, where a group is the set of bullets under one Markdown heading and the citation names the source document and a section number that exists in that document, or, for Requirement 3.11 only, the Day 1 project decision recorded in this spec, cited as `Source: DREAME Day 1 project decision (spec dreame-day1-workspace-setup)`.
10. IF the Brief, the Architecture Spec and the Submission Checklist contain no source text for a rule the Setup_Agent intends to write, THEN THE Setup_Agent SHALL omit that rule from the Steering_Set and SHALL list the omitted topic and the Steering_File it was meant for in its end-of-task report.
11. IF a file with a Steering_Set name already exists in `.kiro/steering/` when the Setup_Agent starts, THEN THE Setup_Agent SHALL leave the existing file unchanged, SHALL stop work on that Steering_File, and SHALL ask the user whether to overwrite it.

### Requirement 2: Product steering and claim wording

**User Story:** As the solo builder, I want product.md to use only the approved claim wording, so that Kiro never writes overclaims into code, docs or the submission.

#### Acceptance Criteria

1. THE product.md Steering_File SHALL name the project DREAME in the first markdown heading that follows the Front_Matter.
2. THE product.md Steering_File SHALL contain the Brief §0 problem-framing paragraph verbatim, from "AI coding agents can generate" to "they are not a universal proof of correctness.", where verbatim means that the text matches the source character for character, including punctuation, after both texts have their markdown emphasis markers (`**`, `*`, `_`) and leading blockquote markers (`>`) removed and runs of whitespace collapsed to one space.
3. THE product.md Steering_File SHALL contain the Brief §0a "What we claim" statement verbatim, from "The toolkit combines" to "for storing activities.", using the verbatim comparison defined in criterion 2.
4. THE product.md Steering_File SHALL contain the Brief §0a differentiation statement verbatim, from "Our hypothesis is" to "where comparative testing shows one.", using the verbatim comparison defined in criterion 2.
5. THE product.md Steering_File SHALL contain no product-description or claim sentence that fails to match a sentence of the Claim_Source under the verbatim comparison defined in criterion 2. Only the Front_Matter, markdown headings, Steering_Rules and source-section citations are exempt.
6. THE product.md Steering_File SHALL contain a Steering_Rule of at most 30 words that requires claims in the README, the submission form text, the demo video narration and on-screen text, and blog posts to use only Claim_Source wording.
7. THE Steering_Set SHALL contain zero case-insensitive substring matches of any Banned_Phrase_List phrase in the full text of every Steering_File, including Front_Matter, so that "novelty", "guaranteed" and "guarantees" also count as matches. The only exception is a match that appears inside double quotes in a Steering_Rule that starts with "Do not" and prohibits that phrase.
8. THE product.md Steering_File SHALL contain a Steering_Rule of at most 30 words that prohibits claiming an advantage over H5P, Lumi, Twine, Optimove Minigames, Genially or plain React + Kiro until the matching Brief §0a comparison-gate task has been run and reported.
9. THE product.md Steering_File SHALL contain zero case-insensitive occurrences of "GDevelop" and no statement of parity with any named product.
10. IF the Brief §0 problem-framing paragraph, the §0a "What we claim" statement or the §0a differentiation statement cannot be found in `docs/Skeleton_Crew_Audit_and_Brief_v2.md`, THEN THE Setup_Agent SHALL leave out substitute or paraphrased wording for that passage in product.md and SHALL report which passage is missing.

### Requirement 3: Tech, structure and security steering

**User Story:** As the solo builder, I want the core architecture and security rules in always-on steering, so that every Kiro session follows them.

#### Acceptance Criteria

1. THE tech.md Steering_File SHALL contain, citing Architecture Spec §A2 and Brief B5, one Steering_Rule for each of: TypeScript strict mode, pnpm workspaces, Node 22, validators precompiled at build time with Ajv standalone code generation with no schema compilation at runtime, and adding a dependency only when the Architecture Spec or the Submission Checklist names it and asking the user before adding any other dependency.
2. THE tech.md Steering_File SHALL contain, citing Architecture Spec §A1, a Steering_Rule prohibiting an application backend, database, authentication service and server-side activity storage in the hackathon build, and a Steering_Rule keeping the v2 backend of Architecture Spec §A8 in ROADMAP.md only.
3. THE structure.md Steering_File SHALL list every folder and file path of the Architecture Spec §A6 layout, with that path's §A6 comment where one exists, and SHALL show `docs/planning/` as `docs/` to match the actual workspace location.
4. THE structure.md Steering_File SHALL contain, citing Brief §3, a Steering_Rule stating that no file under `packages/runtime` imports code from `apps/` or imports `react` or `react-dom`.
5. THE structure.md Steering_File SHALL contain, citing Brief §2 and Architecture Spec §A6, a Steering_Rule keeping the shared node types `content`, `choice` and `outcome` in `packages/node-types`, `collectionSelect` and `recommendOutcome` in `apps/shop-challenge`, and `recall` and `reviewQueue` in `apps/practice-path`.
6. THE structure.md Steering_File SHALL describe Shop Challenge and Practice Path with the Folder, Real audience, Mechanic and Own node types values of the Brief §2 table, copied verbatim apart from markdown emphasis.
7. THE security.md Steering_File SHALL contain, citing Brief C1 and B5, Steering_Rules prohibiting `eval`, `new Function`, `innerHTML` and `dangerouslySetInnerHTML` in source files under `apps/`, `packages/` and `tools/`.
8. THE security.md Steering_File SHALL contain, citing Brief C1, a Steering_Rule requiring every CTA URL and every link to another origin to use only the `https:` scheme, checked in both the schema and the renderer and rendered with `rel="noopener noreferrer"`, so that `javascript:`, `http:` and `data:` URLs are rejected.
9. THE security.md Steering_File SHALL contain, citing Brief C3, Steering_Rules prohibiting collection of personal data (including names), prohibiting user accounts, prohibiting analytics sent off the device, and keeping progress on the user's device only.
10. THE security.md Steering_File SHALL contain, citing Brief C2 and Architecture Spec §A3, a Steering_Rule requiring imported and linked manifests to be rejected before `JSON.parse` when the encoded link exceeds 8 KB or the decoded JSON exceeds 64 KB, and a Steering_Rule requiring a node-count cap check before the graph checks run.
11. THE security.md Steering_File SHALL contain, citing the DREAME Day 1 project decision (no planning doc covers secrets), a Steering_Rule prohibiting API keys, tokens, passwords and other secrets in any file committed to the repository, including the MCP_Config.
12. THE security.md Steering_File SHALL contain, citing Architecture Spec Part C, a Steering_Rule requiring `design-refs/` to be listed in the Ignore_File and prohibiting any file under `design-refs/` from being staged or committed.

### Requirement 4: Activity-authoring, testing and new-node-type steering

**User Story:** As the solo builder, I want context-specific steering for activities, tests and node types, so that Kiro follows the right rules when touching those files.

#### Acceptance Criteria

1. THE activity-authoring.md Steering_File SHALL contain Steering_Rules, citing Brief §B1, §B2 and §B8, requiring: an authored node graph with no cycles (a DAG, with retry and review handled as runtime policy, not as back-edges); a `fallbackOutcomeId` that names an existing outcome node and is used when `limits.maxTransitions` is exceeded; and, on every node that has one or more edges, a last edge without a `when` condition.
2. THE activity-authoring.md Steering_File SHALL contain Steering_Rules, citing Brief §C3 and §C4 and Submission Checklist §2, requiring: made-up (synthetic) demo data with no real people's names or details; no product brand logos in demo data; CTAs that use a website URL or a WhatsApp business line the builder agrees to publish, never a personal WhatsApp number; and, on demo manifests, either no `validUntil` field or a `validUntil` date of 2027-12-31 or later.
3. THE testing.md Steering_File SHALL contain Steering_Rules, citing Brief §5 and Architecture Spec §A3, that: name Vitest as the test runner and fast-check as the property-testing library; require test commands to run once and exit (`vitest --run` or `vitest run`) and prohibit watch mode; and list the three property tests of Brief §5. The three properties are: (a) every manifest that passes validation reaches an outcome within `maxTransitions` for every generated answer sequence tested; (b) the validator does not crash on generated random JSON; (c) the same seed and actions produce the same result.
4. THE testing.md Steering_File SHALL contain a Steering_Rule, citing Brief §0 and §5, requiring that test results in code comments, docs, README, submission, video and blog text be described as evidence for the properties tested and never as a proof of correctness.
5. THE new-node-type.md Steering_File SHALL contain a numbered list of steps, citing Brief §3 and §B4 and Architecture Spec §A6, in this order: (1) through (7) define the `NodeType` members `type`, `version`, `configSchema` (closed), `responseSchema` (closed), `validate` (returns `Diagnostic[]`), `reduce` and `Render`; (8) place the node type in `packages/node-types` if it is shared, or inside the owning app folder if it is app-specific; (9) register the node type in the registry; (10) add its `configSchema` to the per-app schema composed at build time; (11) declare it in the manifest `requires` as `{type: version}`; (12) add Vitest tests for `validate` and `reduce`.
6. THE new-node-type.md Steering_File SHALL contain a Steering_Rule, citing Brief §3 and §B6, requiring `reduce` to be a pure function of `(cfg, state, response, env)`. Under this rule, `reduce` returns a new `AttemptState` without mutating its inputs, takes time only from `env.now` and randomness only from the seeded `env.rng`, and never calls `Date.now`, `new Date()` or `Math.random`.
7. THE activity-authoring.md Steering_File SHALL contain Steering_Rules, citing Brief §B2, requiring that: conditions use only the operators `eq`, `gte`, `lte`, `includes`, `and`, `or` and `not`; every `var` reference names a variable declared in `variables`; every `answer` reference names an existing node ID; and condition nesting depth is at most 8.
8. THE activity-authoring.md Steering_File SHALL contain a Steering_Rule, citing Brief §C1, requiring every CTA URL in a manifest to use the `https:` scheme, which allows `https://wa.me/...` links and rejects `http:`, `javascript:` and `data:` URLs.

### Requirement 5: Context7 MCP configuration

**User Story:** As the solo builder, I want Context7 configured, so that Kiro can look up accurate library documentation.

#### Acceptance Criteria

1. THE Setup_Agent SHALL create the MCP_Config as a UTF-8 file without a byte order mark that parses as JSON without error and has `mcpServers` as its only top-level key.
2. THE MCP_Config SHALL define exactly one entry under `mcpServers`, named `context7`, with `command` set to `npx` and `args` set to exactly `["-y", "@upstash/context7-mcp"]`.
3. THE MCP_Config SHALL contain no API keys, tokens or other secrets, and SHALL have no `env` or `headers` field and no argument other than the two listed in criterion 2.
4. IF the user reports that the Kiro MCP panel shows `context7` with an error or disconnected status, THEN THE Setup_Agent SHALL record the reported error text in the Kiro_Log entry and mark the Context7 connection as unresolved.
5. IF `.kiro/settings/mcp.json` already exists before setup, THEN THE Setup_Agent SHALL leave the existing file unchanged, report the server names it defines to the user, and wait for user confirmation before replacing or merging it.
6. WHEN the Setup_Agent presents the final report of Requirement 11, THE Setup_Agent SHALL ask the user to confirm in the Kiro MCP panel that `context7` is shown as connected with at least one tool listed.
7. IF the user reports a Context7 connection failure under criterion 4, THEN THE Setup_Agent SHALL keep the MCP_Config contents as specified in criterion 2 and SHALL get user confirmation before any change to `command` or `args`.
8. THE Setup_Agent SHALL leave starting the `context7` server to Kiro and SHALL NOT run `npx -y @upstash/context7-mcp` from a terminal, because the stdio server waits on standard input.

### Requirement 6: pnpm workspace and TypeScript base

**User Story:** As the solo builder, I want a pnpm workspace with strict TypeScript, so that later packages and apps share one toolchain.

#### Acceptance Criteria

1. THE Workspace_Config SHALL list exactly three entries under `packages`: `apps/*`, `packages/*` and `tools/*`. It SHALL list no other glob, so `activities` and `docs/kiro-evidence` are not workspace packages.
2. THE Root_Manifest SHALL parse as JSON and SHALL set `"private": true`.
3. THE Root_Manifest SHALL set `packageManager` to the exact string `pnpm@<X.Y.Z>`, where `<X.Y.Z>` is the version that `pnpm --version` printed at the Workspace_Root at setup time (12.21.0 on 18 Nov 2026), with no range prefix such as `^` or `~`.
4. THE Root_Manifest SHALL set `engines.node` to the exact string `>=22`.
5. THE Root_Manifest SHALL list exactly two entries under `devDependencies`, `typescript` and `simple-git-hooks`, and SHALL list no entries under `dependencies`, `peerDependencies` or `optionalDependencies`.
6. THE Base_TSConfig SHALL parse as JSON with no comments and no trailing commas, and SHALL set `compilerOptions.strict` to the boolean `true`.
7. WHEN `pnpm install` has exited with code 0 at the Workspace_Root (Requirement 10.1) and `pnpm exec tsc --version` is then run at the Workspace_Root, THE Setup_Agent SHALL confirm three things: the command exits with code 0, it prints a line of the form `Version <X.Y.Z>`, and `<X.Y.Z>` matches the `typescript` version recorded in the Lockfile.
8. THE Root_Manifest SHALL give each `devDependencies` entry a semver version or range that resolves to a published registry version. It SHALL NOT use `*`, `latest`, a git URL, a file path or a tarball URL.
9. IF `node --version` at the Workspace_Root reports a major version below 22, THEN THE Setup_Agent SHALL do four things: not run `pnpm install`, report the reported Node version to the user, record the mismatch in the Kiro_Log, and leave every file it created in the working tree unchanged.
10. IF `pnpm exec tsc --version` exits with a non-zero code or prints no `Version <X.Y.Z>` line, THEN THE Setup_Agent SHALL do three things: report the command output and exit code to the user, record the failure in the Kiro_Log, and not create the Init_Commit until the user decides how to proceed.

### Requirement 7: Placeholder folders, stub scripts, pre-commit hook and CI

**User Story:** As the solo builder, I want tracked placeholder folders, safe stub scripts, a pre-commit hook and CI, so that the repo layout and quality gate exist from Day 1.

#### Acceptance Criteria

1. THE Setup_Agent SHALL create each of the 12 Placeholder_Folders with a Folder_Stub at `<Placeholder_Folder>/README.md`, and SHALL place no other file in any Placeholder_Folder.
2. THE Folder_Stub of each Placeholder_Folder SHALL start on line 1 with a level-1 markdown heading whose text is the folder path relative to the Workspace_Root with forward slashes (for example `# packages/runtime`), followed by exactly one sentence of purpose that restates the `#` comment for that folder in Architecture Spec §A6 and adds no capability absent from that comment.
3. THE Setup_Agent SHALL leave each Placeholder_Folder without a `package.json`.
4. WHEN any Stub_Script is run with `pnpm <script>` at the Workspace_Root in any of the Supported_Shells, with or without extra arguments, THE Stub_Script SHALL print to standard output a line whose text is exactly `not implemented yet` with no surrounding quotation marks, and SHALL exit with code 0.
5. WHEN any Stub_Script is run, THE Stub_Script SHALL create, modify and delete no files, so that `git status --porcelain` prints the same output before and after the run.
6. THE Git_Hook_Config SHALL configure the `pre-commit` hook with the command `pnpm check` and SHALL configure no other git hook.
7. THE Root_Manifest SHALL set the `postinstall` script to exactly `simple-git-hooks`.
8. WHEN `pnpm install` completes with exit code 0, THE Setup_Agent SHALL confirm that `.git/hooks/pre-commit` exists and that its contents include the command `pnpm check`.
9. IF `.git/hooks/pre-commit` is missing after `pnpm install`, or its contents do not include `pnpm check`, THEN THE Setup_Agent SHALL report the observed hook state to the user and SHALL not create the Init_Commit until the user decides how to proceed.
10. THE CI_Workflow SHALL be valid YAML that triggers only on `push` to the `main` branch and on `pull_request` targeting the `main` branch, and that sets `permissions: contents: read` at the workflow level with no other permission granted.
11. THE CI_Workflow SHALL define one job on a Linux runner that runs these steps in this order: checkout, `pnpm/action-setup`, `actions/setup-node` with `node-version` 22, `pnpm install --frozen-lockfile`, and `pnpm check`.
12. THE CI_Workflow SHALL set no pnpm version input on the `pnpm/action-setup` step, so that the pnpm version comes from the Root_Manifest `packageManager` field.
13. THE CI_Workflow SHALL reference no repository secrets and no environment variables that contain credentials.
14. THE Setup_Agent SHALL create no files in `.kiro/hooks/`.

### Requirement 8: Git ignore and line-ending rules

**User Story:** As the solo builder, I want correct ignore and line-ending rules, so that private references stay out of the public repo and line endings stay consistent across Windows and CI.

#### Acceptance Criteria

1. THE Ignore_File SHALL contain the entries `node_modules`, `dist`, `.env*` and `design-refs/`, each on its own line exactly as written, with no leading `!`, and SHALL be saved as UTF-8 without a byte-order mark.
2. THE Ignore_File SHALL contain no line that includes the string `.kiro`, and no line with a pattern that git matches against `.kiro` or any path under `.kiro/`, such as `.*` or `*`.
3. WHEN the Ignore_File has been written, THE Setup_Agent SHALL run `git check-ignore -v` on each of `.kiro/steering/product.md`, `.kiro/settings/mcp.json`, `pnpm-lock.yaml` and `KIRO_LOG.md`, and SHALL confirm that each command prints no output and exits with code 1 (not ignored).
4. WHEN the Setup_Agent has confirmed that no file under `design-refs/` is tracked and runs `git check-ignore -v design-refs/linktree.webp`, THE Setup_Agent SHALL confirm that the command exits with code 0 and that its output names `.gitignore` as the source file and `design-refs/` as the matching pattern.
5. THE Attributes_File SHALL contain the line `* text=auto eol=lf` as a complete line, and SHALL be saved as UTF-8 without a byte-order mark.
6. WHEN the Ignore_File contains the line `design-refs/`, THE Setup_Agent SHALL delete the `.git.ignore` file at the Workspace_Root only if its content, with leading and trailing whitespace trimmed, is exactly `design-refs`.
7. IF the trimmed content of `.git.ignore` differs from `design-refs`, THEN THE Setup_Agent SHALL leave `.git.ignore` unchanged and unstaged and SHALL report its content to the user.
8. IF adding the Attributes_File causes one or more tracked files to show line-ending-only changes in `git status`, THEN THE Setup_Agent SHALL list each affected path to the user before the Init_Commit, and SHALL leave those changes out of the Init_Commit unless the user confirms that they should be included.
9. IF any check in criterion 3 or criterion 4 gives a result other than the expected one, THEN THE Setup_Agent SHALL not create the Init_Commit, and SHALL report to the user the path checked, the full command output and the exit code.
10. IF `git ls-files design-refs` lists one or more tracked files, THEN THE Setup_Agent SHALL list those paths to the user, SHALL not remove them from the index without user confirmation, and SHALL tell the user that files already pushed stay in the public repository history even after they are untracked.
11. WHEN the Setup_Agent reports Day 1 results to the user, THE Setup_Agent SHALL state whether the `.git.ignore` file was deleted and why: deleted because the Ignore_File supersedes it, or kept under criterion 7 because its trimmed content was not exactly `design-refs`.

### Requirement 9: Kiro log first entry

**User Story:** As the solo builder, I want the first Kiro log entry recorded today, so that Kiro usage evidence starts on Day 1.

#### Acceptance Criteria

1. WHEN `pnpm install` has completed under Requirement 10.1, and before the Setup_Agent stages files for the Init_Commit, THE Setup_Agent SHALL create the Kiro_Log at the Workspace_Root as a Markdown file.
2. THE Kiro_Log SHALL contain exactly one entry, and that entry SHALL begin with a heading that contains the date `2026-11-18` in YYYY-MM-DD format.
3. THE Kiro_Log entry SHALL name each of the three Kiro features used on Day 1 (spec workflow, steering, MCP). For each feature, the entry SHALL give one sentence stating what the Setup_Agent did with it and the Workspace_Root-relative path of at least one file the feature produced: the spec folder `.kiro/specs/dreame-day1-workspace-setup/` for spec workflow, a Steering_File for steering, and the MCP_Config for MCP.
4. THE Kiro_Log SHALL state, above the first entry, that the template in §6 of `Kiro_Setup_and_Operating_Playbook.md` is not in the workspace and that the entry format is provisional until that playbook is supplied. THE Kiro_Log SHALL NOT label any section or format as the playbook §6 template.
5. THE Kiro_Log SHALL contain only statements that trace to a file present at the Workspace_Root or to a command the Setup_Agent ran during setup, together with that command's observed exit code or output. THE Kiro_Log SHALL contain no statement about the Init_Commit, the push, or any other step not yet completed when the Kiro_Log is written.
6. THE Kiro_Log entry SHALL list, by Workspace_Root-relative path and once each, every file the Setup_Agent created or generated on Day 1, including the Kiro_Log itself and the Lockfile. The list SHALL equal the set of files staged under Requirement 10.2 minus the Planning_Docs, which are committed but not created by the Setup_Agent. The list SHALL include no file the Setup_Agent did not create, such as `LICENSE`, the restored root `README.md`, `docs/README.md`, any Planning_Doc, `.git.ignore` or any file in `design-refs/`.
7. IF the user reports a Context7 connection failure under Requirement 5.4, or the Setup_Agent could not use the spec workflow or steering, THEN THE Kiro_Log entry SHALL record that feature as failed, include the reported or observed error text, and SHALL NOT describe that feature as working.
8. THE Kiro_Log SHALL contain no phrase from the Banned_Phrase_List and no API keys, tokens or other secrets.
9. WHILE the user has not confirmed under Requirement 5.6 that `context7` is connected, THE Kiro_Log entry SHALL describe the MCP status as "configured; connection not yet confirmed by the user".

### Requirement 10: Install, commit and push

**User Story:** As the solo builder, I want the workspace installed, committed and pushed, so that the public repo shows the license, `.kiro` and the workspace from Day 1.

#### Acceptance Criteria

1. WHEN every file required by Requirements 1 to 8 exists at the Workspace_Root, THE Setup_Agent SHALL run `pnpm install` at the Workspace_Root and confirm that the command exits with code 0 and that the Lockfile exists at the Workspace_Root afterwards.
2. WHEN `pnpm install` has exited with code 0, THE Setup_Agent SHALL stage files by running `git add` with explicit paths only. The paths SHALL cover the Steering_Set, `.kiro/specs/dreame-day1-workspace-setup/`, the MCP_Config, the Workspace_Config, the Root_Manifest, the Base_TSConfig, every Folder_Stub (including `docs/kiro-evidence/README.md`), the CI_Workflow, the Ignore_File, the Attributes_File, the Kiro_Log, the Lockfile, and each Planning_Doc not left unstaged under criterion 14. The Setup_Agent SHALL NOT use `git add .`, `git add -A`, `git add --all` or `git add docs`.
3. THE Setup_Agent SHALL leave the content of `LICENSE`, `docs/README.md` and each Planning_Doc byte-identical to its content at session start, SHALL leave the root `README.md` content equal to its HEAD content after the restore in criterion 4 so that `git diff HEAD -- README.md` prints nothing, and SHALL leave `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` and `docs/ui-illustration-builder.txt` untracked and unstaged, so that the only staged `docs/` files are the Planning_Docs and `docs/kiro-evidence/README.md`.
4. WHEN `pnpm install` has exited with code 0 and before any file is staged, THE Setup_Agent SHALL restore the tracked root `README.md` from HEAD with `git restore -- README.md` and SHALL confirm that `git status --porcelain -- README.md` prints nothing.
5. WHEN the Init_Commit is created, THE Setup_Agent SHALL confirm that the `git commit` output contains the `not implemented yet` line printed by the pre-commit hook's `pnpm check`, and that `git log -1 --format=%s` prints exactly `chore: init workspace + .kiro`.
6. WHEN the Init_Commit exists, THE Setup_Agent SHALL confirm that `git ls-files design-refs node_modules .git.ignore` prints nothing. It SHALL also confirm that `git show --name-only --format= HEAD` lists only paths covered by criterion 2.
7. WHEN the Init_Commit exists and the checks in criteria 4, 5 and 6 have passed, THE Setup_Agent SHALL run `git push origin main` without `--force`, `--force-with-lease` or any other force option.
8. IF `git push` exits with a non-zero code, THEN THE Setup_Agent SHALL report the git error text to the user and keep the Init_Commit on the local `main` branch. It SHALL NOT run `git pull`, `git rebase`, `git reset` or a forced push unless the user confirms.
9. WHEN `git push` exits with code 0 and `git rev-parse origin/main` prints the same commit hash as `git rev-parse HEAD`, THE Setup_Agent SHALL ask the user to confirm two things on the GitHub repository page: the About section shows the MIT license, and the `.kiro` folder appears in the root file list.
10. IF `pnpm install` exits with a non-zero code or the Lockfile does not exist after it finishes, THEN THE Setup_Agent SHALL report the pnpm error output to the user, stage no files and create no commit.
11. IF the pre-commit hook or `git commit` exits with a non-zero code, THEN THE Setup_Agent SHALL report the error output to the user, leave the staged files staged, and SHALL NOT retry the commit with `--no-verify`.
12. IF, before the push, `git branch --show-current` does not print `main` or `git remote get-url origin` does not print `https://github.com/ChukwuebukaHenrey/my-kiro-win.git`, THEN THE Setup_Agent SHALL NOT push and SHALL ask the user how to proceed.
13. WHEN `pnpm install` has exited with code 0 and before any file is staged, THE Setup_Agent SHALL scan each Planning_Doc for secrets (API keys, tokens, passwords) and personal data (email addresses, phone numbers).
14. IF the scan in criterion 13 finds a match in a Planning_Doc, THEN THE Setup_Agent SHALL leave that Planning_Doc unstaged and SHALL report the file path and line number of each match to the user.

### Requirement 11: Cross-shell compatibility and final report

**User Story:** As the solo builder on Windows, I want every command to work in PowerShell and a clear final report, so that I can repeat the steps and see what was created.

#### Acceptance Criteria

1. THE Setup_Agent SHALL run and show to the user only commands that run unchanged in both PowerShell 5.1 and PowerShell 7. Each such command SHALL contain no `&&` or `||` operators, no bash-only syntax (`export`, `VAR=value` command prefixes, heredocs, backslash line continuations), and no Unix-style flags on PowerShell aliases (for example `rm -rf`, `ls -la`, `cp -r`).
2. THE Root_Manifest SHALL define every script so that `pnpm <script>` produces the same standard output and exit code in each of the Supported_Shells. To meet this, every script value SHALL contain no arguments delimited by single quotes at the shell level (single quotes inside a double-quoted argument are allowed), no environment-variable references (`$VAR` or `%VAR%`), and no shell-specific utilities (`rm`, `cp`, `mkdir -p`, `export`, `set`).
3. WHEN the push step of Requirement 10.7 has finished, whether it succeeded or failed, THE Setup_Agent SHALL show a recursive file tree of the Workspace_Root. The tree SHALL list every file and folder, including names that start with `.` (such as `.kiro`, `.github`, `.gitignore`, `.gitattributes`), and SHALL exclude `.git`, `node_modules` and `design-refs` together with their contents.
4. WHEN the push step of Requirement 10.7 has finished, whether it succeeded or failed, THE Setup_Agent SHALL list each of these open items that the user has not resolved during setup, together with the user decision or input that each listed item needs: item 1 (Missing playbook) of the Introduction's "Open dependencies, assumptions and flagged issues" list, by item number and title, and the Context7 connection confirmation of Requirement 5.6.
5. WHEN the push step of Requirement 10.7 has finished, whether it succeeded or failed, THE Setup_Agent SHALL list every command it ran during setup, in run order, with the exact command text and its exit code, so that the user can repeat each command in PowerShell.
6. WHEN the push step of Requirement 10.7 has finished, whether it succeeded or failed, THE Setup_Agent SHALL report a pass or fail result for each confirmation in Requirements 6.7, 7.8, 8.3, 8.4, 10.1, 10.5 and 10.6. The report SHALL also include the abbreviated hash of the Init_Commit and whether the push succeeded or failed.
7. IF a setup step fails and setup stops before the push step of Requirement 10.7 is attempted, THEN THE Setup_Agent SHALL present the report described in criteria 3 to 6 for the steps already run. That report SHALL name the failed step, give its error text, and list the steps that were not run. THE Setup_Agent SHALL leave every file it already created in place.
