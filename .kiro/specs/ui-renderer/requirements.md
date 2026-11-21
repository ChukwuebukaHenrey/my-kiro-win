# Requirements Document

## Introduction

This spec covers Day 5 of the DREAME 16-day plan (Brief §8: "Shared accessible renderer + theme tokens; node-type wiring hook"), plus two items carried over from Days 2–4: the KIRO_LOG entry for Days 2–4 and the size of the generated validators. DREAME is the toolkit described in `docs/Skeleton_Crew_Audit_and_Brief_v2.md` (the Brief) and `docs/Architecture_and_UI_Spec.md` (the Architecture Spec). The previous spec, `.kiro/specs/runtime-core/`, is complete (62 of 62 tasks) and its approved decisions D1–D12 stay in force unless a requirement below names a change.

The toolkit checks activity definitions against documented structural and supported semantic rules before playback (Brief §0). The renderer in this spec displays activities that already passed those checks. The checks and the component tests in this spec do not establish accessibility: automated checks catch some accessibility errors, and manual keyboard and screen-reader checks are still needed (Architecture Spec §A3).

Environment: Windows, PowerShell 5.1 only, Node v22.23.5, pnpm 12.21.0, TypeScript 7.0.2, vitest 5.1.1, vite 8.3.8, fast-check 4.10.3, typebox 1.4.7, ajv 8.20.0.

### Scope

1. One or more `KIRO_LOG.md` entries for Days 2–4 in the entry template of Playbook §6, and a commit of that file together with the leftover status-only changes in `.kiro/specs/runtime-core/tasks.md` and `tasks.meta.json`, if the user approves at that time.
2. A byte budget for `packages/node-types/generated/core.validators.js`, met without changing diagnostic codes or the results of existing tests.
3. `packages/ui` (`@dreame/ui`): theme tokens, the shared accessible components the three shared views need, a render registry, the `Render` modules for `content`, `choice` and `outcome`, and a minimal `ActivityPlayer` that wires the runtime reducer to the views.
4. The four Kiro hook files of Playbook §3b in `.kiro/hooks/`: `validate-activities.json`, `runtime-regression.json`, `node-type-wiring.json` and `post-task-check.json` (Requirements 15 and 17). Hooks 1 and 2 of Brief §8 Day 4 were approved by the user on 2026-11-19; Brief §6 (demo at 1:30) relies on the activity hook flagging a broken activity.
5. A first `EXTENDING.md` that holds only the node-type entries the Wiring_Hook maintains (Requirement 16). The full guide is Day 10 work.

### Out of scope

- `apps/shop-challenge` and `apps/practice-path`, their routes, `vercel.json` and deployment (Days 6–9).
- App-specific node types `collectionSelect`, `recommendOutcome`, `recall`, `reviewQueue` and their views.
- `packages/link` (decode, 8 KB cap, hash) and `packages/storage`; the player in this spec receives an already validated manifest and keeps no state across page loads.
- Authoring components (`EditorShell`, `ShareDialog` and the rest of Architecture Spec §B2 "Authoring components"), marketing components, `ProgressHeader`, confetti and QR codes.
- Tailwind CSS, shadcn/ui, Radix and Lucide wiring: the apps add these on Days 6–9. This spec writes theme tokens as CSS custom properties that Tailwind v4 can read later.
- Playwright, `@axe-core/playwright` and changes to `.github/workflows/ci.yml`.
- dependency-cruiser and ESLint with `react/no-danger`, which Playbook §3a names as the CI enforcement of the steering rules. Neither the Playbook nor Brief §8 schedules them for a day; Architecture Spec Part D lists "add depcruise to CI" as a Day 1 addition that Day 1 did not do. On 2026-11-20 the user deferred both to Day 6, with the Shop Challenge spec. Until then, CI enforces the same import and DOM rules through `pnpm check`, which runs the boundary test and the Source_Scan (Requirement 14).
- The rest of `EXTENDING.md` (the "new node type in about 50 lines" guide of Brief A4, Day 10).
- The `activity-author` custom agent (Day 10).
- Screenshots: the Implementing_Agent cannot take screenshots. The user saves any screenshot to `docs/kiro-evidence/` (Requirements 1.11, 1.12).

### Research facts used by these requirements

Measured on 2026-11-19 by compiling the current `core` profile schemas with Ajv 8.20.0 under different options (UTF-8 bytes of the generated module; gzip with Node `zlib.gzipSync` default level):

| Ajv options (all with `strict`, `discriminator`, `unicode: false`) | Raw bytes | Gzip bytes |
|---|---|---|
| Current: `lines: true`, `allErrors: true`, `CondD1`–`CondD8` | 428,695 | 35,849 |
| `lines: false`, `allErrors: true`, `CondD1`–`CondD8` | 413,723 | 35,170 |
| `lines: false`, `allErrors: false`, `CondD1`–`CondD8` | 405,731 | 35,637 |
| `lines: false`, `allErrors: true`, `inlineRefs: false`, `CondD1`–`CondD8` | 167,311 | 11,408 |
| `lines: false`, `allErrors: true`, `inlineRefs: false`, one recursive `Cond` | 103,556 | 10,274 |
| `lines: false`, `allErrors: false`, `inlineRefs: false`, one recursive `Cond` | 95,445 | 9,572 |

