# Requirements Document

## Introduction

This spec covers Days 6 and 7 of the DREAME 16-day plan as one "Shop Challenge spec" (Brief §8: Day 6 "Shop Challenge spec; `collectionSelect`, `recommendOutcome`"; Day 7 "Shop Challenge UI; https/WhatsApp CTA; deploy URL #1"). DREAME is the toolkit described in `docs/Skeleton_Crew_Audit_and_Brief_v2.md` (the Brief) and `docs/Architecture_and_UI_Spec.md` (the Architecture Spec). The previous specs `.kiro/specs/runtime-core/` (62 of 62 tasks) and `.kiro/specs/ui-renderer/` (all tasks marked done in `tasks.md`) are complete. Their decisions D1–D23, the Playbook reconciliation P1–P12 and the user answers of 2026-11-20 stay in force unless a requirement below names a change.

Shop Challenge is the first of the two apps (Brief §2). Its audience is small online sellers, such as Instagram and WhatsApp shops. Its mechanic is a bundle builder: the player picks several products under budget, occasion and maximum-item rules, and the activity ends with a recommended bundle and up to three https contact links, such as a `https://wa.me/...` WhatsApp link or a `https://t.me/...` Telegram link (Brief §2, C1; user decision of 2026-11-20). WhatsApp and Telegram are separate channel modules that the result view reads, so a channel can be added or removed without changing the node type.

The toolkit checks activity definitions against documented structural and supported semantic rules before playback (Brief §0). The new checks in this spec catch specified errors, such as a product rule that no selection can meet. They do not establish factual accuracy of prices, accessibility, or that every possible interaction behaves as intended. Property-based tests in this spec provide evidence for the properties tested only.

Environment: Windows, PowerShell 5.1 only, Node v22.23.5, pnpm 12.21.0, TypeScript 7.0.2, vitest 5.1.1, vite 8.3.8, fast-check 4.10.3, typebox 1.4.7, ajv 8.20.0, react and react-dom 19.3.1.

### Scope (proposed by the orchestrator; the user may change it on review)

1. A `KIRO_LOG.md` entry set for Day 5 (the ui-renderer spec) in the Playbook §6 template, and a commit of that file together with the leftover status-only changes in `.kiro/specs/ui-renderer/tasks.md` and `tasks.meta.json`, if the user approves at that time (Requirements 1, 2).
2. The workspace package `apps/shop-challenge` with the app profile `shop-challenge`, its precompiled validators and the app wiring files of ui-renderer decision D20 (Requirements 3, 4, 19).
3. The app node types `collectionSelect` and `recommendOutcome`, their views, unit tests, fast-check properties and `EXTENDING.md` entries, and the WhatsApp and Telegram Channel_Modules (Requirements 5–11, 19).
4. Rejection handling in `ActivityPlayer`, deferred from ui-renderer on 2026-11-20 (Requirement 12).
5. The Shop Challenge static app: routes, bundled demo playback, landing page, footer with the MIT license, `vercel.json` with the Architecture Spec §A3 headers, and the manual deploy of URL #1 (Requirements 13–16), and a short `PRIVACY.md` (Open question 20).
6. Demo activity manifests in `activities/` that pass `pnpm validate`, and a broken fixture for the new check (Requirement 17).
7. CI enforcement deferred from ui-renderer on 2026-11-20: dependency-cruiser boundary rules and ESLint `react/no-danger` (Requirement 18).
8. Task conventions (Requirement 20).

### Out of scope

- `apps/practice-path`, `recall`, `reviewQueue` and `packages/storage` (Days 8–9). Shop Challenge stores nothing on the device in this spec, so it does not need `packages/storage` (Open question 2).
- `packages/link`, the `/play#a=…` route for shared links and the `/create` editor route. Brief §8 schedules no link work for Days 6–7, and the form editor with JSON import and export is Day 11 (Brief §8). Architecture Spec §A3 says to measure the link size "on Day 7"; this spec defers that measurement with the link package (Open question 3).
- Authoring components (`ShopDetailsForm`, `ProductEditorRow`, `ChallengeRulesForm`, `EditorShell`, `ShareDialog`, QR codes) of Architecture Spec §B2 and §B3.
- `tools/create-app`, the `activity-author` custom agent and the full `EXTENDING.md` guide (Day 10).
- Playwright, `@axe-core/playwright` and `pnpm audit --prod` in CI. The axe check stays in Vitest (ui-renderer D17).
- Confetti, Tailwind CSS, shadcn/ui, Radix and Lucide (Open question 17).
- `README.md` app GIFs and `SUBMISSION.md` (Days 12–15). A short `PRIVACY.md` is in scope (Open question 20).
- The Plain React + Kiro comparison (Day 12). No requirement in this spec claims an advantage over another tool (`.kiro/steering/product.md`).
- Screenshots: the Implementing_Agent cannot take screenshots. The user saves any screenshot to `docs/kiro-evidence/` (Requirements 1.8, 1.9).

### Research facts used by these requirements

Checked in the Workspace on 2026-11-21:

| Topic | Finding | Source |
|---|---|---|
| Lint and boundary tools | Architecture Spec §A3 names dependency-cruiser and "ESLint (flat) + jsx-a11y + Prettier", and names the rule `react/no-danger`. It does not name the package `eslint-plugin-react` that provides that rule, nor a TypeScript parser for ESLint such as `typescript-eslint`. | Architecture Spec §A3, Part D |
| CI file | `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile` and then `pnpm check`. A check added inside `pnpm check` runs in CI without editing `ci.yml`. | `.github/workflows/ci.yml` |
| Check duration | `pnpm check` took 265.2 s on 2026-11-20 with no other load, against the 300 s timeout of the Post_Task_Hook. | `docs/HANDOFF.md` §3 |
| Manifest shape | The manifest schema has no `collections` field. Brief §3 lists `collections?: Collection[]`; runtime-core put it out of scope. | `packages/schema/src/contracts.ts`; runtime-core design "Data Models" |
| Answer types | `ValueType` already has a `set` kind for multi-select answers, and the condition operator `includes` works on `set` answers. | `packages/schema/src/node-type.ts`, `graph.ts` |
| Diagnostic codes | `DiagnosticCode` is a closed union in `packages/schema/src/diagnostics.ts`. A new code needs a change in `packages/schema`. | `packages/schema/src/diagnostics.ts` |
| Node type hooks | `enter(cfg, state, env)` runs for every entered node, terminal nodes included. `enter` and `reduce` see the attempt state but not the manifest at run time. `isValidResponse(cfg, r)` sees neither, so a response check cannot read an earlier answer such as the occasion. | `packages/runtime/src/reducer.ts`, `node-type.ts` |
| Rejection today | A rejected response remounts the view (`viewKey` `${nodeId}#${rejections}`), which clears the view's selection, moves focus to `body`, and reuses one `role="alert"` element. | ui-renderer design C10, "User answers (2026-11-20)" |
| Validate CLI | `tools/validate/src/run.ts` knows only the `core` profile. | `tools/validate/src/run.ts` |
| EXTENDING.md test | `tools/validate/test/extending-doc.test.ts` expects exactly the `core` node type sections. | that file |
| Generated files | `.gitignore` ignores `packages/*/generated/` only. | `.gitignore` |
| Git state | `main` is one commit (`082ed51`) ahead of `origin/main`; only the two ui-renderer status files are modified. | `git status`, `git log` |

## Glossary

