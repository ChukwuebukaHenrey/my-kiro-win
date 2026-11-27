# Requirements Document

## Introduction

Plan Day 10, outsider-review priority 1 (Brief A4). This spec adds a scaffold, `pnpm create-app <name>`, that copies a minimal template app into `apps/<name>`, uses it to create a third app, and measures the effort. It also adds a test showing that every app runs the same shared runtime, node types and views, and an `EXTENDING.md` section on creating an app. The `activity-author` agent, the playground, `packages/link`, new node types and deploying the third app are out of scope.

## Glossary

- **Scaffold**: the command-line tool in `tools/create-app/src/`, run as `pnpm create-app <name>`.
- **App_Name**: the `<name>` argument given to the Scaffold.
- **Template**: the plain files with placeholders in `tools/create-app/template/`.
- **Generated_App**: the folder `apps/<App_Name>` that the Scaffold writes.
- **Sample_Activity**: the file `activities/<App_Name>-sample.json` that the Scaffold writes.
- **Root**: the folder the Scaffold writes into; the repository root unless the `--root <dir>` option names another folder.
- **Next_Steps**: the ordered list of hand steps the Scaffold prints after writing, exported as a constant from `tools/create-app/src/`.
- **Third_App**: `apps/quiz-sprint`, created with the Scaffold.
- **Shared_Foundation_Test**: `tools/validate/test/shared-foundation.test.ts`.
- **Reserved_Names**: `core`, `shop-challenge` and `practice-path`.

## Requirements

### Requirement 1: App name check

**User Story:** As a developer, I want the Scaffold to refuse unsafe names, so that it never writes outside its folders or clashes with an existing app.

#### Acceptance Criteria

1. THE Scaffold SHALL accept an App_Name only when the App_Name matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, is 2 to 31 characters long, and is not one of the Reserved_Names.
2. IF the App_Name is missing or fails criterion 1.1, THEN THE Scaffold SHALL print one error line naming the rule that failed, write no file, and exit with code 1.
3. IF `apps/<App_Name>` or the Sample_Activity already exists under the Root, THEN THE Scaffold SHALL print one error line naming the existing path, write no file, and exit with code 1.

### Requirement 2: Template

**User Story:** As a developer, I want the template to be plain files I can read, so that I can see what a new app contains before I run the Scaffold.

#### Acceptance Criteria