Dropping `lines` or `allErrors` saves little. Most of the size comes from Ajv inlining each `$ref` target at every use site. A recursive `Cond` would reverse approved decision D5 and break the existing `compose.test.ts` assertions on `CondD1`–`CondD8`. The user kept D5 on 2026-11-19, so Requirement 3 is met with `inlineRefs: false` (row 4 of the table: 167,311 raw bytes, 11,408 gzip bytes). Architecture Spec §A7 names a 150 KB budget for the app; Requirement 3 sets the validator budget well inside it.

### User decisions (2026-11-19)

1. **Hooks 1 and 2 are in scope.** Requirement 17 is mandatory. The Activity_Hook validates agent-written manifests under `activities/`; the Regression_Hook runs the runtime regression tests when `packages/runtime`, `packages/schema` or `packages/node-types` `.ts` files change. The 2026-11-20 Playbook reconciliation below adds the Post_Task_Hook.
2. **Decision D5 is kept.** The `CondD1`–`CondD8` definitions stay. The Byte_Budget is met with the Ajv option `inlineRefs: false`. `compose.test.ts`, `validator.test.ts` and the property test files stay unchanged (Requirement 4.2).
3. **Dependencies approved.** `@types/react`, `@types/react-dom`, `@testing-library/dom`, `@testing-library/user-event` and `jsdom` (the DOM test environment, chosen over `happy-dom`) are approved by the user on 2026-11-19. `axe-core` is approved by the user as a dev dependency on 2026-11-19 (design decision D17). `vitest-axe` was approved earlier the same day and is dropped by D17, so it is not added. This approval satisfies the tech.md rule on dependencies that the planning docs do not name (Requirement 5.9).
4. **Accepted assumptions.** `Render` receives a third prop carrying the node's runtime `nodeState`, so the Choice_View can show the stored option order (Requirement 10.3). The UI_Package contains a minimal Activity_Player. CTA links use the two-step confirm of Architecture Spec §B2 (`ExternalLinkButton` states "default · confirm"). Tailwind CSS, Radix and Lucide stay deferred to the apps.
5. **Design decisions D17–D23.** The user chose the recommended option A for each design decision D17–D23 on 2026-11-19: call `axe-core` directly (D17); a `pnpm validate:hook` script that writes all output to stderr on failure (D18); a double-quoted `{{filePath}}` with the Activity_Hook path matcher limited to safe characters (D19); app wiring file names fixed now (D20); the Wiring_Hook skips registration and reports when a node type has no view file (D21); React in `dependencies` (D22); and if Kiro blocks writes to `.kiro/hooks/`, the user creates the hook files by hand from the design (D23, amended on 2026-11-20 from three files to four). No design decision is open.

### Playbook reconciliation (2026-11-20)

`docs/Kiro_Setup_and_Operating_Playbook.md` (the Playbook) is now in the workspace. It states that it is authoritative for how Kiro is set up and used, and the user authorised resolving contradictions with it. The design section "Playbook reconciliation" lists each change and its reason. In summary:

1. Four hooks with the Playbook §3b file names, including the Post_Task_Hook (`pnpm -s check`, timeout 300 s). This extends D13 and amends D23 (four files).
2. Hook commands use `pnpm -s`. The Regression_Hook runs `pnpm -s test:shared` with a 180 s timeout and the Playbook matcher. The user raised the timeout from the Playbook's 120 s on 2026-11-20, after the task 12.1 measurement. The Activity_Hook timeout is 30 s.
3. The Activity_Hook keeps D18 (`validate:hook`, output routed to stderr on failure) and D19 (double-quoted `{{filePath}}`). The Playbook's `pnpm -s validate --stdin` is not adopted, because the Kiro docs do not name the stdin field that holds the file path, and because `pnpm -s validate` writes `FAIL` lines only to stdout, which Kiro does not pass to the agent on a non-zero exit (measured 2026-11-20).
4. The Wiring_Hook prompt follows the Playbook: registered exactly once, closed schemas, a `reduce()` unit test, a fast-check property, an `EXTENDING.md` entry, edits limited to named files, then `pnpm -s test:shared`.
5. Where the Playbook's trigger names or matchers do not fit the installed Kiro or this repository, the design keeps the documented v1 name (`PostTaskExec`) and the repository layout, as the Playbook's "use what your installed Kiro creates" rule allows.
6. The Days 2–4 log uses the Playbook §6 entry template (Requirement 1).

### User decisions (2026-11-20)

1. **CI enforcement deferred.** dependency-cruiser and ESLint `react/no-danger` CI enforcement move to Day 6, with the Shop Challenge spec (Out of scope).
2. **KIRO_LOG entry form.** The Days_2_4_Entries follow the Playbook §6 template only. They hold no "Files created" list and no summary of decisions D1–D12; the Spec_Done_Entry refers to `.kiro/specs/runtime-core/design.md` instead (Requirement 1.15).

## Glossary

