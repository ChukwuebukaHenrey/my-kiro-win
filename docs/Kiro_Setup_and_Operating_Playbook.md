# Kiro Setup & Operating Playbook — Skeleton Crew
Date: 18 Nov 2026 · Companion to the brief (v2.2) and `Architecture_and_UI_Spec.md`. Where they differ, this doc is authoritative for **how Kiro is set up and used**.
Kiro facts were checked against kiro.dev docs on 18 Nov 2026. File formats change between versions: if your installed Kiro creates a file differently, use what it creates and commit that.

---

## 1. Which Kiro surface to use

| Surface | Use it for | Verdict |
|---|---|---|
| **Kiro IDE (desktop app)** | Specs, steering, hooks panel, chat, building the apps. It's what last year's winner used. Gives the clearest screenshots for KIRO_LOG and the video. | **Primary.** Do 90% of the work here. |
| **Kiro CLI** | Runs natively on Windows 11, installed from **PowerShell** (`irm 'https://cli.kiro.dev/install.ps1' \| iex`). Has a headless mode for CI. | **Secondary.** Use it 2–3 times on purpose (e.g., headless validation, or a custom agent run in the terminal) so the write-up can answer "how did IDE and CLI differ?" |
| **Git Bash** | Fine for git, pnpm and running scripts. | **Not for kiro-cli.** On Windows, kiro-cli runs shell commands through PowerShell, and there's no setting yet to switch it to Git Bash (open feature request). |
| **Kiro Web (cloud sessions)** | Delegating a task to a cloud sandbox. | **Optional.** It needs a Pro-or-higher plan. Skip unless your account has it. |
| **Kiro Crew** | Long-running, multi-agent orchestration. | **Skip, or one small experiment at most.** Users report it burns credits faster. Its bonus prize needs a Crew app, which we aren't building. |

**Consequence for our scripts:** every hook command and package script must be shell-neutral (`pnpm validate`, `node tools/validate/index.mjs`). No bash-only syntax (`&&` chains with `export`, `$(...)`, `grep`), because hooks may run under PowerShell.

## 2. One-time setup (Day 1, ~2 hours)
1. **Install Node 22 LTS, Git for Windows, and pnpm** (`npm i -g pnpm`). Verify in PowerShell *and* Git Bash: `node -v`, `pnpm -v`, `git --version`.
2. **Install the Kiro IDE** from kiro.dev/downloads, and sign in with the account that received your hackathon credits. Confirm the credits show in your account.
3. **Install the Kiro CLI** in PowerShell: `irm 'https://cli.kiro.dev/install.ps1' | iex` → `kiro-cli --version` → `kiro-cli login`.
4. **Create the GitHub repo** (public, **MIT** license chosen at creation so the About panel detects it). Clone it and open the folder in the Kiro IDE.
5. **Check `.gitignore`.** It must NOT contain `.kiro` (the rules say that can disqualify you). Ignore `node_modules`, `dist` and `.env*` only.
6. **Model/credit discipline:** use Auto or a mid-tier model for routine edits. Save the top model for specs and the graph validator. Check credit usage at the end of each day; target ≤ 250 credits/day.
7. **Commit `chore: init repo + .kiro`.** This is the first dated evidence the project started within the Submission Period.

## 3. What goes in `.kiro/` (exact files)

```
.kiro/
  steering/
    product.md          (always)   what we build, for whom, non-goals
    tech.md             (always)   stack + versions + commands
    structure.md        (always)   repo layout + import rules
    security.md         (always)   https-only, no innerHTML, no eval, no personal data
    activity-authoring.md (fileMatch: activities/**/*.json) how to write a valid manifest
    testing.md          (fileMatch: **/*.test.ts) Vitest + fast-check conventions
    new-node-type.md    (manual → runs as /new-node-type) step-by-step recipe
  specs/
    runtime/            requirements.md design.md tasks.md
    schema-validator/
    shop-challenge/
    practice-path/
    create-app/
  hooks/
    validate-activities.json
    runtime-regression.json
    node-type-wiring.json
    post-task-check.json
  settings/
    mcp.json
  agents/
    activity-author.(json)   ← created via Kiro's custom-agent flow; commit what it generates
```

### 3a. Steering front matter (verified format)
The front matter must be the **very first lines** of the file:
```yaml
---
inclusion: always
---
```
```yaml
---
inclusion: fileMatch
fileMatchPattern: "activities/**/*.json"
---
```
```yaml
---
inclusion: manual
---
```
A manual file is pulled in with `#new-node-type` in chat, or run as `/new-node-type`.

