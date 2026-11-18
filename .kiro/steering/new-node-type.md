---
inclusion: manual
---

# New node type

## Steps

1. Define `type` as a unique string.
2. Define `version` as a number.
3. Define `configSchema` as a closed JSON Schema.
4. Define `responseSchema` as a closed JSON Schema.
5. Define `validate(cfg, ctx)` returning `Diagnostic[]`.
6. Define `reduce(cfg, state, response, env)` returning a new `AttemptState`.
7. Define `Render` as a React component that takes `cfg` and `onRespond`.
8. Place the node type in `packages/node-types` if it is shared, or inside the owning app folder under `apps/` if it is app-specific.
9. Register the node type in the registry in `packages/runtime`.
10. Add its `configSchema` to the per-app `oneOf` schema composed at build time in `packages/schema`.
11. Declare it in the manifest `requires` as `{type: version}`.
12. Add Vitest tests for `validate` and `reduce`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §3, §B4; Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A3, §A6

## Purity

- Write `reduce` as a pure function of `(cfg, state, response, env)` that returns a new `AttemptState` and does not mutate its inputs.
- Take time only from `env.now` and randomness only from the seeded `env.rng` in `reduce`; never call `Date.now`, `new Date()` or `Math.random`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) §3, §B6