- **Implementing_Agent**: The Kiro agent that carries out the tasks of this spec.
- **Workspace**: The repository at `c:\Users\ADMIN\my-kiro-win`.
- **Playbook**: `docs/Kiro_Setup_and_Operating_Playbook.md`, authoritative for how Kiro is set up and used.
- **Kiro_Log**: The file `KIRO_LOG.md` at the Workspace root.
- **Log_Note**: The two-line "Provisional format" blockquote at the top of the Kiro_Log, between the `# KIRO_LOG — DREAME` title and the Day_1_Entry.
- **Day_1_Entry**: The existing Kiro_Log entry headed `## 2026-11-18 — Day 1`, from its heading to the end of its "Open items" list.
- **Days_2_4_Entries**: The one or more Kiro_Log entries this spec adds for the runtime-core work of Days 2–4.
- **Spec_Done_Entry**: The Days_2_4_Entries entry that records the completed runtime-core spec (Requirement 1.6).
- **Entry_Template**: The Playbook §6 entry form: a heading line `## YYYY-MM-DD — <title>`, followed by the five Entry_Fields, each on its own line.
- **Entry_Fields**: The five labelled lines of the Entry_Template, in order: `Spec:`, `Kiro did:`, `Caught by:`, `Fix:`, `Kiro features:`.
- **Evidence_Folder**: The folder `docs/kiro-evidence/`, where screenshots for the Kiro_Log are saved (Playbook §6).
- **Fact_Sources**: `docs/HANDOFF.md` §2–§4, `.kiro/specs/runtime-core/design.md` (section "Decisions for the user") and `.kiro/specs/runtime-core/tasks.md`, plus commands the Implementing_Agent runs with their observed output.
- **Banned_Phrase_List**: The eight phrases in the last rule of "Claim rules" in `.kiro/steering/product.md`, matched as case-insensitive substrings. This spec does not repeat them, so that its own text has no match.
- **Leftover_Status_Files**: `.kiro/specs/runtime-core/tasks.md` and `.kiro/specs/runtime-core/tasks.meta.json`, which differ from HEAD only by task status changes.
- **Commit_Identity**: `-c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com"` passed to `git`.
- **Root_TSConfig**: The `tsconfig.json` at the Workspace root, the program that `pnpm typecheck` compiles.
- **Codegen**: `buildProfileModule` in `packages/schema/src/codegen/index.ts` together with `packages/node-types/scripts/codegen.ts`, run by `pnpm codegen`.
- **Validator_Module**: The generated file `packages/node-types/generated/core.validators.js`.
- **Byte_Budget**: The size limits of Requirement 3.1 and 3.2 for the Validator_Module.
- **Existing_Tests**: Every `*.test.ts` file under `packages/*/test/` and `tools/*/test/` at the start of this spec, including `packages/node-types/test/validator.test.ts` (42 example cases) and the property test files.
- **Check_Pipeline**: The root script `pnpm check` (codegen, typecheck, `vitest run`, `validate activities/*.json`), also the pre-commit hook and the CI step.
- **Shared_Test_Script**: The root script `pnpm test:shared` (`pnpm codegen && vitest run`), which runs every Vitest test in the Workspace.
- **UI_Package**: The workspace package `packages/ui`, named `@dreame/ui`.
- **Theme_Tokens**: The CSS custom properties defined by the UI_Package for colour, spacing, radius, type size, focus ring, touch target size and motion duration.
- **Render_Module**: The React component that displays one node type's `config` and reports a response, matching new-node-type.md step 7. A Render_Module receives the props `cfg`, `onRespond` and `nodeState` (the node's entry in the runtime `AttemptState.nodeState`, or `undefined`).
- **Render_Registry**: The UI_Package lookup from a node type name to its Render_Module.
- **Node_Renderer**: The UI_Package component that looks up the current node's type in the Render_Registry and displays its Render_Module.
- **Content_View**, **Choice_View**, **Outcome_View**: The Render_Modules of the shared node types `content`, `choice` and `outcome`.
- **External_Link_Button**: The UI_Package component that displays a CTA link with its destination disclosure (Architecture Spec §A5).
- **Invalid_Activity_View**: The UI_Package component that lists validator diagnostics in plain language.
- **Activity_Player**: The UI_Package component that takes a `Profile`, a `ValidManifest`, a seed and a Render_Registry, runs the `@dreame/runtime` reducer, and displays the current node through the Node_Renderer.
- **Safe_Url**: A URL for which `checkHttpsUrl` from `@dreame/schema` returns no diagnostics.
- **Component_Test**: A Vitest test that renders UI_Package components in a DOM test environment.
- **Source_Scan**: The test `packages/schema/test/source-scan.test.ts`.
- **Hook_Files**: The four files `.kiro/hooks/validate-activities.json`, `.kiro/hooks/runtime-regression.json`, `.kiro/hooks/node-type-wiring.json` and `.kiro/hooks/post-task-check.json` (Playbook §3b).
- **Wiring_Hook**: The hook file `.kiro/hooks/node-type-wiring.json`, whose agent prompt automates node-type wiring.
- **Wiring_Files**: The named files the Wiring_Hook may edit, listed in the design, including the Extending_Doc.
- **Own_Files**: For one node type, its node type source file, its view file, its unit test file and its property test file, at the paths the design lists.
- **Extending_Doc**: The file `EXTENDING.md` at the Workspace root.
- **Activity_Hook**: The hook file `.kiro/hooks/validate-activities.json` (hook 1 of Brief §8 Day 4), which validates agent-written activity manifests.
- **Regression_Hook**: The hook file `.kiro/hooks/runtime-regression.json` (hook 2 of Brief §8 Day 4), which runs the shared test suite.
- **Post_Task_Hook**: The hook file `.kiro/hooks/post-task-check.json`, which runs the Check_Pipeline when a spec task finishes.
- **Hook_Panel**: The Agent Hooks panel of the Kiro IDE, where the user can see the hooks Kiro loaded.
- **Verify_Command**: A command listed under `Verify:` in a task, written for PowerShell 5.1.

