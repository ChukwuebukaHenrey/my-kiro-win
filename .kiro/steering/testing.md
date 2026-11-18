---
inclusion: fileMatch
fileMatchPattern: "**/*.test.ts"
---

# Testing

## Tools and commands

- Use Vitest as the test runner and fast-check as the property-testing library in every `*.test.ts` file.
- Run tests once with `vitest --run` or `vitest run` so the command exits.
- Do not start Vitest in watch mode, and never run plain `vitest` without `run` or `--run`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §5; Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A3

## Required property tests

- Test with fast-check that every manifest passing validation reaches an outcome within `maxTransitions` for every generated answer sequence tested.
- Test with fast-check that the validator in `packages/schema` does not crash on generated random JSON.
- Test with fast-check that the reducer in `packages/runtime` produces the same result for the same seed and actions.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §5; Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A3

## Describing results

- Describe test results in code comments, docs, README.md, submission, video and blog text as evidence for the properties tested, never as "proof of correctness".

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §0, §5
