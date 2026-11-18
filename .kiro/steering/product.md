---
inclusion: always
---

# DREAME

## Problem framing (for Impact + Presentation)

AI coding agents can generate interactive learning and promo activities quickly, but the output can contain structural errors: branches that point nowhere, loops that trap players, invalid answer references, unsafe links. The toolkit checks activity definitions against documented structural and supported semantic rules before playback. These checks catch specified errors, such as missing references or prohibited cycles. They do not establish factual accuracy, accessibility, the correctness of custom code, or that every possible interaction behaves as intended. Property-based tests provide evidence for the properties tested; they are not a universal proof of correctness.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §0

## What we claim

The toolkit combines developer-extensible activity types, explicit validation, Kiro development instructions, and compact activity sharing through URL fragments. Whether this combination offers a meaningful advantage is unverified. The design still needs static hosting; it avoids a dedicated application backend for storing activities.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §0a

## Differentiation statement

Our hypothesis is that a small, inspectable toolkit with explicit validation and Kiro-specific workflows makes structured playable applications easier to build and maintain. We will claim an advantage only where comparative testing shows one.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §0a

## Claim rules

- Use only the Brief §0 and §0a wording quoted in `.kiro/steering/product.md` for claims in README.md, submission form text, demo video narration, on-screen text and blog posts.
- Do not claim an advantage over H5P, Lumi, Twine, Optimove Minigames, Genially or plain React + Kiro until its Brief §0a comparison-gate task is run and reported.
- Do not use "correct by construction", "novel", "production ready", "production-ready", "without hallucinations", "guarantee", "better than" or "first ever" in any repository text.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §0a; Submission Checklist (`docs/Submission_Checklist_and_Compliance.md`) §2