## Requirements

### Requirement 1: KIRO_LOG entries for Days 2–4

**User Story:** As the builder, I want factual Kiro_Log entries for Days 2–4 in the Playbook §6 template, so that the Kiro write-up and judges can trace how Kiro was used.

#### Acceptance Criteria

1. THE Implementing_Agent SHALL complete Requirements 1 and 2 as the first task of this spec, before any other task.
2. THE Implementing_Agent SHALL append the Days_2_4_Entries after the Day_1_Entry and SHALL leave the title line and the Day_1_Entry byte-for-byte unchanged.
3. THE Implementing_Agent SHALL replace the Log_Note with the note text given in the design, which states that entries from Days 2–4 on use the Entry_Template and that the Day_1_Entry keeps its original format.
4. THE Days_2_4_Entries SHALL each follow the Entry_Template: one heading line `## YYYY-MM-DD — <title>`, then the five Entry_Fields in order, each on its own line with its label followed by one space and the field text.
5. THE Days_2_4_Entries SHALL contain only statements that trace to a Fact_Source, including the date in each heading.
6. THE Days_2_4_Entries SHALL include a Spec_Done_Entry whose `Spec:` field names `runtime-core` and whose `Kiro did:` field states that 62 of 62 runtime-core tasks are done and names decisions D1–D12, their approval date 2026-11-19 and the section "Decisions for the user" of `.kiro/specs/runtime-core/design.md`.
7. THE Spec_Done_Entry SHALL record in its `Caught by:` field each task 9.2 check with its exit code: `pnpm codegen` 0, `pnpm typecheck` 0, `pnpm test:shared` 0 with 21 test files and 378 tests, `pnpm validate activities/*.json` 0 with one PASS line, `pnpm validate activities/fixtures/broken-dangling-edge.json` 1 with one `refs/dangling-ref` diagnostic, `pnpm validate` with no arguments 2, and `pnpm check` 0, and SHALL state that the three most recent GitHub Actions CI runs on `main` passed.
8. THE Days_2_4_Entries SHALL include an entry whose `Spec:` field names runtime-core tasks 3.6, 5.2 and 9.1, whose `Caught by:` field states that their sub-agent runs timed out or aborted, and whose `Fix:` field states that those tasks were split into smaller tasks.
9. THE Days_2_4_Entries SHALL include an entry whose `Caught by:` field records the Validator_Module size of 428,768 bytes printed by `pnpm codegen` and whose `Fix:` field names Requirement 3 of spec `ui-renderer`.
10. THE Days_2_4_Entries SHALL include an entry whose `Kiro did:` field states that the Kiro hooks of Brief §8 Day 4 were not created in Days 2–4 and whose `Fix:` field names Requirement 17 of spec `ui-renderer`.
11. WHEN the Implementing_Agent starts the Days_2_4_Entries, THE Implementing_Agent SHALL tell the user that the Implementing_Agent cannot take screenshots and SHALL ask the user for the file names of any Days 2–4 screenshots saved in the Evidence_Folder.
12. THE Days_2_4_Entries SHALL reference a screenshot only by the Workspace-relative path of a file that exists in the Evidence_Folder, and SHALL contain no screenshot marker for a screenshot that does not exist.
13. THE Days_2_4_Entries SHALL contain no commit hash, no commit message, and no statement about a commit or a push.
14. THE Kiro_Log SHALL contain zero matches of any Banned_Phrase_List phrase and no API keys, tokens, passwords or other secrets.
15. THE Days_2_4_Entries SHALL consist only of the Entry_Template lines, with no list of created files and no summary of the content of decisions D1–D12, and SHALL refer to decisions D1–D12 by the path `.kiro/specs/runtime-core/design.md`.

### Requirement 2: Commit of the log and the leftover status files

**User Story:** As the builder, I want the log and the leftover runtime-core status files committed together, so that the repository records Days 2–4 completely.

#### Acceptance Criteria

1. WHEN the Days_2_4_Entries are written, THE Implementing_Agent SHALL show the user `git status --porcelain` and `git diff --stat` and SHALL ask the user whether to commit the Kiro_Log and the Leftover_Status_Files.
2. WHEN the user approves the commit, THE Implementing_Agent SHALL stage exactly `KIRO_LOG.md`, `.kiro/specs/runtime-core/tasks.md` and `.kiro/specs/runtime-core/tasks.meta.json` by explicit path and SHALL commit them with the Commit_Identity.
3. THE Implementing_Agent SHALL commit without `--no-verify`, without `--amend` and without a co-author trailer, so that the Check_Pipeline runs as the pre-commit hook.
4. IF the user declines the commit, THEN THE Implementing_Agent SHALL leave the three files unstaged and SHALL record the decision in its task report.
5. IF the pre-commit Check_Pipeline fails, THEN THE Implementing_Agent SHALL report the failing command, its output and its exit code to the user and SHALL create no commit until the user decides how to proceed.
6. THE Implementing_Agent SHALL stage no file under `packages/*/generated/` or `design-refs/` and none of the untracked files `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` and `docs/ui-illustration-builder.txt`.

### Requirement 3: Validator byte budget

**User Story:** As an app developer, I want the generated validators small enough for app bundles, so that the apps can import the `core` profile without exceeding the Architecture Spec §A7 budget.

#### Acceptance Criteria