**Content rules for steering** (from last year's winner, improved):
- Short, imperative, testable rules ("The runtime must not import from `apps/` or `react`"), not essays.
- Every steering rule that matters is **also enforced in CI**: dependency-cruiser for imports, ESLint `react/no-danger`, the validator for manifests. Steering *guides* Kiro; CI *enforces*.

### 3b. Hooks — corrected design
**Important (changes brief §5):** Kiro's file triggers respond **only to changes the agent makes**. Your own edits in the editor do **not** fire File Create/Save/Delete hooks. So:
- Hooks validate everything **Kiro writes**. That's the demo story: Kiro writes a bad activity → the hook catches it → Kiro fixes it.
- **Your manual edits** are covered by `pnpm validate` in a git pre-commit hook (`simple-git-hooks`) **plus CI**. Never rely on Kiro hooks alone.

Hook files are JSON in `.kiro/hooks/<id>.json`. Each has a trigger, an optional regex matcher, and an action that is either a shell `command` or an `agent` prompt. **A command action receives event context as JSON on STDIN**, so `tools/validate` should read STDIN to get the changed file path.

`validate-activities.json`
```json
{ "version": "v1", "hooks": [ {
  "name": "validate-activities",
  "trigger": "PostFileSave",
  "matcher": "activities[\\\\/].*\\.json$",
  "action": { "type": "command", "command": "pnpm -s validate --stdin" },
  "timeout": 30, "enabled": true
} ] }
```
The `[\\\\/]` in the matcher accepts both `/` and Windows `\` paths.

`runtime-regression.json`
```json
{ "version": "v1", "hooks": [ {
  "name": "runtime-regression",
  "trigger": "PostFileSave",
  "matcher": "packages[\\\\/](runtime|schema|node-types)[\\\\/].*\\.ts$",
  "action": { "type": "command", "command": "pnpm -s test:shared" },
  "timeout": 120, "enabled": true
} ] }
```

`node-type-wiring.json`. This is an agent prompt, our equivalent of InteractionKit's gesture hooks:
```json
{ "version": "v1", "hooks": [ {
  "name": "node-type-wiring",
  "trigger": "PostFileSave",
  "matcher": "node-types[\\\\/][^\\\\/]+[\\\\/]index\\.ts$",
  "action": { "type": "agent", "prompt": "A node type file changed. Follow #new-node-type: ensure it is registered exactly once in the registry, has a closed configSchema, a reduce() unit test and a fast-check property, and an entry in EXTENDING.md. Edit only those files. Then run pnpm -s test:shared and report." },
  "enabled": true
} ] }
```

`post-task-check.json`. When a spec task finishes, run the full gate:
```json
{ "version": "v1", "hooks": [ {
  "name": "post-task-check",
  "trigger": "PostTaskExecution",
  "action": { "type": "command", "command": "pnpm -s check" },
  "timeout": 300, "enabled": true
} ] }
```

**Hook safety rules:**
- Agent-prompt hooks name the exact files they may edit.
- Every hook is idempotent (safe to run twice).
- CI re-checks everything. If a hook misfires, disable it (`"enabled": false`) and log why in KIRO_LOG: that's honest evidence too.

**Verify triggers on your version.** Trigger names differ between IDE versions (e.g., `PostTaskExecution` may not exist in yours). On Day 1, create each hook through the IDE's Agent Hooks panel by describing it to Kiro, then compare the JSON it generates with the above and keep Kiro's field names.

### 3c. MCP — `.kiro/settings/mcp.json`
```json
{ "mcpServers": {
  "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
} }
```
- **Purpose:** current docs for React 19, TypeBox, Ajv standalone, fast-check, Vite, Tailwind v4 and shadcn, so Kiro doesn't invent APIs. This mirrors the winner's use of Context7 for MediaPipe.
- **Optional second server:** the GitHub MCP, for opening issues and PRs. Only if it helps; don't add servers for show.

### 3d. Custom agent — `activity-author`
- **Job:** turn "a topic + 5 facts" or "a product list" into **one manifest JSON** in `activities/`, nothing else.
- **Config:** a prompt that includes `#activity-authoring`, a tool scope limited to file read/write in `activities/`, and no shell.
- **Proof:**
  - Run it in the IDE once.
  - Run it in the CLI once (`kiro-cli` with the agent), so the write-up can compare surfaces.
  - The validate hook checks its output either way.

## 4. Spec-driven workflow (how each spec is run)
For each spec (runtime → schema-validator → shop-challenge → practice-path → create-app):
1. **Requirements:** in the IDE, start a new Spec, paste the matching section from the brief and architecture doc, and let Kiro draft `requirements.md`. **Edit it yourself:** cut anything out of scope and make every requirement testable ("WHEN a manifest has a cycle THEN validation SHALL return error `GRAPH_CYCLE` naming the nodes").
2. **Design:** Kiro drafts `design.md`. Check it against the architecture doc's contracts (`NodeType`, `Manifest`, routes). Reject any server, any `eval`, and any new dependency not in the stack table.
3. **Tasks:** Kiro drafts `tasks.md`. Make sure every task ends with a test, and that property tests are separate tasks (they're a 2026 judging question).
4. **Execute** tasks one at a time. After each, the post-task hook runs `pnpm check`. If it's red, fix it with Kiro in the same session.
5. **Log it:** for at least one interesting task per spec, add a KIRO_LOG entry (§6).

**Spec vs vibe coding (for the write-up):** vibe-code the landing pages and visual polish, and spec the runtime, validator and apps. Write down one concrete case where the spec prevented a bug that vibe coding introduced.

## 5. Daily operating loop (≈ 6–8 h days)
1. **Start:** `git pull`. Open the IDE. Pick today's spec tasks from the 16-day plan.
2. **Build:** execute spec tasks. Let hooks run; don't bypass red checks.
3. **Mid-day:** run the app on your Android phone via the Vercel preview URL.
4. **End:** `pnpm check` → commit with a clear message → push (Vercel deploys a preview).
5. Add 1–2 KIRO_LOG entries with screenshots. Note credits used.

## 6. Evidence — KIRO_LOG.md entry template
```
## 2026-11-21 — Graph validator: unreachable outcome
Spec: schema-validator / task 3.2
Kiro did: generated reachability check from requirement R4
Caught by: fast-check property "valid ⇒ terminates" failed with seed 1834 (screenshot)
Fix: Kiro patched BFS to include review-phase edges; test green (screenshot)
Kiro features: spec task, post-task hook, PBT, Context7 lookup (fast-check API)
```
Save screenshots to `docs/kiro-evidence/` (committed). Videos are optional; screenshots are enough.

## 7. KIRO_WRITEUP.md — answer every rules question
| Rules question | What we'll show |
|---|---|
| IDE / CLI / Web / Crew | IDE primary; CLI for headless validation and the custom agent; honest notes on the differences. Web/Crew only if actually tried. |
| Custom agents | `activity-author`: its scope, an example run, and the validator catching its mistakes |
| Agent hooks | The 4 hooks, what each automated, and a before/after example (node-type wiring took N files → 1) |
| Spec-driven development | Spec structure; one bug a spec prevented; comparison with vibe-coded parts |
| Steering | Always / fileMatch / manual split; the security rules that stopped `innerHTML` suggestions |
| MCP | Context7: a concrete API Kiro got right because of it (Ajv standalone) |
| Property-based testing | 3 properties; the real bug the "valid ⇒ terminates" property found |
| Kiro powers | Only if one is genuinely used. Otherwise say so. |

## 8. What we adopt from last year's winner, and what we do better
| InteractionKit (2025 winner) | Ours |
|---|---|
| 3 hooks automate wiring when a gesture is added | Hook wires a new **node type** (registry, schema, test, docs), plus validation hooks |
| 2 steering docs (architecture, testing) | 7 steering files across always/fileMatch/manual, each rule backed by a CI check |
| Context7 MCP for MediaPipe docs | Context7 for Ajv/TypeBox/fast-check/React 19 |
| Two simple specs → two apps | Five specs; each app spec builds on the template's specs |
| Vibe sessions for the skeleton | Vibe-code only the UI polish; spec the core |
| No PBT, no custom agent, claims unproven | PBT, a custom agent, the CLI used too, and KIRO_LOG evidence for each claim |
| `.kiro` shipped as part of the template for its users | Same. The README section "Using this template with Kiro" explains each hook and steering file. |

## 9. Changes this playbook makes to earlier docs
- **Brief §5 hooks:** file hooks fire only on agent edits, so a pre-commit hook + CI now cover manual edits (`simple-git-hooks` added to the stack). There are 4 hooks, not 3.
- **Stack:** add `simple-git-hooks`. All scripts must be shell-neutral (Node), because hooks may run in PowerShell.
- **Repo:** add `docs/kiro-evidence/`.
- **Day 1:** sections 2 and 3 of this playbook.