- **Implementing_Agent**: The Kiro agent that carries out the tasks of this spec.
- **Workspace**: The repository at `c:\Users\ADMIN\my-kiro-win`.
- **Brief**: `docs/Skeleton_Crew_Audit_and_Brief_v2.md`.
- **Architecture_Spec**: `docs/Architecture_and_UI_Spec.md`.
- **Playbook**: `docs/Kiro_Setup_and_Operating_Playbook.md`, authoritative for how Kiro is set up and used.
- **Kiro_Log**: The file `KIRO_LOG.md` at the Workspace root.
- **Entry_Template**: The Playbook §6 entry form: a heading line `## YYYY-MM-DD — <title>`, then the five Entry_Fields, each on its own line.
- **Entry_Fields**: The five labelled lines of the Entry_Template, in order: `Spec:`, `Kiro did:`, `Caught by:`, `Fix:`, `Kiro features:`.
- **Day_5_Entries**: The one or more Kiro_Log entries this spec adds for the ui-renderer work.
- **Spec_Done_Entry**: The Day_5_Entries entry that records the completed ui-renderer spec.
- **Evidence_Folder**: The folder `docs/kiro-evidence/`.
- **Fact_Sources**: `docs/HANDOFF.md`, `.kiro/specs/ui-renderer/design.md` (sections "Decisions for the user", "User answers (2026-11-20)" and "Playbook reconciliation (2026-11-20)"), `.kiro/specs/ui-renderer/tasks.md`, and commands the Implementing_Agent runs with their observed output.
- **Banned_Phrase_List**: The eight phrases in the last rule of "Claim rules" in `.kiro/steering/product.md`, matched as case-insensitive substrings. This spec does not repeat them.
- **Leftover_Status_Files**: `.kiro/specs/ui-renderer/tasks.md` and `.kiro/specs/ui-renderer/tasks.meta.json`, which differ from HEAD only by task status changes.
- **Commit_Identity**: `-c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com"` passed to `git`.
- **Check_Pipeline**: The root script `pnpm check`, also the pre-commit hook and the CI step.
- **Shared_Test_Script**: The root script `pnpm test:shared` (`pnpm codegen && vitest run`).
- **Post_Task_Hook**: The hook file `.kiro/hooks/post-task-check.json`, which runs `pnpm -s check` when a spec task finishes.
- **Wiring_Hook**: The hook file `.kiro/hooks/node-type-wiring.json`.
- **Shop_App**: The workspace package in `apps/shop-challenge`, named `@dreame/shop-challenge`.
- **Shop_Profile**: The runtime `Profile` with ID `shop-challenge`, defined in `apps/shop-challenge/src/profile.ts`.
- **Shop_Codegen**: The build-time script of the Shop_App that writes the Shop_Validator_Module with `buildProfileModule` from `@dreame/schema/codegen`.
- **Shop_Validator_Module**: The generated JavaScript module that holds the precompiled manifest and response validators of the Shop_Profile.
- **App_Wiring_Files**: `apps/shop-challenge/src/node-types/index.ts`, `apps/shop-challenge/src/profile.ts` and `apps/shop-challenge/src/views/registry.ts` (ui-renderer D20, Wiring_Files W5–W7).
- **Own_Files**: For one app node type, its node type file `apps/shop-challenge/src/node-types/<type>.ts`, its view file `apps/shop-challenge/src/views/<Type>NodeView.tsx`, and its test files `apps/shop-challenge/test/<type>.test.ts` and `apps/shop-challenge/test/<type>.property.test.ts`.
- **Collection_Select**: The app node type `collectionSelect`, a multi-select of Items under the Selection_Rules.
- **Recommend_Outcome**: The app node type `recommendOutcome`, a terminal node that shows the chosen bundle, Suggestions and 0–3 Contact_Links.
- **Contact_Link**: One entry of the Recommend_Outcome `contacts` list: a `label` and an https `url` that the Recommend_Outcome_View shows through the External_Link_Button. It replaces the single `cta` field (user decision of 2026-11-20).
- **Contact_Channel**: A messaging service that the Recommend_Outcome_View can name next to a Contact_Link, described by the `ContactChannel` interface in `apps/shop-challenge/src/contact/channel.ts` (`id`, `name`, `matches(url)`). This spec defines WhatsApp and Telegram.
- **Channel_Module**: A file in `apps/shop-challenge/src/contact/` other than `channel.ts` and `channels.ts` that exports one Contact_Channel, for example `whatsapp.ts` or `telegram.ts`.
- **Channel_List**: The array `CONTACT_CHANNELS` and the function `channelFor(url)` in `apps/shop-challenge/src/contact/channels.ts`.
- **Item**: One product in a Collection_Select config, with an ID, a name, a price, tags, optional occasions and an optional emoji.
- **Price_Unit**: A price or budget value as a non-negative integer in whole units of the config's currency, for example whole US dollars.
- **Selection**: The set of Item IDs a player has picked in one Collection_Select node.
- **Occasion_Source**: The optional `choice` node named by a Collection_Select config, whose chosen option ID is the occasion.
- **Offered_Items**: For one Collection_Select node and one occasion value, the Items that have no `occasions` list or whose `occasions` list contains that occasion value; all Items when the config names no Occasion_Source.
- **Selection_Rules**: The rules a Selection must meet: every ID names an Item of the config, no ID repeats, the count is at least `min` and at most `max`, and the price total is at most `budget`. The occasion is not one of these rules, because `isValidResponse` receives no attempt state; the Collection_Select_View offers only Offered_Items instead.
- **Satisfiable**: A Collection_Select config is Satisfiable for one occasion value when at least `min` Offered_Items exist, `min` is at most `max`, and the sum of the `min` lowest Offered_Item prices is at most `budget`.
- **Suggestions**: The Items a Recommend_Outcome node lists in addition to the Selection, computed from its `recommend` block (Brief B3: `where`, `sortBy`, `limit`).
- **Collection_Select_View**: The Render_Module of Collection_Select, at `apps/shop-challenge/src/views/CollectionSelectNodeView.tsx`.
- **Recommend_Outcome_View**: The Render_Module of Recommend_Outcome, at `apps/shop-challenge/src/views/RecommendOutcomeNodeView.tsx`.
- **Render_Module**: A React component that receives the props `cfg`, `onRespond` and `nodeState` (ui-renderer C6).
- **Shop_Views**: The Render_Registry exported by `apps/shop-challenge/src/views/registry.ts`, holding the views of all Shop_Profile node types.
- **Activity_Player**: The `ActivityPlayer` component of `@dreame/ui` (ui-renderer C10).
- **Rejection**: A respond action that the runtime `checkAction` refuses, so the attempt state stays unchanged.
- **Rejection_Message**: The text the Activity_Player shows after a Rejection.
- **External_Link_Button**: The `ExternalLinkButton` component of `@dreame/ui` (ui-renderer C8).
- **Invalid_Activity_View**: The `InvalidActivityView` component of `@dreame/ui` (ui-renderer C11).
- **Safe_Url**: A URL for which `checkHttpsUrl` from `@dreame/schema` returns no diagnostics.
- **Demo_Manifest**: A manifest file `activities/shop-*.json` with `profile` `shop-challenge`, bundled into the Shop_App.
- **Shop_Fixture**: A deliberately broken manifest file under `activities/fixtures/` with `profile` `shop-challenge`.
- **Validate_CLI**: The command `pnpm validate <file-or-pattern>...` in `tools/validate`.
- **Vercel_Config**: The file `apps/shop-challenge/vercel.json`.
- **CSP_Value**: The exact string `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` (Architecture Spec §A3).
- **Deploy_URL**: The public Vercel URL of the Shop_App (Brief §8 Day 7 "deploy URL #1").
- **Boundary_Rules**: The dependency-cruiser rules of Requirement 18.
- **Lint_Check**: The ESLint run of Requirement 18.
- **Named_Dependency**: A package that the Architecture_Spec or `docs/Submission_Checklist_and_Compliance.md` names, or that an earlier spec records as approved by the user.
- **Unnamed_Dependency**: Any other package.
- **Component_Test**: A Vitest test that renders components in the `jsdom` environment.
- **Source_Scan**: The test `packages/schema/test/source-scan.test.ts`.
- **Privacy_Scan**: The test `packages/ui/test/privacy-scan.test.ts` and any app-level scan that applies the same token list.
- **Repo_Text_Scan**: The test `tools/validate/test/repo-text.test.ts`.
- **Verify_Command**: A command listed under `Verify:` in a task, written for PowerShell 5.1.

## Requirements

### Requirement 1: KIRO_LOG entries for Day 5

**User Story:** As the builder, I want factual Kiro_Log entries for the ui-renderer work in the Playbook §6 template, so that the Kiro write-up and judges can trace how Kiro was used on Day 5.

Source: Playbook §6; ui-renderer Requirement 1 and "User answers (2026-11-20)".

#### Acceptance Criteria