1. WHEN `pnpm codegen` completes, THE Validator_Module SHALL be at most 180,000 bytes in UTF-8.
2. WHEN `pnpm codegen` completes, THE Validator_Module SHALL be at most 14,000 bytes after gzip compression with Node `zlib.gzipSync` at its default level.
3. THE Workspace SHALL contain a Vitest test that reads the Validator_Module and fails when either Byte_Budget limit is exceeded, so that the Check_Pipeline rejects a size regression.
4. WHEN `pnpm codegen` completes, THE Codegen SHALL print the raw and gzip byte counts of the Validator_Module.
5. THE Codegen SHALL keep producing the Validator_Module with Ajv standalone code generation at build time, with no runtime schema compilation and no `ajv` import outside `packages/schema/src/codegen/`.
6. THE Codegen SHALL keep passing the generated code through `inlineRuntimeHelpers` and `assertSelfContained`.
7. THE Codegen SHALL keep the `CondD1`–`CondD8` definitions of approved decision D5 and SHALL meet the Byte_Budget by changing Ajv code generation options only.

### Requirement 4: Validator behaviour preserved

**User Story:** As a toolkit maintainer, I want the smaller validators to report the same diagnostics, so that shrinking them does not weaken validation.

#### Acceptance Criteria

1. WHEN the Validator_Module meets the Byte_Budget, THE Existing_Tests SHALL pass under `pnpm test:shared`.
2. THE Implementing_Agent SHALL leave `packages/schema/test/compose.test.ts`, `packages/node-types/test/validator.test.ts`, `validator.property.test.ts`, `termination.property.test.ts` and `replay.property.test.ts` unchanged.
3. FOR ALL inputs, THE graph validator using the new Validator_Module SHALL return the same diagnostic codes, stages, paths and severities as with the Validator_Module at the start of this spec.
4. WHEN a manifest contains an edge `when` nested deeper than 8 levels, THE graph validator SHALL report `schema/cond-too-deep` at that `when` path.
5. WHEN `pnpm validate activities/*.json` runs, THE validate CLI SHALL print one PASS line for `activities/core-demo-study-break.json` and exit with code 0.
6. WHEN `pnpm validate activities/fixtures/broken-dangling-edge.json` runs, THE validate CLI SHALL report one `refs/dangling-ref` diagnostic and exit with code 1.

### Requirement 5: UI package setup and dependencies

**User Story:** As a toolkit developer, I want a `@dreame/ui` package with a working component test setup, so that the shared views can be built and tested like the other packages.

#### Acceptance Criteria

1. THE UI_Package SHALL have a `package.json` named `@dreame/ui` with `private: true` and `type: module`, and a `tsconfig.json` that extends `../../tsconfig.base.json` with `compilerOptions.strict` set to `true`.
2. THE UI_Package SHALL list `react` and `react-dom` at major version 19 as dependencies.
3. WHEN the Implementing_Agent needs a dependency that the Architecture Spec or the Submission Checklist does not name and that Requirement 5.9 does not list as approved, THE Implementing_Agent SHALL stop and ask the user before adding it to any `package.json`.
4. THE design SHALL list each dependency it proposes with its checked registry version, whether a planning doc names it, and its approval status.
5. THE Root_TSConfig SHALL include the UI_Package `.ts` and `.tsx` source and test files, and `pnpm typecheck` SHALL exit with code 0.
6. THE root `vitest.config.ts` SHALL include the Component_Test files, and every Component_Test SHALL run in the `jsdom` test environment while the Existing_Tests keep running in the `node` environment.
7. THE Workspace SHALL keep `pnpm-lock.yaml` as its only lockfile, and THE Implementing_Agent SHALL commit any `pnpm-lock.yaml` change in the same commit as the dependency change.
8. THE UI_Package source SHALL use relative imports with explicit `.ts` or `.tsx` extensions and only erasable TypeScript syntax.
9. THE design SHALL record `@types/react`, `@types/react-dom`, `@testing-library/dom`, `@testing-library/user-event`, `jsdom` and `axe-core` (as a dev dependency) as approved by the user on 2026-11-19, and SHALL record that `vitest-axe` is not added (decision D17).

### Requirement 6: Theme tokens

**User Story:** As an app developer, I want shared theme tokens, so that both apps and later theme packs style the views consistently.

#### Acceptance Criteria

1. THE UI_Package SHALL define the Theme_Tokens as CSS custom properties in one stylesheet, and SHALL export the same token names and values as a TypeScript object.
2. THE UI_Package SHALL have a test that fails when the stylesheet and the TypeScript object differ in any token name or value.
3. FOR ALL text and background token pairs that the design marks as used together, THE Theme_Tokens SHALL have a WCAG 2.2 contrast ratio of at least 4.5:1, checked by a test that computes the ratio from the token values.
4. THE Theme_Tokens SHALL define a focus ring colour with a contrast ratio of at least 3:1 against every background token, checked by the same test.
5. THE Theme_Tokens SHALL define a minimum touch target size of at least 44 CSS pixels, which the interactive components use for their minimum height.
6. WHILE the user agent reports `prefers-reduced-motion: reduce`, THE stylesheet SHALL set every motion-duration token to `0ms`.
7. THE Theme_Tokens SHALL contain no third-party brand colours, logos or illustrations.

### Requirement 7: Shared accessible components

**User Story:** As a player using a keyboard or screen reader, I want every control labelled and operable, so that I can complete an activity without a mouse.

