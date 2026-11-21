# Implementation Plan: UI Renderer (DREAME Day 5)

## Overview

Tasks follow the build order in design.md "Notes for the tasks run": the KIRO_LOG Days 2–4 entries and their commit first (Requirement 1.1), then the validator size reduction, the `@dreame/ui` package setup, theme tokens, the render registry and link button, the three views, the player, the scans, `EXTENDING.md` with Property 10, the validate hook entry, the four Kiro hook files, the timing and full-pipeline checks, and a final checkpoint that asks the user before committing. File names, interfaces, token values and hook JSON come from design.md; each task names its files and how to verify them. All code is TypeScript under `strict`.

Conventions for every task (Requirement 18):

- Write files with the editor tool (UTF-8, no BOM, LF line endings). Write no file under `.kiro/settings/` and run no `Remove-Item`; when a task needs either, stop and ask the user to do it by hand (Requirement 18.5).
- Every command must work in Windows PowerShell 5.1: separate commands with `;`, check exit codes with `; $LASTEXITCODE`, and never use `&&` or `||` (`&&` appears only inside `package.json` script values). A Verify step passes only when every listed command prints the expected exit code (0 unless the step says otherwise) and meets the stated condition.
- Run Vitest only as `pnpm exec vitest run <path>`, never in watch mode. Every command must finish within 180,000 ms; if one does not, stop and report the command and its time to the user (Requirement 18.3).
- Each task ends with its Verify step, which runs a test (Requirement 18.8). Each of design Properties 1–10 is its own task and is not optional (Requirement 18.9).
- Property tests use fast-check with `numRuns` of at least 100 and carry the tag `Feature: ui-renderer, Property N: <title>` in the `describe` or `it` title (Requirement 18.6). When a property fails, fix the code, then copy the printed seed and shrunk counterexample into the same file as an example test. If a property run takes longer than 180,000 ms, shrink the generated sizes (never `numRuns` below 100) and report it.
- Relative imports use explicit `.ts` or `.tsx` extensions; use only erasable syntax (no `enum`, `namespace` or constructor parameter properties) (Requirement 5.8).
- Add no dependency other than those in design.md "Dependencies". If another one seems needed, or pnpm blocks an install, stop and ask the user (Requirement 5.3).
- Do not edit `.github/workflows/ci.yml` (Requirement 14.5). Never stage files under `packages/*/generated/` or `design-refs/`. Never use `git add -A`, `git add .`, `--no-verify` or `--amend`.
- Use no phrase from the "Do not use" line of `.kiro/steering/product.md` in any file (Requirement 18.7).
- Once a hook file exists in `.kiro/hooks/`, Kiro runs it on matching agent edits; from task 11.7 on, Kiro runs `pnpm -s check` after every task. Read its result and fix any failure in the same session.

## Tasks