1. THE Implementing_Agent SHALL complete Requirements 1 and 2 as the first task of this spec, before any other task.
2. THE Implementing_Agent SHALL append the Day_5_Entries after the last existing Kiro_Log entry and SHALL leave every existing line of the Kiro_Log byte-for-byte unchanged.
3. THE Day_5_Entries SHALL each follow the Entry_Template: one heading line `## YYYY-MM-DD — <title>`, then the five Entry_Fields in order, each on its own line with its label followed by one space and the field text.
4. THE Day_5_Entries SHALL contain only statements that trace to a Fact_Source, including the date in each heading.
5. THE Day_5_Entries SHALL include a Spec_Done_Entry whose `Spec:` field names `ui-renderer`, whose `Kiro did:` field states the number of ui-renderer tasks marked done in `.kiro/specs/ui-renderer/tasks.md`, and which refers to the decisions of that spec by the path `.kiro/specs/ui-renderer/design.md`.
6. THE Spec_Done_Entry SHALL record in its `Caught by:` field each final ui-renderer check that a Fact_Source records, with its command and exit code.
7. THE Day_5_Entries SHALL include one entry for each of these Fact_Source events: the generated validator size before and after the ui-renderer byte budget; the `pnpm check` run that failed with Vitest worker start timeouts under machine load and passed on a re-run without code changes; the Regression_Hook timeout raised from 120 s to 180 s after a measured 98.82 s; and the deferral of rejection focus and CI enforcement to this spec.
8. WHEN the Implementing_Agent starts the Day_5_Entries, THE Implementing_Agent SHALL tell the user that the Implementing_Agent cannot take screenshots and SHALL ask the user for the file names of any Day 5 screenshots saved in the Evidence_Folder.
9. THE Day_5_Entries SHALL reference a screenshot only by the Workspace-relative path of a file that exists in the Evidence_Folder.
10. THE Day_5_Entries SHALL contain no commit hash, no commit message, no statement about a commit or a push, and no list of created files.
11. THE Kiro_Log SHALL contain zero matches of any Banned_Phrase_List phrase and no API keys, tokens, passwords or other secrets.

### Requirement 2: Commit of the log and the leftover status files

**User Story:** As the builder, I want the Day 5 log and the leftover ui-renderer status files committed together, so that the repository records Day 5 completely.

Source: ui-renderer Requirement 2; `docs/HANDOFF.md` §5 git rules.

#### Acceptance Criteria

1. WHEN the Day_5_Entries are written, THE Implementing_Agent SHALL show the user `git status --porcelain` and `git diff --stat` and SHALL ask the user whether to commit the Kiro_Log and the Leftover_Status_Files, and whether to include the files of `.kiro/specs/shop-challenge/` in the same commit.
2. WHEN the user approves the commit, THE Implementing_Agent SHALL stage exactly the approved files by explicit path and SHALL commit them with the Commit_Identity.
3. THE Implementing_Agent SHALL commit without `--no-verify`, without `--amend` and without a co-author trailer, so that the Check_Pipeline runs as the pre-commit hook.
4. IF the user declines the commit, THEN THE Implementing_Agent SHALL leave the files unstaged and SHALL record the decision in its task report.
5. IF the pre-commit Check_Pipeline fails, THEN THE Implementing_Agent SHALL report the failing command, its output and its exit code to the user and SHALL create no commit until the user decides how to proceed.
6. THE Implementing_Agent SHALL stage no file under `packages/*/generated/`, `apps/*/generated/` or `design-refs/` and none of the untracked files `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` and `docs/ui-illustration-builder.txt`.
7. THE Implementing_Agent SHALL push only when the user asks, and SHALL tell the user how many local commits are ahead of `origin/main` before asking.

### Requirement 3: Shop Challenge package and profile

**User Story:** As an app developer, I want a Shop Challenge workspace package with its own profile, so that the app's node types are registered once and the app builds on its own.

Source: Brief §2, D2; Architecture Spec §A3, §A6, §A7; `structure.md`; `tech.md`; ui-renderer D20.

#### Acceptance Criteria

1. THE Shop_App SHALL have a `package.json` named `@dreame/shop-challenge` with `private: true` and `type: module`, and a `tsconfig.json` that extends `../../tsconfig.base.json` with `compilerOptions.strict` set to `true`.
2. THE Shop_App SHALL keep its node types in `apps/shop-challenge/src/node-types/`, its views in `apps/shop-challenge/src/views/`, its profile in `apps/shop-challenge/src/profile.ts` and its tests in `apps/shop-challenge/test/` (ui-renderer D20).
3. THE Shop_Profile SHALL have the ID `shop-challenge` and SHALL list the node types `content`, `choice`, `outcome`, `collectionSelect` and `recommendOutcome`, each exactly once.
4. THE files under `apps/shop-challenge/src/node-types/` and the file `apps/shop-challenge/src/profile.ts` SHALL import no `react`, `react-dom`, `@dreame/ui` or `.tsx` module, so that Node can load the Shop_Profile in the Validate_CLI and the Shop_Codegen.
5. THE Workspace root `tsconfig.json` SHALL include the Shop_App `.ts` and `.tsx` source and test files, and `pnpm typecheck` SHALL exit with code 0.
6. THE root `vitest.config.ts` SHALL include the Shop_App test files, running `*.test.ts` files in the `node` environment and `*.test.tsx` files in the `jsdom` environment.
7. WHEN the Implementing_Agent needs an Unnamed_Dependency, THE Implementing_Agent SHALL stop and ask the user before adding it to any `package.json`.
8. THE design SHALL list each dependency it proposes with its checked registry version, whether it is a Named_Dependency, and its approval status.
9. THE Workspace SHALL keep `pnpm-lock.yaml` as its only lockfile, and THE Implementing_Agent SHALL commit any `pnpm-lock.yaml` change in the same commit as the matching `package.json` change.
10. THE Shop_App source SHALL use relative imports with explicit `.ts` or `.tsx` extensions and only erasable TypeScript syntax (runtime-core D4).

### Requirement 4: Precompiled Shop Challenge validators

**User Story:** As a toolkit maintainer, I want the Shop_Profile validators generated at build time, so that the app runs under a strict CSP with no runtime schema compilation.

Source: Brief B4, B5; Architecture Spec §A2, §A3; `tech.md`; runtime-core D2, D3; ui-renderer Requirement 3.

#### Acceptance Criteria

1. THE Shop_Codegen SHALL produce the Shop_Validator_Module with Ajv standalone code generation at build time, through `buildProfileModule` from `@dreame/schema/codegen`, with the code generation options that ui-renderer decision D14 set as defaults.
2. THE Shop_Validator_Module SHALL hold one manifest validator composed as a `oneOf` over the `configSchema` of every Shop_Profile node type, discriminated on `type`, and one response validator per Shop_Profile node type.
3. THE Shop_Codegen SHALL write the Shop_Validator_Module and its `.d.ts` file to `apps/shop-challenge/generated/`, and THE `.gitignore` SHALL list `apps/*/generated/`.
4. WHEN `pnpm codegen` runs, THE root script SHALL run the `core` codegen and the Shop_Codegen, and THE Shop_Codegen SHALL print the raw and gzip byte counts of the Shop_Validator_Module.
5. THE Workspace SHALL contain a Vitest test that fails when the Shop_Validator_Module exceeds the byte limits the design sets after measuring the first generated module, and THE design SHALL record the measured sizes next to those limits.
6. THE Workspace SHALL contain no `ajv` import outside `packages/schema/src/codegen/`, checked by the Source_Scan over `apps/`, `packages/` and `tools/`.
7. THE Shop_Codegen SHALL pass the generated code through `inlineRuntimeHelpers` and `assertSelfContained`, as the `core` codegen does.

### Requirement 5: collectionSelect configuration and validation

**User Story:** As a seller, I want my product list and bundle rules checked before anyone plays, so that a shared challenge never traps a player in a step where no bundle can be accepted.

Source: Brief §2, B3, B11, C1, C2; Architecture Spec §B3; `new-node-type.md` steps 1–6; `activity-authoring.md`.

#### Acceptance Criteria

