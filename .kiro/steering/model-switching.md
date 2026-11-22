# Model switching

## Models

- Stronger: Claude Opus 5.5 (the current session model).
- Cheaper: Sonnet 5.5 (the cheapest available model; user, 2026-11-22).

## Rule

- When the next task, or a run of consecutive tasks, can be done well by a cheaper model, stop before dispatching it and ask the user to switch Kiro's model to a named cheaper model. Say which tasks the switch covers and why the cheaper model is enough. Do not start those tasks on the current model.
- Ask for a switch only for a run worth it: two or more consecutive cheaper sub-tasks, or one long-running task such as a timing run or a full checkpoint. A lone small cheaper sub-task that sits between stronger tasks stays on the stronger model.
- Sub-agents always run on the session model, so the agent cannot pick a model for them. Only the user can switch the model. This rule replaces the earlier request that the agent itself switch to lower models.
- The cheaper model runs only the listed tasks. When they are done, it stops and asks the user to switch back to the stronger model, named, and says where to resume.
- The cheaper model also stops early and asks to switch back when it meets a task outside the list, a failure it cannot fix with a small change, a design deviation, or any decision for the user.
- Name each model exactly as it appears in Kiro's model picker. If the available models are not known, ask the user once to list them and record the list in `docs/HANDOFF.md`.

## Fits a cheaper model

- Verify-only runs, checkpoint runs and timing runs.
- Tasks that copy exact content given in `design.md`.
- Single-file test edits that follow a given pattern.
- Git status, commit and push steps the user already approved.
- Manual-step tasks: asking the user and recording the answers.
- README and log text written from given facts.

## Keep on the stronger model

- Writing or changing specs (requirements, design, tasks).
- New node types and property tests.
- Shared packages: `packages/*`, `tools/lint` and `tools/validate`.
- Any task whose Verify failed, and diagnosing failures.
- Design deviations, and any task whose Stop condition fired.

## How to ask

- Example: "Tasks 2.1–4.1 copy exact content from design.md. Please switch to Sonnet 5.5 and say "continue"; I'll ask you to switch back to Claude Opus 5.5 after 4.1."

Source: user instruction, 2026-11-21 (session after shop-challenge completion); models and lone-task rule added 2026-11-22
