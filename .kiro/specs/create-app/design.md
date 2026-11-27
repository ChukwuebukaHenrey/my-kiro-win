# Design Document: create-app

## Overview

`pnpm create-app <name>` scaffolds a new DREAME app. The work splits into a pure planner and a thin I/O shell, so the planner is testable without the filesystem. A plain-text template with placeholders lives in `tools/create-app/template/`, inspectable before a run. Three small shared-wiring changes let a new app join `pnpm codegen` and the lint rules by folder glob rather than by name. A third app, `apps/quiz-sprint`, is built with the Scaffold and its effort measured. A shared-foundation test shows every app runs the same runtime, node types and views.

Language: TypeScript (the workspace is TypeScript, run under `node --experimental-strip-types`, matching the existing tools and app scripts).

## Decisions

- **D1 Template as plain `.tmpl` files** (Req 2.1). Each template file carries a `.tmpl` suffix so no repo check (tsc, lint, vitest, validate) ever compiles or runs it, yet it reads as ordinary source. Recommended and adopted.
- **D2 Pure planner + I/O shell** (Req 3.2). `planFiles(name)` returns either a rejection or a `{ path, contents }[]` plan rendered fully in memory; `run` does the checks, then writes. This makes scope, placeholder and name rules testable without disk.
- **D3 Placeholder scheme.** Placeholders are `__APP_ID__` (the name, e.g. `quiz-sprint`), `__APP_PKG__` (`@dreame/<name>`), `__APP_TITLE__` (name split on `-`, each word capitalised, joined with spaces), `__APP_CLASS__` (a CSS/JSX prefix, the name's words lower-cased and joined, e.g. `quizsprint`). All derive from the name; no user prompt.
- **D4 Root codegen discovers apps** (Req 5.1). The root `codegen` script becomes a small Node script, `tools/create-app/src/codegen-all.ts`, that runs `@dreame/node-types` codegen then every `apps/*` package whose `package.json` has a `codegen` script. Fewest shared edits: a new app needs no change to the root script. Chosen over "scaffold prints a line to add" because it removes a hand edit and a failure mode.
- **D5 depcruise rule generalised** (Req 5.2). The `react-free-no-ui` `from` path for app code changes from the two named apps to `apps/[^/]+/src/node-types/` and `apps/[^/]+/src/profile\.ts$`. `progress` and `share` stay listed for `practice-path` only (the template has no such files, so the third app does not need them). This keeps the rule honest and lets any new app's profile and node-types stay React-free.
- **D6 Remaining shared edits are template-driven and listed in Next_Steps** (Req 4.2). Two shared files still name each profile explicitly for type reasons: `tools/validate/src/run.ts` `PROFILES` (needs the typed import) and `tools/validate/package.json` (needs the workspace dep so the import resolves). The Shared_Foundation_Test also lists each app. The Scaffold prints the exact lines to add to these three, rather than editing them, so it never writes outside its two folders (Req 3.1). Accepted trade-off: three hand edits per new app, each one line, each printed verbatim.
- **D7 App exports `./views`** (Req 5.3). The template `package.json` adds `"./views"` to `exports` so the Shared_Foundation_Test can import each app's registry by package subpath, as it already imports `./profile` and `./node-types`.
- **D8 Third app name and mechanic** (Req 6). `quiz-sprint`: a three-question quiz using only core node types; each correct `choice` adds one to a `score` variable, and a final `outcome` branches on `score >= 2`. No new node type, so no new view or validator work.
- **D9 Third app not deployed** (Req 6, out of scope). Two live URLs already satisfy the Brief; deploying a third costs time for no extra evidence. Built and checked locally only.
- **D10 Shared-fix test by identity + one replay** (Req 8). Identity checks (same node-type objects, same view components) plus one deterministic replay through each profile are the smallest honest demonstration that a single shared change moves every app. A comment states this is evidence for the properties tested, not a universal proof.
- **D11 At most one property test** (plan instruction). Only the planner property (P1) is a property test; it adds real evidence about the name/scope/placeholder invariant across all strings. Everything else is example, integration or smoke, per the prework.

## Architecture

```
tools/create-app/
  template/                         # D1 plain .tmpl files, one per Generated_App file + sample activity
    apps/__APP_ID__/package.json.tmpl, index.html.tmpl, vite.config.ts.tmpl, tsconfig.json.tmpl,
      vercel.json.tmpl, README.md.tmpl, scripts/codegen.ts.tmpl, scripts/check-dist.ts.tmpl,
      src/profile.ts.tmpl, src/demos.ts.tmpl,
      src/node-types/index.ts.tmpl, src/views/registry.ts.tmpl,
      src/app/main.tsx.tmpl, App.tsx.tmpl, LandingView.tsx.tmpl, PlayDemoRoute.tsx.tmpl,
      NotFoundView.tsx.tmpl, Footer.tsx.tmpl, app.css.tmpl, css.d.ts.tmpl,
      test/shared.test.ts.tmpl
    activities/__APP_ID__-sample.json.tmpl
  src/
    name.ts        # isValidName, RESERVED_NAMES, derive(name) -> placeholder values
    plan.ts        # planFiles(name): Rejection | { files: PlannedFile[] }; reads template, renders
    run.ts         # run(argv, io): number — checks, existence, write, print; no node:fs directly
    cli.ts         # wires real CliIo (node:fs, node:path, process) and calls run
    next-steps.ts  # NEXT_STEPS(name): readonly string[] — the three shared edits + install/check/build
    codegen-all.ts # D4 root codegen: node-types then each apps/* with a codegen script
  test/
    name.test.ts, plan.property.test.ts, run.test.ts
  package.json     # name @dreame/create-app, bin create-app -> src/cli.ts
```

Root `package.json` `codegen` script becomes `node --experimental-strip-types tools/create-app/src/codegen-all.ts`. A root `create-app` script runs `node --experimental-strip-types tools/create-app/src/cli.ts`, so `pnpm create-app <name>` works.

## Components and Interfaces

### C1 name.ts

```ts
export const RESERVED_NAMES: readonly string[] = ['core', 'shop-challenge', 'practice-path'];
export function isValidName(name: string): boolean; // regex + length 2..31 + not reserved
export interface Placeholders { id: string; pkg: string; title: string; className: string; }
export function derive(name: string): Placeholders;
```

### C2 plan.ts

```ts
export interface PlannedFile { readonly path: string; readonly contents: string; } // path relative to Root, LF
export type PlanResult =
  | { readonly ok: false; readonly error: string }
  | { readonly ok: true; readonly files: readonly PlannedFile[] };
export function planFiles(name: string): PlanResult; // rejects per Req 1.1; else renders every .tmpl
```

`planFiles` lists the template tree, maps each `apps/__APP_ID__/x.tmpl` to `apps/<name>/x` and `activities/__APP_ID__-sample.json.tmpl` to `activities/<name>-sample.json`, and replaces every placeholder. It asserts no `__APP_` substring remains in any rendered file.

### C3 run.ts and CliIo

```ts
export interface CliIo {
  exists(path: string): boolean;
  writeFile(path: string, contents: string): void; // UTF-8 no BOM, LF
  out(line: string): void; err(line: string): void;
  root: string;
}
export function run(argv: readonly string[], io: CliIo): number; // 0 ok, 1 on any rejection
```

`run`: parse name (and optional `--root`); `planFiles`; on rejection print error, return 1; check each planned absolute path for existence, and the app folder, with `io.exists` — if any exists, print and return 1 (Req 1.3, 3.2); else write each file, print paths + counts + `NEXT_STEPS(name)`, return 0.

### C4 codegen-all.ts (D4)

Reads `apps/` entries, for each `apps/<x>/package.json` with a `scripts.codegen`, spawns `pnpm --filter <pkgName> run codegen`; runs `@dreame/node-types` codegen first. Uses only `node:*`.

### C5 Shared_Foundation_Test (Req 8)

Imports `PROFILES` from the validate CLI, `coreNodeTypes` from `@dreame/node-types`, and `ContentNodeView`, `ChoiceNodeView`, `OutcomeNodeView` from `@dreame/ui`, plus each app's `./views`. For each app profile: asserts the three core node-type objects are identical by reference; for each app registry: asserts `get('content').Render === ContentNodeView` etc.; then builds a runtime from one core manifest and replays a fixed action list under each profile, asserting equal final status and outcome.

## Data Models

Core-only sample manifest (quiz-sprint): `schemaVersion 1`, `profile "quiz-sprint"`, a `score` number variable initial 0, three `choice` nodes whose correct edge carries an effect adding 1 to `score`, and a final `outcome` node branching on `score >= 2` to `ready` else `review`. Node and transition counts stay within the default limits.

## Error Handling

- Invalid or missing name, reserved name, name too long/short: one error line, no write, exit 1 (Req 1.2).
- Target path or sample file exists: one error line naming the path, no write, exit 1 (Req 1.3).
- A leftover `__APP_` in a rendered file: `planFiles` throws; `run` reports it and exits 1 (guards Req 2.4).
- `codegen-all` propagates a non-zero child exit as its own non-zero exit (matches the current script's fail-fast).

## Testing Strategy

Unit/example tests: name rule, CLI rejections and success in a temp Root, UTF-8/LF bytes, output and next-steps content, generalised depcruise rule, scaffold import scan, the shared-foundation identity + replay test, and the EXTENDING doc test. Integration: `pnpm check` and the quiz-sprint build. One property test (P1). Property tests use fast-check with `numRuns >= 100`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — a formal statement about what the system should do.*

### Property 1: The planner obeys the name rule, write scope and placeholder rule

For any string `name`, `planFiles(name)` either returns `{ ok: false }` exactly when `isValidName(name)` is false, or returns `{ ok: true, files }` where every file path is under `apps/<name>/` or equals `activities/<name>-sample.json`, no two files share a path, and no file's contents contain the substring `__APP_`.

**Validates: Requirements 1.1, 2.4, 3.1**