1. THE Collection_Select node type SHALL have `type` `collectionSelect`, `version` 1 and `terminal` `false`.
2. THE Collection_Select `configSchema` SHALL be closed, with `additionalProperties: false` on every object schema, and SHALL accept a `prompt`, an `items` array, the rule fields `min`, `max` and `budget`, a `currency` code, and the optional fields `occasionFrom`, `pricesAsOf` and `continueLabel`.
3. THE Collection_Select `configSchema` SHALL accept each Item with an `id`, a `name`, a `price` in Price_Units, a `tags` array, and the optional fields `occasions` and `emoji`, and no other field.
4. THE Collection_Select `configSchema` SHALL limit `items` to 1–24 entries, `price` to integers 0–100,000,000, `budget` to integers 1–1,000,000,000, `min` and `max` to integers 1–24, `tags` to at most 8 strings, `currency` to the pattern `^[A-Z]{3}$`, `pricesAsOf` to the pattern `YYYY-MM-DD`, and every string to a maximum length the design lists (runtime-core D6 counts UTF-16 code units).
5. IF two Items in one Collection_Select config share an `id`, THEN THE Collection_Select `validate` SHALL report a diagnostic with code `duplicate-item-id` at the path of the second Item.
6. IF the `prompt` or an Item `name` is blank, THEN THE Collection_Select `validate` SHALL report `conditions/blank-text` through `ctx.checkText` at that path.
7. IF `occasionFrom` names no node in the manifest, THEN THE Collection_Select `validate` SHALL report `dangling-ref` at the `occasionFrom` path.
8. IF `occasionFrom` names a node whose type is not `choice`, THEN THE Collection_Select `validate` SHALL report `type-mismatch` at the `occasionFrom` path.
9. IF `occasionFrom` names a node that does not lie on every path from `entryNodeId` to the Collection_Select node, THEN THE Collection_Select `validate` SHALL report `answer-not-upstream` at the `occasionFrom` path.
10. IF an Item `occasions` entry is not an option ID of the Occasion_Source, or the config has no `occasionFrom`, THEN THE Collection_Select `validate` SHALL report `dangling-ref` at the path of that `occasions` entry.
11. IF the config is not Satisfiable for the single occasion value of a config without `occasionFrom`, or for any option ID of the Occasion_Source, THEN THE Collection_Select `validate` SHALL report a diagnostic with code `select-unsatisfiable` that names the occasion value, at the path of the config.
12. THE Collection_Select `answerType` SHALL return a `set` value type whose `values` are the Item IDs in config order, so that edge conditions can test a Selection with `includes`.
13. FOR ALL generated Collection_Select configs with at most 10 Items, THE Collection_Select `validate` SHALL report `select-unsatisfiable` for an occasion value exactly when an exhaustive search over all subsets of the Offered_Items for that value finds no subset that meets the Selection_Rules (model-based property).

### Requirement 6: collectionSelect responses and state

**User Story:** As a player, I want only bundles that meet the challenge rules accepted, so that the result screen always shows a bundle within budget.

Source: Brief §2, §3, B6; `new-node-type.md` steps 4, 6 and "Purity".

#### Acceptance Criteria

1. THE Collection_Select `responseSchema` SHALL be closed and SHALL accept only an object `{ itemIds }` whose `itemIds` is an array of at most 24 strings.
2. WHEN a response meets the Selection_Rules, THE Collection_Select `isValidResponse` SHALL return `true`.
3. IF a response breaks any Selection_Rule, THEN THE Collection_Select `isValidResponse` SHALL return `false`, so that the runtime reports the Rejection `invalid-response`.
4. WHEN the runtime applies an accepted Collection_Select response, THE Collection_Select `reduce` SHALL store the Selection as the node's answer, with the Item IDs in config order.
5. WHEN the runtime applies an accepted Collection_Select response, THE Collection_Select `reduce` SHALL store in the node's `nodeState` the Item data that a later Recommend_Outcome node needs: the ID, name, price, tags and emoji of each Offered_Item, and the config `currency`.
6. THE Collection_Select `reduce` and `enter` SHALL take time only from `env.now` and randomness only from `env.rng`, and SHALL leave their inputs unchanged.
7. FOR ALL generated Collection_Select configs and candidate responses, THE Collection_Select `isValidResponse` SHALL return `true` exactly when a reference implementation of the Selection_Rules returns `true` (model-based property).
8. FOR ALL generated Collection_Select configs, attempt states and valid responses, THE Collection_Select `reduce` SHALL leave its inputs unchanged and return equal results for equal inputs (Wiring_Hook prompt step 6).

### Requirement 7: recommendOutcome configuration and validation

**User Story:** As a seller, I want the result step checked against the product step it reads from, so that the result screen always has a bundle to show.

Source: Brief §2, B3, C1; Architecture Spec §B3, §A5; `security.md` "Links"; `activity-authoring.md` "CTA URLs".

#### Acceptance Criteria

1. THE Recommend_Outcome node type SHALL have `type` `recommendOutcome`, `version` 1 and `terminal` `true`.
2. THE Recommend_Outcome `configSchema` SHALL be closed and SHALL accept a `title`, a `body`, a `from` node ID, and the optional fields `whyText`, `recommend` and `contacts`, where `contacts` is a list of 0–3 Contact_Links.
3. THE Recommend_Outcome `recommend` block SHALL accept a `where` list of 0–4 clauses, a `sortBy` of price ascending or price descending, and a `limit` integer 1–8 (Brief B3).
4. THE Recommend_Outcome `where` clauses SHALL accept only `includes` on Item `tags` with a string value, and `lte` or `gte` on Item `price` with an integer value, so that the operator set stays within the condition operators of `activity-authoring.md`.
5. THE Recommend_Outcome `configSchema` SHALL accept a `contacts` list of at most 3 entries, each a closed object with a `label` of at most 60 characters and a `url` of at most 2,048 characters whose schema pattern requires the prefix `https://` (runtime-core D6 counts UTF-16 code units).
6. IF the `url` of a Contact_Link is not a Safe_Url, THEN THE Recommend_Outcome `validate` SHALL report `conditions/unsafe-url` through `ctx.checkHttpsUrl` at the path `/config/contacts/<index>/url` of that Contact_Link, so that `http:`, `javascript:`, `data:` and known link-shortener URLs are rejected and `https://wa.me/...` and `https://t.me/...` URLs are accepted.
7. IF `from` names no node in the manifest, THEN THE Recommend_Outcome `validate` SHALL report `dangling-ref` at the `from` path.
8. IF `from` names a node whose type is not `collectionSelect`, THEN THE Recommend_Outcome `validate` SHALL report `type-mismatch` at the `from` path.
9. IF `from` names a node that does not lie on every path from `entryNodeId` to the Recommend_Outcome node, THEN THE Recommend_Outcome `validate` SHALL report `answer-not-upstream` at the `from` path.
10. IF the `title` is blank, THEN THE Recommend_Outcome `validate` SHALL report `conditions/blank-text` at the `title` path.
11. THE Recommend_Outcome `answerType` SHALL return `null`, and THE Recommend_Outcome `responseSchema` SHALL be the closed empty object.
12. THE Recommend_Outcome node type file `apps/shop-challenge/src/node-types/recommendOutcome.ts` SHALL import no Channel_Module and no Channel_List, so that adding or removing a Contact_Channel changes no node type file.

### Requirement 8: Bundle result and Suggestions

**User Story:** As a player, I want to see my bundle with its total and a few matching extras, so that I can decide what to order from the seller.

Source: Brief §2 ("Recommended bundle + https CTA"), B3, B6; Architecture Spec §B3 `BundleResult`.

#### Acceptance Criteria

1. WHEN the runtime enters a Recommend_Outcome node, THE Recommend_Outcome `enter` SHALL store in the node's `nodeState` the Selection of the `from` node with each Item's name and price, the Selection's price total, the currency, and the Suggestions.
2. THE Recommend_Outcome `enter` SHALL compute the Suggestions as the Offered_Items of the `from` node that are not in the Selection and that meet every `where` clause, sorted by price in the `sortBy` order with ties kept in config order, and cut to the first `limit` entries.
3. WHERE the Recommend_Outcome config has no `recommend` block, THE Recommend_Outcome `enter` SHALL store an empty Suggestions list.
4. IF the `from` node has no answer when the runtime enters the Recommend_Outcome node, THEN THE Recommend_Outcome `enter` SHALL store an empty Selection, a total of 0 and an empty Suggestions list.
5. THE Recommend_Outcome `enter` SHALL take no time or randomness from outside `env`, and SHALL leave its inputs unchanged.
6. FOR ALL generated Item lists, Selections and `recommend` blocks, THE Suggestions SHALL be a subset of the Offered_Items, SHALL share no Item with the Selection, SHALL meet every `where` clause, SHALL be ordered by price in the `sortBy` order, and SHALL have a length equal to the smaller of `limit` and the number of eligible Items (metamorphic and invariant property).
7. FOR ALL generated Selections, THE stored total SHALL equal the sum of the stored Item prices.

### Requirement 9: Shop Challenge profile property tests

**User Story:** As a toolkit maintainer, I want the three required property tests run against the Shop_Profile, so that the app node types meet the same properties as the shared ones.

Source: `testing.md` "Required property tests"; Brief §5; Architecture Spec §A3.

#### Acceptance Criteria

