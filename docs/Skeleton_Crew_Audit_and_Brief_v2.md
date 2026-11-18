# Skeleton Crew — Principal Architect Audit + Corrected Brief (v2.3)
Audit date: 18 Nov 2026 · Deadline: **Fri 4 Dec 2026, 2:00 PM PT = 11:00 PM WAT** (submit 3 Dec) · Builder: solo · Kiro credits: already obtained
Rules: verified against the official 2026 rules (updated 16 Nov 2026).
v2.3: competitor analysis, novelty claim and correctness claim corrected (§0a). The architecture is unchanged.

## 0. Fit verdict
**Good fit for Skeleton Crew. The original brief's scope was not buildable.** The category asks for "a skeleton code template lean enough to be clear but flexible enough to support various use cases", with two distinct applications in **2 separate repo folders**. The concept matches that. The original brief, though, specified a multi-tenant SaaS platform: 3–4 months of team work, not 16 solo days.

A Halloween look is **not** required for Skeleton Crew; Costume Contest is the category that judges spooky UI. A theme is optional polish.

**2026 judging criteria:**
- **Potential Impact:** a real problem for a real audience; useful, intuitive, accessible.
- **Technological Implementation:** how thoroughly and skilfully Kiro is used, with a variety of Kiro tools and experimentation.
- **Design:** a complete, coherent product, not a proof of concept.
- **Innovation/Idea:** novelty.
- **Presentation:** the video shows it working end to end and explains problem, audience and why it matters.

Rules warn that **insufficient use of Kiro = disqualification** at the judges' discretion.

**Problem framing (for Impact + Presentation):** AI coding agents can generate interactive learning and promo activities quickly, but the output can contain structural errors: branches that point nowhere, loops that trap players, invalid answer references, unsafe links. The toolkit **checks activity definitions against documented structural and supported semantic rules before playback**. These checks catch specified errors, such as missing references or prohibited cycles. They do **not** establish factual accuracy, accessibility, the correctness of custom code, or that every possible interaction behaves as intended. Property-based tests provide evidence for the properties tested; they are not a universal proof of correctness.

## 0a. Competitive position (corrected)
**Established capabilities — not our advantages:**
- **H5P** supports custom content types and developer extensions. **Lumi** provides offline H5P authoring and HTML/SCORM export. Open source, offline authoring and portable activities already exist.
- **Optimove Minigames (formerly Adact):** its documented MCP workflow generates playable minigames from natural-language prompts, previews them, and publishes them to its Minigames library. It requires an Optimove account with Minigames enabled. "AI creates playable marketing experiences" is therefore **not** our innovation. Its quality has not been independently tested here.
- **Genially:** gamified teaching and marketing content, branching, AI-assisted content (original brief §2).

**What we claim (replaces any "novel against existing platforms" wording):**
> The toolkit combines developer-extensible activity types, explicit validation, Kiro development instructions, and compact activity sharing through URL fragments. Whether this combination offers a meaningful advantage is unverified. The design still needs static hosting; it avoids a dedicated application backend for storing activities.

**Differentiation statement (use in README, submission and video):**
> Our hypothesis is that a small, inspectable toolkit with explicit validation and Kiro-specific workflows makes structured playable applications easier to build and maintain. We will claim an advantage only where comparative testing shows one.

**Comparison gate — no superiority claim until this has been run:**
| Alternative | Comparison task |
|---|---|
| H5P + Lumi | Create, modify, export and extend an equivalent activity |
| Twine | Build and distribute an equivalent branching experience |
| Plain React + Kiro | Implement the same custom mechanic plus a later requirement change |

Record development time, manual corrections, defects detected, extension effort and distribution limits. Report operator familiarity and other limits of the comparison.

**Schedule realism:** the full gate doesn't fit the 16 days. Before the deadline, run only the **Plain React + Kiro** comparison, time-boxed to 3 hours on Day 12. It's the one most relevant to Kiro judges. Report it with its limits: one operator, who is also the toolkit's author. H5P/Lumi and Twine go to `ROADMAP.md`. Until a comparison is run, the submission states the hypothesis, not an advantage.

How to read §1: each row is one problem (middle column) with its fix (right column).

---

## 1. Findings: problem → fix

