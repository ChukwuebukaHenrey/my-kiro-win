---
inclusion: always
---

# Tech

## Toolchain

- Set `compilerOptions.strict` to `true` in `tsconfig.base.json` and in every package `tsconfig.json`.
- Use pnpm workspaces declared in `pnpm-workspace.yaml`, and do not add `package-lock.json` or `yarn.lock` files.
- Keep `engines.node` at `>=22` in `package.json` and `node-version: 22` in `.github/workflows/ci.yml`.
- Precompile validators at build time with Ajv standalone code generation, and do not compile schemas at runtime or import `ajv` in browser code.
- Add a `package.json` dependency only when the Architecture Spec or the Submission Checklist names it, and ask the user before adding any other dependency.

Source: Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A2, §A3; Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) B5

## Hosting and backend

- Do not add an application backend, database, authentication service or server-side activity storage in the hackathon build; serve `apps/shop-challenge` and `apps/practice-path` as static sites.
- Keep the Architecture Spec §A8 v2 backend (Supabase) in `ROADMAP.md` only, with no Supabase code, dependency or configuration in the repository.

Source: Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A1, §A8