1. FOR ALL generated Shop_Profile manifests that pass validation, and every generated response sequence tested, THE runtime SHALL reach status `finished` or `limit_reached` within `limits.maxTransitions` transitions.
2. FOR ALL generated JSON values, THE graph validator called with the Shop_Profile SHALL return a result without throwing.
3. FOR ALL generated Shop_Profile manifests that pass validation, seeds and action sequences, THE runtime `reduce` SHALL return equal attempt states for equal seeds and equal action sequences.
4. THE property tests of this spec SHALL use fast-check with `numRuns` of at least 100 and SHALL describe their results as evidence for the properties tested.

### Requirement 10: collectionSelect view

**User Story:** As a player on a phone or a keyboard, I want to pick products, see my running total against the budget, and know what to change, so that I can build a valid bundle without guessing.

Source: Architecture Spec §B3 (`ProductCard`, `BundleBar`, `ConstraintHint`), §A5, §A7; Brief A8, B11; ui-renderer Requirements 6.5, 7, 10.7.

#### Acceptance Criteria

1. WHEN the Collection_Select_View displays a config, THE Collection_Select_View SHALL display the `prompt` as the label of one group and one checkbox per Offered_Item, in config order.
2. THE Collection_Select_View SHALL give each Item checkbox an accessible name that contains the Item `name` and its formatted price.
3. THE Collection_Select_View SHALL display each Item's `tags` as text, and SHALL mark each Item `emoji` as decorative with `aria-hidden="true"`.
4. THE Collection_Select_View SHALL display prices in the config `currency` with `Intl.NumberFormat`, the locale `en-US` and no fraction digits, for example "$12" (Open question 10, changed 2026-11-20).
5. WHILE the player changes the Selection, THE Collection_Select_View SHALL display the Item count against `max`, the price total, and a budget status in text: "Under budget" when the total is at most 80% of `budget`, "Close to budget" when the total is above 80% and at most 100%, and "Over budget" when the total is above `budget`.
6. WHILE the Selection breaks a Selection_Rule, THE Collection_Select_View SHALL display one hint in text that names the first broken rule in the order count below `min`, count above `max`, total above `budget`, with the number of Items to add or remove or the formatted amount over budget.
7. WHEN the player activates the continue control with a Selection that meets the Selection_Rules, THE Collection_Select_View SHALL call `onRespond` once with `{ itemIds }` in config order.
8. IF the player activates the continue control with a Selection that breaks a Selection_Rule, THEN THE Collection_Select_View SHALL leave `onRespond` uncalled and SHALL display an inline message that is linked to the group with `aria-describedby`.
9. WHEN `onRespond` has been called, THE Collection_Select_View SHALL ignore further continue activations until the node changes or the Activity_Player reports a Rejection.
10. WHERE the config has `pricesAsOf`, THE Collection_Select_View SHALL display the text "Prices as of <date>. The seller's page has the current prices." (Brief B11).
11. THE Collection_Select_View SHALL display every manifest string as text content, SHALL use native `input type="checkbox"`, `fieldset`, `legend`, `label` and `button` elements, and SHALL use no inline `style` attribute.
12. FOR ALL generated Collection_Select configs, occasion values and sequences of checkbox toggles, THE response passed to `onRespond` SHALL pass the Collection_Select `isValidResponse` and SHALL contain only IDs of Offered_Items.

### Requirement 11: recommendOutcome view

**User Story:** As a player, I want a clear result screen with my bundle, its total and the seller's link, so that I know what I picked and how to order it.

Source: Architecture Spec §B3 `BundleResult`, §A5; Brief §2, §6, C1; ui-renderer Requirement 11.

#### Acceptance Criteria

1. WHEN the Recommend_Outcome_View displays a node, THE Recommend_Outcome_View SHALL display the `title` as a heading and the `body` as text with its line breaks kept.
2. THE Recommend_Outcome_View SHALL display each Item of the stored Selection with its name and formatted price, and the formatted total.
3. WHERE the config has `whyText`, THE Recommend_Outcome_View SHALL display it as text next to the bundle.
4. WHILE the stored Suggestions list is not empty, THE Recommend_Outcome_View SHALL display the Suggestions under their own heading, each with its name and formatted price.
5. IF the stored Selection is empty, THEN THE Recommend_Outcome_View SHALL display a plain-language note that no bundle was chosen.
6. WHERE the config has Contact_Links, THE Recommend_Outcome_View SHALL display one External_Link_Button per Contact_Link, in config order, with the Contact_Link `label` as its text, so that the destination host is shown and confirmed before the player leaves the page.
7. THE Recommend_Outcome_View SHALL display no control that calls `onRespond`.
8. IF the `nodeState` is missing or does not have the shape that Recommend_Outcome `enter` stores, THEN THE Recommend_Outcome_View SHALL display the `title`, the `body` and the Contact_Links, with the note of criterion 5.
9. WHEN `channelFor(url)` returns a Contact_Channel for the `url` of a Contact_Link, THE Recommend_Outcome_View SHALL display the text "via <name>" next to that Contact_Link, where `<name>` is the `name` of that Contact_Channel.
10. IF `channelFor(url)` returns no Contact_Channel for the `url` of a Contact_Link, THEN THE Recommend_Outcome_View SHALL display the Contact_Link `label` alone, with no channel name.
11. THE Channel_List `channelFor` SHALL return a Contact_Channel only for a URL with the scheme `https:` whose host name equals exactly one host name of that Contact_Channel: `wa.me` or `api.whatsapp.com` for WhatsApp, and `t.me` for Telegram.
12. IF the URL passed to `channelFor` cannot be parsed, THEN THE Channel_List `channelFor` SHALL return no Contact_Channel.
13. THE Channel_Modules SHALL each import only `apps/shop-challenge/src/contact/channel.ts`, so that adding or removing a Contact_Channel changes one Channel_Module file plus its import and its `CONTACT_CHANNELS` entry in `channels.ts`.
14. THE Channel_Modules and the Channel_List SHALL import no `react` or `react-dom` module and SHALL contain no call to `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` or `WebSocket`, so that naming a Contact_Channel makes no network call.

### Requirement 12: Rejection handling in the activity player

**User Story:** As a keyboard or screen-reader player, I want to hear and reach the message when my answer is not accepted, and keep my picks, so that I can fix the answer instead of starting the step again.

Source: ui-renderer design "User answers (2026-11-20)" (rejection focus deferred to this spec); ui-renderer Requirement 13; `docs/HANDOFF.md` §2 open points.

#### Acceptance Criteria

1. WHEN a Rejection occurs, THE Activity_Player SHALL insert a new Rejection_Message element, so that each Rejection adds an element that was not in the page before.
2. WHEN a Rejection occurs, THE Activity_Player SHALL move keyboard focus to the Rejection_Message.
3. WHEN a second Rejection occurs on the same node, THE Activity_Player SHALL replace the Rejection_Message with a new element and SHALL move focus to the new element.
4. WHEN an accepted response moves the attempt to another node, THE Activity_Player SHALL remove the Rejection_Message and SHALL move focus as ui-renderer Requirement 13.5 states.
5. WHILE the current node is unchanged after a Rejection, THE view of that node SHALL keep the Selection or option the player had chosen before the rejected submit (Open question 9).
6. WHEN a Rejection occurs, THE view of the current node SHALL accept a new submit.
7. THE Activity_Player Component_Tests SHALL check `document.activeElement` after one and after two Rejections, and SHALL check that the second Rejection_Message is a different element from the first.
8. THE axe Component_Test SHALL include the Activity_Player in the state after a Rejection.
9. WHEN the rejection handling changes, THE existing `@dreame/ui` tests SHALL pass, and THE design SHALL list each existing test it changes with the reason.

### Requirement 13: Shop Challenge app shell and routes

**User Story:** As a judge or a seller, I want to open the app, read what it is for, and play the demo challenge on a phone, so that I can try the bundle builder with no sign-up.

Source: Brief §2, §6, §7, A8, B11, D2, D3; Architecture Spec §A1, §A4, §A5, §A7, §B1, §B2, §B3; Submission Checklist §1; `product.md`.

#### Acceptance Criteria