#### Acceptance Criteria

1. THE UI_Package components SHALL use native HTML interactive elements (`button`, `a`, `input`, `fieldset`, `legend`, `label`) for every control.
2. THE UI_Package components SHALL give every interactive element an accessible name that Testing Library finds with `getByRole` and the element's visible label.
3. WHEN an interactive element receives keyboard focus, THE stylesheet SHALL display the focus ring defined by the Theme_Tokens through `:focus-visible`.
4. THE UI_Package components SHALL display every manifest string as text content, so that a string containing markup such as `<b>x</b>` is displayed literally.
5. THE UI_Package source SHALL contain no call to `eval` or `new Function` and no use of `innerHTML` or `dangerouslySetInnerHTML`.
6. THE UI_Package components SHALL render no input that collects a name, email address, phone number or other personal data, and SHALL send no data off the device.

### Requirement 8: Safe external links

**User Story:** As a player, I want to see where a CTA link goes and to be protected from unsafe links, so that a shared activity cannot send me to a hidden or script destination.

#### Acceptance Criteria

1. WHEN the External_Link_Button receives a Safe_Url, THE External_Link_Button SHALL display the CTA label and the destination host name before the player leaves the page.
2. WHEN the player activates the External_Link_Button for a Safe_Url, THE External_Link_Button SHALL display a confirmation step that names the destination host and offers an anchor to the URL.
3. THE External_Link_Button SHALL render every anchor to another origin with `rel="noopener noreferrer"` and `target="_blank"`.
4. IF the External_Link_Button receives a URL that is not a Safe_Url, THEN THE External_Link_Button SHALL render no anchor and SHALL display the CTA label with a plain-language note that the link was blocked.
5. FOR ALL generated URL strings, THE External_Link_Button SHALL render an anchor only when `checkHttpsUrl` returns no diagnostics for that string, and the anchor `href` SHALL equal that string.
6. THE External_Link_Button SHALL display a note that the link was added by the activity's author and is not verified by the app.

### Requirement 9: Content view

**User Story:** As a player, I want content pages shown clearly with a continue control, so that I can read and move on.

#### Acceptance Criteria

1. WHEN the Content_View displays a `content` config, THE Content_View SHALL display `title` as a heading when present, `body` as text with its line breaks kept, and a button labelled `continueLabel`, or "Continue" when `continueLabel` is absent.
2. WHEN the player activates the continue button, THE Content_View SHALL call `onRespond` once with `{}`.
3. WHEN the player activates the continue button again before the node changes, THE Content_View SHALL leave `onRespond` uncalled.

### Requirement 10: Choice view

**User Story:** As a player, I want to pick one option with the keyboard or by touch and submit it, so that I can answer a question.

#### Acceptance Criteria

1. WHEN the Choice_View displays a `choice` config, THE Choice_View SHALL display `prompt` as the group label and one radio option per entry of `options`, labelled with that option's `label`.
2. WHERE `shuffle` is not `true`, THE Choice_View SHALL display the options in `config.options` order.
3. WHERE `shuffle` is `true` and the runtime `nodeState` of the node holds an option order, THE Choice_View SHALL display the options in that stored order.
4. WHILE focus is in the option group, THE Choice_View SHALL move the selection with the arrow keys, following native radio group behaviour.
5. WHEN the player activates the submit button with an option selected, THE Choice_View SHALL call `onRespond` once with `{ optionId }` of the selected option.
6. WHILE focus is on an option with that option selected, THE Choice_View SHALL submit the selection when the player presses Enter.
7. IF the player activates the submit button with no option selected, THEN THE Choice_View SHALL leave `onRespond` uncalled and SHALL display an inline message that is linked to the option group with `aria-describedby`.
8. WHEN `onRespond` has been called, THE Choice_View SHALL ignore further submissions until the node changes.
9. FOR ALL valid `choice` configs and every selected option, THE response passed to `onRespond` SHALL pass the `choice` node type's `isValidResponse`.

### Requirement 11: Outcome view

**User Story:** As a player, I want a clear ending with the author's call to action, so that I know the activity is finished and what to do next.

#### Acceptance Criteria

1. WHEN the Outcome_View displays an `outcome` config, THE Outcome_View SHALL display `title` as a heading and `body` as text with its line breaks kept.
2. WHERE the `outcome` config has a `cta`, THE Outcome_View SHALL display the `cta` through the External_Link_Button.
3. THE Outcome_View SHALL display no control that calls `onRespond`.

### Requirement 12: Render registry and node renderer

**User Story:** As a toolkit developer, I want views looked up by node type name, so that adding a node type means registering one more view.

#### Acceptance Criteria

1. THE UI_Package SHALL export a Render_Registry holding the Content_View, Choice_View and Outcome_View under the names `content`, `choice` and `outcome`.
2. THE UI_Package SHALL export a function that builds a Render_Registry from a list of node type names and Render_Modules, so that an app can add its own node types.
3. IF two entries given to that function share a node type name, THEN THE function SHALL throw an `Error` naming the duplicate.
4. WHEN the Node_Renderer receives a node whose type has a Render_Module in the Render_Registry, THE Node_Renderer SHALL display that Render_Module with the node's `config`.
5. IF the Node_Renderer receives a node whose type has no Render_Module in the Render_Registry, THEN THE Node_Renderer SHALL display a plain-language error that names the node type and SHALL display no Render_Module.
6. THE Render_Modules for `content`, `choice` and `outcome` SHALL live outside `packages/runtime`, and THE `@dreame/node-types` codegen script SHALL run without loading `react` or `react-dom`.