### A. Scope and strategy
| # | Problem | Fix |
|---|---|---|
| A1 | The platform scope is impossible in 16 days. | **Static-first.** No application backend. Activities are JSON files in the repo (content-as-code). They are validated at build time, in CI and in the browser. |
| A2 | Server-dependent failure-register rows (tenant isolation, abuse hosting, upload pipeline, coupon fraud, ingest replay, concurrent edits, AI spend, ad networks) consume the design budget. | These **disappear** with static-first. Keep each one as a "v2 gate" in `ROADMAP.md`, not as built work. |
| A3 | Both apps are "pick a choice → reach an outcome". Judges will see one quiz in two skins. | The apps differ in **mechanic, state model and outcome** (§2). Each gets node types the other doesn't use. |
| A4 | Nothing proves the template is a *template*. It reads as a monorepo product. | Add a `pnpm create-app <name>` scaffold, `EXTENDING.md` (a new node type in ~50 lines), and a test showing one runtime fix changes both apps. |
| A5 | The original brief mentions Kiro only in a closing section. It never says which specs, steering rules or hooks get built, or how evidence is captured. Kiro is scored, and under-use can disqualify. | §5: a Kiro kit shipped **inside the template** for its users, plus specs, steering, a custom agent, MCP, property-based tests and a write-up that answers each rules question. |
| A6 | *(Optional.)* A plain UI. | Optional theme-token package. Working names: **Shop Challenge**, **Practice Path**. Add a spooky theme pack only if Day 12 has spare time. |
| A7 | The market/learning-science evidence and the pilot add no score before the deadline. | Move them to `ROADMAP.md` → "Validation plan". Keep the honest labels. The comparison gate is in §0a. |
| A8 | Quizzes and bundle pickers look less striking than last year's webcam-gesture winner, which hurts the Design and Presentation scores. | Make both apps feel like games: animated feedback, progress, a satisfying end screen. Show **Kiro generating a new activity live, the validator catching a structural error, and Kiro fixing it**. |
| A9 | Overclaiming novelty or correctness would be checkable and false (H5P/Lumi, Optimove MCP). | Use only the §0a wording in README, submission, video and blog. |

### B. Runtime and schema contradictions
| # | Problem | Fix |
|---|---|---|
| B1 | "Reject automatic cycles" contradicts "wrong answer → explanation → retry". A retry *is* a back-edge, and "automatic" is undefined. | The authored graph **must be a DAG** (topological sort in the validator). Retry and review are **runtime policy**, not edges: `onIncorrect: { explanationId?, maxRetries: 0–3 }` plus a `review` phase that replays wrong nodes once, with effects skipped. |
| B2 | "Conditions use allowlisted operations" has no state to read. The manifest has no variables. | Add declared `variables` plus a closed condition AST (`eq/gte/lte/includes/and/or/not`). Every ref is type-checked against its declaration. AST depth ≤ 8. Edges are first-match, and the last edge must be unconditional. |
| B3 | Bundle-building fits no listed node type. `choice` is single-select, and `outcome` can't compute recommendations. | `collection` (items with attrs) plus a `select` config `{min, max, budgetAttr?, budgetMax?}` plus a declarative `recommend {where, sortBy, limit}` on the outcome. The validator checks that `budgetAttr` is numeric on every item. |
| B4 | A closed JSON Schema contradicts plugin node types. A monolithic schema defeats the extension contract. | `NodeType` registry (§3). Per-app schema = `oneOf` over registered `configSchema`s, discriminated on `type`, composed at build time. The manifest declares `requires: {type: version}`, and the player rejects unknown types with a clear message. |
| B5 | Ajv compiles schemas with `new Function`, which breaks a strict CSP (it needs `unsafe-eval`) and bloats the bundle. | **Precompile validators at build time** with Ajv standalone code generation. Ship the generated code. No runtime compilation, no `unsafe-eval`. |
| B6 | "Pure transitions" — but shuffling and timestamps are impure. | `reduce(state, action, env: {now, rng})` with a seeded RNG. The seed is stored in the attempt. Replays are deterministic and testable. |
| B7 | Version pinning has no defined home for attempt state. | `AttemptRecord {attemptId, activityId, version, manifestHash, seed, state, status}` in localStorage. Key Practice Path's **mistake history by stable item ID**, not by version, so edits don't wipe history. |
| B8 | "Bound transitions" has no defined outcome when the bound is hit. | Require `fallbackOutcomeId`. When `maxTransitions` is exceeded, go there and emit `limit_reached`. |
| B9 | "Immutable runtime pairing" contradicts "one fix benefits both". | Pin **manifests**, not the runtime. Add `schemaVersion` upgraders (`v1→v2`), plus a CI fixture corpus that replays recorded action logs per schema version. |
| B10 | A strict schema refuses half-written drafts. | Drafts use a permissive `DraftDoc` schema. Validation returns `Diagnostic[]` and blocks **only** export/publish. |
| B11 | Live data (availability, expiry) sits inside an immutable manifest. | Snapshot data at build time, with "prices as of {date}". `validUntil` → "offer ended" screen. Copy states that the merchant page is the source of truth. Client-side expiry is cosmetic, and the copy says so. |