1. THE Shop_App SHALL be a Vite and React 19 single-page app whose production build is static files only.
2. WHEN `pnpm --filter @dreame/shop-challenge build` runs in a clean clone after `pnpm install --frozen-lockfile`, THE Shop_App build SHALL run the `core` codegen and the Shop_Codegen before the Vite build and SHALL exit with code 0.
3. THE Shop_App SHALL serve the routes `/` (landing), `/play/demo/:id` (bundled Demo_Manifest playback) and a not-found view for every other path (Architecture Spec §B1).
4. WHEN the player opens `/play/demo/:id` with the `activityId` of a bundled Demo_Manifest, THE Shop_App SHALL validate that manifest in the browser with the Shop_Validator_Module and the graph validator, and SHALL play it in the Activity_Player with the Shop_Views and a new uint32 seed from `crypto.getRandomValues`.
5. IF a bundled Demo_Manifest fails validation in the browser, THEN THE Shop_App SHALL display the Invalid_Activity_View with the action label "Back to home".
6. IF the player opens `/play/demo/:id` with an ID that matches no bundled Demo_Manifest, THEN THE Shop_App SHALL display the not-found view with a link to `/`.
7. IF a Demo_Manifest has a `validUntil` date earlier than the device date, THEN THE Shop_App SHALL display an offer-ended view in place of the player, with a note that the end date is checked on this device only (Brief B11, Architecture Spec §B3 `OfferEndedView`).
8. THE landing view SHALL display the app name, one sentence that names small online sellers as the audience, a link to each bundled Demo_Manifest, and the text "No sign-up · No tracking · Open source" (Architecture Spec §B2 `TrustStrip`).
9. THE Shop_App SHALL display on every view a footer that names the MIT License, links to the `LICENSE` file and the repository on GitHub with https URLs, and states "Built with Kiro" (Brief §7, D3; Architecture Spec §B2 `Footer`).
10. THE Shop_App text SHALL use only the Brief §0 and §0a wording quoted in `.kiro/steering/product.md` for any claim about the toolkit, and SHALL contain no Banned_Phrase_List phrase.
11. THE Shop_App `index.html` SHALL set a page title and the `og:title` and `og:description` meta tags for the app (Architecture Spec §A5).
12. THE Shop_App SHALL load the `@dreame/ui` theme stylesheets, so that the views use the shared Theme_Tokens of ui-renderer Requirement 6.
13. THE axe Component_Test SHALL cover the landing view, the not-found view, the offer-ended view, the Collection_Select_View and the Recommend_Outcome_View.

### Requirement 14: Privacy and safe rendering in the app

**User Story:** As a player, I want the app to collect nothing about me and to render shared content safely, so that I can play a seller's challenge without being tracked or exposed to script links.

Source: Brief C1, C2, C3; Architecture Spec §A3, §A5; `security.md`; ui-renderer Requirements 7.5, 7.6, 14.2.

#### Acceptance Criteria

1. THE Shop_App SHALL render no input that collects a name, email address, phone number or other personal data, and SHALL have no user accounts.
2. THE Shop_App source SHALL contain no call to `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` or `WebSocket`, and no use of `localStorage`, `sessionStorage` or `indexedDB`, checked by a Privacy_Scan over `apps/shop-challenge/src`.
3. THE Source_Scan SHALL scan `.ts`, `.tsx`, `.js` and `.jsx` files under `apps/` as well as `packages/` and `tools/`, so that the `eval`, `new Function`, `innerHTML` and `dangerouslySetInnerHTML` checks cover the Shop_App.
4. THE Shop_App SHALL render every anchor to another origin with an https `href`, `target="_blank"` and `rel="noopener noreferrer"`, and SHALL render every Contact_Link and every `outcome` node `cta` through the External_Link_Button.
5. THE Shop_App components SHALL use class names only and no inline `style` attribute, so that the CSP_Value `style-src 'self'` needs no exception.
6. WHEN `pnpm --filter @dreame/shop-challenge build` completes, THE built `apps/shop-challenge/dist/index.html` SHALL contain no inline `script` element and no inline `style` element.
7. THE Repo_Text_Scan SHALL scan `.kiro/specs/shop-challenge/*.md`, the files under `apps/shop-challenge/src`, `apps/shop-challenge/index.html` and `apps/shop-challenge/README.md` for Banned_Phrase_List phrases.
8. THE Shop_App SHALL store no data on the device in this spec, and THE `packages/storage` work SHALL stay in the Practice Path spec (Brief §8 Day 8) (Open question 2).

### Requirement 15: Static hosting configuration

**User Story:** As the builder, I want the app's security headers and routing in its own `vercel.json`, so that the deployed app enforces the CSP and every route works on refresh.

Source: Architecture Spec §A3 ("`vercel.json` headers", "SPA rewrite"), §A6; Brief D1; `tech.md` "Hosting and backend".

#### Acceptance Criteria

1. THE Vercel_Config SHALL set, for every path, the header `Content-Security-Policy` to the CSP_Value, `Referrer-Policy` to `no-referrer`, `X-Content-Type-Options` to `nosniff`, and `Permissions-Policy` to `camera=(), microphone=(), geolocation=()`.
2. THE Vercel_Config SHALL rewrite every path that is not a built file to `/index.html`, so that `/play/demo/:id` loads on refresh.
3. THE Vercel_Config SHALL set the install command, build command and output directory that the design gives for a Vercel project whose Root Directory is `apps/shop-challenge`.
4. THE Workspace SHALL have a test that parses the Vercel_Config and fails when a header name or value of criterion 1 differs or the rewrite of criterion 2 is missing.
5. THE Vercel_Config and the Shop_App SHALL need no environment variable, API key, token or other secret.
6. THE `.gitignore` SHALL list `.vercel`, so that local Vercel project link files are never committed.

### Requirement 16: Deploy URL #1

**User Story:** As the builder, I want the Shop Challenge app live at a public URL, so that judges can test it with no login.

Source: Brief §8 Day 7, D1, D2, D4; Architecture Spec §A3; Submission Checklist §1, §2, §4.

#### Acceptance Criteria

1. WHEN the Vercel_Config and the build pass their tests, THE Implementing_Agent SHALL give the user the steps to create a Vercel project from the GitHub repository with Root Directory `apps/shop-challenge`, and SHALL state that the user performs these steps with the user's own Vercel account.
2. THE Implementing_Agent SHALL write no Vercel token, project ID, organisation ID or other account data to any file in the Workspace.
3. WHEN the user reports the Deploy_URL, THE Implementing_Agent SHALL request `/` and `/play/demo/<id>` of each Demo_Manifest at the Deploy_URL with `Invoke-WebRequest`, and SHALL report each status code and whether the four headers of Requirement 15.1 have the expected values.
4. IF a request under criterion 3 returns a status other than 200 or a header value differs, THEN THE Implementing_Agent SHALL report the difference to the user and SHALL change no Vercel setting itself.
5. WHEN the checks of criterion 3 pass, THE Implementing_Agent SHALL record the Deploy_URL in `apps/shop-challenge/README.md`, with the note "No login needed".
6. WHEN the Deploy_URL is recorded, THE Implementing_Agent SHALL ask the user to open the Deploy_URL on an Android phone, play each Demo_Manifest to its result and open the confirm step of each Contact_Link, and SHALL record the user's reported result in its task report.

### Requirement 17: Demo activities and fixtures

**User Story:** As a judge, I want a ready demo challenge with synthetic products and public-safe Contact_Links, so that the Brief §6 demo can show a bundle reaching a WhatsApp link and a Telegram link.

Source: Brief §6, C3, C4; Submission Checklist §2, §4; `activity-authoring.md`; Architecture Spec §A4 ("Bundled demos").

#### Acceptance Criteria

1. WHEN the Implementing_Agent starts the Demo_Manifest task, THE Implementing_Agent SHALL ask the user for the demo product list (5–8 products with names, prices in US dollars, tags and emoji) and for the URLs of one WhatsApp Contact_Link and one Telegram Contact_Link, which the user supplies or approves and agrees to publish (Submission Checklist §4).
2. IF the user supplies no product list, THEN THE Implementing_Agent SHALL write synthetic products with no real brand names and SHALL show the list to the user before saving it.
3. THE Implementing_Agent SHALL write no Contact_Link URL that the user has not supplied or approved, and no personal WhatsApp number or personal Telegram account, in any file under `activities/`.
4. THE Workspace SHALL contain one Demo_Manifest (Open question 14), with `profile` `shop-challenge`, a `requires` entry for every node type it uses, an occasion `choice` node, a Collection_Select node and a Recommend_Outcome node with a WhatsApp Contact_Link and a Telegram Contact_Link whose URLs the user supplies or approves.
5. THE Demo_Manifests SHALL have an acyclic node graph, a `fallbackOutcomeId` that names an existing terminal node, an unconditional last edge on every node with edges, and no `validUntil` or a `validUntil` of `2027-12-31` or later.
6. THE Demo_Manifests SHALL contain only synthetic data, with no real people's names or details and no product brand logos.
7. THE Validate_CLI SHALL know the profiles `core` and `shop-challenge`, so that `pnpm validate activities/*.json` prints one PASS line per manifest and exits with code 0.
8. THE Workspace SHALL contain a Shop_Fixture whose budget no Selection can meet, and WHEN `pnpm validate` runs on that file, THE Validate_CLI SHALL report one `select-unsatisfiable` diagnostic and exit with code 1.
9. THE Workspace SHALL have a test that plays each Demo_Manifest with one scripted response sequence to a Recommend_Outcome node and checks the stored Selection and total.

