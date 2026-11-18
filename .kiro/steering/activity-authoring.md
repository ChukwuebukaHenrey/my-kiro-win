---
inclusion: fileMatch
fileMatchPattern: "activities/**/*.json"
---

# Activity authoring

## Graph shape

- Keep the authored node graph in each `activities/*.json` manifest acyclic (a DAG); handle retry and review as runtime policy (`onIncorrect`, `review` phase), never as back-edges.
- Set `fallbackOutcomeId` to the ID of an existing outcome node; the runtime goes there and emits `limit_reached` when `limits.maxTransitions` is exceeded.
- Make the last edge of every node with one or more edges unconditional, with no `when` field; edges are first-match.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §1 B1, B2, B8

## Conditions

- Use only the condition operators `eq`, `gte`, `lte`, `includes`, `and`, `or` and `not` in `when` conditions.
- Declare every variable named by a `var` reference in the manifest `variables` array.
- Point every `answer` reference at an existing node ID in the manifest `nodes` array.
- Keep condition nesting depth at 8 or less.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §1 B2; §3

## Demo data

- Use made-up (synthetic) demo data in `activities/*.json`, with no real people's names or details.
- Do not put product brand logos in demo manifest data under `activities/`.
- Point demo CTAs at a website URL or a WhatsApp business line the builder agrees to publish; never use a personal WhatsApp number in `activities/*.json`.
- Omit `validUntil` from demo manifests, or set it to `2027-12-31` or later.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §1 C3, C4; Submission Checklist (`docs/Submission_Checklist_and_Compliance.md`) §2

## CTA URLs

- Use only the `https:` scheme for every CTA URL in a manifest; `https://wa.me/...` links are allowed, and `http:`, `javascript:` and `data:` URLs are rejected.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §1 C1
