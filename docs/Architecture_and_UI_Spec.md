# Skeleton Crew — Architecture, Tech Stack & UI Spec (v1.1)
Date: 18 Nov 2026 · Companion to `claude/Skeleton_Crew_Audit_and_Brief_v2.md`.
This doc is **authoritative for architecture**. It supersedes brief §3–§4 where they differ, and settles brief D1 in favour of Vercel.
v1.1: competitor and novelty wording corrected to match brief v2.3 §0a. The architecture is unchanged.

---

## Part A — Backend architecture

### A1. The decision: no application backend. The activity lives in the link.
**Options considered**

| | A. No application backend (chosen) | B. Thin BaaS (Supabase: Postgres + Auth + Storage) |
|---|---|---|
| How sharing works | The whole activity is compressed into the URL **fragment** (`/play#a=…`). Browsers don't send the fragment to the server in HTTP requests. | Publish → DB row → short link |
| Build cost | ~0 extra days | +4–5 days (auth, RLS, storage, abuse controls, quotas) |
| Failure surface | Validator + safe rendering + static hosting | Tenant isolation, uploads, abuse hosting, rate limits, backups, keys |
| Privacy (NDPA) | No activity or learner data is stored server-side by us | Personal data processing → lawful basis, notice, retention |
| Judge testing | Open a link; works as long as the static hosting stays up | Also depends on the database free tier staying active through judging (Dec–Jan) |
| What we lose | Author-side analytics, uploaded images, short links | — |

**Why A wins for this hackathon:**
- **The core user job still works.** A seller or tutor makes an activity and sends a link on WhatsApp.
- **It removes most of the failure register.**
- **There's less to keep running through the 6-week judging window** (16 Dec → 29 Jan): static hosting only, no database or auth service.

**What A is not:** a novelty claim. Open source, offline authoring and portable activities already exist (H5P with Lumi export). AI-generated playable marketing games already exist (Optimove Minigames via MCP). Static hosting is still required; A only avoids a dedicated backend for storing activities. Positioning wording is in brief v2.3 §0a; use only that wording.

Option B is designed in §A8 as the v2 path, so the jump is planned, not improvised.

### A2. What "backend" means here (four layers)

| Layer | Technology | Job |
|---|---|---|
| 1. Contract | **TypeBox** schemas → JSON Schema + TS types | One source of truth for the manifest |
| 2. Build pipeline | **Node 22 scripts + Ajv standalone codegen + Vite** | Generate validators, validate `activities/*.json`, build the apps |
| 3. Quality gate | **GitHub Actions** | Typecheck, lint, architecture rules, tests, PBT, e2e, a11y, audit |
| 4. Delivery | **Vercel** (2 projects, 1 repo) + `vercel.json` headers | Static hosting with CSP and security headers per app |

### A3. Each technology — what and why

**Language and repo**
| Tech | Why this, not something else |
|---|---|
| **TypeScript (strict)** | The runtime, validator and apps share types. Strict mode catches some graph and state bugs at compile time, which matters for Kiro-generated code. |
| **pnpm workspaces** | Strict dependency isolation. A package can't use a dependency it didn't declare, so the runtime can't secretly lean on React. `pnpm --filter` builds each app alone (rules: two separate app folders). No Turborepo or Nx: too much tooling for a solo 16-day build. |
| **Node 22 LTS** | Runs the scripts (`validate`, `create-app`, codegen). It has native `fetch` and `crypto`. |

**Schema and validation**
| Tech | Why |
|---|---|
| **TypeBox** | Write the schema once and get both a JSON Schema and a TS type. Hand-writing JSON Schema plus separate TS types (or Zod plus JSON Schema) drifts. |
| **Ajv (standalone code generation)** | A mature, fast JSON Schema validator. **Standalone mode** generates validator code at build time, so there's no `new Function` at runtime: a strict CSP works and the bundle stays smaller (brief B5). |
| **Custom graph validator** (our code, `packages/schema/graph.ts`) | JSON Schema can't express "DAG", "every node reaches an ending" or "references exist". It checks the specified structural and semantic rules only (brief §0). It's what the property tests attack. |