### Requirement 18: CI enforcement of boundary and DOM rules

**User Story:** As a toolkit maintainer, I want the import boundaries and the ban on raw HTML enforced by tools in the Check_Pipeline, so that steering rules are blocked in CI and not only advised.

Source: Playbook §3a ("Every steering rule that matters is also enforced in CI"); Architecture Spec §A3 (dependency-cruiser; ESLint flat, jsx-a11y, `react/no-danger`), Part D; ui-renderer "User answers (2026-11-20)"; `tech.md`; `structure.md` "Boundaries"; `security.md`.

#### Acceptance Criteria

1. THE Implementing_Agent SHALL add for the Boundary_Rules and the Lint_Check only the packages the user approved on 2026-11-20: `dependency-cruiser`, `eslint`, `eslint-plugin-react`, `typescript-eslint` and `eslint-plugin-jsx-a11y`, at the registry versions the design lists, and SHALL add no `prettier` (Open question 15).
2. THE Implementing_Agent SHALL keep the existing boundary test and the Source_Scan, so that they still check the rules of criteria 3–6 next to the Boundary_Rules and the Lint_Check.
3. THE Boundary_Rules SHALL fail when a file under `packages/runtime` imports `react`, `react-dom`, `@dreame/ui` or a path under `apps/`.
4. THE Boundary_Rules SHALL fail when a file under `packages/node-types/src`, `packages/node-types/scripts`, `packages/schema/src`, `apps/shop-challenge/src/node-types` or the file `apps/shop-challenge/src/profile.ts` imports `react`, `react-dom` or `@dreame/ui`.
5. THE Boundary_Rules SHALL fail when a file under `packages/` imports a path under `apps/`, or a file outside `packages/schema/src/codegen/` imports `ajv`.
6. THE Lint_Check SHALL report the rule `react/no-danger` as an error for every `.ts` and `.tsx` file under `apps/`, `packages/` and `tools/`.
7. THE Lint_Check SHALL report the recommended rules of `eslint-plugin-jsx-a11y` as errors for `.tsx` files under `apps/` and `packages/ui/` (Open question 15).
8. THE Check_Pipeline SHALL run the Boundary_Rules and the Lint_Check, and SHALL exit with a non-zero code when either reports an error.
9. THE Workspace SHALL have a test showing that the Lint_Check reports `react/no-danger` for a code sample that uses `dangerouslySetInnerHTML`, and that the Boundary_Rules report a violation for a sample import of `react` from `packages/runtime`, with no violating file committed under `apps/`, `packages/` or `tools/`.
10. THE Implementing_Agent SHALL change `.github/workflows/ci.yml` only by adding one step `pnpm --filter @dreame/shop-challenge build` after the `pnpm check` step, and SHALL keep `node-version: 22` (Open question 16).
11. WHEN the Boundary_Rules and the Lint_Check are in the Check_Pipeline, THE Implementing_Agent SHALL measure the wall time of `pnpm -s check` and record it in its task report.
12. IF the time measured under criterion 11 exceeds 240 s (80% of the Post_Task_Hook timeout of 300 s; the Post_Task_Hook timeout was raised to 600 s by the user on 2026-11-21 (D53)), THEN THE Implementing_Agent SHALL report the time to the user and SHALL ask whether to narrow the Check_Pipeline or raise the timeout before changing either.

### Requirement 19: Node type wiring, EXTENDING.md and the wiring hook

**User Story:** As a developer adding a node type to an app, I want the app node types wired the way the Wiring_Hook expects, so that the hook and the docs match a working app example.

Source: Playbook §3b `node-type-wiring.json`; `new-node-type.md`; ui-renderer Requirements 15, 16 and design C13 H3, W5–W8, D20, D21.

#### Acceptance Criteria

1. THE Implementing_Agent SHALL create the App_Wiring_Files before it creates the first Own_File of `collectionSelect` or `recommendOutcome`, so that the Wiring_Hook finds every App_Wiring_File when it triggers.
2. THE App_Wiring_Files SHALL list each of `collectionSelect` and `recommendOutcome` exactly once, in the line forms that the Wiring_Hook prompt gives for an app node type.
3. THE Shop_Views SHALL hold the shared views of `content`, `choice` and `outcome` from `@dreame/ui` and the Collection_Select_View and Recommend_Outcome_View, each exactly once, and a test SHALL check that the Shop_Views type names equal the Shop_Profile node type names in order.
4. THE `EXTENDING.md` file SHALL contain one `### collectionSelect` and one `### recommendOutcome` section in the existing entry form, naming the Own_Files and the profile `shop-challenge`.
5. THE `tools/validate/test/extending-doc.test.ts` test SHALL expect the `core` node type sections followed by the Shop_Profile app node type sections, and SHALL check that every listed path exists.
6. THE Own_Files test files SHALL hold Vitest tests for `validate` and `reduce` and a fast-check property at `numRuns` of at least 100 for each app node type, so that Wiring_Hook prompt steps 5 and 6 create no extra test files.
7. WHEN the agent saves an Own_File after the wiring of criteria 2–6 is complete and the Wiring_Hook replies, THE Implementing_Agent SHALL record the reply in its task report, for use as Kiro_Log evidence.
8. THE Implementing_Agent SHALL leave the four files in `.kiro/hooks/` unchanged, except the Post_Task_Hook timeout, raised to 600 s by the user on 2026-11-21 (D53).

### Requirement 20: Task and verification conventions

**User Story:** As the builder, I want every task small and verifiable on this machine, so that sub-agent runs finish and results are checkable.

Source: ui-renderer Requirement 18; Playbook §4.3; `docs/HANDOFF.md` §1, §4.

#### Acceptance Criteria

1. THE tasks SHALL each list at least one Verify_Command with its expected exit code.
2. THE Verify_Commands SHALL run in PowerShell 5.1, use `;` between commands, check exit codes with `; $LASTEXITCODE`, and contain no `&&` or `||`.
3. THE Verify_Commands SHALL run Vitest only as `pnpm exec vitest run <path>` and SHALL each finish within 180,000 ms, except a full `pnpm check` run.
4. THE tasks SHALL each create or change at most the files that one sub-agent run can finish within the 180,000 ms command limit, splitting any task that combines more than one component with its tests.
5. THE Implementing_Agent SHALL write no file under `.kiro/settings/`, run no `Remove-Item` command, and start no `npm` or `yarn` command, and SHALL ask the user to do a needed deletion or settings change by hand.
6. THE Implementing_Agent SHALL edit no generated file under `packages/*/generated/` or `apps/*/generated/` by hand.
7. THE Implementing_Agent SHALL write files as UTF-8 without BOM and with LF line endings.
8. THE Implementing_Agent SHALL write property tests with fast-check at `numRuns` of at least 100, tagged `Feature: shop-challenge, Property N: <title>` in the `describe` or `it` title.
9. THE Implementing_Agent SHALL use no Banned_Phrase_List phrase in any file of this spec or any file it creates.
10. THE tasks SHALL each end with a step that runs a test: a Vitest test through `vitest run`, or a Verify_Command whose exit code checks the task's result (Playbook §4.3).
11. THE tasks SHALL place each property test in its own task, separate from the task that writes the code the property tests (Playbook §4.3).
12. THE tasks SHALL state that the Post_Task_Hook runs `pnpm -s check` after every task, and THE design SHALL account for that run time in the task plan.

## Open questions for the user

Each question has a recommended option and its reason. On 2026-11-20 the user accepted the recommended option of every question below. The criteria above that depended on an answer now state the accepted option.

1. **Days 6 and 7 in one spec?** Recommended: yes. The app node types, their views and the app shell depend on each other, and the deploy needs all of them. Alternative: split into `shop-challenge` (node types) and `shop-challenge-ui` (app and deploy).

   Answered 2026-11-20: recommended option accepted.
2. **`packages/storage` now or on Day 8?** Recommended: Day 8, with Practice Path. Shop Challenge plays bundled demos with no drafts and no history, so it has nothing to store (Requirement 14.8). Alternative: build the wrapper now and save the current attempt for reloads.

   Answered 2026-11-20: recommended option accepted.
