# Requirements Document

## Introduction

This spec covers Days 8 and 9 of the DREAME 16-day plan as one "Practice Path spec" (Brief §8: Day 8 "Practice Path spec; `recall`, `reviewQueue`; localStorage by item ID"; Day 9 "Practice Path UI; deploy URL #2"). DREAME is the toolkit described in `docs/Skeleton_Crew_Audit_and_Brief_v2.md` (the Brief) and `docs/Architecture_and_UI_Spec.md` (the Architecture Spec). The specs `.kiro/specs/runtime-core/`, `.kiro/specs/ui-renderer/` and `.kiro/specs/shop-challenge/` are complete and pushed (HEAD `02117a2` on `main`, equal to `origin/main`). Their decisions D1–D54, the Playbook reconciliation P1–P12 and the user answers of 2026-11-20 and 2026-11-21 stay in force unless a requirement below names a change.

Practice Path is the second of the two apps (Brief §2). Its audience is tutors and lesson creators. Its mechanic is a retrieval loop: the learner answers a question, reads an explanation, and every question missed on the first try joins a review queue that comes back in a review round before the lesson ends. The lesson ends with a mastery summary and the set of questions to review next time. Per-question progress stays on the learner's device only, keyed by a stable item ID (Brief B7), through the new package `packages/storage`.

The toolkit checks activity definitions against documented structural and supported semantic rules before playback (Brief §0). The new checks in this spec catch specified errors, such as an answer key that names no option of its question. They do not establish the factual accuracy of questions or explanations, accessibility, or that every possible interaction behaves as intended. Property-based tests in this spec provide evidence for the properties tested only.

Environment: Windows, PowerShell 5.1 only, Node v22.23.5, pnpm 12.21.0, TypeScript 7.0.2 (6.0.3 in `tools/lint` only, D51), vitest 5.1.1, vite 8.3.8, fast-check 4.10.3, typebox 1.4.7, ajv 8.20.0, react and react-dom 19.3.1, react-router 8.5.2, jsdom 31.0.1, axe-core 4.14.1.

### Scope (matches the resolved questions of 2026-11-21)

1. `KIRO_LOG.md` entries for Days 6 and 7 (the shop-challenge spec) in the Playbook §6 template, and one commit of that file, the leftover shop-challenge status files and this spec, if the user approves at that time (Requirements 1, 2).
2. The workspace package `apps/practice-path` with the app profile `practice-path`, its precompiled validators and the App_Wiring_Files of ui-renderer decision D20 (Requirements 3, 4, 23).
3. The app node types `recall` and `reviewQueue` of Brief §2, plus the terminal app node type `masterySummary` that shows the result (Resolved question 1), with their views, unit tests, fast-check properties and `EXTENDING.md` entries (Requirements 5–10, 15–17, 23).
4. The package `packages/storage` and the device progress model with export, import and clear (Requirements 11–13).
5. One additive change to `ActivityPlayer` in `@dreame/ui`: an attempt-end callback (Requirement 14, Resolved question 13).
6. The Practice Path static app: routes, bundled demo playback, landing page with device progress, footer, `vercel.json` with the Architecture Spec §A3 headers, the manual deploy of URL #2, and an updated `PRIVACY.md` (Requirements 18–21).
7. One demo lesson in `activities/` that passes `pnpm validate`, and one broken fixture (Requirement 22).
8. Boundary rule, scan and CI additions for the new app and package (Requirements 19, 24).
9. Task conventions (Requirement 24).

### Out of scope

- `packages/link`, the `/play#a=…` route for shared links, the `/create` editor route and the authoring components `LessonDetailsForm`, `QuestionEditorRow`, `ShareDialog` and QR codes of Architecture Spec §B2 and §B4 (Day 11).
- `tools/create-app`, the `activity-author` custom agent and the full `EXTENDING.md` guide (Day 10).
- Any change to `packages/runtime`. Retry and review run inside the app node types (Resolved question 1).
- Saving or resuming an unfinished attempt across page loads, the `AttemptRecord` of Brief B7 and the SHA-256 `manifestHash` of Architecture Spec §A3 (Resolved question 7). A reload starts the lesson again.
- Review scheduling with dates or intervals, such as Leitner boxes, and device history that changes which questions the runtime plays (Resolved question 2).
- Free-text answers (Resolved question 3).
- Tailwind CSS, shadcn/ui, Radix, Lucide and `canvas-confetti` (D40 stays in force).
- Playwright, `@axe-core/playwright` and `pnpm audit --prod` in CI. The axe check stays in Vitest (ui-renderer D17).
- `README.md` app GIFs, `SUBMISSION.md`, `KIRO_WRITEUP.md`, `ROADMAP.md` and `ASSETS.md` (Days 12–15).
- The Plain React + Kiro comparison (Day 12). No requirement in this spec claims an advantage over another tool (`.kiro/steering/product.md`).
- Screenshots: the Implementing_Agent cannot take screenshots. The user saves any screenshot to `docs/kiro-evidence/` (Requirements 1.8, 1.9).

### Research facts used by these requirements

Checked in the Workspace on 2026-11-21:

| Topic | Finding | Source |
|---|---|---|
| Retry and review policy | Brief B1 places retry and review in runtime policy: `onIncorrect: { explanationId?, maxRetries: 0–3 }` and a `review` phase that replays wrong nodes once. runtime-core put "review/retry policy (B1)" out of scope. The manifest schema has no `onIncorrect` field and the reducer has no review phase. | Brief B1; runtime-core design scope table; `packages/schema/src/contracts.ts`; `packages/runtime/src/reducer.ts` |
| One response per node | After every accepted response, `reduce` takes the first matching edge, so a node takes exactly one response. The authored graph must be a DAG, so no edge can lead back to a node. | `packages/runtime/src/reducer.ts`; `.kiro/steering/activity-authoring.md` |
| Terminal nodes | Entering a terminal node sets the status `finished`, so a terminal node takes no response. | `packages/runtime/src/reducer.ts` |
| Response check | `isValidResponse(cfg, r)` sees neither the attempt state nor the manifest. `enter` and `reduce` see the attempt state but not the manifest. | `packages/runtime/src/node-type.ts` |
| What a view sees | A view receives `cfg`, `onRespond`, the `nodeState` of the current node and `rejections`. `ActivityPlayer` has no callback that reports the attempt state to the app. | `packages/ui/src/render.ts`; `packages/ui/src/components/ActivityPlayer.tsx` |
| Result screen | Brief §2 names the outcome "Mastery summary + next review set" but lists only `recall` and `reviewQueue` as Practice Path node types. Shop Challenge shows its result through the terminal app node type `recommendOutcome`, which reads the state of its `from` node in `enter`. | Brief §2; `apps/shop-challenge/src/node-types/recommendOutcome.ts` |
| Diagnostic codes | `DiagnosticCode` already contains `duplicate-item-id`, `duplicate-option-id`, `dangling-ref`, `type-mismatch`, `answer-not-upstream`, `blank-text` and `unsafe-url`. | `packages/schema/src/diagnostics.ts` |
| Storage today | No source file under `apps/`, `packages/` or `tools/` names `localStorage` or `sessionStorage`. `packages/storage` and `packages/link` hold only a `README.md`. The shop and `@dreame/ui` privacy scans reject browser storage. | workspace search; `apps/shop-challenge/test/privacy-scan.test.ts`; `packages/ui/test/privacy-scan.test.ts` |
| Storage risks | Brief §9: localStorage can be evicted, so the UI says "saved on this device — export to keep"; answer keys are visible in the client; mistake history is per device. Architecture Spec §A3: the wrapper does try/catch, JSON versioning and quota-error handling and returns `{ok, error}`. §A5: when storage is blocked or evicted, the UI shows a "Not saved on this device" state. | Brief §9; Architecture Spec §A3, §A5 |
| Result sharing | Architecture Spec §A5 and Part D: the learner taps "Send result to tutor", which opens a `wa.me` text with the score and missed topics; no server, user-initiated. The Submission Checklist §5 draft says "learners can send results to their tutor". | Architecture Spec §A5, Part D, §B4; Submission Checklist §5 |
| Demo content | The user supplies "one lesson of 6–8 questions with explanations on a topic you know well" by Day 8; synthetic data only. | Submission Checklist §4 |
| `PRIVACY.md` | Names Shop Challenge only and says the app stores nothing on the device. | `PRIVACY.md` |
| Boundary rules | The rule `react-free-no-ui` covers `packages/node-types`, `packages/schema/src` and the Shop Challenge node types and profile only. | `tools/lint/src/depcruise-rules.ts` |
| Scripts | Root `codegen` runs the `core` and Shop codegen. `check` runs codegen → `tsc` → depcruise → lint → `vitest run` → validate `activities/*.json`. | `package.json` |
| CI file | `ci.yml` runs `pnpm check` and then `pnpm --filter @dreame/shop-challenge build`. | `.github/workflows/ci.yml` |
| Validate CLI | `tools/validate/src/run.ts` knows the profiles `core` and `shop-challenge`. | that file |
| Repo text scan | `tools/validate/test/repo-text.test.ts` lists the ui-renderer and shop-challenge spec folders and the Shop app files. | that file |
| Check duration | The last `pnpm check` ran 820 tests in about 140–240 s; the Post_Task_Hook timeout is 600 s (D53). | user brief of 2026-11-21; `.kiro/hooks/post-task-check.json` |
| Git state | `main` equals `origin/main` at `02117a2`; only `.kiro/specs/shop-challenge/tasks.md` and `tasks.meta.json` are modified. | `git status`, `git log` |

## Glossary