**Link transport ("the backend in the URL")**
| Tech | Why |
|---|---|
| **Native `CompressionStream('deflate-raw')` + base64url** | Zero dependency, built into modern browsers (Chrome, Edge, Firefox, Safari 16.4+). Estimated ≈ 0.8–2 KB in the link for a 5-product or 8-question activity; measure on Day 7. |
| **Format** `#a=1.<base64url>` | The `1` is the link-format version, so formats can change later without breaking old links. |
| **Hard caps** | Encoded ≤ 8 KB; decoded JSON ≤ 64 KB, checked **before** parsing (brief C2). |
| **SubtleCrypto SHA-256** | `manifestHash` = hash of canonical JSON. Keys the attempt and progress records (brief B7). Needs HTTPS, which Vercel provides. |

**Device storage**
| Tech | Why |
|---|---|
| **localStorage via a tiny wrapper** (`packages/storage`) | Drafts, attempts and mistake history are small (KB). IndexedDB adds complexity for no gain here. The wrapper does try/catch, JSON versioning and quota-error handling, and returns `{ok, error}` so the UI can show an honest "Not saved" state. |

**Hosting and security**
| Tech | Why |
|---|---|
| **Vercel**, 2 projects from 1 repo (Root Directory = `apps/shop-challenge`, `apps/practice-path`) | Two URLs from one repo (brief D1). Unlike GitHub Pages, it lets us set **real HTTP security headers**: a CSP meta tag can't do `frame-ancestors`. Free tier, preview deploys per PR, and you have the Vercel connector. |
| **`vercel.json` headers** | `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` · `Referrer-Policy: no-referrer` · `X-Content-Type-Options: nosniff` · `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| **SPA rewrite** | All routes → `index.html`, so `/play` and `/create` work on refresh. |

**Quality gate**
| Tech | Why |
|---|---|
| **Vitest** | Fast, Vite-native unit tests. |
| **fast-check** | Property-based tests (a 2026 judging question): valid activities terminate for the generated answer sequences tested; the validator doesn't crash on generated random JSON; replays are deterministic. Evidence for these properties, not a proof of correctness. |
| **Testing Library** | Component tests by role and label, which double as accessibility checks. |
| **Playwright + @axe-core/playwright** | End-to-end flows (create → share link → open → play → result) on desktop and a mobile viewport. Automated a11y scan, which can't catch every a11y issue: manual keyboard and screen-reader checks are still needed. |
| **dependency-cruiser** | **Enforces** the steering rule "runtime never imports apps or React" in CI. Steering guides Kiro; this blocks violations. |
| **ESLint (flat) + jsx-a11y + Prettier** | Catches some a11y mistakes while writing. Bans `dangerouslySetInnerHTML` via `react/no-danger`. |
| **GitHub Actions** | Order: install (frozen lockfile) → typecheck → lint → depcruise → codegen → validate activities → unit + PBT → build both apps → Playwright + axe → `pnpm audit --prod`. |

### A4. Runtime data flow
```
AUTHOR (/create)                       PLAYER (/play#a=1.xxx)
Form edits ──► Draft (permissive)      URL fragment
   │            saved to localStorage      │ 1. size cap (8 KB)
   ▼                                       │ 2. base64url → inflate → size cap (64 KB)
Validate: schema → caps → IDs →            │ 3. JSON.parse
   refs → DAG → reachability → conds       │ 4. schemaVersion upgrade (v1→vN)
   │ diagnostics shown inline              │ 5. Ajv validate (precompiled)
   ▼ (only if 0 errors)                    │ 6. graph validate
Canonical JSON → deflate → base64url       │ 7. SHA-256 → load attempt by hash
   ▼                                       ▼
Share: copy link · WhatsApp · QR      Runtime reducer(state, action, {now, rng})
                                          ▼
                                      Outcome → CTA (with destination disclosure)
                                             or Summary (+ "send result to tutor")
```
- **Editing a shared activity:** "Remix" loads the link's manifest into a new local draft. Content in a link is immutable by nature, so **brief B9's versioning pipeline is no longer needed**: a new edit means a new link.
- **Bundled demos:** `activities/*.json` are built into each app at `/play/demo/<id>`, with no fragment needed. These are the judge-facing demos.

### A5. New loopholes this design creates, and their fixes
| Problem | Fix |
|---|---|
| **Phishing via our domain.** Anyone can craft a link with a CTA to a scam site, shown under our app's URL. | The CTA shows its destination before leaving ("Opens **wa.me** · chat with 0803…"). The footer says "Made by the sender, not verified by Shop Challenge". `https:` only, and no URL shorteners in the CTA (block a known-shortener list in the validator). |
| **QR codes fail on long links.** A dense QR won't scan. | Generate a QR only when the link ≤ 1,200 chars. Otherwise show "Link too long for a QR code — share the link instead". The validator shows the current link size in the editor. |
| **No per-activity link preview.** WhatsApp can't read the fragment, so every link shows the app's generic card. | A good generic Open Graph image and title per app. The share text includes the activity title: "Try my Valentine gift challenge 🎁 …". |
| **Third-party images leak the player's IP** and can break the CSP. | Default to the built-in emoji and illustration set. Allow `https:` image URLs only with a note ("Images load from the seller's host"). `img-src https:` only, never scripts. |
| **Some chat apps truncate very long URLs.** | 8 KB cap. Test the actual WhatsApp Android path on Day 12. |
| **Author analytics are gone** (starts, completions, clicks). | Be honest in the UI and README: "No tracking — v2 adds opt-in stats." Practice Path gets **user-initiated result sharing** instead: the learner taps "Send result to tutor" → `wa.me` text with score and missed topics (the Wordle-share pattern). No server, explicit consent. |
| **localStorage gets blocked or evicted** (private mode, storage full). | The wrapper returns errors, and the UI shows "Not saved on this device — export your draft". Export/import JSON is always available. |
| **Malicious manifests in links** | Same pipeline as imports: size caps → strict schema → graph checks → text-only rendering → https-only links (brief C1, C2). |

### A6. Repo layout (final)
```
apps/
  shop-challenge/          # Vite + React app, own vercel.json
  practice-path/           # Vite + React app, own vercel.json
packages/
  schema/                  # TypeBox schemas, generated Ajv validators, graph validator, upgraders
  runtime/                 # pure reducer, registry, conditions, seeded rng — no React
  node-types/              # content, choice, outcome (+ app-specific types live in each app)
  link/                    # encode/decode/caps/hash
  storage/                 # safe localStorage wrapper
  ui/                      # shared accessible components + theme tokens
tools/
  create-app/              # scaffold: copies template, renames, adds sample activity + test
  validate/                # CLI: pnpm validate activities/*.json (used by Kiro hook + CI)
activities/                # demo manifests (content-as-code)
docs/planning/             # brief, this spec, playbook, checklist
docs/kiro-evidence/        # screenshots for KIRO_LOG
.kiro/ specs/ steering/ hooks/ agents/ settings/mcp.json
.github/workflows/ci.yml
LICENSE README.md EXTENDING.md PRIVACY.md ASSETS.md KIRO_LOG.md KIRO_WRITEUP.md ROADMAP.md
```

### A7. Frontend tech (decided by the backend choice)
| Tech | Why |
|---|---|
| **React 19 + Vite** | You're learning React. Vite gives instant dev reload and static output that fits A1. No Next.js: there's no server rendering to do, and it would add a server model we deliberately removed. |
| **React Router (library mode)** | Three routes per app: `/`, `/create`, `/play`. Small and well documented. |
| **`useReducer` + context** | The runtime is already a reducer, so the player state *is* the runtime. No Redux or Zustand needed. |
| **Tailwind CSS v4 + CSS-variable theme tokens** | Fast styling. Tokens make themes swappable (template extension point; optional spooky pack). |
| **shadcn/ui (Radix primitives)** | Accessible dialog, radio group, checkbox, tabs and toast primitives. You copy the code in, so no heavy dependency. |
| **Lucide icons** | Matches shadcn, tree-shaken. |
| **CSS animations + `canvas-confetti`** (~6 KB) | Game feel cheaply. Everything respects `prefers-reduced-motion`. No Framer Motion (keeps within the 150 KB budget). |
| **`uqr`** (tiny QR generator) or equivalent | QR codes for market stalls and classrooms. |

### A8. v2 backend (designed, not built) — ROADMAP.md
Supabase (Postgres + Auth + Storage + Edge Functions):
- **Tables:** `activities(id, owner_id, title, manifest jsonb, hash, created_at, unpublished_at)`; `events(id uuid unique, activity_id, attempt_id, type, seq, at)` with only counts surfaced.
- **RLS:** owners read/write only their own rows. Public read only of `manifest` for published, not-unpublished rows.
- **Storage:** images are re-encoded by an Edge Function, under a size cap, with generated names.
- **Gates before launch:** NDPA privacy notice and lawful basis, takedown flow, rate limits, a restore-from-backup test. These are brief failure-register rows that become relevant only here.

---

## Part B — Frontend structure

### B1. Routes (identical shape in both apps — that *is* the template)
| Route | Purpose |
|---|---|
| `/` | Landing: what it is, live demo, "Create yours" |
| `/create` | Editor with live preview; Share |
| `/play#a=…` | Player for shared links |
| `/play/demo/:id` | Bundled demo activities (judge path) |
| `*` | Not found |

### B2. Shared components (`packages/ui` + runtime renderers)

**Primitives (from shadcn/ui):** Button, Card, Dialog, Sheet (mobile), RadioGroup, Checkbox, Tabs, Input, Textarea, Select, Badge, Progress, Toast, Tooltip, Separator.

**Player components**
| Component | Responsibility | States to design |
|---|---|---|
| `ActivityPlayer` | Decodes, validates and runs a manifest. Owns the reducer. | loading · invalid · playing · finished · limit-reached |
| `NodeRenderer` | Looks up the node type in the registry and renders its `Render` | unknown-type error |
| `ContentNodeView` | Text and illustration step, with Continue | — |
| `ChoiceNodeView` | Single choice (radio cards); keyboard arrows + Enter | idle · selected · submitted |
| `OutcomeNodeView` | Generic ending | — |
| `ProgressHeader` | Step x/y, exit button | — |
| `InvalidActivityView` | Plain-language diagnostics ("This link is damaged: question 3 points to a step that doesn't exist") + "Back to home" | — |
| `ExternalLinkButton` | The CTA with destination disclosure (§A5) | default · confirm |

**Authoring components**
| Component | Responsibility |
|---|---|
| `EditorShell` | Desktop: form left, live phone-frame preview right. Mobile: Edit/Preview tabs. |
| `StepNav` | Stepper (Details → Items → Rules → Preview → Share) |
| `ListEditor<T>` | Add, remove, **move up/down buttons** (no drag required, per WCAG) |
| `FieldRow` | Label, input, inline error, help text |
| `DiagnosticsPanel` | Validator errors; clicking one focuses the field |
| `LinkSizeMeter` | Shows the encoded size against the 8 KB cap and the QR threshold |
| `SaveStatus` | "Saved on this device" / "Not saved — export" |
| `ShareDialog` | Link, Copy, WhatsApp share, QR (if short enough), Export JSON |
| `ImportButton` | Load a JSON file → draft (through the validation pipeline) |

**Marketing components (landing)**
`Hero` (headline, sub, primary CTA, phone mock with the live player) · `HowItWorks` (3 steps: make, share, play) · `LiveDemo` (real embedded `ActivityPlayer` with a demo manifest) · `UseCases` · `TrustStrip` ("No sign-up · No tracking · Open source") · `FAQ` · `Footer` (GitHub, "Built with Kiro", license, link to the sister app).

### B3. Shop Challenge — app-specific components
| Component | Detail |
|---|---|
| `ShopDetailsForm` | Shop name, currency (₦ default), CTA type (WhatsApp number → builds `wa.me` link / website URL) |
| `ProductEditorRow` | Name, price, tags (occasion, style), emoji or image URL |
| `ChallengeRulesForm` | Occasion question, budget, min/max items |
| `ProductCard` | Selectable card (checkbox semantics): image, name, price, tag chips; disabled when over budget |
| `BundleBar` | Sticky bottom bar: items x/max, total, **budget meter** (green → amber → red), Continue |
| `ConstraintHint` | "Add 1 more item" / "₦2,000 over budget" |
| `BundleResult` | Chosen + recommended bundle, total, "Why these" line, CTA |
| `OfferEndedView` | Shown after `validUntil` |

### B4. Practice Path — app-specific components
| Component | Detail |
|---|---|
| `LessonDetailsForm` | Title, subject, retry policy (0–3), optional tutor WhatsApp number |
| `QuestionEditorRow` | Prompt, 2–5 options, correct mark, explanation (required) |
| `QuestionCard` | Prompt + `OptionButton` list; Check button |
| `OptionButton` | idle · selected · correct · incorrect · disabled |
| `FeedbackSheet` | Bottom sheet: correct (green) / incorrect (red) + explanation + Continue/Retry |
| `ReviewInterstitial` | "3 questions to review" — the review round starts |
| `MasterySummary` | Score, first-try vs after-review, missed topics, "Review again", "Send result to tutor" |
| `ResultShareButton` | Builds the `wa.me` text (Wordle-style), user-initiated |

### B5. Template hub (SHOULD)
A one-page static site at `site/` (not inside `apps/`). It explains the template, links both apps, the GitHub repo and `create-app`, and shows a code snippet of a node type. This is the "URL to your working app(s)" landing for judges. If time is short, the README does this job.

---

## Part C — UI references to collect
Take **layout and interaction patterns only**. Don't copy logos, brand colours or illustrations (rules ban third-party trademarks in the video, and IP must be ours). Keep reference screenshots in the gitignored `design-refs/` folder.

| Screen | Reference product(s) | What to capture |
|---|---|---|
| **Landing — Shop Challenge** | **Paystack** homepage; **Selar** homepage; **Linktree** homepage | Paystack: clean fintech hero and trust strip. Selar: creator-commerce copy for African sellers. Linktree: phone-mock hero, simple 3-step "how it works". |
| **Landing — Practice Path** | **Duolingo** homepage; **Quizlet** homepage; **Kahoot!** homepage | Playful but clean hero, a big single CTA, the illustration style idea (we draw our own). |
| **Template hub** | **shadcn/ui** homepage; **create-t3-app** site; last year's **InteractionKit** README | Dev-template pitch, code snippet blocks, "get started in 3 commands". |
| **Editor (both apps)** | **Linktree admin** (editor left, live phone preview right); **Tally.so** form builder; **Typeform** create screen | Split editor/preview, add-item rows, minimal fields, mobile tab switch. |
| **Product grid + bundle bar** | **HelloFresh** "choose your meals"; any "build-your-own box/bundle" store page; **Jumia** product cards | Selectable cards, sticky running total, limit counter, familiar Nigerian product-card density (Jumia). |
| **Product quiz flow** | **Octane AI** / Shopify product-quiz examples | One question per screen, results page with recommended products. |
| **Question + feedback** | **Duolingo** lesson screen (Check button, green/red bottom sheet); **Quizlet Learn** mode | Feedback sheet, review of missed items. This is the closest reference for Practice Path. |
| **Results / summary** | **Duolingo** lesson-complete screen; **Wordle** share result | Celebration, stats, a one-tap share of a text result. |
| **Share dialog** | **Linktree** share/QR panel; **Google Docs** share dialog | Copy link, QR, share targets. |
| **Error / invalid link** | **Elm** compiler error messages (tone); **Vercel** 404 page | Friendly, specific, actionable error copy. |
| **Component library** | **shadcn/ui** docs + **Radix** docs | Real components we will use; no redesign needed. |
| **Optional spooky theme** | Last year's Costume Contest winners on Devpost | Only if the theme is added on Day 12. |

**Get, in priority order:** (1) the Duolingo lesson + feedback screens, (2) the Linktree admin editor, (3) the HelloFresh meal-selection page, (4) the Wordle share result, (5) the Paystack + Duolingo landings. Mobile screenshots first: most of your users will open links on phones.

---

## Part D — Changes to the brief (applied by this doc)
- **Hosting:** Vercel, two projects (settles D1).
- **Sharing:** link-fragment transport replaces publishing/versioning (B9's pipeline is no longer needed; keep `schemaVersion` upgraders).
- **New risks and fixes:** CTA phishing disclosure, QR length threshold, generic OG cards, image-host note (§A5).
- **New feature:** user-initiated "Send result to tutor" (Practice Path).
- **New packages:** `packages/link`, `packages/storage`, `tools/validate`. New CI tool: dependency-cruiser.
- **Day 1 additions:** set up the Vercel projects with headers; add depcruise to CI.