### C. Security, privacy, compliance
| # | Problem | Fix |
|---|---|---|
| C1 | CTA URLs from an imported manifest can be `javascript:`. | `https:` only, enforced in the schema **and** the renderer (this allows `https://wa.me/...` WhatsApp links). Never `dangerouslySetInnerHTML`. `rel="noopener noreferrer"`. |
| C2 | Imported JSON is untrusted. | Size cap and node-count cap **before** parsing into the graph checks. Closed schemas. Text-only rendering. |
| C3 | The original brief plans to store learner records and reports. Its only legal check is US COPPA. Nigeria's NDPA 2023 is never considered, and learners may be under 18. | **Collect no personal data** in the hackathon build: no accounts, no names, no analytics sent anywhere. Progress lives only on the user's device. `PRIVACY.md` states this. Use made-up demo data only. A pilot with real users comes later, after an NDPA (and, if relevant, GDPR) privacy check. |
| C4 | Asset IP. The rules also ban third-party trademarks and copyrighted music in the video. | CC0/OFL or your own assets only, listed in `ASSETS.md`. Use royalty-free or no music in the video. Don't put product brand logos in demo data. |
| C5 | Agent hooks aren't an enforcement boundary. Hooks that auto-edit several files can also corrupt the registry. | CI (GitHub Actions) runs validation, tests and `pnpm audit`. Hooks must be idempotent and limited to named files. CI catches a bad hook edit. Commit the lockfile. |

### D. Delivery and rule compliance
| # | Problem | Fix |
|---|---|---|
| D1 | Two apps need two URLs, but a GitHub repo gets **one** Pages site. | **Two Vercel projects** from one repo with different Root Directories (see the architecture spec). Verify both URLs on a clean device. |
| D2 | "Independently runnable" is ambiguous in a workspace. | Each app builds via `pnpm --filter <app> build` from a clean clone. Document this in the README. |
| D3 | `.kiro` gets gitignored (the rules say this can disqualify), or the license isn't detected in the About section. | Check a clean clone. MIT `LICENSE` at the root, confirmed visible in About. |
| D4 | Demo overload. The rules also require showing the app on the device it was built for. | Script in §6: desktop browser plus one phone clip. Show only what works. |
| D5 | Pre-existing work. New projects only (from 30 Oct). | Fresh repo now. Disclose any reused Odin Project code. |

---

## 2. What to build

| | **Shop Challenge** | **Practice Path** |
|---|---|---|
| Real audience | Small online sellers (e.g., Instagram/WhatsApp shops) | Tutors and lesson creators |
| Folder | `apps/shop-challenge` | `apps/practice-path` |
| Mechanic | Bundle builder: multi-select under budget/occasion/max-item constraints | Retrieval loop: answer → explanation → wrong items join a review queue |
| State | Cart plus constraint checks | Per-item mistake history across sessions |
| Outcome | Recommended bundle + https CTA (merchant site or `wa.me` WhatsApp link) | Mastery summary + next review set |
| Own node types | `collectionSelect`, `recommendOutcome` | `recall`, `reviewQueue` |
| Shared | runtime, schema composer, graph validator, renderer, theme tokens, scaffold, Kiro kit | same |

## 3. Core contracts