### Requirement 13: Activity player

**User Story:** As an app developer, I want one component that plays a validated manifest, so that both apps share the same player wiring.

#### Acceptance Criteria

1. WHEN the Activity_Player mounts, THE Activity_Player SHALL create the runtime with `createRuntime`, create the attempt with `createAttempt` using the given seed, and display the current node through the Node_Renderer.
2. WHEN a Render_Module calls `onRespond`, THE Activity_Player SHALL dispatch a `respond` action for the current node to the runtime `reduce` and display the node of the new state.
3. WHEN the attempt status becomes `finished`, THE Activity_Player SHALL display the reached `outcome` node.
4. WHEN the attempt status becomes `limit_reached`, THE Activity_Player SHALL display the fallback `outcome` node with a plain-language note that the activity stopped at its step limit.
5. WHEN the current node changes, THE Activity_Player SHALL move keyboard focus to the new node's heading or, when the node has no heading, to the node's container.
6. FOR ALL respond sequences generated against the demo manifest `activities/core-demo-study-break.json`, THE Activity_Player SHALL display the node whose ID equals the `currentNodeId` of the state that the runtime `reduce` returns for the same seed and sequence.
7. THE UI_Package SHALL export the Invalid_Activity_View, which lists each diagnostic's message as text and offers a button whose action the app supplies.

### Requirement 14: Reduced motion and layer boundaries

**User Story:** As a toolkit maintainer, I want motion settings and package boundaries checked automatically, so that later changes do not break them.

#### Acceptance Criteria

1. WHILE `prefers-reduced-motion: reduce` applies, THE UI_Package components SHALL run no animation or transition longer than `0ms`.
2. THE Source_Scan SHALL scan `.tsx` and `.jsx` files as well as `.ts` and `.js` files under `packages/` and `tools/`, so that the forbidden-API check covers the UI_Package.
3. THE Workspace SHALL have a test that fails when a file under `packages/runtime` imports `react`, `react-dom`, `@dreame/ui` or a path under `apps/`.
4. THE Workspace SHALL have a test that fails when a file under `packages/node-types/src`, `packages/node-types/scripts` or `packages/schema/src` imports `react`, `react-dom` or `@dreame/ui`.
5. WHEN the UI_Package is added, THE Check_Pipeline SHALL exit with code 0, and `.github/workflows/ci.yml` SHALL stay unchanged.

### Requirement 15: Node-type wiring hook

**User Story:** As a developer adding a node type, I want Kiro to wire the repetitive registration steps, so that a new node type is registered, rendered and tested without a manual checklist.

#### Acceptance Criteria

1. THE Wiring_Hook SHALL be the file `.kiro/hooks/node-type-wiring.json`, and every hook in the Wiring_Hook SHALL use an `agent` action.
2. WHEN the agent creates or saves a node type source file or a view file at a path that the design lists for the Wiring_Hook matcher, THE Wiring_Hook SHALL trigger.
3. WHEN the Wiring_Hook triggers, THE Wiring_Hook SHALL instruct the agent to follow `#new-node-type` (`.kiro/steering/new-node-type.md`) for the node type of the changed file.
4. THE Wiring_Hook SHALL instruct the agent to ensure that the node type is listed exactly once in each Wiring_File that applies to the node type, by adding a missing line and removing any extra copy of an existing line.
5. THE Wiring_Hook SHALL instruct the agent to ensure that the node type's `configSchema` and `responseSchema` are closed, with `additionalProperties: false` on every object schema, by editing only the node type source file.
6. THE Wiring_Hook SHALL instruct the agent to create the node type's unit test file, with Vitest tests for `validate` and `reduce`, when no test file in the package's test folder references the node type's exported constant.
7. THE Wiring_Hook SHALL instruct the agent to create the node type's property test file, with a fast-check property for `reduce` at `numRuns` of at least 100, when no `*.property.test.ts` file in the package's test folder references the node type's exported constant.
8. THE Wiring_Hook SHALL instruct the agent to add the node type's entry to the Extending_Doc in the form the design gives, and to create the Extending_Doc with only its title and its "Node types" heading first when the Extending_Doc does not exist.
9. THE Wiring_Hook SHALL instruct the agent to edit only the Wiring_Files and the Own_Files of the node type.
10. WHEN the Wiring_Hook triggers for a node type that is already wired, THE Wiring_Hook SHALL instruct the agent to leave every file unchanged, run no command, and reply "already wired".
11. WHEN the agent has changed at least one file for the wiring, THE Wiring_Hook SHALL instruct the agent to run `pnpm -s test:shared` and report its exit code.
12. THE Wiring_Hook SHALL contain no secrets, no reference to `.kiro/settings/`, and no command that deletes files.
13. THE design SHALL record each difference between the Wiring_Hook and the Playbook §3b `node-type-wiring.json` example, with its reason.

### Requirement 16: Wiring files for the shared node types

**User Story:** As a developer, I want the shared node types wired the same way the hook wires new ones, so that the hook's steps match a working example.

#### Acceptance Criteria

