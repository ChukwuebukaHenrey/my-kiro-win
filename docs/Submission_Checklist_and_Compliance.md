# Kiroween 2026 — Compliance Check, Remaining Work & What You Must Provide
Date: 18 Nov 2026 · Deadline: Fri 4 Dec, 2:00 PM PT (11:00 PM WAT) · Target submit: 3 Dec
Checked against the official 2026 rules (updated 16 Nov 2026). This doc adds the gaps found below to the brief, the architecture doc and the playbook.
Updated: the §5 submission draft uses the corrected claims from brief v2.3 §0a.

## 1. Rules compliance — line by line

| Official rule | Covered in our plan? | Action |
|---|---|---|
| Working software app built **using Kiro** (IDE/CLI/Web/Crew); insufficient Kiro use can disqualify | ✅ Playbook §3–§7 | Follow the daily loop; keep KIRO_LOG honest |
| Skeleton Crew: template + **two distinct apps** | ✅ Brief §2 | — |
| **2 separate repo folders** for the 2 apps | ✅ `apps/shop-challenge`, `apps/practice-path` | — |
| Built **during the Submission Period** (from 30 Oct); disclose pre-existing code | ✅ Fresh repo | Add a "Pre-existing work" line to the README (shadcn copies, any Odin code) |
| Public **GitHub** repo with all source, assets and instructions | ✅ | Clean-clone test on Day 15 |
| Open-source license **detectable in the About section** | ✅ MIT | Confirm on GitHub after the first push |
| `/.kiro` at the root, **not gitignored** | ✅ | Check after the first push |
| **URL to working app(s)**; login credentials if needed | ✅ Two Vercel URLs, no login | Write "No login needed" in testing instructions |
| App must stay **free and testable until judging ends** (29 Jan 2027) | ⚠️ **Missing** | Don't delete or pause the Vercel projects; no expiring demo data (`validUntil` on demos must be after Feb 2027) |
| **Text description** of features and functionality | ⚠️ **Missing** | Write `SUBMISSION.md` (draft in §5) on Day 15 |
| Demo video **< 3 min**, public on YouTube, shows the app **on its intended device** | ✅ Brief §6 | Desktop browser + Android phone clips |
| No third-party trademarks or copyrighted music in the video | ✅ Partly | No reference-app screenshots, brand logos or commercial music in the video |
| **Kiro write-up** covering features used | ✅ KIRO_WRITEUP | Paste into the form |
| Identify category + bonus categories | ✅ | Skeleton Crew + Social Blitz + Blog (+ Student if eligible) |
| Third-party SDKs/data used within their terms | ✅ ASSETS.md | Also list npm dependency licenses (`pnpm licenses list`) |
| Submission is your original work; no IP violations | ⚠️ **Risk: reference screenshots** | Keep design references **out of the public repo** (§2) |
| English | ✅ | — |
| **Kiro features/models vary by region** (entrant's responsibility) | ⚠️ **Missing** | Today: confirm your chosen models work from Nigeria in the IDE. Note any limits in the write-up. |

**Kiro-usage coverage against the rules' write-up questions:**
- **Covered:** IDE, CLI, custom agent, hooks, specs, steering, MCP, property-based testing.
- **Gap — powers:** the overview names powers, and we have none planned. **Fix:** on Day 2, open the IDE's Powers panel and install **one** power only if it fits our stack (e.g., testing, React or Vercel). Use it on one real task and log it. If nothing fits, the write-up says so honestly. Never invent usage.
- **Web/Crew:** optional. Mention them only if tried.

## 2. New gaps found, with fixes
| Problem | Fix |
|---|---|
| Your design references (screenshots of Duolingo, Linktree, etc.) committed to a public repo would publish other companies' copyrighted UI. | Keep them in `design-refs/` and add `design-refs/` to `.gitignore`. Use them only for layout inspiration. |
| A real WhatsApp number in public demo data exposes your number to everyone. | Demo CTAs use a website URL or a WhatsApp business line you're happy to publish. Never your personal number. |
| Demo activities with `validUntil` dates would show "offer ended" to judges in January. | Demo manifests: no `validUntil`, or set it to 2027-12-31. |
| The free hosting tier could pause or rate-limit if a deployment is removed. | Static Vercel sites on Hobby stay up. Don't delete projects or rename domains after submitting; re-check both URLs on 16 Dec and in mid-January. |
| Novelty or correctness overclaims in the submission, README, video or blog (e.g., "correct by construction", "novel vs hosted platforms") are checkable and false. | Use only the brief v2.3 §0a wording. Claim an advantage only if the comparison gate was run, and report its limits. |

## 3. What's left — ordered (today is Day 1, 18 Nov)
**Today (rest of Day 1)**
1. Install Node 22 LTS, pnpm and Git; verify in PowerShell.
2. Install the Kiro CLI (PowerShell): `irm 'https://cli.kiro.dev/install.ps1' | iex` → `kiro-cli login`.
3. Confirm your models are available in your region (IDE model picker).
4. Create the public GitHub repo with an **MIT license**. Clone it and open it in the Kiro IDE.
5. Set up `.gitignore`: `node_modules`, `dist`, `.env*`, `design-refs/`. **Not** `.kiro`.
6. Ask Kiro to generate steering files (product/tech/structure). Then edit them and add security, activity-authoring, testing and new-node-type (playbook §3a).
7. Add `.kiro/settings/mcp.json` (Context7) and confirm it connects.
8. Initialise the pnpm workspace (`apps/`, `packages/`, `tools/`), the CI workflow skeleton and `simple-git-hooks`.
9. Start `KIRO_LOG.md`. First commit and push. Check that the license shows in About and `.kiro` is visible.

**Day 2 onward:** follow the brief's 16-day plan, the playbook's spec workflow, and §1 actions as they come up.

## 4. What only you can provide
| Item | When | Notes |
|---|---|---|
| GitHub account + public repo | Today | MIT at creation |
| Vercel account linked to GitHub | By Day 7 | Two projects, Root Directory per app |
| Android phone (and any iPhone you can borrow) | Day 7 onward | Testing + video clips |
| **Demo content (your own words):** 5–8 products (names, prices in ₦, tags, emoji or **your own** photos) and one lesson of 6–8 questions with explanations on a topic you know well | By Day 6 / Day 8 | Synthetic data only. No real customers or students. |
| Public-safe CTA destination | By Day 6 | Website URL or business WhatsApp line |
| Screen recorder (e.g., OBS) + mic; YouTube account | Day 13 | No copyrighted music |
| Devpost text description, testing instructions ("no login needed"), category + bonuses | Day 15 | Draft below |
| Social post (starts with `#KiroweenHackathon26`) and a dev.to/Hashnode blog stating it's for Kiroween 2026 | Day 15 | Both during the Submission Period; same honest claims as §5 |
| **Student status decision** | Before submit | Only if currently enrolled: LinkedIn, student email, year/degree, school; proof may be requested |
| Pre-existing work disclosure | Day 15 | One README line |

## 5. SUBMISSION.md draft (fill in at the end)
```
Category: Skeleton Crew   Bonus: Social Blitz, Blog[, Best Student Project: Skeleton Crew]
Problem: AI agents can generate interactive activities quickly, but the output can contain structural errors (branches that point nowhere, trapped loops, invalid references, unsafe links).
What it is: an open-source toolkit for structured playable activities. It combines developer-extensible activity types, explicit validation, Kiro development instructions (specs, steering, hooks, a custom agent), and compact sharing through URL fragments on static hosting, with no accounts and no application backend for storing activities.
What the checks do: activity definitions are checked against documented structural and supported semantic rules before playback (e.g., missing references, prohibited cycles, unreachable endings, non-https links). They do not establish factual accuracy, accessibility, or the correctness of custom code. Property-based tests give evidence for the specific properties tested.
Prior art: H5P/Lumi (extensible, offline, exportable), Twine (branching stories), Genially, and Optimove Minigames (AI-generated marketing games via MCP) already cover parts of this space.
Hypothesis: a small, inspectable toolkit with explicit validation and Kiro-specific workflows makes structured playable apps easier to build and maintain. [If run: summary of the Plain React + Kiro comparison, with its limits. If not run: "Not yet compared; claimed as a hypothesis only."]
App 1 — Shop Challenge (URL): sellers build a bundle challenge and share it on WhatsApp.
App 2 — Practice Path (URL): tutors share practice lessons; wrong answers come back in review; learners can send results to their tutor.
How the template works: node-type registry, strict schema, graph validator, property tests, create-app scaffold.
Testing: open either URL — no login. Demo activities at /play/demo/...
Kiro: see KIRO_WRITEUP.md (specs, steering, 4 hooks, custom agent, MCP, PBT, CLI vs IDE).
Pre-existing work: none beyond standard libraries and shadcn/ui component copies.
```