- **Implementing_Agent**: The Kiro agent that carries out the tasks of this spec.
- **Workspace**: The repository at `c:\Users\ADMIN\my-kiro-win`.
- **Brief**: `docs/Skeleton_Crew_Audit_and_Brief_v2.md`.
- **Architecture_Spec**: `docs/Architecture_and_UI_Spec.md`.
- **Playbook**: `docs/Kiro_Setup_and_Operating_Playbook.md`, authoritative for how Kiro is set up and used.
- **Kiro_Log**: The file `KIRO_LOG.md` at the Workspace root.
- **Entry_Template**: The Playbook §6 entry form: a heading line `## YYYY-MM-DD — <title>`, then the five Entry_Fields, each on its own line.
- **Entry_Fields**: The five labelled lines of the Entry_Template, in order: `Spec:`, `Kiro did:`, `Caught by:`, `Fix:`, `Kiro features:`.
- **Day_6_7_Entries**: The one or more Kiro_Log entries this spec adds for the shop-challenge work.
- **Spec_Done_Entry**: The Day_6_7_Entries entry that records the completed shop-challenge spec.
- **Evidence_Folder**: The folder `docs/kiro-evidence/`.
- **Fact_Sources**: `docs/HANDOFF.md`, `.kiro/specs/shop-challenge/design.md` (sections "Decisions for the user" and "Testing Strategy"), `.kiro/specs/shop-challenge/tasks.md`, `git log` output, and commands the Implementing_Agent runs with their observed output.
- **Banned_Phrase_List**: The phrases in the last rule of "Claim rules" in `.kiro/steering/product.md`, matched as case-insensitive substrings. This spec does not repeat them.
- **Leftover_Status_Files**: `.kiro/specs/shop-challenge/tasks.md` and `.kiro/specs/shop-challenge/tasks.meta.json`, which differ from HEAD only by task status changes.
- **Commit_Identity**: `-c user.name="chukwuebuka henry" -c user.email="121734925+ChukwuebukaHenrey@users.noreply.github.com"` passed to `git`.
- **Check_Pipeline**: The root script `pnpm check`, also the pre-commit hook and the CI step.
- **Shared_Test_Script**: The root script `pnpm test:shared` (`pnpm codegen && vitest run`).
- **Post_Task_Hook**: The hook file `.kiro/hooks/post-task-check.json`, which runs `pnpm -s check` when a spec task finishes, with a 600 s timeout.
- **Wiring_Hook**: The hook file `.kiro/hooks/node-type-wiring.json`.
- **Activity_Hook**: The hook in `.kiro/hooks/validate-activities.json`, which validates agent-written `activities/**/*.json` files.
- **Regression_Hook**: The hook in `.kiro/hooks/runtime-regression.json`, which runs the Shared_Test_Script when the agent saves a `.ts` file in `packages/runtime`, `packages/schema` or `packages/node-types`.
- **Practice_App**: The workspace package in `apps/practice-path`, named `@dreame/practice-path`.
- **Practice_Profile**: The runtime `Profile` with ID `practice-path`, defined in `apps/practice-path/src/profile.ts`.
- **Practice_Codegen**: The build-time script of the Practice_App that writes the Practice_Validator_Module with `buildProfileModule` from `@dreame/schema/codegen`.
- **Practice_Validator_Module**: The generated JavaScript module that holds the precompiled manifest and response validators of the Practice_Profile.
- **App_Wiring_Files**: `apps/practice-path/src/node-types/index.ts`, `apps/practice-path/src/profile.ts` and `apps/practice-path/src/views/registry.ts` (ui-renderer D20, Wiring_Files W5–W7).
- **Own_Files**: For one app node type, its node type file `apps/practice-path/src/node-types/<type>.ts`, its view file `apps/practice-path/src/views/<Type>NodeView.tsx`, and its test files `apps/practice-path/test/<type>.test.ts` and `apps/practice-path/test/<type>.property.test.ts`.
- **Recall**: The app node type `recall`: one multiple-choice question about one Item, with an answer key, an explanation and a Retry_Limit.
- **Review_Queue**: The app node type `reviewQueue`: the review round that replays, once each, the Items missed on the First_Try at the Recall nodes it names in `from`.
- **Mastery_Summary**: The app node type `masterySummary`: the terminal result step that shows the Mastery_Result of the Review_Queue node it names in `from` (Resolved question 1).
- **Item**: The question of one Recall node, identified by its Item_ID.
- **Item_ID**: The `itemId` string of a Recall config. It stays the same across manifest versions, so device progress survives edits (Brief B7).
- **Topic**: The optional short `topic` label of a Recall config, used to list missed topics.
- **Try**: One option the learner submits for an Item at a Recall node.
- **First_Try**: The first Try at a Recall node.
- **First_Try_Result**: `correct` when the First_Try names the correct option, otherwise `incorrect`.
- **Retry_Limit**: The Recall config field `maxRetries`, an integer 0–3: the number of Tries allowed after the First_Try (Brief B1).
- **Try_Rules**: The rules a Recall response must meet: every Try names an option of the config; no option repeats; the number of Tries is at most `maxRetries + 1`; every Try before the last names a wrong option; and the last Try names the correct option or the number of Tries equals `maxRetries + 1`.
- **Item_Snapshot**: The plain-JSON copy of one answered Item that a Recall node stores in its `nodeState`: the Item_ID, Topic, prompt, options with IDs and labels, the correct option ID, the explanation, the Tries and the First_Try_Result.
- **Queue**: The ordered list of Item_Snapshots that a Review_Queue node replays: the Items of its `from` nodes whose First_Try_Result is `incorrect`, in `from` order.
- **Review_Round**: The part of the lesson in which the Review_Queue_View shows each Queue Item once and the learner gives one Try per Item.
- **Review_Result**: For one Queue Item, `correct` when the Review_Round answer names the correct option, otherwise `incorrect`.
- **Item_Result**: For one answered Item: `firstTry` when its First_Try_Result is `correct`; `reviewed` when its First_Try_Result is `incorrect` and its Review_Result is `correct`; `missed` otherwise.
- **Mastery_Result**: The plain-JSON result that Mastery_Summary `enter` stores: one entry per answered Item with its Item_ID, Topic, prompt and Item_Result, the counts of each Item_Result, the Missed_Topics and the Next_Review_Set.
- **Missed_Topics**: The distinct Topics of the Items whose Item_Result is `missed`, in Item order.
- **Next_Review_Set**: The Items whose Item_Result is `reviewed` or `missed`, in Item order.
- **Tutor_Share_Link**: The `https://wa.me/...` URL with a `text` parameter that the Mastery_Summary_View offers as "Send result to tutor" (Architecture Spec §A5, Part D).
- **Share_Text**: The text of the Tutor_Share_Link `text` parameter: the lesson title, the First_Try count, the after-review count, the Item count and the Missed_Topics.
- **Recall_View**: The Render_Module of Recall, at `apps/practice-path/src/views/RecallNodeView.tsx`.
- **Review_Queue_View**: The Render_Module of Review_Queue, at `apps/practice-path/src/views/ReviewQueueNodeView.tsx`.
- **Mastery_Summary_View**: The Render_Module of Mastery_Summary, at `apps/practice-path/src/views/MasterySummaryNodeView.tsx`.
- **Render_Module**: A React component that receives the props `cfg`, `onRespond`, `nodeState` and `rejections` (ui-renderer C6, shop-challenge D48).
- **Practice_Views**: The Render_Registry exported by `apps/practice-path/src/views/registry.ts`, holding the views of all Practice_Profile node types.
- **Activity_Player**: The `ActivityPlayer` component of `@dreame/ui` (ui-renderer C10).
- **Attempt_End**: The moment an attempt's status changes from `playing` to `finished` or `limit_reached`, including an attempt whose entry node is terminal.
- **External_Link_Button**: The `ExternalLinkButton` component of `@dreame/ui` (ui-renderer C8).
- **Invalid_Activity_View**: The `InvalidActivityView` component of `@dreame/ui` (ui-renderer C11).
- **Safe_Url**: A URL for which `checkHttpsUrl` from `@dreame/schema` returns no diagnostics.
- **Storage_Package**: The workspace package in `packages/storage`, named `@dreame/storage`.
- **Storage_Wrapper**: The functions of the Storage_Package that read, write and remove one JSON value under one key of a Storage_Backend.
- **Storage_Backend**: An object with `getItem`, `setItem` and `removeItem` methods, such as the browser `localStorage` or an in-memory test double.
- **Store_Result**: The return value of every Storage_Wrapper call: `{ ok: true, value }` or `{ ok: false, error }`, where `error` is one Storage_Error.
- **Storage_Error**: One of `unavailable` (no Storage_Backend, or access throws), `quota` (the backend reports a full store), `too-large` (the value exceeds the Value_Cap), `corrupt` (the stored text is not a valid Envelope or the data check fails) and `version` (the Envelope version differs).
- **Envelope**: The stored JSON form `{ "v": <version>, "data": <value> }` of one Storage_Wrapper value.
- **Value_Cap**: 65,536 UTF-16 code units for the serialized Envelope text (runtime-core D6 counting).
- **Progress_Model**: The pure, React-free module `apps/practice-path/src/progress.ts` that computes and merges device progress.
- **Progress_Store**: The device progress value that the Practice_App keeps under the Progress_Key_Name through the Storage_Wrapper.
- **Progress_Key_Name**: The storage key `dreame.practice-path.progress` (Resolved question 6).
- **Progress_Key**: The key of one Item_Record inside the Progress_Store: `<activityId>:<itemId>`.
- **Item_Record**: The device record of one Item: `seen` (number of attempts with a First_Try), `firstTryMisses` (number of attempts whose First_Try_Result was `incorrect`), `last` (the latest Item_Result) and `lastSeenAt` (epoch milliseconds of the latest Attempt_End).
- **Record_Cap**: 1,000 Item_Records in one Progress_Store (Resolved question 6).
- **Due_For_Review**: An Item whose Item_Record `last` is `reviewed` or `missed`.
- **Progress_File**: The exported JSON file `practice-path-progress.json`, with the fields `format` (`"dreame-practice-progress"`), `version` (`1`) and `items` (the Item_Records by Progress_Key).
- **Save_Status**: The text near the player that tells the learner whether the Progress_Store was saved on the device.
- **Demo_Lesson**: A manifest file `activities/practice-*.json` with `profile` `practice-path`, bundled into the Practice_App.
- **Practice_Fixture**: A deliberately broken manifest file under `activities/fixtures/` with `profile` `practice-path`.
- **Validate_CLI**: The command `pnpm validate <file-or-pattern>...` in `tools/validate`.
- **Vercel_Config**: The file `apps/practice-path/vercel.json`.
- **CSP_Value**: The exact string `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` (Architecture Spec §A3).
- **Shop_Deploy_URL**: `https://my-kiro-win-shop-challenge.vercel.app/`, the live URL of Shop Challenge (deploy URL #1).
- **Deploy_URL_2**: The public Vercel URL of the Practice_App (Brief §8 Day 9 "deploy URL #2").
- **Boundary_Rules**: The dependency-cruiser rules in `tools/lint/src/depcruise-rules.ts`.
- **Lint_Check**: The ESLint run of `pnpm lint` (`tools/lint`).
- **Named_Dependency**: A package that the Architecture_Spec or `docs/Submission_Checklist_and_Compliance.md` names, or that an earlier spec records as approved by the user.
- **Unnamed_Dependency**: Any other package.
- **Component_Test**: A Vitest test that renders components in the `jsdom` environment.
- **Source_Scan**: The test `packages/schema/test/source-scan.test.ts`.
- **Privacy_Scan**: A test that scans source files for network calls, browser storage use and personal-data form fields, such as `packages/ui/test/privacy-scan.test.ts` and the app-level scans.
- **Repo_Text_Scan**: The test `tools/validate/test/repo-text.test.ts`.
- **Verify_Command**: A command listed under `Verify:` in a task, written for PowerShell 5.1.

## Requirements

### Requirement 1: KIRO_LOG entries for Days 6 and 7

**User Story:** As the builder, I want factual Kiro_Log entries for the shop-challenge work in the Playbook §6 template, so that the Kiro write-up and judges can trace how Kiro was used on Days 6 and 7.

Source: Playbook §6; shop-challenge Requirement 1.

#### Acceptance Criteria

1. THE Implementing_Agent SHALL complete Requirements 1 and 2 as the first task of this spec, before any other task.
2. THE Implementing_Agent SHALL append the Day_6_7_Entries after the last existing Kiro_Log entry and SHALL leave every existing line of the Kiro_Log byte-for-byte unchanged.
3. THE Day_6_7_Entries SHALL each follow the Entry_Template: one heading line `## YYYY-MM-DD — <title>`, then the five Entry_Fields in order, each on its own line with its label followed by one space and the field text.
4. THE Day_6_7_Entries SHALL contain only statements that trace to a Fact_Source, including the date in each heading.
5. THE Day_6_7_Entries SHALL include a Spec_Done_Entry whose `Spec:` field names `shop-challenge`, whose `Kiro did:` field states the number of shop-challenge tasks marked done in `.kiro/specs/shop-challenge/tasks.md` and the Shop_Deploy_URL, and which refers to the decisions of that spec by the path `.kiro/specs/shop-challenge/design.md`.
6. THE Spec_Done_Entry SHALL record in its `Caught by:` field each final shop-challenge check that a Fact_Source records, with its command and exit code.
7. THE Day_6_7_Entries SHALL include one entry for each of these events that a Fact_Source records: the Post_Task_Hook timeout raised from 300 s to 600 s (D53); the second TypeScript copy 6.0.3 for the lint tools (D51); the Wiring_Hook replies on the Shop Challenge node type and view files, including the "already wired" reply on the second trigger; the first Vercel build that failed before the app existed and the later live Shop_Deploy_URL; and the checkpoint task that was missing from the task dependency graph.
8. WHEN the Implementing_Agent starts the Day_6_7_Entries, THE Implementing_Agent SHALL tell the user that the Implementing_Agent cannot take screenshots and SHALL ask the user for the file names of any Day 6 or Day 7 screenshots saved in the Evidence_Folder.
9. THE Day_6_7_Entries SHALL reference a screenshot only by the Workspace-relative path of a file that exists in the Evidence_Folder.
10. THE Day_6_7_Entries SHALL contain no commit hash, no commit message, no statement about a commit or a push, and no list of created files.
11. THE Kiro_Log SHALL contain zero matches of any Banned_Phrase_List phrase and no API keys, tokens, passwords or other secrets.

### Requirement 2: Commit of the log, the leftover status files and this spec

**User Story:** As the builder, I want the Day 6–7 log, the leftover shop-challenge status files and this spec committed together, so that the repository records Days 6 and 7 completely before Practice Path code lands.

Source: shop-challenge Requirement 2; `docs/HANDOFF.md` §5 git rules.

#### Acceptance Criteria

1. WHEN the Day_6_7_Entries are written, THE Implementing_Agent SHALL show the user `git status --porcelain` and `git diff --stat` and SHALL ask the user whether to commit the Kiro_Log, the Leftover_Status_Files and the files of `.kiro/specs/practice-path/` in one commit.
2. WHEN the user approves the commit, THE Implementing_Agent SHALL stage exactly the approved files by explicit path and SHALL commit them with the Commit_Identity.
3. THE Implementing_Agent SHALL commit without `--no-verify`, without `--amend` and without a co-author trailer, so that the Check_Pipeline runs as the pre-commit hook.
4. IF the user declines the commit, THEN THE Implementing_Agent SHALL leave the files unstaged and SHALL record the decision in its task report.
5. IF the pre-commit Check_Pipeline fails, THEN THE Implementing_Agent SHALL report the failing command, its output and its exit code to the user and SHALL create no commit until the user decides how to proceed.
6. THE Implementing_Agent SHALL stage no file under `packages/*/generated/`, `apps/*/generated/`, `apps/*/dist/` or `design-refs/` and none of the untracked files `.git.ignore`, `docs/HANDOFF.md`, `docs/README.md`, `docs/read as soon as you finish kiro agent.txt` and `docs/ui-illustration-builder.txt`.
7. THE Implementing_Agent SHALL push only when the user asks, and SHALL tell the user how many local commits are ahead of `origin/main` before asking.

### Requirement 3: Practice Path package and profile

**User Story:** As an app developer, I want a Practice Path workspace package with its own profile, so that the app's node types are registered once and the app builds on its own.

Source: Brief §2, D2; Architecture Spec §A3, §A6, §A7; `structure.md`; `tech.md`; ui-renderer D20; shop-challenge D45.

#### Acceptance Criteria

1. THE Practice_App SHALL have a `package.json` named `@dreame/practice-path` with `private: true`, `type: module` and `engines.node` `22.x`, and a `tsconfig.json` that extends `../../tsconfig.base.json` with `compilerOptions.strict` set to `true`.
2. THE Practice_App SHALL keep its node types in `apps/practice-path/src/node-types/`, its views in `apps/practice-path/src/views/`, its profile in `apps/practice-path/src/profile.ts` and its tests in `apps/practice-path/test/` (ui-renderer D20).
3. THE Practice_Profile SHALL have the ID `practice-path` and SHALL list the node types `content`, `choice`, `outcome`, `recall`, `reviewQueue` and `masterySummary`, each exactly once.
4. THE files under `apps/practice-path/src/node-types/`, the file `apps/practice-path/src/profile.ts` and the Progress_Model SHALL import no `react`, `react-dom`, `@dreame/ui` or `.tsx` module, so that Node can load the Practice_Profile in the Validate_CLI and the Practice_Codegen.
5. THE Practice_App SHALL import no module from `apps/shop-challenge`, so that each app builds on its own (Brief D2).
6. THE Workspace root `tsconfig.json` SHALL include the Practice_App and Storage_Package `.ts` and `.tsx` source and test files, and `pnpm typecheck` SHALL exit with code 0.
7. THE root `vitest.config.ts` SHALL include the Practice_App and Storage_Package test files, running `*.test.ts` files in the `node` environment and `*.test.tsx` files in the `jsdom` environment.
8. WHEN the Implementing_Agent needs an Unnamed_Dependency, THE Implementing_Agent SHALL stop and ask the user before adding it to any `package.json`.
9. THE design SHALL list each dependency it proposes with its checked registry version, whether it is a Named_Dependency, and its approval status.
10. THE Workspace SHALL keep `pnpm-lock.yaml` as its only lockfile, and THE Implementing_Agent SHALL commit any `pnpm-lock.yaml` change in the same commit as the matching `package.json` change.
11. THE Practice_App and Storage_Package source SHALL use relative imports with explicit `.ts` or `.tsx` extensions and only erasable TypeScript syntax (runtime-core D4).
12. THE Practice_App SHALL expose a React-free `./profile` package export, so that `tools/validate` can load the Practice_Profile (shop-challenge D45).

### Requirement 4: Precompiled Practice Path validators

**User Story:** As a toolkit maintainer, I want the Practice_Profile validators generated at build time, so that the app runs under a strict CSP with no runtime schema compilation.

Source: Brief B4, B5; Architecture Spec §A2, §A3; `tech.md`; runtime-core D2, D3; shop-challenge Requirement 4.

#### Acceptance Criteria

1. THE Practice_Codegen SHALL produce the Practice_Validator_Module with Ajv standalone code generation at build time, through `buildProfileModule` from `@dreame/schema/codegen`, with the code generation options that ui-renderer decision D14 set as defaults.
2. THE Practice_Validator_Module SHALL hold one manifest validator composed as a `oneOf` over the `configSchema` of every Practice_Profile node type, discriminated on `type`, and one response validator per Practice_Profile node type.
3. THE Practice_Codegen SHALL write the Practice_Validator_Module and its `.d.ts` file to `apps/practice-path/generated/`, which the existing `.gitignore` entry `apps/*/generated/` ignores.
4. WHEN `pnpm codegen` runs, THE root script SHALL run the `core` codegen, the Shop codegen and the Practice_Codegen, and THE Practice_Codegen SHALL print the raw and gzip byte counts of the Practice_Validator_Module.
5. THE Workspace SHALL contain a Vitest test that fails when the Practice_Validator_Module exceeds the byte limits the design sets after measuring the first generated module, and THE design SHALL record the measured sizes next to those limits.
6. THE Practice_Codegen SHALL pass the generated code through `inlineRuntimeHelpers` and `assertSelfContained`, as the `core` and Shop codegen do.
7. THE Source_Scan SHALL find no `ajv` import outside `packages/schema/src/codegen/`, including under `apps/practice-path/` and `packages/storage/`.

### Requirement 5: recall configuration and validation

**User Story:** As a tutor, I want each question and its answer key checked before anyone practises, so that a shared lesson never marks a learner wrong because the answer key points at an option that does not exist.

Source: Brief §2, B1, B7, C1, C2; Architecture Spec §B4 (`QuestionEditorRow`: prompt, 2–5 options, correct mark, explanation required); `new-node-type.md` steps 1–6.

#### Acceptance Criteria

1. THE Recall node type SHALL have `type` `recall`, `version` 1 and `terminal` `false`.
2. THE Recall `configSchema` SHALL be closed, with `additionalProperties: false` on every object schema, and SHALL accept an `itemId`, a `prompt`, an `options` array, a `correctOptionId`, an `explanation`, a `maxRetries` value, and the optional fields `topic` and `shuffle`.
3. THE Recall `configSchema` SHALL accept each option with an `id` and a `label` and no other field.
4. THE Recall `configSchema` SHALL limit `options` to 2–5 entries, `maxRetries` to the integers 0–3, `itemId` and option `id` to the node ID pattern of `@dreame/schema`, and every string to a maximum length the design lists (runtime-core D6 counts UTF-16 code units).
5. IF two options in one Recall config share an `id`, THEN THE Recall `validate` SHALL report a diagnostic with code `duplicate-option-id` at the `id` path of the second option.
6. IF `correctOptionId` names no option of the config, THEN THE Recall `validate` SHALL report a diagnostic with code `dangling-ref` at the `correctOptionId` path.
7. IF the `prompt`, an option `label` or the `explanation` is blank, THEN THE Recall `validate` SHALL report `conditions/blank-text` through `ctx.checkText` at that path.
8. IF two Recall nodes in one manifest share an `itemId`, THEN THE Recall `validate` of the later node in manifest order SHALL report a diagnostic with code `duplicate-item-id` at its `itemId` path.
9. THE Recall `answerType` SHALL return an `enum` value type with the values `correct` and `incorrect`, so that edge conditions can branch on the First_Try_Result with `eq`.

### Requirement 6: recall responses, retries and state

**User Story:** As a learner, I want a wrong first answer to give me another try and then an explanation, and my first answer to be what counts for review, so that I practise recalling the answer rather than guessing until something works.

Source: Brief §2, B1 (`maxRetries: 0–3`), B6, B7; `new-node-type.md` "Purity"; Resolved questions 1 and 4.

#### Acceptance Criteria

1. THE Recall `responseSchema` SHALL be closed and SHALL accept only an object `{ tries }` whose `tries` is an array of 1–4 strings.
2. WHEN a response meets the Try_Rules, THE Recall `isValidResponse` SHALL return `true`.
3. IF a response breaks any Try_Rule, THEN THE Recall `isValidResponse` SHALL return `false`, so that the runtime reports the Rejection `invalid-response`.
4. WHEN the runtime applies an accepted Recall response, THE Recall `reduce` SHALL store the First_Try_Result as the node's answer.
5. WHEN the runtime applies an accepted Recall response, THE Recall `reduce` SHALL store the Item_Snapshot in the node's `nodeState`, with the options in config order.
6. WHERE the Recall config sets `shuffle` to `true`, THE Recall `enter` SHALL store in the node's `nodeState` an option order drawn from `env.rng`, and THE Recall `reduce` SHALL keep that order in the stored `nodeState`.
7. THE Recall `enter` and `reduce` SHALL take time only from `env.now` and randomness only from `env.rng`, and SHALL leave their inputs unchanged.
8. FOR ALL generated Recall configs and candidate responses, THE Recall `isValidResponse` SHALL return `true` exactly when a reference implementation of the Try_Rules returns `true` (model-based property).
9. FOR ALL generated Recall configs and accepted responses, THE stored First_Try_Result SHALL be `correct` exactly when the first Try equals `correctOptionId`, and THE stored Item_Snapshot SHALL hold the response Tries unchanged (invariant property).
10. FOR ALL generated Recall configs, attempt states and valid responses, THE Recall `reduce` SHALL leave its inputs unchanged and return equal results for equal inputs (Wiring_Hook prompt step 6).

### Requirement 7: reviewQueue configuration and validation

**User Story:** As a tutor, I want the review step checked against the questions it reviews, so that the review round always reads real questions from earlier in the lesson.

Source: Brief §2, B1; Architecture Spec §B4 `ReviewInterstitial`; shop-challenge D46 (`isUpstream`).

#### Acceptance Criteria

1. THE Review_Queue node type SHALL have `type` `reviewQueue`, `version` 1 and `terminal` `false`.
2. THE Review_Queue `configSchema` SHALL be closed and SHALL accept a `title`, a `from` array of 1–24 node IDs with no repeated entry, and the optional fields `intro` and `emptyText`.
3. IF a `from` entry names no node in the manifest, THEN THE Review_Queue `validate` SHALL report `dangling-ref` at the path `/config/from/<index>` of that entry.
4. IF a `from` entry names a node whose type is not `recall`, THEN THE Review_Queue `validate` SHALL report `type-mismatch` at the path of that entry.
5. IF a `from` entry names a node that does not lie on every path from `entryNodeId` to the Review_Queue node, THEN THE Review_Queue `validate` SHALL report `answer-not-upstream` at the path of that entry.
6. IF the `title` is blank, THEN THE Review_Queue `validate` SHALL report `conditions/blank-text` at the `title` path.
7. THE Review_Queue `answerType` SHALL return `null`.

### Requirement 8: Review round

**User Story:** As a learner, I want every question I missed on the first try to come back once before the lesson ends, so that I retrieve the answer again after a short gap.

Source: Brief §2 ("wrong items join a review queue"), §6 ("wrong answer → it returns in the review round"), B1 ("replays wrong nodes once"); Resolved question 2.

#### Acceptance Criteria

1. WHEN the runtime enters a Review_Queue node, THE Review_Queue `enter` SHALL store in the node's `nodeState` the Queue: the Item_Snapshot of each `from` node whose First_Try_Result is `incorrect`, in `from` order, each once.
2. WHEN the runtime enters a Review_Queue node, THE Review_Queue `enter` SHALL store in the node's `nodeState`, for each `from` node with a stored Item_Snapshot, its Item_ID, Topic, prompt and First_Try_Result, in `from` order.
3. IF no `from` node has the First_Try_Result `incorrect`, THEN THE Review_Queue `enter` SHALL store an empty Queue.
4. THE Review_Queue `responseSchema` SHALL be closed and SHALL accept only an object `{ answers }` whose `answers` is an array of at most 24 closed objects `{ itemId, optionId }`.
5. WHEN a response matches the `responseSchema` and no `itemId` repeats, THE Review_Queue `isValidResponse` SHALL return `true`.
6. IF a response repeats an `itemId`, THEN THE Review_Queue `isValidResponse` SHALL return `false`.
7. WHEN the runtime applies an accepted Review_Queue response, THE Review_Queue `reduce` SHALL store in the node's `nodeState` the Review_Result of each Queue Item: `correct` when the response has an answer for that Item_ID whose `optionId` equals the Item's correct option ID, otherwise `incorrect`.
8. THE Review_Queue `reduce` SHALL ignore answers whose `itemId` names no Queue Item.
9. THE Review_Queue `enter` and `reduce` SHALL take time only from `env.now` and randomness only from `env.rng`, and SHALL leave their inputs unchanged.
10. FOR ALL generated attempt states holding Recall Item_Snapshots, THE stored Queue SHALL contain exactly the `from` Items whose First_Try_Result is `incorrect`, in `from` order, with no Item twice (invariant property).
11. FOR ALL generated Queues and responses, THE stored Review_Results SHALL equal the results of a reference implementation of criterion 7 (model-based property).
12. FOR ALL generated Review_Queue configs, attempt states and valid responses, THE Review_Queue `reduce` SHALL leave its inputs unchanged and return equal results for equal inputs (Wiring_Hook prompt step 6).

### Requirement 9: masterySummary configuration, validation and result

**User Story:** As a learner, I want a result screen with my first-try score, my score after review, the topics I still miss and what to review next time, so that I know where I stand and what to practise.

Source: Brief §2 ("Mastery summary + next review set"); Architecture Spec §B4 `MasterySummary`, `ResultShareButton`, §A5; Resolved questions 1 and 10.

#### Acceptance Criteria

1. THE Mastery_Summary node type SHALL have `type` `masterySummary`, `version` 1 and `terminal` `true`.
2. THE Mastery_Summary `configSchema` SHALL be closed and SHALL accept a `title`, a `body`, a `from` node ID, and an optional `tutorShare` closed object with a `label` of at most 60 characters and a `url` whose schema pattern accepts only `https://wa.me/` followed by 6–15 digits.
3. IF `from` names no node in the manifest, THEN THE Mastery_Summary `validate` SHALL report `dangling-ref` at the `from` path.
4. IF `from` names a node whose type is not `reviewQueue`, THEN THE Mastery_Summary `validate` SHALL report `type-mismatch` at the `from` path.
5. IF `from` names a node that does not lie on every path from `entryNodeId` to the Mastery_Summary node, THEN THE Mastery_Summary `validate` SHALL report `answer-not-upstream` at the `from` path.
6. IF the `title` is blank, THEN THE Mastery_Summary `validate` SHALL report `conditions/blank-text` at the `title` path.
7. IF the `tutorShare` `url` is not a Safe_Url, THEN THE Mastery_Summary `validate` SHALL report `conditions/unsafe-url` through `ctx.checkHttpsUrl` at the path `/config/tutorShare/url`.
8. THE Mastery_Summary `answerType` SHALL return `null`, and THE Mastery_Summary `responseSchema` SHALL be the closed empty object.
9. WHEN the runtime enters a Mastery_Summary node, THE Mastery_Summary `enter` SHALL store the Mastery_Result of the `from` node in the node's `nodeState`, with the Items in the order the `from` node stored them and each Item_Result computed by the Item_Result rule of the Glossary.
10. IF the `from` node has no stored `nodeState` when the runtime enters the Mastery_Summary node, THEN THE Mastery_Summary `enter` SHALL store a Mastery_Result with no Items, all counts 0, no Missed_Topics and an empty Next_Review_Set.
11. THE Mastery_Summary `enter` SHALL take no time or randomness from outside `env`, and SHALL leave its inputs unchanged.
12. FOR ALL generated Review_Queue node states, THE stored Mastery_Result counts SHALL sum to the number of listed Items, THE Next_Review_Set SHALL equal the listed Items whose Item_Result is `reviewed` or `missed` in order, and THE Missed_Topics SHALL equal the distinct Topics of the `missed` Items in first-occurrence order (invariant property).
13. THE Practice_App SHALL build the Tutor_Share_Link with a pure function that appends `?text=` and the `encodeURIComponent` form of the Share_Text to the `tutorShare` `url`, with the Share_Text cut to at most 500 UTF-16 code units by dropping Missed_Topics from the end.
14. FOR ALL generated Mastery_Results and titles, THE Tutor_Share_Link SHALL be a Safe_Url with the host `wa.me` and at most 2,048 code units, and decoding its `text` parameter SHALL give back the Share_Text (round-trip property).
15. THE Share_Text SHALL contain only the lesson title, the First_Try count, the after-review count, the Item count and Missed_Topics, so that the shared result holds no other data about the learner.

### Requirement 10: Practice Path profile property tests

**User Story:** As a toolkit maintainer, I want the three required property tests run against the Practice_Profile, so that the app node types meet the same properties as the shared ones.

Source: `testing.md` "Required property tests"; Brief §5; Architecture Spec §A3.

#### Acceptance Criteria

1. FOR ALL generated Practice_Profile manifests that pass validation, and every generated response sequence tested, THE runtime SHALL reach status `finished` or `limit_reached` within `limits.maxTransitions` transitions.
2. FOR ALL generated JSON values, THE graph validator called with the Practice_Profile SHALL return a result without throwing.
3. FOR ALL generated Practice_Profile manifests that pass validation, seeds and action sequences, THE runtime `reduce` SHALL return equal attempt states for equal seeds and equal action sequences.
4. THE property tests of this spec SHALL use fast-check with `numRuns` of at least 100 and SHALL describe their results as evidence for the properties tested.

### Requirement 11: Safe storage package

**User Story:** As a learner on a phone, I want the app to keep working when my browser blocks storage or is full, and to tell me when nothing was saved, so that I never lose a lesson to a storage error.

Source: Architecture Spec §A3 ("localStorage via a tiny wrapper"), §A5, §A6; Brief §9, C3; `security.md` "Privacy"; Resolved question 6.

#### Acceptance Criteria

1. THE Storage_Package SHALL have a `package.json` named `@dreame/storage` with `private: true` and `type: module`, a `tsconfig.json` with `compilerOptions.strict` set to `true`, and no runtime dependency.
2. THE Storage_Package source SHALL import no `react`, `react-dom`, `@dreame/ui` or `apps/` module and SHALL contain no call to `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` or `WebSocket`.
3. THE Storage_Wrapper SHALL take the Storage_Backend as a parameter, or `null` when no backend exists, so that tests can pass an in-memory double.
4. THE Storage_Package SHALL provide a function that returns the browser `localStorage`, or `null` when the global is missing or reading it throws.
5. THE Storage_Wrapper SHALL return a Store_Result from every read, write and remove call and SHALL let no exception escape.
6. WHEN a write receives a value and a version, THE Storage_Wrapper SHALL store the Envelope of that value as JSON text under the given key.
7. WHEN a read finds no stored text under the key, THE Storage_Wrapper SHALL return `{ ok: true, value: null }`.
8. IF the serialized Envelope of a write exceeds the Value_Cap, THEN THE Storage_Wrapper SHALL return the error `too-large` and SHALL leave the stored text unchanged.
9. IF the stored text of a read exceeds the Value_Cap, THEN THE Storage_Wrapper SHALL return the error `too-large` before calling `JSON.parse`.
10. IF the Storage_Backend is `null` or a backend call throws an error that is not a quota error, THEN THE Storage_Wrapper SHALL return the error `unavailable`.
11. IF `setItem` throws a quota error, THEN THE Storage_Wrapper SHALL return the error `quota`.
12. IF the stored text is not JSON, is not an Envelope, or fails the data check the caller passes, THEN THE Storage_Wrapper SHALL return the error `corrupt`.
13. IF the stored Envelope version differs from the version the caller expects, THEN THE Storage_Wrapper SHALL return the error `version`.
14. FOR ALL JSON values whose Envelope fits the Value_Cap, a write followed by a read with the same key, version and an accepting data check SHALL return a value deep-equal to the written value (round-trip property).
15. FOR ALL generated Storage_Backend behaviours, including backends that throw on any call or return any string, every Storage_Wrapper call SHALL return a Store_Result without throwing (error-condition property).

### Requirement 12: Device progress by item ID

**User Story:** As a learner, I want the app to remember on my device which questions I missed, even after the tutor edits the lesson, so that I can see what to review next time.

Source: Brief §2 ("Per-item mistake history across sessions"), B7 ("Key Practice Path's mistake history by stable item ID, not by version"), §9, C3; Resolved questions 2 and 6.

#### Acceptance Criteria

1. THE Practice_App SHALL keep the Progress_Store under the Progress_Key_Name with Envelope version 1, through the Storage_Wrapper only.
2. THE Progress_Store SHALL hold one Item_Record per Progress_Key and no other data.
3. WHEN an Attempt_End occurs, THE Progress_Model SHALL update the Item_Record of every Recall node of the attempt that has a stored First_Try_Result: `seen` increased by 1, `firstTryMisses` increased by 1 when the First_Try_Result is `incorrect`, `last` set to the Item_Result, and `lastSeenAt` set to the Attempt_End time.
4. THE Progress_Model SHALL compute the Item_Result of each Recall node from the attempt state with the Item_Result rule of the Glossary, counting a Queue Item without a Review_Result as `missed`.
5. WHEN an Attempt_End occurs, THE Progress_Model SHALL leave unchanged every Item_Record whose Progress_Key the attempt did not answer.
6. IF an update would leave more than Record_Cap Item_Records or a Progress_File text longer than 65,536 characters, THEN THE Progress_Model SHALL remove the Item_Records with the oldest `lastSeenAt`, ties broken by Progress_Key, until at most Record_Cap Item_Records remain and the Progress_File text is at most 65,536 characters, keeping the records of the current attempt (design D63, accepted 2026-11-21).
7. THE Progress_Model SHALL be a set of pure functions that take the current time as a parameter and call no `Date.now`, `new Date()` or `Math.random`.
8. THE Progress_Model SHALL report an Item as Due_For_Review when its Item_Record `last` is `reviewed` or `missed`.
9. FOR ALL generated Progress_Stores and attempt states, an update SHALL increase `seen` by exactly 1 for each answered Item, SHALL keep every other Item_Record deep-equal, and SHALL leave at most Record_Cap Item_Records (invariant property).
10. FOR ALL generated Progress_Stores, THE Progress_Model data check SHALL accept the value, and SHALL reject every value that adds a field to an Item_Record (error-condition property).
11. IF the Storage_Wrapper read of the Progress_Key_Name at app start returns the Storage_Error `corrupt`, `version` or `too-large`, THEN THE Practice_App SHALL start with an empty in-memory Progress_Store, report that Storage_Error in the Save_Status, and replace the stored value with the next successful save (Resolved question 6).

### Requirement 13: Progress export, import and clear

**User Story:** As a learner, I want to export my progress to a file, load it again and clear it, so that I can keep my history when the browser clears storage and remove it when I want.

Source: Brief §9 ("saved on this device — export to keep"), C2, C3; Architecture Spec §A5 ("Export/import JSON is always available"); `security.md` "Import limits"; Resolved question 5.

#### Acceptance Criteria

1. WHEN the learner activates the export control, THE Practice_App SHALL download the Progress_File built in the browser from the in-memory Progress_Store, so that export works when the Storage_Backend is unavailable.
2. THE Practice_App SHALL build the Progress_File download with no network request.
3. WHEN the learner picks a file with the import control, THE Practice_App SHALL check the file size before reading the text.
4. IF the picked file exceeds 65,536 bytes, THEN THE Practice_App SHALL display a plain-language message and SHALL leave the Progress_Store unchanged, without calling `JSON.parse`.
5. IF the picked file is not JSON or does not pass the Progress_File check, THEN THE Practice_App SHALL display a plain-language message and SHALL leave the Progress_Store unchanged.
6. WHEN a picked file passes the Progress_File check, THE Progress_Model SHALL merge its Item_Records into the Progress_Store, keeping for each Progress_Key the record with the later `lastSeenAt` and the current record on equal times, and THE Practice_App SHALL save the result.
7. WHEN the learner activates the clear control and confirms, THE Practice_App SHALL remove the Progress_Key_Name from the Storage_Backend and empty the in-memory Progress_Store.
8. FOR ALL generated Progress_Stores, building the Progress_File, parsing it, and merging it into an empty Progress_Store SHALL give a Progress_Store deep-equal to the original (round-trip property).
9. FOR ALL generated Progress_Stores `a` and `b` within the caps, merging `a` into itself SHALL give `a`, and WHEN the untrimmed union of `a` and `b` holds at most 1,000 records and its Progress_File text is at most 65,536 characters, merging `b` into the merge of `b` into `a` SHALL give the merge of `b` into `a` (idempotence property).

### Requirement 14: Attempt end callback in the activity player

**User Story:** As an app developer, I want the activity player to tell my app once when an attempt ends, so that the app can save progress without node views writing to storage.

Source: Architecture Spec §A7 (`useReducer` + context; the player state is the runtime); ui-renderer C10; Resolved question 13.

#### Acceptance Criteria

1. THE Activity_Player SHALL accept an optional prop `onFinish` that receives the attempt state.
2. WHEN an Attempt_End occurs, THE Activity_Player SHALL call `onFinish` exactly once for that attempt, with the attempt state after the Attempt_End.
3. WHILE the attempt status is `playing`, THE Activity_Player SHALL leave `onFinish` uncalled.
4. WHILE the Activity_Player renders inside React `StrictMode`, THE Activity_Player SHALL call `onFinish` once per Attempt_End.
5. WHERE no `onFinish` prop is passed, THE Activity_Player SHALL behave as before this change, and THE existing `@dreame/ui` tests SHALL pass.
6. THE design SHALL list each existing `@dreame/ui` test it changes with the reason.
7. THE `@dreame/ui` source SHALL stay free of browser storage use, checked by the existing `@dreame/ui` Privacy_Scan.

### Requirement 15: recall view

**User Story:** As a learner on a phone or a keyboard, I want to pick an answer, check it, and read clear feedback, so that I learn from a wrong answer before I move on.

Source: Architecture Spec §B4 (`QuestionCard`, `OptionButton`, `FeedbackSheet`), §A5, §A7; Brief A8; ui-renderer Requirements 7, 10; Resolved question 4.

#### Acceptance Criteria

1. WHEN the Recall_View displays a config, THE Recall_View SHALL display the `prompt` as the legend of one group and one native radio button per option, in the stored option order when one exists and otherwise in config order.
2. IF the learner activates the check control with no option selected, THEN THE Recall_View SHALL display an inline message linked to the group with `aria-describedby` and SHALL record no Try.
3. WHEN a Try names the correct option, THE Recall_View SHALL display the text "Correct", the `explanation` and a continue control.
4. WHEN a Try names a wrong option and Tries remain under the Retry_Limit, THE Recall_View SHALL display the text "Not quite. Try again." with the number of Tries left, SHALL disable the radio button of each option already tried, and SHALL display neither the explanation nor the correct option.
5. WHEN a Try names a wrong option and no Tries remain under the Retry_Limit, THE Recall_View SHALL display the text "Not this time", the label of the correct option, the `explanation` and a continue control.
6. WHEN the Recall_View displays feedback, THE Recall_View SHALL move keyboard focus to the feedback element and SHALL state the result in text, not by colour alone.
7. WHEN the learner activates the continue control, THE Recall_View SHALL call `onRespond` once with `{ tries }` in the order the Tries were made.
8. WHEN `onRespond` has been called, THE Recall_View SHALL ignore further continue activations until the node changes or the Activity_Player reports a Rejection.
9. THE Recall_View SHALL display every manifest string as text content, SHALL use native `fieldset`, `legend`, `input type="radio"`, `label` and `button` elements, and SHALL use no inline `style` attribute.
10. FOR ALL generated Recall configs and sequences of option picks and check activations, THE response passed to `onRespond` SHALL pass the Recall `isValidResponse` (property).

### Requirement 16: reviewQueue view

**User Story:** As a learner, I want to be told how many questions come back and then answer each one again, so that the review round feels like a short second pass, not a new lesson.

Source: Architecture Spec §B4 (`ReviewInterstitial` "3 questions to review"); Brief §6, B1; ui-renderer Requirements 7, 10.

#### Acceptance Criteria

1. WHILE the stored Queue is not empty and the Review_Round has not started, THE Review_Queue_View SHALL display the `title` as a heading, the `intro` when present, the text "<n> questions to review" ("1 question to review" for one Item) and a start control.
2. WHEN the learner activates the start control, THE Review_Queue_View SHALL display the Queue Items one at a time in Queue order, each with the text "Question <k> of <n>", its prompt as the legend of a group of native radio buttons, and a check control.
3. WHEN the learner checks an answer to a Queue Item, THE Review_Queue_View SHALL accept exactly one Try for that Item and SHALL display the result in text, the label of the correct option, the explanation and a next control.
4. WHEN the learner activates the next control on the last Queue Item, THE Review_Queue_View SHALL call `onRespond` once with `{ answers }` holding one `{ itemId, optionId }` per Queue Item in Queue order.
5. IF the stored Queue is empty, or the `nodeState` is missing or does not have the shape that Review_Queue `enter` stores, THEN THE Review_Queue_View SHALL display the `emptyText`, or the text "Nothing to review. Every question was right on the first try." when the config has none, and a continue control that calls `onRespond` once with `{ answers: [] }`.
6. WHEN the Review_Queue_View displays a new Queue Item or feedback, THE Review_Queue_View SHALL move keyboard focus to its heading or feedback element.
7. THE Review_Queue_View SHALL display every manifest string as text content, SHALL use native form elements and SHALL use no inline `style` attribute.
8. FOR ALL generated Queues and sequences of option picks, THE response passed to `onRespond` SHALL pass the Review_Queue `isValidResponse` and SHALL list every Queue Item_ID exactly once in Queue order (property).

### Requirement 17: masterySummary view

**User Story:** As a learner, I want to see my scores, the topics I still miss and what comes back next time, and to send the result to my tutor if I choose, so that my tutor can help without the app collecting anything.

Source: Architecture Spec §B4 (`MasterySummary`, `ResultShareButton`), §A5; Brief §2, C1, C3; ui-renderer Requirement 11.

#### Acceptance Criteria

1. WHEN the Mastery_Summary_View displays a node, THE Mastery_Summary_View SHALL display the `title` as a heading and the `body` as text with its line breaks kept.
2. THE Mastery_Summary_View SHALL display the text "First try: <a> of <n>" and "After review: <b> of <n>", where `<a>` is the `firstTry` count, `<b>` is the sum of the `firstTry` and `reviewed` counts, and `<n>` is the number of listed Items.
3. THE Mastery_Summary_View SHALL display each listed Item with its prompt and its Item_Result in text.
4. WHILE the Missed_Topics list is not empty, THE Mastery_Summary_View SHALL display the Missed_Topics under their own heading.
5. WHILE the Next_Review_Set is not empty, THE Mastery_Summary_View SHALL display its prompts under the heading "Review next time"; otherwise THE Mastery_Summary_View SHALL display the text "Nothing to review next time."
6. WHERE the config has `tutorShare` and the Tutor_Share_Link is a Safe_Url, THE Mastery_Summary_View SHALL display one External_Link_Button with the `tutorShare` `label` as its text and the Tutor_Share_Link as its destination, so that the destination host is shown and confirmed before the learner leaves the page.
7. IF the `nodeState` is missing or does not have the shape that Mastery_Summary `enter` stores, THEN THE Mastery_Summary_View SHALL display the `title`, the `body` and the note "No results to show for this attempt.", with no Tutor_Share_Link.
8. THE Mastery_Summary_View SHALL display no control that calls `onRespond`.
9. THE Mastery_Summary_View SHALL display every manifest and stored string as text content and SHALL use no inline `style` attribute.
10. FOR ALL generated Practice_Profile node configs and stored states, THE Recall_View, Review_Queue_View and Mastery_Summary_View SHALL show every manifest string they display as text content, with markup characters shown literally (property).

### Requirement 18: Practice Path app shell and routes

**User Story:** As a judge or a tutor, I want to open the app, read what it is for, and practise the demo lesson on a phone, so that I can try the retrieval loop with no sign-up.

Source: Brief §2, §6, §7, §9, B11, D2, D3; Architecture Spec §A1, §A4, §A5, §A7, §B1, §B2, §B4; Submission Checklist §1; `product.md`; Resolved questions 9 and 12.

#### Acceptance Criteria

1. THE Practice_App SHALL be a Vite and React 19 single-page app whose production build is static files only.
2. WHEN `pnpm --filter @dreame/practice-path build` runs in a clean clone after `pnpm install --frozen-lockfile`, THE Practice_App build SHALL run the root codegen before the Vite build and SHALL exit with code 0.
3. THE Practice_App SHALL serve the routes `/` (landing), `/play/demo/:id` (bundled Demo_Lesson playback) and a not-found view for every other path (Architecture Spec §B1).
4. WHEN the learner opens `/play/demo/:id` with the `activityId` of a bundled Demo_Lesson, THE Practice_App SHALL validate that manifest in the browser with the Practice_Validator_Module and the graph validator, and SHALL play it in the Activity_Player with the Practice_Views, a new uint32 seed from `crypto.getRandomValues` and an `onFinish` handler.
5. IF a bundled Demo_Lesson fails validation in the browser, THEN THE Practice_App SHALL display the Invalid_Activity_View with the action label "Back to home".
6. IF the learner opens `/play/demo/:id` with an ID that matches no bundled Demo_Lesson, THEN THE Practice_App SHALL display the not-found view with a link to `/`.
7. IF a Demo_Lesson has a `validUntil` date earlier than the device date, THEN THE Practice_App SHALL display a lesson-ended view in place of the player, with a note that the end date is checked on this device only (Brief B11).
8. WHEN an Attempt_End occurs, THE Practice_App SHALL update the Progress_Store with the Progress_Model, save it through the Storage_Wrapper, and display the Save_Status.
9. WHEN the save of criterion 8 succeeds, THE Save_Status SHALL read "Saved on this device — export to keep" (Brief §9).
10. IF the save of criterion 8 returns a Store_Result error, THEN THE Save_Status SHALL read "Not saved on this device" followed by a plain-language reason for the Storage_Error and an export control.
11. WHEN an Attempt_End occurs, THE Practice_App SHALL display a "Practice again" control that starts a new attempt of the same Demo_Lesson with a new seed.
12. THE landing view SHALL display the app name, one sentence that names tutors and lesson creators as the audience, a link to each bundled Demo_Lesson with the number of its Items that are Due_For_Review on this device, and the text "No sign-up · No tracking · Open source" (Architecture Spec §B2 `TrustStrip`).
13. THE landing view SHALL display the note "Progress is saved on this device only — export to keep it" and the export, import and clear controls of Requirement 13.
14. IF the Storage_Backend is unavailable when the landing view loads, THEN THE landing view SHALL display the note "This browser is not saving progress. You can still practise and export your results.", and THE Practice_App SHALL keep every route playable.
15. THE landing view SHALL display the note "For practice only. The answers are part of this page, so it is not suited to graded tests." (Brief §9; Resolved question 9).
16. THE Practice_App SHALL display on every view a footer that names the MIT License, links to the `LICENSE` file, the repository on GitHub and the Shop_Deploy_URL with https URLs, and states "Built with Kiro" (Brief §7, D3; Architecture Spec §B2 `Footer`; Resolved question 12).
17. THE Practice_App text SHALL use only the Brief §0 and §0a wording quoted in `.kiro/steering/product.md` for any claim about the toolkit, SHALL make no claim about learning gains or exam results, and SHALL contain no Banned_Phrase_List phrase.
18. THE Practice_App `index.html` SHALL set a page title and the `og:title` and `og:description` meta tags for the app (Architecture Spec §A5).
19. THE Practice_App SHALL load the `@dreame/ui` theme stylesheets, so that the views use the shared theme tokens.
20. THE axe Component_Test SHALL cover the landing view, the not-found view, the lesson-ended view, the Save_Status in its saved and not-saved states, the Recall_View, the Review_Queue_View and the Mastery_Summary_View.
21. WHILE the Progress_Store read of Requirement 12.11 has returned a Storage_Error and no save has succeeded since, THE Save_Status on the landing view and on the `/play/demo/:id` route SHALL read "Saved progress on this device could not be read. It will be replaced at the next save." followed by a plain-language reason for the Storage_Error.

### Requirement 19: Privacy, safe rendering and storage boundaries

**User Story:** As a learner, I want the app to collect nothing about me, keep my progress on my device only, and render shared content safely, so that I can practise without being tracked.

Source: Brief C1, C2, C3; Architecture Spec §A3, §A5; `security.md`; Playbook §3a ("Every steering rule that matters is also enforced in CI"); shop-challenge Requirements 14, 18.

#### Acceptance Criteria

1. THE Practice_App SHALL render no input that collects a name, email address, phone number or other personal data, SHALL render only radio inputs and the file input of the import control, and SHALL have no user accounts.
2. THE Practice_App source and the Storage_Package source SHALL contain no call to `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` or `WebSocket`, and no use of `sessionStorage` or `indexedDB`, checked by a Privacy_Scan.
3. THE Privacy_Scan SHALL check that `packages/storage/src` holds the only source files under `apps/`, `packages/` and `tools/` that name `localStorage`.
4. THE Source_Scan SHALL cover the Practice_App and the Storage_Package, so that the `eval`, `new Function`, `innerHTML` and `dangerouslySetInnerHTML` checks apply to both.
5. THE Practice_App SHALL render every anchor to another origin with an https `href`, `target="_blank"` and `rel="noopener noreferrer"`, and SHALL render the Tutor_Share_Link and every `outcome` node `cta` through the External_Link_Button.
6. THE Practice_App components SHALL use class names only and no inline `style` attribute, and WHEN `pnpm --filter @dreame/practice-path build` completes, THE built `apps/practice-path/dist/index.html` SHALL contain no inline `script` element and no inline `style` element.
7. WHEN the Practice_App build completes, THE build check SHALL fail when the production JavaScript exceeds 153,600 gzip bytes (Architecture Spec §A7, 150 KB).
8. THE Boundary_Rules SHALL fail when a file under `packages/storage/src`, `apps/practice-path/src/node-types`, the file `apps/practice-path/src/profile.ts` or the Progress_Model imports `react`, `react-dom` or `@dreame/ui`.
9. THE Lint_Check SHALL report `react/no-danger` and the recommended `eslint-plugin-jsx-a11y` rules as errors for the `.ts` and `.tsx` files of the Practice_App and the Storage_Package.
10. THE Repo_Text_Scan SHALL scan `.kiro/specs/practice-path/*.md`, the files under `apps/practice-path/src`, `apps/practice-path/index.html`, `apps/practice-path/README.md`, `packages/storage/README.md` and `PRIVACY.md` for Banned_Phrase_List phrases.
11. THE `PRIVACY.md` file SHALL cover both apps and SHALL state, for Practice Path, that the Progress_Store stays on the device under the Progress_Key_Name, which fields an Item_Record holds, how to clear it, that the Progress_File stays with the learner, and that "Send result to tutor" opens WhatsApp only when the learner chooses, with the exact text given in the design.

### Requirement 20: Static hosting configuration

**User Story:** As the builder, I want the Practice Path security headers and routing in its own `vercel.json`, so that the deployed app enforces the CSP and every route works on refresh.

Source: Architecture Spec §A3 ("`vercel.json` headers", "SPA rewrite"), §A6; Brief D1; `tech.md` "Hosting and backend"; shop-challenge Requirement 15.

#### Acceptance Criteria

1. THE Vercel_Config SHALL set, for every path, the header `Content-Security-Policy` to the CSP_Value, `Referrer-Policy` to `no-referrer`, `X-Content-Type-Options` to `nosniff`, and `Permissions-Policy` to `camera=(), microphone=(), geolocation=()`.
2. THE Vercel_Config SHALL rewrite every path that is not a built file to `/index.html`, so that `/play/demo/:id` loads on refresh.
3. THE Vercel_Config SHALL set the install command, build command and output directory that the design gives for a Vercel project whose Root Directory is `apps/practice-path`.
4. THE Workspace SHALL have a test that parses the Vercel_Config and fails when a header name or value of criterion 1 differs, the rewrite of criterion 2 is missing, or an `env`, `build` or `buildEnv` key exists.
5. FOR ALL generated request paths, THE header rules and the rewrite of the Vercel_Config SHALL apply, with the header values equal to the Architecture Spec §A3 values read at test run time (property).
6. THE Vercel_Config and the Practice_App SHALL need no environment variable, API key, token or other secret.

### Requirement 21: Deploy URL #2

**User Story:** As the builder, I want the Practice Path app live at a second public URL, so that judges can test both apps with no login.

Source: Brief §8 Day 9, D1, D2, D4; Architecture Spec §A3; Submission Checklist §1, §2, §4; shop-challenge Requirement 16; Resolved question 12.

#### Acceptance Criteria

1. WHEN the Vercel_Config and the build pass their tests, THE Implementing_Agent SHALL give the user the steps to create a second Vercel project from the GitHub repository with Root Directory `apps/practice-path` and no environment variable, and SHALL state that the user performs these steps with the user's own Vercel account.
2. THE Implementing_Agent SHALL write no Vercel token, project ID, organisation ID or other account data to any file in the Workspace.
3. WHEN the user asks for a push, THE Implementing_Agent SHALL confirm first that `pnpm --filter @dreame/shop-challenge build` and `pnpm --filter @dreame/practice-path build` both exit with code 0, because every push to `main` also rebuilds Shop Challenge.
4. WHEN the user reports the Deploy_URL_2, THE Implementing_Agent SHALL request `/` and `/play/demo/<id>` of each Demo_Lesson at the Deploy_URL_2 with `Invoke-WebRequest`, and SHALL report each status code and whether the four headers of Requirement 20.1 have the expected values.
5. IF a request under criterion 4 returns a status other than 200 or a header value differs, THEN THE Implementing_Agent SHALL report the difference to the user and SHALL change no Vercel setting itself.
6. WHEN the checks of criterion 4 pass, THE Implementing_Agent SHALL record the Deploy_URL_2 in `apps/practice-path/README.md`, with the note "No login needed".
7. WHEN the Deploy_URL_2 is recorded, THE Implementing_Agent SHALL add a link to the Deploy_URL_2 in the Shop Challenge footer, with its footer test updated, as the only change to `apps/shop-challenge` in this spec (Resolved question 12).
8. WHEN the Deploy_URL_2 is recorded, THE Implementing_Agent SHALL ask the user to open the Deploy_URL_2 on an Android phone, play the Demo_Lesson with at least one wrong first answer, confirm that the missed question returns in the Review_Round, return to the landing view to see the Due_For_Review count, export the Progress_File, and open the confirm step of the Tutor_Share_Link, and SHALL record the user's reported result in its task report.

### Requirement 22: Demo lesson and fixture

**User Story:** As a judge, I want a ready demo lesson with synthetic questions, so that the Brief §6 demo can show a wrong answer coming back in the review round.

Source: Brief §6, C3, C4; Submission Checklist §2, §4; `activity-authoring.md`; Architecture Spec §A4 ("Bundled demos"); Resolved questions 8 and 10.

#### Acceptance Criteria

1. WHEN the Implementing_Agent starts the Demo_Lesson task, THE Implementing_Agent SHALL write a synthetic draft of 6 questions on "Fractions and percentages", each with a prompt, 2–5 options, the correct option, an explanation and a Topic (Resolved question 8).
2. WHEN the draft of criterion 1 is written, THE Implementing_Agent SHALL show its questions, answer keys and explanations to the user and SHALL save the Demo_Lesson only after the user approves them, using any corrections or replacement questions the user gives at that review (Submission Checklist §4).
3. THE Demo_Lesson SHALL set the Mastery_Summary `tutorShare` `url` to the approved fictional number `https://wa.me/12125550142` (Resolved question 10), and THE Implementing_Agent SHALL write no other WhatsApp number in any file under `activities/`.
4. THE Workspace SHALL contain one Demo_Lesson with `profile` `practice-path`, a `requires` entry for every node type it uses, 6–8 Recall nodes, one Review_Queue node whose `from` names every Recall node, and one Mastery_Summary node whose `from` names the Review_Queue node.
5. THE Demo_Lesson SHALL have an acyclic node graph, a `fallbackOutcomeId` that names an existing terminal node, an unconditional last edge on every node with edges, and no `validUntil` or a `validUntil` of `2027-12-31` or later.
6. THE Demo_Lesson SHALL contain only synthetic data, with no real people's names or details and no brand logos.
7. THE Validate_CLI SHALL know the profiles `core`, `shop-challenge` and `practice-path`, so that `pnpm validate activities/*.json` prints one PASS line per manifest and exits with code 0.
8. THE Workspace SHALL contain one Practice_Fixture whose Recall `correctOptionId` names no option, and WHEN `pnpm validate` runs on that file, THE Validate_CLI SHALL report one `dangling-ref` diagnostic and exit with code 1.
9. THE `activities/fixtures/README.md` file SHALL list the Practice_Fixture with the diagnostic it is expected to produce.
10. THE Workspace SHALL have a test that plays the Demo_Lesson with one scripted response sequence that misses two questions on the First_Try, and checks that the Queue holds exactly those two Items and that the Mastery_Result counts match the script.

### Requirement 23: Node type wiring, EXTENDING.md and the wiring hook

**User Story:** As a developer adding a node type to an app, I want the Practice Path node types wired the way the Wiring_Hook expects, so that the hook and the docs match a second working app example.

Source: Playbook §3b `node-type-wiring.json`; `new-node-type.md`; ui-renderer D20, D21; shop-challenge Requirement 19, D47.

#### Acceptance Criteria

1. THE Implementing_Agent SHALL create the App_Wiring_Files before it creates the first Own_File of `recall`, `reviewQueue` or `masterySummary`, so that the Wiring_Hook finds every App_Wiring_File when it triggers.
2. THE App_Wiring_Files SHALL list each of `recall`, `reviewQueue` and `masterySummary` exactly once, in the line forms that the Wiring_Hook prompt gives for an app node type.
3. THE Practice_Views SHALL hold the shared views of `content`, `choice` and `outcome` from `@dreame/ui` and the Recall_View, Review_Queue_View and Mastery_Summary_View, each exactly once, and a test SHALL check that the Practice_Views type names equal the Practice_Profile node type names in order.
4. THE `EXTENDING.md` file SHALL contain one `### recall`, one `### reviewQueue` and one `### masterySummary` section in the existing entry form, naming the Own_Files and the profile `practice-path`.
5. THE `tools/validate/test/extending-doc.test.ts` test SHALL expect the `core` node type sections, then the Shop Challenge app node type sections, then the Practice_Profile app node type sections, and SHALL check that every listed path exists.
6. THE Own_Files test files SHALL hold Vitest tests for `validate` and `reduce` and a fast-check property at `numRuns` of at least 100 for each app node type, so that Wiring_Hook prompt steps 5 and 6 create no extra test files.
7. WHEN the agent saves an Own_File after the wiring of criteria 2–6 is complete and the Wiring_Hook replies, THE Implementing_Agent SHALL record the reply in its task report, for use as Kiro_Log evidence.
8. THE Implementing_Agent SHALL leave the four files in `.kiro/hooks/` unchanged.

### Requirement 24: Task, CI and verification conventions

**User Story:** As the builder, I want every task small and verifiable on this machine, and CI to build the new app, so that sub-agent runs finish and results are checkable.

Source: shop-challenge Requirement 20, D39; Playbook §4.3; `docs/HANDOFF.md` §1, §4; Resolved question 11.

#### Acceptance Criteria

1. THE tasks SHALL each list at least one Verify_Command with its expected exit code.
2. THE Verify_Commands SHALL run in PowerShell 5.1, use `;` between commands, check exit codes with `; $LASTEXITCODE`, and contain no `&&` or `||`.
3. THE Verify_Commands SHALL run Vitest only as `pnpm exec vitest run <path>`, SHALL start with `pnpm codegen;` when the tested code imports generated validators, and SHALL each finish within 180,000 ms, except a full `pnpm check` run, which gets 600,000 ms.
4. THE tasks SHALL each create or change at most the files that one sub-agent run can finish within the 180,000 ms command limit, splitting any task that combines more than one component with its tests.
5. THE Implementing_Agent SHALL write no file under `.kiro/settings/`, run no `Remove-Item` command, and start no `npm` or `yarn` command, and SHALL ask the user to do a needed deletion or settings change by hand.
6. THE Implementing_Agent SHALL edit no generated file under `packages/*/generated/` or `apps/*/generated/` by hand.
7. THE Implementing_Agent SHALL write files as UTF-8 without BOM and with LF line endings.
8. THE Implementing_Agent SHALL write property tests with fast-check at `numRuns` of at least 100, tagged `Feature: practice-path, Property N: <title>` in the `describe` or `it` title.
9. THE Implementing_Agent SHALL use no Banned_Phrase_List phrase in any file of this spec or any file it creates.
10. THE tasks SHALL each end with a step that runs a test: a Vitest test through `vitest run`, or a Verify_Command whose exit code checks the task's result (Playbook §4.3).
11. THE tasks SHALL place each property test in its own task, separate from the task that writes the code the property tests (Playbook §4.3).
12. THE tasks SHALL state that the Post_Task_Hook runs `pnpm -s check` after every task, and THE design SHALL account for that run time in the task plan.
13. WHEN the Practice_App tests are in the Check_Pipeline, THE Implementing_Agent SHALL measure the wall time of `pnpm -s check` after asking the user to close heavy processes, and SHALL record it in its task report.
14. IF the time measured under criterion 13 exceeds 480 s (80% of the 600 s Post_Task_Hook timeout), THEN THE Implementing_Agent SHALL report the time to the user and SHALL ask whether to narrow the Check_Pipeline or split the tests before changing either.
15. THE Implementing_Agent SHALL change `.github/workflows/ci.yml` only by adding one step `pnpm --filter @dreame/practice-path build` after the Shop Challenge build step, and SHALL keep `node-version: 22`.
16. THE tasks file SHALL note that checkpoint tasks are not part of the task dependency graph, so that the orchestrator runs each checkpoint by hand, and that tasks run one at a time.
17. THE tasks SHALL include a checkpoint that asks the user before each commit and before each push, following the rules of Requirement 2.

## Resolved questions (user decision 2026-11-21)

On 2026-11-21 the user accepted the answer given for each of the 17 questions below. The criteria above state these answers. Later documents refer to each item as "Resolved question N".

1. **Where do retry, review and the result screen live?** Accepted (2026-11-21): keep `packages/runtime` unchanged. The Recall_View runs the Tries of one question and sends them in one response (Requirement 6). The non-terminal Review_Queue holds the whole Review_Round in one response (Requirement 8). A third app node type, the terminal Mastery_Summary, shows the result by reading the Review_Queue state in `enter`, the same pattern as `recommendOutcome` (Requirement 9). Reason: the runtime takes one response per node and finishes on entering a terminal node, and Brief §2 names a "Mastery summary" outcome without a node type that can show it. Rejected alternatives: (A) a "stay on this node" reducer step so that each Try and each review answer is its own action (Brief B1), which changes `packages/runtime`, the validator's `maxTransitions` lower bound and the termination property of the three earlier specs; (B) two node types with the summary as an app panel under the shared `outcome` view, fed by `onFinish`, outside the manifest and unchecked by the validator.
2. **Which review scheduling rule?** Accepted (2026-11-21): in the attempt, the Queue holds every Item missed on the First_Try, in `from` order, each replayed once with one Try (Brief B1). The Next_Review_Set and the device Due_For_Review flag mark every Item whose latest First_Try was wrong. No dates or intervals. Rejected alternatives: (A) Leitner boxes with 1-, 3- and 7-day intervals from `lastSeenAt`; (B) ordering the Queue by the device mistake count, which needs device history inside the runtime `Env`.
3. **Answer format?** Accepted (2026-11-21): multiple choice with 2–5 options (Architecture Spec §B4 `QuestionEditorRow`). Rejected alternative: typed free recall with a normalised text match, which needs a text input and accepted-answer lists.
4. **When does the explanation appear?** Accepted (2026-11-21): after a correct Try or after the last allowed Try; a wrong Try with Tries left shows "Not quite. Try again." without the answer, and tried options are disabled (Requirement 15). Reason: showing the explanation earlier gives the answer away before the retry. Rejected alternative: the explanation after every Try.
5. **Export, import and clear in this spec?** Accepted (2026-11-21): all three (Requirement 13). Reason: Brief §9 asks the UI to say "export to keep", which needs an export control; an export is only useful with an import; clear lets the learner remove device data. Rejected alternatives: (A) export only, with import on Day 11 with the editor's JSON import; (B) none, with the text "saved on this device only".
6. **Storage key, versioning and caps?** Accepted (2026-11-21): one key `dreame.practice-path.progress`, an Envelope with `v: 1`, Item_Records keyed `<activityId>:<itemId>` (`activityId` and `itemId` stay the same across manifest versions, Brief B7), a Value_Cap of 65,536 code units and a Record_Cap of 1,000 that drops the oldest records first. An unreadable value or one with another version is reported in the Save_Status, the app starts with empty progress, and the next successful save replaces it. Rejected alternatives: (A) one storage key per Item; (B) keeping an unreadable value untouched until the learner clears it.
7. **Resume an unfinished attempt after a reload?** Accepted (2026-11-21): no; a reload starts the lesson again. Reason: attempt resume needs the `AttemptRecord` and the manifest hash of Brief B7 and Architecture Spec §A3, which belong with `packages/link` on Day 11. Rejected alternative: saving the attempt state after every step and resuming it.
8. **Demo lesson subject and count?** Accepted (2026-11-21): one Demo_Lesson (an optional `content` intro, 6 Recall nodes, one Review_Queue, one Mastery_Summary) whose questions are a synthetic draft of 6 questions on "Fractions and percentages" that the Implementing_Agent writes; the answers are arithmetic and easy to check. The implementing task shows the draft to the user for approval before saving, and any corrections or replacement questions the user gives at that review take the place of the draft (Requirement 22.1, 22.2; Submission Checklist §4). One Practice_Fixture with an answer key that names no option. Rejected alternative: two Demo_Lessons on different topics.
9. **Answer keys are visible in the client.** Accepted (2026-11-21): a short landing note that the app is for practice and not suited to graded tests (Requirement 18.15), as Brief §9 accepts this risk "for practice; no exam claims". Rejected alternative: the note in `README.md` only.
10. **"Send result to tutor" in this spec?** Accepted (2026-11-21): yes, WhatsApp only, through the External_Link_Button, with the Share_Text built from the lesson title, the counts and the Missed_Topics (Requirements 9.13–9.15, 17.6). Architecture Spec §A5 and Part D name it, and the Submission Checklist §5 draft describes it. The Demo_Lesson uses the approved fictional number `https://wa.me/12125550142` (Requirement 22.3). Rejected alternatives: (A) a "Copy result" button with the same text; (B) deferring to Day 11.
11. **May this spec edit `.github/workflows/ci.yml`?** Accepted (2026-11-21): yes, only one added step `pnpm --filter @dreame/practice-path build` (Requirement 24.15), as D39 did for Shop Challenge. Rejected alternative: keeping `ci.yml` unchanged and relying on the Vercel build.
12. **Links between the two apps?** Accepted (2026-11-21): the Practice Path footer links to the Shop_Deploy_URL now, and after Deploy_URL_2 is live the Shop Challenge footer gets one link to it (Requirement 21.7). Architecture Spec §B2 `Footer` lists "link to the sister app". Rejected alternative: a link from Practice Path only, leaving `apps/shop-challenge` untouched.
13. **How does the app learn that an attempt ended?** Accepted (2026-11-21): an optional `onFinish` prop on the Activity_Player (Requirement 14), an additive change to `@dreame/ui`. Rejected alternative: the Mastery_Summary_View writing progress on mount, which puts storage writes in a node view and runs twice under React `StrictMode`.
14. **Byte budgets?** Accepted (2026-11-21): the design sets the Practice_Validator_Module limits after the first measurement (Requirement 4.5), as D44 did, and the app's production JavaScript stays within 153,600 gzip bytes (Requirement 19.7). Rejected alternative: fixed limits now, for example the Shop limits of 255,000 raw and 19,000 gzip bytes.
15. **May `tools/validate` depend on `@dreame/practice-path`?** Accepted (2026-11-21): yes, through the React-free `./profile` export (Requirement 3.12), as D45 allowed for Shop Challenge. `packages/` still never imports `apps/`. Rejected alternative: moving the Practice_Profile into a package, which conflicts with `structure.md` "Node type placement".
16. **New dependencies?** Accepted (2026-11-21): none. The Practice_App uses the packages already approved for Shop Challenge (`react`, `react-dom`, `react-router`, `typebox`, the Testing Library packages, `axe-core`, `vite`), and the Storage_Package has no runtime dependency. Any other package stops the task for approval (Requirement 3.8).
17. **Days 8 and 9 in one spec?** Accepted (2026-11-21): yes. Reason: the node types, the storage package, the views and the app shell depend on each other, and the deploy needs all of them. Rejected alternative: splitting into `practice-path` (node types and storage) and `practice-path-ui` (app and deploy).

## Conflicts and gaps found in the sources

- Brief §2 lists `recall` and `reviewQueue` as the Practice Path node types, but its outcome "Mastery summary + next review set" needs a terminal node to display it. This spec adds `masterySummary`. Resolved by Resolved question 1.
- Brief B1 defines retry and review as runtime policy with an `onIncorrect` manifest field and a `review` phase. runtime-core deferred it, and the runtime takes one response per node. This spec keeps the policy inside the node types. Resolved by Resolved question 1.
- Brief B7 and Architecture Spec §A3 key attempt and progress records with a SHA-256 `manifestHash`, while Brief B7 also says to key mistake history by stable item ID, not by version. This spec keys progress by `activityId` and `itemId` and leaves the hash to `packages/link`. Resolved by Resolved questions 6 and 7.
- Architecture Spec §A5 words the failed-save state as "Not saved on this device — export your draft". Drafts belong to the Day 11 editor, so this spec uses "Not saved on this device" with a reason and an export control (Requirement 18.10), and the Brief §9 wording for a successful save.
- Architecture Spec §B4 `LessonDetailsForm` sets the retry policy (0–3) once per lesson; this spec sets `maxRetries` per Recall node, because no lesson-level config exists in the manifest contract.
- Architecture Spec §B4 names `OptionButton` buttons with selected, correct and incorrect states; this spec uses native radio buttons, as the shared `ChoiceNodeView` does, with the result stated in text.
- Architecture Spec §A7 lists three routes (`/`, `/create`, `/play`), §B1 lists five; this spec serves `/`, `/play/demo/:id` and not-found, as Shop Challenge does (D26).
- Architecture Spec §A6 places the planning docs in `docs/planning/`; `structure.md` places them in `docs/`, which matches the Workspace.
- Playbook §3b shows a 300 s Post_Task_Hook timeout; the hook file has 600 s since D53.
- `docs/HANDOFF.md` still describes HEAD `6132a2b` with shop-challenge tasks open; the Workspace is at `02117a2` with the shop-challenge spec complete. Kiro_Log facts that the HANDOFF and the Workspace disagree on use the Workspace (`git log`, `tasks.md`).
- Submission Checklist §4 expects the user's lesson content by Day 8; none is in the Workspace yet (Requirement 22.1). Resolved by Resolved question 8: the Demo_Lesson is a synthetic draft on "Fractions and percentages" that the user approves, corrects or replaces before saving (Requirement 22.1, 22.2).