1. THE Template SHALL hold each file of the Generated_App and the Sample_Activity as a plain text file with the suffix `.tmpl`, so that no repository check compiles, lints or runs a Template file.
2. THE Template SHALL produce a Vite + React + react-router app with `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `vercel.json` with the Architecture Spec §A3 headers, `README.md`, `scripts/codegen.ts`, `scripts/check-dist.ts`, a profile with the `content`, `choice` and `outcome` node types, a view registry, a landing route, a demo route, a not-found route, a footer, and one test file.
3. THE Template SHALL use only dependencies that `apps/practice-path/package.json` already lists.
4. WHEN the Scaffold renders a Template file, THE Scaffold SHALL replace every placeholder with a value derived from the App_Name, so that no placeholder text remains in any written file.

### Requirement 3: Write scope

**User Story:** As a developer, I want the Scaffold to touch only the new app and its sample activity, so that a run cannot damage shared files.

#### Acceptance Criteria

1. THE Scaffold SHALL write files only under `<Root>/apps/<App_Name>/` and to `<Root>/activities/<App_Name>-sample.json`.
2. THE Scaffold SHALL render all files in memory and complete the checks of Requirement 1 before the Scaffold writes the first file.
3. THE Scaffold SHALL write every file as UTF-8 without BOM, with LF line endings.

### Requirement 4: Output and next steps

**User Story:** As a developer, I want the Scaffold to tell me what it wrote and what to do next, so that I can finish the wiring without reading the source.

#### Acceptance Criteria

1. WHEN the Scaffold finishes writing, THE Scaffold SHALL print each written path relative to the Root, then the total number of files and lines written, then the Next_Steps, and exit with code 0.
2. THE Next_Steps SHALL give the exact text of each shared-file edit a new app needs: the dependency line for `tools/validate/package.json`, the import and `PROFILES` lines for `tools/validate/src/run.ts`, and the import and entry lines for the Shared_Foundation_Test, followed by `pnpm install`, `pnpm check` and the app build command.

### Requirement 5: Shared wiring picks up new apps

**User Story:** As a developer, I want the shared scripts and rules to find a new app by folder, so that each new app needs as few shared-file edits as possible.

#### Acceptance Criteria

1. THE root `codegen` script SHALL run the `codegen` script of `@dreame/node-types` and then of every package under `apps/` that defines a `codegen` script.
2. THE `react-free-no-ui` rule in `tools/lint/src/depcruise-rules.ts` SHALL cover `src/node-types/` and `src/profile.ts` of every folder under `apps/`.
3. THE `package.json` of each app under `apps/` SHALL export its view registry as `./views`.

### Requirement 6: Third app

**User Story:** As a judge, I want a third app built with the Scaffold, so that I can see that the shared foundation supports more than the two original apps.

#### Acceptance Criteria

1. THE Third_App SHALL be created by running `pnpm create-app quiz-sprint` and SHALL use only the `content`, `choice` and `outcome` node types.
2. THE Third_App Sample_Activity SHALL be a three-question quiz that adds one to a `score` variable per correct answer and ends at a `ready` outcome when `score` is at least 2 and at a `review` outcome otherwise.
3. WHEN the Next_Steps are applied, THE repository SHALL pass `pnpm check` and `pnpm --filter @dreame/quiz-sprint run build`.

### Requirement 7: Effort measurement

**User Story:** As a judge, I want the effort of the third app reported with numbers, so that the claim about the foundation rests on evidence.

#### Acceptance Criteria

1. WHEN the Third_App is created, THE developer SHALL record the wall time of the Scaffold run, the number of files and lines written by the Scaffold, the number of files and lines changed by hand afterwards, and each manual fix needed.
2. THE `KIRO_LOG.md` entry for this spec SHALL report the figures of criterion 7.1, including any failed step and its fix.

### Requirement 8: Shared-fix test

**User Story:** As a judge, I want a test showing that one fix in a shared package changes every app, so that the shared foundation is shown by a check and not only by a statement.

#### Acceptance Criteria

1. THE Shared_Foundation_Test SHALL check, for each app profile in `PROFILES`, that the profile's `content`, `choice` and `outcome` node types are the same objects as the ones in `coreNodeTypes`.
2. THE Shared_Foundation_Test SHALL check, for each app view registry, that the views for `content`, `choice` and `outcome` are the same objects as the ones `@dreame/ui` exports.
3. THE Shared_Foundation_Test SHALL play one core-only manifest with a fixed seed, clock and action list through each app profile with the `@dreame/runtime` reducer, and check that every app reaches the same final status and outcome.

### Requirement 9: EXTENDING.md section

**User Story:** As a developer, I want `EXTENDING.md` to explain how to create an app, so that I can follow the steps without reading the Scaffold source.

#### Acceptance Criteria

1. THE `EXTENDING.md` file SHALL have a `## Create a new app` section after `## Node types` that gives the command `pnpm create-app <name>`, the name rule of criterion 1.1, and the Next_Steps.
2. THE `tools/validate/test/extending-doc.test.ts` test SHALL check that the `## Create a new app` section contains the command and every Next_Steps line.

### Requirement 10: Repository rules

**User Story:** As a maintainer, I want the new code to follow the repository rules, so that `pnpm check` and the steering rules keep holding.

#### Acceptance Criteria

1. THE Scaffold SHALL import only `node:*` modules and files in `tools/create-app/src/`.
2. THE files of this spec SHALL add no dependency outside the workspace and contain no phrase from the "Do not use" line of `.kiro/steering/product.md`.
3. THE Template SHALL contain no `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`, and every link to another origin in the Template SHALL use `https:` and `rel="noopener noreferrer"`.