- [x] 1. KIRO_LOG Days 2–4 entries and their commit (first task, Requirement 1.1)
  - [x] 1.1 Write the Days 2–4 entries in `KIRO_LOG.md`
    - Before writing, tell the user that you cannot take screenshots and ask for the file names of any Days 2–4 screenshots saved in `docs/kiro-evidence/`; run `Test-Path` on each named file and reference only files that exist, by Workspace-relative path inside a field line (Requirements 1.11, 1.12)
    - Read the facts: `docs/HANDOFF.md` §2–§4, `.kiro/specs/runtime-core/design.md` "Decisions for the user", `.kiro/specs/runtime-core/tasks.md` (task 9.2), and `git log -1 --format=%ad --date=short cd0f142; $LASTEXITCODE` for the date used in every new heading (Requirement 1.5)
    - Check CI with `gh run list --branch main --limit 3; $LASTEXITCODE`. **Stop condition:** if `gh` fails or any of the three runs did not pass, ask the user before writing the CI clause of Requirement 1.7
    - Replace the two-line "Provisional format" blockquote with the two-line note in design C1; leave the title line and the Day 1 entry byte-for-byte unchanged (Requirements 1.2, 1.3)
    - Append the four entries of the design C1 table after the Day 1 entry: a `## <date> — <title>` heading, then `Spec:`, `Kiro did:`, `Caught by:`, `Fix:`, `Kiro features:`, one line each. Leave the bracketed Fact_Source notes of the table out of the log
    - The Spec_Done_Entry names decisions D1–D12, the approval date 2026-11-19 and `.kiro/specs/runtime-core/design.md` "Decisions for the user", and does not summarise them; no entry has a "Files created" list (Requirements 1.6, 1.15, user answer 2026-11-20)
    - No entry holds a commit hash, a commit message, or a statement about a commit or a push (Requirement 1.13)
    - Verify (template, run as one line; pass when it prints `4`, then `20`, then nothing else): `$new = Get-Content -Encoding UTF8 KIRO_LOG.md | Select-Object -Skip ((Select-String -Path KIRO_LOG.md -Pattern '^## \d{4}-\d{2}-\d{2} ')[1].LineNumber - 1); ($new | Select-String -Pattern '^## \d{4}-\d{2}-\d{2} ').Count; ($new | Select-String -Pattern '^(Spec|Kiro did|Caught by|Fix|Kiro features): ').Count; $new | Where-Object { $_ -ne '' -and $_ -notmatch '^## \d{4}-\d{2}-\d{2} ' -and $_ -notmatch '^(Spec|Kiro did|Caught by|Fix|Kiro features): ' }`
    - Verify (Day 1 unchanged): `git diff --numstat -- KIRO_LOG.md; $LASTEXITCODE`; pass when the deleted-lines column is `2` (the old note) and the exit code is 0
    - Verify (no hash, commit wording, file list or secret; run as one line; pass on no output): `$new = Get-Content -Encoding UTF8 KIRO_LOG.md | Select-Object -Skip ((Select-String -Path KIRO_LOG.md -Pattern '^## \d{4}-\d{2}-\d{2} ')[1].LineNumber - 1); $new | Select-String -CaseSensitive -Pattern '\b[0-9a-f]{7,40}\b'; $new | Select-String -Pattern '\b(commit|commits|committed|push|pushed|pushes)\b', 'Files created', '(api[_-]?key|token|password|secret)\s*[:=]'`
    - Verify (banned phrases; pass when it prints `8` and nothing else): `$l = (Select-String -Path .kiro/steering/product.md -Pattern '^- Do not use "' | Select-Object -First 1).Line; $ph = [regex]::Matches($l, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }; $ph.Count; Select-String -Path KIRO_LOG.md -SimpleMatch -Pattern $ph`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15_
  - [x] 1.2 Ask the user, then commit the log and the leftover status files
    - Show the user the output of `git status --porcelain; git diff --stat` and ask whether to commit `KIRO_LOG.md`, `.kiro/specs/runtime-core/tasks.md` and `.kiro/specs/runtime-core/tasks.meta.json` (Requirement 2.1)
    - If the user approves: `git add -- KIRO_LOG.md .kiro/specs/runtime-core/tasks.md .kiro/specs/runtime-core/tasks.meta.json; $LASTEXITCODE`, then `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "docs: KIRO_LOG Days 2-4 entries and runtime-core task status"; $LASTEXITCODE`. No `--no-verify`, no `--amend`, no co-author trailer; the pre-commit hook runs `pnpm check` (Requirements 2.2, 2.3)
    - Stage nothing else: no file under `packages/*/generated/` or `design-refs/`, and none of `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt`, `docs/ui-illustration-builder.txt` (Requirement 2.6)
    - **Stop condition:** if the pre-commit `pnpm check` fails, report the failing command, its output and exit code, and create no commit until the user decides (Requirement 2.5)
    - If the user declines, leave the three files unstaged and record the decision in the task report (Requirement 2.4)
    - Verify (approved): `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when it shows the Commit_Identity name and email and exactly the three paths, then `git status --porcelain -- KIRO_LOG.md .kiro/specs/runtime-core; $LASTEXITCODE` prints no file
    - Verify (declined): `git diff --cached --name-only; $LASTEXITCODE`; pass on no output
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Validator size reduction
  - [x] 2.1 Add codegen options to `buildProfileModule`
    - Edit `packages/schema/src/codegen/index.ts`: add `CodegenOptions`, `DEFAULT_CODEGEN_OPTIONS` (`inlineRefs: false`, `lines: false`) and `BASELINE_CODEGEN_OPTIONS` (`inlineRefs: true`, `lines: true`) as in design C2, and the optional third parameter of `buildProfileModule`; pass `inlineRefs` and `code.lines` to Ajv from the options
    - Keep `strict`, `allErrors`, `discriminator`, `unicode: false`, the logger, `CondD1`–`CondD8`, `inlineRuntimeHelpers` and `assertSelfContained`; `ajv` stays imported only in `packages/schema/src/codegen/`
    - Verify: `pnpm exec vitest run packages/schema/test/codegen.test.ts packages/schema/test/source-scan.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 3.5, 3.6, 3.7_
  - [x] 2.2 Print the byte counts and add the size test
    - Edit `packages/node-types/scripts/codegen.ts` to print `codegen: wrote <js path> and <d.ts path> (<raw> bytes JS, <gzip> bytes gzip)`, with `<gzip>` from `gzipSync` of `node:zlib` at the default level
    - Create `packages/node-types/test/validator-size.test.ts`: reads `packages/node-types/generated/core.validators.js` and fails when it exceeds 180,000 UTF-8 bytes or 14,000 gzip bytes
    - **Stop condition:** if either limit is exceeded, report both numbers and ask the user; do not change `CondD1`–`CondD8` (D5, D14)
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when the printed line shows both counts within the limits
    - Verify: `pnpm exec vitest run packages/node-types/test/validator-size.test.ts; $LASTEXITCODE`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.3 Write the property test for validator equivalence
    - **Property 1: Smaller validators report the same diagnostics**
    - Create `packages/node-types/test/validator-equivalence.property.test.ts`: build the `core` module with `DEFAULT_CODEGEN_OPTIONS` and `BASELINE_CODEGEN_OPTIONS`, write each to a file under `os.tmpdir()` and load it with `import(pathToFileURL(file).href)`, as `codegen.test.ts` does (no `eval` or `new Function`)
    - Assert that the module built with `DEFAULT_CODEGEN_OPTIONS` is byte-identical to the generated file
    - Generators from `packages/node-types/test/arbitraries.ts` (unchanged): valid manifests, manifests with one injected defect, one value replaced by random JSON, an edge `when` nested 1–10 levels, and random JSON; compare `ok` and the multiset of `(code, stage, path, severity)`; for random JSON, compare each `response_<type>` result
    - Include an example: a `when` nested 9 levels reports `schema/cond-too-deep` at that `when` path
    - Verify: `pnpm exec vitest run packages/node-types/test/validator-equivalence.property.test.ts; $LASTEXITCODE`
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 2.4 Confirm the existing tests and CLI results are unchanged
    - Verify: `git diff --exit-code -- packages/schema/test/compose.test.ts packages/node-types/test/validator.test.ts packages/node-types/test/validator.property.test.ts packages/node-types/test/termination.property.test.ts packages/node-types/test/replay.property.test.ts; $LASTEXITCODE`
    - Verify: `pnpm -s test:shared; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE`; pass when it prints one PASS line for `activities/core-demo-study-break.json` and exit code 0
    - Verify: `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE`; pass when it prints one `refs/dangling-ref` diagnostic and exit code 1
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