3. **`packages/link`, `/play#a=…` and `/create`?** Recommended: defer to the Day 11 editor work. Brief §8 schedules no link work on Days 6–7; Architecture Spec §A3 asks for a link-size measurement on Day 7, which needs the link package. Alternative: add `packages/link` and the `/play#a=…` route in this spec, with the 8 KB and 64 KB caps checked before `JSON.parse` (`security.md`).

   Answered 2026-11-20: recommended option accepted.
4. **Where do products live?** Recommended: inside the Collection_Select config, with Recommend_Outcome reading them through the `from` node's stored state (Requirements 5, 6.5, 8). This adds app node types without changing the shared manifest contract, which keeps the template's extension story intact. Alternative: a manifest-level `collections` array as Brief §3 lists. That changes `packages/schema` contracts and the runtime `Env`, because node types cannot read the manifest at run time.

   Answered 2026-11-20: recommended option accepted.
5. **New diagnostic codes?** Recommended: add `duplicate-item-id` and `select-unsatisfiable` to the shared `DiagnosticCode` union, both with severity `error` (Requirements 5.5, 5.11). They name errors no existing code covers. Alternative: reuse `duplicate-option-id` and `schema` with descriptive messages, which leaves `packages/schema` unchanged.

   Answered 2026-11-20: recommended option accepted.
6. **Over budget and over the item limit: disable cards or show hints?** Architecture Spec §B3 says a card is "disabled when over budget", but the same section shows a red budget meter and the hint "₦2,000 over budget" (user override 2026-11-20: USD), which cannot happen if cards are disabled. Recommended: keep every card enabled, show the budget status and hint in text, and check the rules when the player continues (Requirements 10.5–10.8). Disabled controls do not tell a screen-reader user why. Alternative: disable cards that would exceed the budget or the item limit.

   Answered 2026-11-20: recommended option accepted.
7. **How does the occasion work?** Recommended: an earlier `choice` node asks for the occasion; Collection_Select names it in `occasionFrom`; an Item with an `occasions` list is offered only for those occasions, and an Item without one is offered for every occasion; Items not offered are not shown (Requirements 5.7–5.11, 10.1). Because `isValidResponse` sees no attempt state, the runtime itself does not reject a non-offered Item; the view enforces it and Requirement 10.12 tests it. Alternative A: show every Item and mark the ones that do not fit the occasion. Alternative B: extend the runtime `isValidResponse` contract with the attempt state, a change to `packages/runtime` and every node type.

   Answered 2026-11-20: recommended option accepted.
8. **What is the "recommended bundle"?** Recommended: the player's own bundle with its total, plus up to `limit` suggested extra Items chosen by the `recommend` block (Requirement 8). Alternative: the outcome computes a separate bundle from the rules and ignores the player's picks.

   Answered 2026-11-20: recommended option accepted.
9. **Does a Rejection keep the player's selection?** Recommended: yes (Requirement 12.5). Losing every pick after a rejected Collection_Select submit would force the player to start the step again. The view-remount behaviour of ui-renderer C10 changes for this. Alternative: keep the current remount, which clears the selection.

   Answered 2026-11-20: recommended option accepted.
10. **Currency and number format?** Recommended: integer prices in whole units of a 3-letter currency code, demos in `NGN`, shown with `Intl.NumberFormat` and the locale `en-NG` with no decimals (for example "₦12,500"). Architecture Spec §B3 names ₦ as the default. Alternative: prices in minor units (kobo) with two decimals.

   Answered 2026-11-20: recommended option accepted.
   Changed by the user on 2026-11-20: demos in `USD`, locale `en-US` (for example "$12"); the `currency` field stays any 3-letter code.
11. **Limits?** Recommended: 1–24 Items per Collection_Select, at most 8 tags per Item, prices 0–100,000,000, budget 1–1,000,000,000, `min` and `max` 1–24, Suggestions `limit` 1–8, at most 4 `where` clauses (Requirements 5.4, 7.3). These keep the satisfiability check and the property tests small. The Submission Checklist expects 5–8 demo products.

   Answered 2026-11-20: recommended option accepted.
12. **Product images?** Recommended: emoji only in this spec. Architecture Spec §A5 says third-party images leak the player's IP and need a host note. Alternative: optional https image URLs with the note "Images load from the seller's host".

   Answered 2026-11-20: recommended option accepted.
13. **WhatsApp message text?** Recommended: use each Contact_Link URL exactly as the author wrote it. Brief §2 asks for an https CTA and does not ask for a pre-filled message. Alternative: append the bundle as the `text` parameter of a `wa.me` link at run time, with the result still checked as a Safe_Url.

   Answered 2026-11-20: recommended option accepted.
   Changed by the user on 2026-11-20: Telegram links are also offered, as separate Channel_Modules.
14. **How many demo activities?** Recommended: one Demo_Manifest (a gift bundle with an occasion question) and one Shop_Fixture for the `select-unsatisfiable` check. Brief §6 needs one Shop Challenge run. Alternative: two Demo_Manifests with different occasions and different Contact_Links (website and WhatsApp).

   Answered 2026-11-20: recommended option accepted.
15. **Lint and boundary dependencies?** Named in Architecture Spec §A3: `dependency-cruiser`, `eslint`, `eslint-plugin-jsx-a11y`, `prettier`. Named only through the rule `react/no-danger`: `eslint-plugin-react`. Not named: `typescript-eslint` (needed for ESLint to parse `.ts` and `.tsx`). Recommended: approve `dependency-cruiser`, `eslint`, `eslint-plugin-react`, `typescript-eslint` and `eslint-plugin-jsx-a11y` now; leave `prettier` out, because formatting the whole repository would touch every file. Alternative: dependency-cruiser only, with the Source_Scan as the `dangerouslySetInnerHTML` check.

   Answered 2026-11-20: recommended option accepted.
16. **May this spec edit `.github/workflows/ci.yml`?** Recommended: no for lint and boundaries, which run inside `pnpm check` (Requirement 18.8); yes for one added step `pnpm --filter @dreame/shop-challenge build`, so CI builds the app without adding Vite build time to the Post_Task_Hook. Alternative: keep `ci.yml` frozen and rely on the Vercel build to catch build errors.

   Answered 2026-11-20: recommended option accepted.
17. **Styling and routing libraries?** All are named in Architecture Spec §A7. Recommended: add React Router (library mode) for the routes now; defer Tailwind CSS, shadcn/ui, Radix, Lucide and `canvas-confetti` to the Day 11–12 polish, because the `@dreame/ui` tokens and CSS already style the views. Alternative: add Tailwind CSS v4 and shadcn/ui now.

   Answered 2026-11-20: recommended option accepted.
18. **Landing page size?** Recommended: the minimal landing of Requirement 13.8 now; the full `Hero`, `HowItWorks`, `LiveDemo`, `UseCases` and `FAQ` sections later, as Playbook §4 suggests vibe-coding landing pages. Alternative: build the full Architecture Spec §B2 marketing set in this spec.

   Answered 2026-11-20: recommended option accepted.
19. **What does "MIT license visible in About" mean?** Brief D3 and Submission Checklist §1 refer to the About panel of the GitHub repository. Recommended: the app footer names the license (Requirement 13.9), and the user confirms the GitHub About panel by hand. Alternative: a separate in-app About route.

   Answered 2026-11-20: recommended option accepted.
20. **`PRIVACY.md` before the URL goes public?** Recommended: write a short `PRIVACY.md` in this spec, because Deploy_URL #1 is public and Brief C3 asks the file to state that no personal data is collected. Alternative: leave it for Day 15 with the other docs.

   Answered 2026-11-20: recommended option accepted.
21. **Byte budgets?** Recommended: the design sets the Shop_Validator_Module limits after the first measurement (Requirement 4.5), and the app's production JavaScript stays within the 150 KB budget of Architecture Spec §A7, measured gzip. Alternative: fix limits now, for example 240,000 raw and 16,000 gzip bytes for the Shop_Validator_Module.

   Answered 2026-11-20: recommended option accepted.
22. **May `tools/validate` depend on `@dreame/shop-challenge`?** Recommended: yes. The Validate_CLI needs the Shop_Profile to check `activities/shop-*.json` (Requirement 17.7), and `structure.md` places the app node types in `apps/shop-challenge`. `packages/` still never imports `apps/` (Requirement 18.5). Alternative: move the Shop_Profile into a package, which conflicts with `structure.md` "Node type placement".

   Answered 2026-11-20: recommended option accepted.