```ts
type NodeId = string;
type VarDecl = { id: string; type: 'number'|'boolean'|'enum'; initial: unknown; min?: number; max?: number; values?: string[] };
type Ref = { answer: NodeId } | { var: string };
type Cond = { op: 'eq'|'gte'|'lte'|'includes'; ref: Ref; value: string|number|boolean }
          | { op: 'and'|'or'; args: Cond[] } | { op: 'not'; arg: Cond };
type Edge = { to: NodeId; when?: Cond };            // first match wins; last edge unconditional

interface Manifest {
  schemaVersion: number; profile: 'shop-challenge'|'practice-path'|string;
  activityId: string; version: number; requires: Record<string, number>;
  entryNodeId: NodeId; fallbackOutcomeId: NodeId;
  limits: { maxNodes: number; maxTransitions: number };
  variables: VarDecl[]; collections?: Collection[]; nodes: Node[];
  theme: string; validUntil?: string;
}

interface NodeType<C, R> {
  type: string; version: number;
  configSchema: JSONSchema; responseSchema: JSONSchema;   // closed
  validate(cfg: C, ctx: GraphCtx): Diagnostic[];
  reduce(cfg: C, s: AttemptState, r: R, env: { now: number; rng: SeededRng }): AttemptState;
  Render: React.FC<{ cfg: C; onRespond(r: R): void }>;
}
```
Rules: `packages/runtime` imports no app and no React (the `Render` part lives in each node type's UI module). The validator runs schema → size caps → unique IDs → dangling refs → DAG → every node reaches a terminal → type-checked conditions.

## 4. Repo layout
See `Architecture_and_UI_Spec.md` §A6 (authoritative).

## 5. Kiro plan (Technological Implementation + disqualification risk)
See `Kiro_Setup_and_Operating_Playbook.md` (authoritative for setup, hooks and evidence).

**Principle taken from the 2025 winner:** the `.kiro` folder is a **product feature of the template**, not just evidence. Anyone who clones the template gets Kiro automation that runs the toolkit's checks on new apps and activities.

| Kiro feature | What we build |
|---|---|
| **Specs** | runtime, validator, shop-challenge, practice-path, create-app |
| **Steering** | architecture, security, activity-authoring, testing, and a new-node-type recipe |
| **Hooks** | validate agent-written activities; runtime regression tests; node-type wiring; post-task check (manual edits are covered by pre-commit + CI) |
| **Custom agent** | `activity-author` (writes manifests only) |
| **MCP** | Context7 for accurate library docs |
| **Property-based testing** | (a) any manifest that passes validation reaches an outcome within `maxTransitions` for every *generated* answer sequence tested; (b) the validator doesn't crash on generated random JSON; (c) same seed + actions → same result. These are evidence for the properties tested, not a proof of correctness. |
| **Powers / CLI / Crew / Web** | Only where genuinely tried; described honestly. |

## 6. Demo (≤ 2:50)
- **0:00** Problem: "AI can generate activities fast, but they can ship with structural errors."
- **0:20** Shop Challenge: build a bundle → WhatsApp CTA, shown on a phone.
- **0:55** Practice Path: wrong answer → it returns in the review round.
- **1:30** In Kiro, ask `activity-author` for a new activity → the hook flags a broken branch → Kiro fixes it → it plays.
- **2:05** `create-app` + the new-node-type hook wiring files automatically; a property test catches a bug.
- **2:40** Links + the honest differentiation statement (§0a).

No copyrighted music. Publish publicly on YouTube.

## 7. MUST / SHOULD / CUT
- **MUST:**
  - runtime + registry + validator + tests
  - two apps with distinct mechanics
  - scaffold + EXTENDING.md
  - https-only, strict schema, precompiled validators
  - `.kiro`: specs, steering, 4 hooks, custom agent, MCP config
  - property tests
  - KIRO_LOG + KIRO_WRITEUP
  - MIT license visible in About
  - two live URLs
  - README with clean-start steps and a GIF of each app
  - PRIVACY.md
  - §0a wording everywhere
- **SHOULD:**
  - form editor with JSON import/export
  - keyboard path + axe scan + non-drag controls
  - CI
  - ASSETS.md
  - schema upgrader fixture
  - **Plain React + Kiro comparison (3 h, Day 12)**
  - optional theme pack
  - Social Blitz post + blog post (§11)
- **CUT (→ ROADMAP.md):**
  - Postgres, object storage, CDN, auth, multi-tenancy, uploads
  - service worker / offline
  - runtime AI adapter
  - analytics ingest
  - versioned publishing pipeline
  - matching and sequencing nodes
  - **H5P/Lumi and Twine comparisons**
  - pilot
  - ad formats and rewards

## 8. 16-day plan
| Day | Date | Work |
|---|---|---|
| 1 | 18 Nov | Repo, MIT, `.kiro`, steering, MCP config, pnpm workspace, CI skeleton. Start KIRO_LOG. |
| 2 | 19 Nov | Runtime spec; schema composer; Ajv standalone build step; try one Kiro power if relevant |
| 3 | 20 Nov | Runtime reducer + registry (content/choice/outcome); seeded env; unit tests |
| 4 | 21 Nov | Graph validator; property tests (fast-check); hooks 1 and 2 |
| 5 | 22 Nov | Shared accessible renderer + theme tokens; node-type wiring hook |
| 6 | 23 Nov | Shop Challenge spec; `collectionSelect`, `recommendOutcome` |
| 7 | 24 Nov | Shop Challenge UI; https/WhatsApp CTA; **deploy URL #1** |
| 8 | 25 Nov | Practice Path spec; `recall`, `reviewQueue`; localStorage by item ID |
| 9 | 26 Nov | Practice Path UI; **deploy URL #2**. *If both URLs aren't live, cut Day 11.* |
| 10 | 27 Nov | `create-app` scaffold; EXTENDING.md; `activity-author` custom agent; shared-fix test |
| 11 | 28 Nov | Form editor + JSON import/export (SHOULD); game-feel polish |
| 12 | 29 Nov | Keyboard/axe pass; real Android check; app GIFs; **Plain React + Kiro comparison (3 h)**; optional theme |
| 13 | 30 Nov | Feature freeze; script + record demo |
| 14 | 1 Dec | Edit, caption, upload public video |
| 15 | 2 Dec | README, KIRO_WRITEUP, docs; blog + social post; clean-clone test |
| 16 | 3 Dec | **Submit.** 4 Dec (closes 11 PM WAT) = buffer |

## 9. Residual risks (accepted)
- Answer keys are visible in the client. Acceptable for practice; no exam claims.
- localStorage can be evicted. The UI says "saved on this device — export to keep".
- Mistake history is per device.
- No evidence yet of conversion or learning gains. The README says so.
- No comparative evidence of advantage unless the §0a gate is run. Claims stay hypotheses.
- Validation covers specified structural and semantic rules only. It does not check factual accuracy or accessibility.
- Visual "wow" is lower than a computer-vision app. This is countered by game feel and the live Kiro-flags-a-broken-activity moment.

## 10. Lessons from the 2025 winner (InteractionKit, 1st overall)
**Adopt:**
- The template plus a Kiro kit is the product. Hooks automate the repetitive wiring when you add a unit of extension (their gestures → our node types).
- Two short specs → two complete apps built on the template.
- A developer-pain framing → ours: agents can generate activities with structural errors.
- Steering that keeps layers separate.
- MCP (Context7) for accurate library docs.
- A one-command setup, a GIF per app, a per-feature "How we used Kiro" table, and a dev.to post.

**Improve on:**
- Judges can test us with a URL.
- Use 2026 features (custom agent, property-based testing, CLI).
- Prove claims with tests and logs, and **scope them precisely**. They claimed "without hallucinations" and "production ready"; we state exactly what our checks do and don't cover.
- Build accessibility in.

**Avoid:**
- Overclaiming novelty or correctness.
- Hooks that silently rewrite many files without CI checks.
- Demo dependence on hardware.

## 11. Bonus prizes
- **Social Blitz** (5 winners): the post must **start with** `#KiroweenHackathon26`. Share your favourite Kiro feature and how it changed your approach. Post during the period; link it in the form.
- **Bonus Blog** (100 winners, 2,000 credits): a dev.to or Hashnode post that says it is written for Kiroween 2026. Repurpose KIRO_WRITEUP.
- **Best Student Project: Skeleton Crew** ($1,500): only if you are currently enrolled. Proof may be requested.
- **Best Demo:** automatic.
- Not applicable: Startup, Ghost of Kiroween Past, Kiro Crew App.

## Sources added in v2.3
- [H5P developer docs](https://h5p.org/developers)
- [Optimove Academy — How to create a minigame using Optimove MCP](https://academy.optimove.com/hc/en-us/articles/38090805607837-How-to-Create-a-Minigame-Using-Optimove-MCP)
- [Optimove developer docs — MCP Minigame Creation](https://developer.optimove.com/docs/mcp-minigame-creation)
