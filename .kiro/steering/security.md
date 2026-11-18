---
inclusion: always
---

# Security

## Code execution and DOM

- Do not call `eval` or `new Function` in any source file under `apps/`, `packages/` or `tools/`.
- Do not use `innerHTML` or `dangerouslySetInnerHTML` in any source file under `apps/`, `packages/` or `tools/`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) C1, B5

## Links

- Allow only `https:` for every CTA URL and link to another origin, checked in schema and renderer, rejecting `javascript:`, `http:` and `data:`; render them with `rel="noopener noreferrer"`.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) C1

## Privacy

- Do not collect personal data, including names, in any code under `apps/`, `packages/` or `tools/`.
- Do not add user accounts to any app under `apps/`.
- Do not send analytics off the device from any code under `apps/` or `packages/`.
- Store progress only on the user's device through `packages/storage`, and send no progress data to any server.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) C3; Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A3

## Import limits

- Reject an imported or linked manifest before `JSON.parse` when the encoded link exceeds 8 KB or the decoded JSON exceeds 64 KB.
- Check the manifest node-count cap before the graph checks in `packages/schema/graph.ts` run.

Source: Brief (`docs/Skeleton_Crew_Audit_and_Brief_v2.md`) C2; Architecture Spec (`docs/Architecture_and_UI_Spec.md`) §A3

## Secrets

- Do not commit API keys, tokens, passwords or other secrets in any file, including `.kiro/settings/mcp.json`.

Source: DREAME Day 1 project decision (spec dreame-day1-workspace-setup)

## Reference files

- Keep `design-refs/` listed in `.gitignore`, and do not stage or commit any file under `design-refs/`.

Source: Architecture Spec (`docs/Architecture_and_UI_Spec.md`) Part C