- [x] 3. `@dreame/ui` package setup and dependencies
  - [x] 3.1 Create the package manifest and install the dependencies
    - Create `packages/ui/package.json` with the exact content in design C3, `packages/ui/tsconfig.json` (extends `../../tsconfig.base.json`, `strict: true`, `types: ["node"]`, includes `src/**/*.ts`, `src/**/*.tsx`, `test/**/*.ts`, `test/**/*.tsx`) and a placeholder `packages/ui/src/index.ts` containing `export {};`; keep the existing `README.md`
    - Edit the root `package.json`: add `jsdom` `^31.0.1` to `devDependencies`
    - Do not add `vitest-axe` or `@vitejs/plugin-react` (D17, design "Dependencies")
    - Do not commit here: the final checkpoint commits `pnpm-lock.yaml` in the same commit as the `package.json` changes (Requirement 5.7)
    - **Stop condition:** if pnpm blocks a package by its minimum release age, or reports a missing peer not in design "Dependencies", stop and ask the user
    - Verify: `pnpm install; $LASTEXITCODE`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `Select-String -Path pnpm-lock.yaml -Pattern 'react-dom@19', 'jsdom@31', 'axe-core@4', '@testing-library/user-event@14'`; pass when each name appears
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.9_
  - [x] 3.2 Configure JSX, the root program and the two Vitest projects
    - Edit `tsconfig.base.json`: add `"jsx": "react-jsx"`; edit the root `tsconfig.json`: add `packages/*/src/**/*.tsx` and `packages/*/test/**/*.tsx` to `include`
    - Replace `vitest.config.ts` with the two inline projects of design C4 (`node` for `*.test.ts`, `dom` with `jsdom` and `packages/ui/test/setup.ts` for `packages/*/test/**/*.test.tsx`) and the `oxc.jsx` setting
    - Create `packages/ui/test/setup.ts` (`afterEach(cleanup)`), `packages/ui/test/environment.test.tsx` (renders `<p>ok</p>` with Testing Library and finds it by text) and `packages/ui/test/environment.test.ts` (asserts `typeof document === 'undefined'`)
    - **Stop condition:** if JSX fails to transform, check the Vite and Vitest docs through Context7; ask the user before adding any plugin
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/ui/; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run packages/runtime/; $LASTEXITCODE`
    - _Requirements: 5.5, 5.6, 5.8_

- [x] 4. Theme tokens
  - [x] 4.1 Write the TypeScript tokens and the contrast helpers
    - Create `packages/ui/src/theme/contrast.ts` (`relativeLuminance`, `contrastRatio` for `#rrggbb` strings, WCAG 2.2 formula) and `packages/ui/src/theme/tokens.ts` (`themeTokens` with every token and value of design C5, `reducedMotionTokens`, `BACKGROUND_TOKENS`, `CONTRAST_PAIRS`)
    - Create `packages/ui/test/tokens.test.ts` (node): `contrastRatio('#000000', '#ffffff')` is 21 and symmetric; every `CONTRAST_PAIRS` ratio is at least 4.5; `--dr-focus-ring-color` is at least 3 against each `BACKGROUND_TOKENS` entry; `--dr-touch-target-min` is at least `44px`; every colour token is 6-digit hex
    - Verify: `pnpm exec vitest run packages/ui/test/tokens.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.7_
  - [x] 4.2 Write the stylesheets and extend the token test
    - Create `packages/ui/src/theme/tokens.css` (every token on `:root`; motion tokens `0ms` inside `@media (prefers-reduced-motion: reduce)`) and `packages/ui/src/theme/components.css` (`:focus-visible` with the three focus tokens; `.dr-button` and `.dr-option` with `min-height` and `min-width` `var(--dr-touch-target-min)`; `.dr-body` with `white-space: pre-line`; every `transition` or `animation` duration through `var(--dr-motion-duration-*)`)
    - Extend `packages/ui/test/tokens.test.ts`: the `:root` block of `tokens.css` equals `themeTokens` in names and values; the reduced-motion block equals `reducedMotionTokens`; `components.css` meets each rule above, has no literal `ms` or `s` duration in a `transition` or `animation`, and has no `url(`
    - Verify: `pnpm exec vitest run packages/ui/test/tokens.test.ts; $LASTEXITCODE`
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 7.3, 14.1_

- [x] 5. Render registry and external link button
  - [x] 5.1 Write the render contract and registry
    - Create `packages/ui/src/render.ts` with `RenderProps`, `RenderModule`, `RenderEntry`, `RenderRegistry` and `createRenderRegistry` as in design C6 (`Map`-backed; throws `Error('createRenderRegistry: duplicate node type "<type>"')`)
    - Create `packages/ui/test/render-registry.test.ts` (node): lookup of three entries, `types()` order, duplicate error message, `get('__proto__')` and `get('toString')` return `undefined`
    - Verify: `pnpm exec vitest run packages/ui/test/render-registry.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 12.2, 12.3_
  - [x] 5.2 Write the property test for the render registry
    - **Property 6: The render registry returns what it was given**
    - Create `packages/ui/test/render-registry.property.test.ts` (node): generated type-name lists with and without repeats, including `__proto__` and `toString`
    - Verify: `pnpm exec vitest run packages/ui/test/render-registry.property.test.ts; $LASTEXITCODE`
    - _Requirements: 12.2, 12.3_
  - [x] 5.3 Write `describeLink` and `ExternalLinkButton`
    - Create `packages/ui/src/link.ts` (`describeLink` through `checkHttpsUrl` from `@dreame/schema`; `host` from `new URL(url).hostname`) and `packages/ui/src/components/ExternalLinkButton.tsx` with the default, confirm and blocked states of design C8 (`useId` for the IDs; focus moves to the anchor on confirm and back to the CTA button on "Stay here")
    - Create `packages/ui/test/ExternalLinkButton.test.tsx`: default state shows the label, `Opens <host>` and the author note; activating shows the confirm group with an anchor named `Open <host>`, `rel="noopener noreferrer"`, `target="_blank"` and focus on it; "Stay here" restores focus; `javascript:alert(1)` and an `http:` URL render no anchor and show the blocked note; a Unicode host shows its `xn--` form
    - Verify: `pnpm exec vitest run packages/ui/test/ExternalLinkButton.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.4, 8.1, 8.2, 8.3, 8.4, 8.6_
  - [x] 5.4 Write the property test for safe CTA links
    - **Property 3: Only safe CTA URLs become anchors**
    - Create `packages/ui/test/ExternalLinkButton.property.test.tsx`: generated safe `https:` URLs, `SAFE_CTA_URLS` and `UNSAFE_CTA_URLS` from `arbitraries.ts`, `http:`, `javascript:` and `data:` URLs, credentials, over-long URLs and random strings; activate the CTA button when present; an anchor exists exactly when `checkHttpsUrl(url, '')` returns no diagnostics, with `href` equal to the input, `rel` and `target` as in design C8
    - Verify: `pnpm exec vitest run packages/ui/test/ExternalLinkButton.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6. Render views for `content`, `choice` and `outcome`
  - [x] 6.1 Write `ContentNodeView`
    - Create `packages/ui/src/views/ContentNodeView.tsx` as in design C7 (optional `h2` with `tabIndex={-1}`, `.dr-body` paragraph, continue button, once-only `useRef` flag)
    - Create `packages/ui/test/ContentNodeView.test.tsx`: "Continue" when `continueLabel` is absent, the given label otherwise; one click calls `onRespond` once with `{}`; a second click does not call it again; a `body` with `<b>x</b>` shows literally
    - Verify: `pnpm exec vitest run packages/ui/test/ContentNodeView.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 7.4, 9.1, 9.2, 9.3_
  - [x] 6.2 Write `orderedOptions`
    - Create `packages/ui/src/choice-order.ts` (`orderedOptions(cfg, nodeState)` as in design C7)
    - Create `packages/ui/test/choice-order.test.ts` (node): config order when `shuffle` is not `true`; stored order when `shuffle` is `true` and `nodeState.order` is a permutation; config order for a missing, partial, duplicated or non-array `order`
    - Verify: `pnpm exec vitest run packages/ui/test/choice-order.test.ts; $LASTEXITCODE`
    - _Requirements: 10.2, 10.3_
  - [x] 6.3 Write `ChoiceNodeView`
    - Create `packages/ui/src/views/ChoiceNodeView.tsx` with the form, `fieldset role="radiogroup"`, `legend`, radio rows, inline error and submit button of design C7 (`useId` for names and IDs; Enter on a selected option calls `preventDefault()` and submits once; once-only flag)
    - Create `packages/ui/test/ChoiceNodeView.test.tsx`: the group is named by `prompt`; arrow keys move the selection (user-event); submit with a selection calls `onRespond` once with `{ optionId }`; Enter submits once; submit with no selection shows the message, links it with `aria-describedby` and does not call `onRespond`; further submits after a response are ignored
    - Verify: `pnpm exec vitest run packages/ui/test/ChoiceNodeView.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2, 10.1, 10.4, 10.5, 10.6, 10.7, 10.8_
  - [x] 6.4 Write the property test for choice option order
    - **Property 4: Choice options keep a defined order**
    - Create `packages/ui/test/ChoiceNodeView.property.test.tsx` with this property: valid `choice` configs from `validManifestArb` nodes and generated `nodeState` values (valid permutations, damaged values, `undefined`); the displayed radio values are a permutation of the option IDs and follow the rule of design Property 4
    - Verify: `pnpm exec vitest run packages/ui/test/ChoiceNodeView.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 6.5 Write the property test for choice submissions
    - **Property 5: A choice submission yields one valid response**
    - Add this property to `packages/ui/test/ChoiceNodeView.property.test.tsx`: generated configs, `nodeState`, a selected option and 1–4 submit attempts (clicks or Enter); `onRespond` is called exactly once with `{ optionId }`, and the response passes `choiceNodeType.isValidResponse(cfg, r)` and the generated `response_choice`
    - Verify: `pnpm exec vitest run packages/ui/test/ChoiceNodeView.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 10.5, 10.8, 10.9_
  - [x] 6.6 Write `OutcomeNodeView`
    - Create `packages/ui/src/views/OutcomeNodeView.tsx` as in design C7 (`h2` with `title`, `.dr-body` paragraph, `ExternalLinkButton` when `cta` is present, no respond control)
    - Create `packages/ui/test/OutcomeNodeView.test.tsx`: title and body shown; a `cta` renders through `ExternalLinkButton`; without `cta` no button exists; `onRespond` is never called
    - Verify: `pnpm exec vitest run packages/ui/test/OutcomeNodeView.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 6.7 Write the default render registry (Wiring_File W4)
    - Create `packages/ui/src/core-views.ts` with the exact content in design C6
    - Create `packages/ui/test/core-views.test.ts` (node): `coreViews.types()` equals the `type` names of `coreNodeTypes`, in order, and `coreViews.get` returns the three views
    - Verify: `pnpm exec vitest run packages/ui/test/core-views.test.ts; $LASTEXITCODE`
    - _Requirements: 12.1, 16.1, 16.2_
  - [x] 6.8 Write the property test for text rendering
    - **Property 2: Manifest strings are displayed as text**
    - Create `packages/ui/test/text-rendering.property.test.tsx`: generated strings, including markup such as `<b>x</b>` and `<img src=x>`, as every string field of design Property 2 across the three views; each string is the `textContent` of an element, and no `b` or `img` element is created
    - Verify: `pnpm exec vitest run packages/ui/test/text-rendering.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 7.4, 9.1, 10.1, 11.1_

- [x] 7. Node renderer, activity player and invalid-activity view
  - [x] 7.1 Write `NodeRenderer`
    - Create `packages/ui/src/components/NodeRenderer.tsx` as in design C9 (`key={viewKey}`; unknown type shows the `role="alert"` message naming the type and no view)
    - Create `packages/ui/test/NodeRenderer.test.tsx`: a registered type renders its view with the node's `config` and `nodeState`; an unregistered type shows the message with the type name
    - Verify: `pnpm exec vitest run packages/ui/test/NodeRenderer.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 12.4, 12.5_
  - [x] 7.2 Write the pure player reducer
    - Create `packages/ui/src/player-state.ts` (`PlayerState`, `PlayerEvent`, `playerReducer` as in design C10 and Data Models: `checkAction`, then `reduce` with `{ now: event.at }`; a rejection increments `rejections`, sets `lastRejection` and keeps the attempt)
    - Create `packages/ui/test/player-state.test.ts` (node), using the demo manifest: an accepted respond moves `currentNodeId`; an invalid `optionId` is rejected with the attempt unchanged
    - Verify: `pnpm exec vitest run packages/ui/test/player-state.test.ts; $LASTEXITCODE`
    - _Requirements: 13.2_
  - [x] 7.3 Write `ActivityPlayer`
    - Create `packages/ui/src/components/ActivityPlayer.tsx` as in design C10 (`useMemo` runtime, `useReducer` over `playerReducer`, `section.dr-player` with `data-node-id` and `tabIndex={-1}`, `viewKey` `${currentNodeId}#${rejections}`, rejection message, `limit_reached` note, focus effect that skips the first render)
    - Create `packages/ui/test/ActivityPlayer.test.tsx`: mount shows the start node and does not move focus; after a step, focus is on the new `h2`, or on the container for a `choice` node; a hand-built manifest with `maxTransitions` 1 shows the step-limit note and the fallback outcome; a test view that sends an invalid response shows the rejection message; a finished attempt shows the outcome
    - Verify: `pnpm exec vitest run packages/ui/test/ActivityPlayer.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - [x] 7.4 Write the property test for the player
    - **Property 7: The player shows the reducer's node**
    - Create `packages/ui/test/ActivityPlayer.property.test.tsx`: generated seeds and pick sequences on `activities/core-demo-study-break.json` and on `validManifestArb` manifests; drive the views with `fireEvent`, use a fixed `now`, and after every step compare `data-node-id` with `currentNodeId` from `reduce` for the same seed, responses and clock (`playManifest` from `arbitraries.ts`)
    - Verify: `pnpm exec vitest run packages/ui/test/ActivityPlayer.property.test.tsx; $LASTEXITCODE`
    - _Requirements: 13.1, 13.2, 13.3, 13.6_
  - [x] 7.5 Write `InvalidActivityView`
    - Create `packages/ui/src/components/InvalidActivityView.tsx` as in design C11 (at most `HARD_LIMITS.maxDiagnostics` items)
    - Create `packages/ui/test/InvalidActivityView.test.tsx`: each message shown as text (markup literal); 60 diagnostics show 50 items; the button has the given label and calls `onAction`
    - Verify: `pnpm exec vitest run packages/ui/test/InvalidActivityView.test.tsx; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 7.4, 13.7_
  - [x] 7.6 Write the public barrel
    - Replace `packages/ui/src/index.ts` with the exports listed in design C3
    - Create `packages/ui/test/index.test.ts` (node): each export name of design C3 is defined
    - Verify: `pnpm exec vitest run packages/ui/test/index.test.ts; $LASTEXITCODE`
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - _Requirements: 12.1, 12.2, 13.7_
  - [x] 7.7 Write the automated axe check
    - Create `packages/ui/test/a11y.test.tsx`: `axe.run(container, options)` from `axe-core` with the WCAG 2.x A and AA tags and `color-contrast` disabled, asserting `expect(result.violations).toEqual([])` for each view, the confirm state, the player and `InvalidActivityView` (D17)
    - **Stop condition:** fix violations in the components; disable no rule other than `color-contrast` without asking the user
    - Verify: `pnpm exec vitest run packages/ui/test/a11y.test.tsx; $LASTEXITCODE`
    - _Requirements: 7.1, 7.2_

- [x] 8. Scans and boundary tests
  - [x] 8.1 Extend the source scan to `.tsx` and `.jsx`
    - Edit `packages/schema/test/source-scan.test.ts`: the `listSourceFiles` filter becomes `/\.(ts|tsx|js|jsx)$/`; add one assertion that the list holds at least one `.tsx` file under `packages/ui/src`
    - Verify: `pnpm exec vitest run packages/schema/test/source-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 7.5, 14.2_
  - [x] 8.2 Extend the boundary test
    - Edit `packages/runtime/test/boundaries.test.ts`: `isForbiddenSpecifier` also flags `@dreame/ui`; a new `describe` scans `packages/node-types/src`, `packages/node-types/scripts` and `packages/schema/src` for `react`, `react-dom` and `@dreame/ui`
    - Verify: `pnpm exec vitest run packages/runtime/test/boundaries.test.ts; $LASTEXITCODE`
    - _Requirements: 12.6, 14.3, 14.4_
  - [x] 8.3 Write the privacy scan
    - Create `packages/ui/test/privacy-scan.test.ts` (node) as in design C12; build the searched tokens from fragments
    - Verify: `pnpm exec vitest run packages/ui/test/privacy-scan.test.ts; $LASTEXITCODE`
    - _Requirements: 7.6_
  - [x] 8.4 Write the repository text test
    - Create `tools/validate/test/repo-text.test.ts` (node): reads the quoted phrases of the "Do not use" line in `.kiro/steering/product.md` at run time (fails if there are not 8) and finds no case-insensitive match in `KIRO_LOG.md`, `.kiro/specs/ui-renderer/*.md` and `packages/ui/src/**`, nor in `EXTENDING.md` and `.kiro/hooks/*.json` when they exist (tasks 10.2 and 11.7 add those tests of existence)
    - Verify: `pnpm exec vitest run tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 1.14, 18.7_

- [x] 9. Checkpoint - Ensure all tests pass
  - Verify: `pnpm check; $LASTEXITCODE`
  - Verify: `git diff --exit-code -- .github/workflows/ci.yml; $LASTEXITCODE`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Shared node type property test and `EXTENDING.md` (W8)
  - [x] 10.1 Write the property test for shared node type `reduce`
    - **Property 10: Shared node type reduce leaves its inputs unchanged**
    - Create `packages/node-types/test/node-types.property.test.ts` referencing `contentNodeType`, `choiceNodeType` and `outcomeNodeType`: configs from `validManifestArb`, states reached with `playManifest`, responses that pass `isValidResponse`; deep-freeze the inputs, call `reduce` twice with the same `Env`, and compare
    - This file must exist before the Wiring_Hook (task 11.5), so that saving a shared node type file creates no new test file
    - Verify: `pnpm exec vitest run packages/node-types/test/node-types.property.test.ts; $LASTEXITCODE`
    - _Requirements: 16.5_
  - [x] 10.2 Write `EXTENDING.md` and its test
    - Create `EXTENDING.md` with `# Extending DREAME`, `## Node types` and one `### <type>` section for `content`, `choice` and `outcome` in the form of design C13 "Extending_Doc entry form", and nothing else
    - Create `tools/validate/test/extending-doc.test.ts` (node): the title, exactly one `##` heading (`## Node types`), one `### <type>` section with `Node type`, `View` and `Tests` lines per `coreNodeTypes` name, in order, and every path in those lines exists
    - Verify: `pnpm exec vitest run tools/validate/test/extending-doc.test.ts tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 15.8, 16.1, 16.2, 16.3, 16.4_
  - [x] 10.3 Add Node types to the `tools/validate` tsconfig
    - Edit `tools/validate/tsconfig.json`: add `"types": ["node"]` to `compilerOptions`, after `"strict": true`, as in `packages/runtime/tsconfig.json`; change nothing else in the file and add no dependency (`@types/node` is already installed)
    - Reason: design "Decisions for the user", "User answers (2026-11-20)": this package tsconfig was the only one without Node types; the change runs before task 11.1 because tasks 11.1–11.3 edit `tools/validate`
    - Verify: `pnpm exec tsc -p tools/validate/tsconfig.json; $LASTEXITCODE` (expect 0)
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run tools/validate/; $LASTEXITCODE`
    - _Requirements: 5.5, 18.8_

- [x] 11. Validate hook entry and the four Kiro hooks
  - [x] 11.1 Move the file-system half of the CLI to `node-io.ts`
    - Create `tools/validate/src/node-io.ts` with the real-file-system `CliIo` parts of `tools/validate/src/cli.ts`, and make `cli.ts` import them; `run.ts` and its tests stay unchanged
    - Verify: `git diff --exit-code -- tools/validate/src/run.ts tools/validate/test/run.test.ts; $LASTEXITCODE`
    - Verify: `pnpm exec vitest run tools/validate/; $LASTEXITCODE`
    - Verify: `pnpm validate activities/core-demo-study-break.json; $LASTEXITCODE` (expect 0), `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1), `pnpm validate; $LASTEXITCODE` (expect 2)
    - _Requirements: 4.5, 4.6, 17.2_
  - [x] 11.2 Write `runValidateHook`, its entry and the `validate:hook` script
    - Create `tools/validate/src/hook.ts` (`HookResult`, `runValidateHook` over `run` with an in-memory output buffer, routed by exit code as in design C13 H1) and `tools/validate/src/hook-cli.ts` (wires `node-io.ts`, writes `stdout` and `stderr`, sets `process.exitCode`)
    - Add the root script `"validate:hook": "pnpm codegen && node --experimental-strip-types tools/validate/src/hook-cli.ts"` to `package.json`
    - Create `tools/validate/test/hook.test.ts` (node): demo manifest gives 0 and the PASS line on `stdout`; the broken fixture gives 1 and the `FAIL` and `refs/dangling-ref` lines on `stderr`; no arguments give 2 and the usage on `stderr`
    - Verify: `pnpm exec vitest run tools/validate/test/hook.test.ts; $LASTEXITCODE`
    - Verify: `pnpm -s validate:hook activities/core-demo-study-break.json; $LASTEXITCODE`; pass when it prints the PASS line and exit code 0
    - Verify: `$out = pnpm -s validate:hook activities/fixtures/broken-dangling-edge.json 2>$null; $LASTEXITCODE; $out`; pass when the exit code is 1 and `$out` holds no `FAIL` line
    - _Requirements: 17.2, 17.3, 17.4_
  - [x] 11.3 Write the property test for hook output routing
    - **Property 8: Hook output reaches the agent on every exit code**
    - Create `tools/validate/test/hook.property.test.ts` (node): generated file contents (valid and defective manifests, random JSON, random bytes) in an in-memory `CliIo`; compare `runValidateHook` with `run` for the same arguments
    - Verify: `pnpm exec vitest run tools/validate/test/hook.property.test.ts; $LASTEXITCODE`
    - _Requirements: 17.2, 17.3, 17.4_
  - [x] 11.4 Write the activity and regression hook files
    - Create `.kiro/hooks/validate-activities.json` (H1, with `<ACTIVITY_MATCHER>` JSON-escaped) and `.kiro/hooks/runtime-regression.json` (H2) with the exact JSON of design C13, using the editor tool, not Kiro's hook-creation tool
    - **Stop condition (D23):** if Kiro denies a write under `.kiro/hooks/`, stop, give the user the exact JSON of each file and its name, and continue only after the user confirms the files exist
    - Verify: `(Get-Content -Raw -Encoding UTF8 .kiro/hooks/validate-activities.json | ConvertFrom-Json).hooks | Select-Object name, trigger, timeout, enabled; (Get-Content -Raw -Encoding UTF8 .kiro/hooks/runtime-regression.json | ConvertFrom-Json).hooks | Select-Object name, trigger, timeout, enabled`; pass when it raises no error and lists the H1 and H2 rows of the design C13 table
    - Verify: `pnpm -s validate:hook activities/core-demo-study-break.json; $LASTEXITCODE`
    - _Requirements: 17.2, 17.5, 17.6, 17.8, 17.9_
  - [x] 11.5 Write the node-type wiring hook file
    - Create `.kiro/hooks/node-type-wiring.json` (H3): the two hooks of design C13 H3 with `<WIRING_MATCHER>` JSON-escaped and the prompt as one JSON string (lines joined with `\n`); D23 applies as in task 11.4
    - Verify: `$h = (Get-Content -Raw -Encoding UTF8 .kiro/hooks/node-type-wiring.json | ConvertFrom-Json).hooks; $h | Select-Object name, trigger, enabled; $h[0].action.prompt -match '#new-node-type'`; pass when it lists the two H3 hooks and prints `True`
    - Verify: `Select-String -Path .kiro/hooks/node-type-wiring.json -SimpleMatch -Pattern 'Remove-Item', '.kiro/settings', '--no-verify'`; pass on no output
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12_
  - [x] 11.6 Write the property test for the activity matcher
    - **Property 9: The activity matcher accepts only shell-safe paths**
    - Create `tools/validate/test/kiro-hooks.property.test.ts` (node): read the matcher from `.kiro/hooks/validate-activities.json`; for any generated string the matcher accepts, check the character set, the `.json` ending and an `activities` segment; for generated safe paths with either separator, check that it matches
    - Verify: `pnpm exec vitest run tools/validate/test/kiro-hooks.property.test.ts; $LASTEXITCODE`
    - _Requirements: 17.2, 17.5_
  - [x] 11.7 Write the post-task hook file and the hook file test
    - Create `.kiro/hooks/post-task-check.json` (H4) with the exact JSON of design C13; D23 applies as in task 11.4. From this point Kiro runs `pnpm -s check` after each task
    - Create `tools/validate/test/kiro-hooks.test.ts` (node) with every check in design C13 "Hook file test", including the matcher examples and the H3 prompt phrases
    - Verify: `Get-ChildItem .kiro/hooks -Name`; pass when it lists exactly the four Hook_Files
    - Verify: `pnpm exec vitest run tools/validate/test/kiro-hooks.test.ts tools/validate/test/kiro-hooks.property.test.ts tools/validate/test/repo-text.test.ts; $LASTEXITCODE`
    - _Requirements: 15.1, 15.12, 17.1, 17.5, 17.6, 17.7, 17.8, 17.9, 17.12_
  - [x] 11.8 Ask the user to confirm the hooks in the Agent Hooks panel
    - Ask the user to open the Agent Hooks panel and confirm that Kiro lists all six hooks of the four files without an error, and that the trigger names Kiro shows are `PostFileSave`, `PostFileCreate` and `PostTaskExec` as written (Requirement 17.13)
    - If the panel shows an error, or Kiro uses another field or trigger name, change the Hook_File, `tools/validate/test/kiro-hooks.test.ts` and design C13 to Kiro's name, and record the difference in the task report (Requirement 17.14)
    - Verify: `pnpm exec vitest run tools/validate/test/kiro-hooks.test.ts; $LASTEXITCODE`
    - _Requirements: 17.13, 17.14_

- [x] 12. Timing and full-pipeline checks
  - [x] 12.1 Measure the hook command times
    - Run each command once and record its time and exit code in the task report:
      - `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s validate:hook activities/core-demo-study-break.json; $LASTEXITCODE; $sw.Elapsed.TotalSeconds`
      - `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s test:shared; $LASTEXITCODE; $sw.Elapsed.TotalSeconds`
      - `$sw = [Diagnostics.Stopwatch]::StartNew(); pnpm -s check; $LASTEXITCODE; $sw.Elapsed.TotalSeconds`
    - **Stop condition:** if a time exceeds 24 s, 96 s or 240 s respectively, report it to the user and ask whether to narrow the hook command or raise the timeout; change neither before the user answers (Requirement 17.11)
    - Verify: each of the three commands above prints exit code 0
    - _Requirements: 17.10, 17.11_
  - [x] 12.2 Run the full pipeline checks
    - Verify: `pnpm codegen; $LASTEXITCODE`; pass when the printed sizes are within 180,000 and 14,000 bytes
    - Verify: `pnpm typecheck; $LASTEXITCODE`
    - Verify: `pnpm validate activities/*.json; $LASTEXITCODE` (expect 0, one PASS line); `pnpm validate activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1); `pnpm validate; $LASTEXITCODE` (expect 2)
    - Verify: `pnpm -s validate:hook activities/fixtures/broken-dangling-edge.json; $LASTEXITCODE` (expect 1)
    - Verify: `pnpm check; $LASTEXITCODE`
    - Verify: `git diff --exit-code -- .github/workflows/ci.yml; $LASTEXITCODE`
    - Verify: `Test-Path package-lock.json; Test-Path yarn.lock`; pass when both print `False`
    - Verify: `git ls-files packages/node-types/generated design-refs .kiro/settings; $LASTEXITCODE`; pass when it lists no file under `packages/node-types/generated` or `design-refs`, and `git status --porcelain -- .kiro/settings` prints nothing
    - _Requirements: 3.1, 3.2, 4.5, 4.6, 5.5, 5.7, 14.5, 17.4_

- [-] 13. Final checkpoint - Ensure all tests pass, then ask before committing
  - Ensure all tests pass, ask the user if questions arise.
  - Show the user `git status --porcelain --untracked-files=all; git diff --stat` and ask: whether to commit; whether the work goes in one commit or several; whether to include `.kiro/specs/ui-renderer/` and the untracked `docs/Kiro_Setup_and_Operating_Playbook.md`
  - On approval, stage each approved file by explicit path with `git add -- <path> ...`, including `package.json`, `packages/ui/package.json` and `pnpm-lock.yaml` in the same commit (Requirement 5.7); never stage `packages/*/generated/`, `design-refs/`, `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` or `docs/ui-illustration-builder.txt`
  - Commit with `git -c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com" commit -m "<message the user approves>"; $LASTEXITCODE`; no `--no-verify`, no `--amend`, no co-author trailer; do not push unless the user asks
  - **Stop condition:** if the pre-commit `pnpm check` fails, report the command, output and exit code, and create no commit until the user decides
  - Verify: `git show --name-only --format=%an%n%ae%n%s HEAD; $LASTEXITCODE`; pass when the author is the Commit_Identity and the file list holds only approved paths, with `package.json` and `pnpm-lock.yaml` together
  - Verify: `git ls-files packages/node-types/generated design-refs`; pass on no output
  - _Requirements: 5.7, 14.5, 18.1_

## Notes

- No task is optional: each of design Properties 1–10 is its own required task (tasks 2.3, 5.2, 5.4, 6.4, 6.5, 6.8, 7.4, 10.1, 11.3, 11.6), placed after the task that writes the code it tests.
- Task 1 is first because Requirement 1.1 says so; task 1.2 and task 13 both wait for the user before any commit.
- Tasks 6.4 and 6.5 write the same file, as do tasks 4.1 and 4.2, so they sit in different waves.
- Hook files come after `validate:hook` (task 11.2) and Property 10 (task 10.1) exist, and the post-task hook comes last among them (task 11.7), as design "Notes for the tasks run" requires.
- Manual steps for the user: screenshot file names (1.1), commit approvals (1.2, 13), hook files by hand if Kiro blocks the writes (D23, tasks 11.4, 11.5, 11.7), the Agent Hooks panel check (11.8), and any timeout decision (12.1).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["2.4"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["4.1", "5.1", "6.2"] },
    { "id": 9, "tasks": ["4.2", "5.2", "5.3"] },
    { "id": 10, "tasks": ["5.4", "6.1"] },
    { "id": 11, "tasks": ["6.3", "6.6"] },
    { "id": 12, "tasks": ["6.4", "6.7"] },
    { "id": 13, "tasks": ["6.5", "6.8", "7.1"] },
    { "id": 14, "tasks": ["7.2", "7.5"] },
    { "id": 15, "tasks": ["7.3"] },
    { "id": 16, "tasks": ["7.4", "7.6"] },
    { "id": 17, "tasks": ["7.7"] },
    { "id": 18, "tasks": ["8.1", "8.2", "8.3", "8.4"] },
    { "id": 19, "tasks": ["10.1"] },
    { "id": 20, "tasks": ["10.2"] },
    { "id": 21, "tasks": ["10.3"] },
    { "id": 22, "tasks": ["11.1"] },
    { "id": 23, "tasks": ["11.2"] },
    { "id": 24, "tasks": ["11.3", "11.4"] },
    { "id": 25, "tasks": ["11.5", "11.6"] },
    { "id": 26, "tasks": ["11.7"] },
    { "id": 27, "tasks": ["11.8"] },
    { "id": 28, "tasks": ["12.1"] },
    { "id": 29, "tasks": ["12.2"] }
  ]
}
```