1. THE Wiring_Files SHALL include the file that exports the shared node types, the file that lists the `core` profile node types, the file that maps node types to response validators, the file that defines the default Render_Registry, and the Extending_Doc.
2. THE shared node types `content`, `choice` and `outcome` SHALL be registered in each Wiring_File in the form that the Wiring_Hook instructs for a new node type.
3. THE design SHALL map each step of `.kiro/steering/new-node-type.md` to a Wiring_File, to the Own_Files of the node type, or to "manual", with a reason for each "manual" step.
4. THE Implementing_Agent SHALL create the Extending_Doc with one entry for each of `content`, `choice` and `outcome`, in the form that the Wiring_Hook instructs, and with no other section.
5. FOR ALL generated configs, attempt states and valid responses of the shared node types `content`, `choice` and `outcome`, the node type's `reduce` SHALL leave its inputs unchanged and return equal results for equal inputs, checked by one property test file under `packages/node-types/test/` that references `contentNodeType`, `choiceNodeType` and `outcomeNodeType`.

### Requirement 17: Activity, regression and post-task hooks

**User Story:** As the builder, I want the four Playbook §3b hooks, so that agent-written activities are validated, the shared tests run after agent edits, the full check runs after each spec task, and the Brief §6 demo can show a broken activity being flagged.

#### Acceptance Criteria

1. THE Workspace SHALL contain the four Hook_Files in `.kiro/hooks/` and no other file in that folder.
2. WHEN the agent creates or saves a file whose path matches the Activity_Hook matcher, THE Activity_Hook SHALL run the validate CLI on that file through the root script `pnpm -s validate:hook` and report the exit code to the agent.
3. WHEN the validate CLI exits with code 0 for that file, THE Activity_Hook SHALL write every CLI output line to stdout, so that Kiro adds the lines to the agent's context.
4. WHEN the validate CLI exits with code 1 or 2 for that file, THE Activity_Hook SHALL write every CLI output line, including each `FAIL` line and diagnostic line, to stderr, so that Kiro passes the lines to the agent.
5. THE Activity_Hook matcher SHALL match only file paths under an `activities` folder that end in `.json` and consist of the characters that the design lists as safe to pass to the shell.
6. WHEN the agent saves a `.ts` file under `packages/runtime/`, `packages/schema/` or `packages/node-types/`, THE Regression_Hook SHALL run `pnpm -s test:shared` and report the exit code to the agent.
7. WHEN a spec task finishes, THE Post_Task_Hook SHALL run `pnpm -s check` and report the exit code to the agent.
8. THE command hooks in the Hook_Files SHALL edit no tracked file; the codegen step that they run before their checks may rewrite the gitignored files under `packages/node-types/generated/`.
9. THE Hook_Files SHALL set `timeout` to 30 seconds for the Activity_Hook and 600 seconds for the Post_Task_Hook (raised 2026-11-21, shop-challenge D53), and 180 seconds for the Regression_Hook, raised from the Playbook's 120 seconds by the user on 2026-11-20.
10. WHEN the UI_Package tests are in place, THE Implementing_Agent SHALL measure the wall time of `pnpm -s validate:hook activities/core-demo-study-break.json`, `pnpm -s test:shared` and `pnpm -s check` and record the three times in its task report.
11. IF a time measured under criterion 10 exceeds 80% of the matching hook timeout (24 s, 144 s or 240 s), THEN THE Implementing_Agent SHALL report the time to the user and SHALL ask whether to narrow the hook command or raise the timeout before changing either.
12. THE Workspace SHALL have a test that parses each Hook_File and fails when a file is not valid JSON, lacks the fields the design names for the hook format, or differs from the design in hook names, triggers, matchers, actions, timeouts or `enabled` values.
13. WHEN the Hook_Files are written, THE Implementing_Agent SHALL ask the user to open the Hook_Panel and confirm that Kiro lists every hook in the Hook_Files without an error.
14. IF the user reports that the Hook_Panel shows an error for a hook, or that Kiro creates the hook with a different field or trigger name, THEN THE Implementing_Agent SHALL change the Hook_File, the hook file test and the design to the name Kiro uses and SHALL record the difference in its task report.

### Requirement 18: Task and verification conventions

**User Story:** As the builder, I want every task small and verifiable on this machine, so that sub-agent runs finish and results are checkable.

#### Acceptance Criteria

1. THE tasks SHALL each list at least one Verify_Command with its expected exit code.
2. THE Verify_Commands SHALL run in PowerShell 5.1, use `;` between commands, check exit codes with `; $LASTEXITCODE`, and contain no `&&` or `||`.
3. THE Verify_Commands SHALL run Vitest only as `vitest run` and SHALL each finish within 180,000 ms.
4. THE tasks SHALL each create or change at most the files that one sub-agent run can finish within the 180,000 ms command limit, splitting any task that combines more than one component with its tests.
5. THE Implementing_Agent SHALL write no file under `.kiro/settings/` and run no `Remove-Item` command, and SHALL ask the user to do either by hand when a task needs it.
6. THE Implementing_Agent SHALL write property tests with fast-check at `numRuns` of at least 100, tagged `Feature: ui-renderer, Property N: <title>` in the `describe` or `it` title.
7. THE Implementing_Agent SHALL use no Banned_Phrase_List phrase in any file of this spec or any file it creates.
8. THE tasks SHALL each end with a step that runs a test: a Vitest test through `vitest run`, or a Verify_Command whose exit code checks the task's result (Playbook §4.3).
9. THE tasks SHALL place each property test in its own task, separate from the task that writes the code the property tests (Playbook §4.3).
