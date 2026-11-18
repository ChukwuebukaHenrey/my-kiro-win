---
inclusion: always
---

# Structure

## Layout

Source: Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A6. The planning docs live in `docs/`, not `docs/planning/`.

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
docs/                      # brief, this spec, playbook, checklist
docs/kiro-evidence/        # screenshots for KIRO_LOG
.kiro/ specs/ steering/ hooks/ agents/ settings/mcp.json
.github/workflows/ci.yml
LICENSE README.md EXTENDING.md PRIVACY.md ASSETS.md KIRO_LOG.md KIRO_WRITEUP.md ROADMAP.md
```

## Apps

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §2

| | Shop Challenge | Practice Path |
|---|---|---|
| Real audience | Small online sellers (e.g., Instagram/WhatsApp shops) | Tutors and lesson creators |
| Folder | `apps/shop-challenge` | `apps/practice-path` |
| Mechanic | Bundle builder: multi-select under budget/occasion/max-item constraints | Retrieval loop: answer → explanation → wrong items join a review queue |
| Own node types | `collectionSelect`, `recommendOutcome` | `recall`, `reviewQueue` |

## Boundaries

- Do not import code from `apps/`, or import `react` or `react-dom`, in any file under `packages/runtime`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §3

## Node type placement

- Keep `content`, `choice` and `outcome` in `packages/node-types`, `collectionSelect` and `recommendOutcome` in `apps/shop-challenge`, and `recall` and `reviewQueue` in `apps/practice-path`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §2; Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A6
