# Email Delivery, Operator Controls, And Release Hardening Implementation Plan

**Goal:** Close the in-flight email delivery mainline, then complete the operator controls and end-to-end release hardening work that depends on it.

**Architecture:** Keep the current Node + SQLite backend and existing single-shell frontend. Treat the current worktree as a partially implemented continuation of the 2026-04-19 user-facing productization archive: verify `P16` first, then extend only the missing `P17` and `P18` behaviors on top of the validated notification layer.

**Tech Stack:** Node.js HTTP server, SQLite app-state store, plain HTML/CSS/JS frontend, Node-based regression tests, Playwright browser smoke/visual checks, local PowerShell service scripts.

---

## Execution Order

1. Freeze current context and dirty worktree state.
2. Verify and close `P16 Real Email Delivery Baseline`.
3. Implement and verify `P17 Invite/Recovery Operator Controls And Observability`.
4. Implement and verify `P18 End-To-End Delivery Automation And Release Hardening`.
5. Refresh archive docs and close the round with explicit residual risks.

## P16 Focus

1. Audit existing notification config, transport, templates, routes, and tests.
2. Run focused notification/auth/frontend verification before touching code.
3. Patch only the verified gaps.
4. Update auth rules, env matrix, runbook, and release checklist for real delivery behavior.

## P17 Focus

1. Add resend invitation and revoke invitation controls.
2. Ensure invitation lifecycle state is queryable from admin surfaces.
3. Extend audit logging for resend/revoke actions.
4. Add focused backend, frontend-state, and smoke coverage.

## P18 Focus

1. Make invite and reset delivery flows deterministically testable.
2. Extend browser automation or supporting harnesses for end-to-end delivery paths.
3. Refresh release-readiness, runbook, and regression wiring after automation stabilizes.
4. Re-run closeout regression and archive the result.

## Validation Rhythm

1. After each small batch within a phase, run only the tests that prove that batch.
2. After each phase closes, run a wider regression slice.
3. Run the full regression only after the phase stack is stable enough to justify the cost.

## Required Deliverables

1. `docs/dev/2026-04-20-email-delivery-operator-release-plan.md`
2. `docs/dev/2026-04-20-email-delivery-operator-release-execution.md`
3. Updated archive docs in `docs/dev`
4. Updated code/tests reflecting final `P16/P17/P18` behavior
