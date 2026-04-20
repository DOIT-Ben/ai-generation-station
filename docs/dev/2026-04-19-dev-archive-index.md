# Dev Archive Index

## Purpose

This is the active archive entry point for the current mainline under `docs/dev`.

Historical context still exists under `docs/开发过程文档`, but new active documents for this round are archived here.

## Current Mainline

- `User-Facing Productization Baseline`
- `Email Delivery, Operator Controls, And Release Hardening`
- `Next Recommended Mainline: State Durability And Retention Baseline`

## Latest Extension Read Order

Read these first for the latest round:

1. `2026-04-20-auth-surface-round-status.md`
2. `2026-04-20-release-core-normalization-plan.md`
3. `2026-04-20-release-core-normalization-execution.md`
4. `2026-04-20-anonymous-nav-auth-gate-fix-execution.md`
5. `2026-04-20-email-delivery-operator-release-plan.md`
6. `2026-04-20-email-delivery-operator-release-execution.md`
7. `2026-04-20-email-delivery-operator-release-summary.md`
8. `2026-04-20-next-state-durability-mainline-granular-todo.md`
9. `2026-04-20-state-durability-retention-plan.md`
10. `2026-04-20-state-durability-retention-execution.md`
11. `2026-04-19-user-facing-auth-rules.md`
12. `2026-04-19-production-env-matrix.md`
13. `2026-04-19-local-service-runbook.md`
14. `2026-04-19-release-readiness-checklist.md`

## Active Read Order

1. `2026-04-19-user-facing-productization-baseline-plan.md`
2. `2026-04-19-user-facing-productization-execution.md`
3. `2026-04-19-product-ui-contract-baseline.md`
4. `2026-04-19-user-facing-auth-rules.md`
5. `2026-04-19-frontend-acceptance-matrix.md`
6. `2026-04-19-browser-frontend-automation-execution.md`
7. `2026-04-19-real-user-account-operations-baseline-plan.md`
8. `2026-04-19-real-user-account-operations-baseline-execution.md`
9. `2026-04-19-release-readiness-checklist.md`
10. `2026-04-19-docs-dev-bridge-note.md`
11. `2026-04-19-mobile-responsive-acceptance-execution.md`
12. `2026-04-19-visual-regression-baseline-execution.md`
13. `2026-04-19-account-lifecycle-phase-2-plan.md`
14. `2026-04-19-account-lifecycle-phase-2-execution.md`
15. `2026-04-19-startup-runbook-hardening-plan.md`
16. `2026-04-19-startup-runbook-hardening-execution.md`
17. `2026-04-19-local-service-runbook.md`
18. `2026-04-19-next-step-granular-todo.md`
19. `2026-04-19-post-p0-p2-next-granular-todo.md`
20. `2026-04-19-security-abuse-baseline-plan.md`
21. `2026-04-19-security-abuse-baseline-execution.md`
22. `2026-04-19-production-gateway-hardening-plan.md`
23. `2026-04-19-production-gateway-hardening-execution.md`
24. `2026-04-19-reverse-proxy-runbook.md`
25. `2026-04-19-production-env-matrix.md`
26. `2026-04-19-capacity-baseline-plan.md`
27. `2026-04-19-capacity-baseline-execution.md`
28. `2026-04-19-admin-audit-center-plan.md`
29. `2026-04-19-admin-audit-center-execution.md`
30. `2026-04-19-remaining-release-mainline-granular-todo.md`
31. `2026-04-19-invitation-recovery-plan.md`
32. `2026-04-19-invitation-recovery-execution.md`
33. `2026-04-19-release-closeout-execution.md`
34. `2026-04-19-forgot-password-throttle-hardening-plan.md`
35. `2026-04-19-forgot-password-throttle-hardening-execution.md`
36. `2026-04-19-persistent-auth-rate-limit-plan.md`
37. `2026-04-19-persistent-auth-rate-limit-execution.md`
38. `2026-04-19-next-user-facing-mainline-granular-todo.md`
39. `2026-04-19-email-identity-baseline-plan.md`
40. `2026-04-19-email-identity-baseline-execution.md`

## What This Archive Closes

- moved active development logging to `docs/dev`
- froze the shared UI contract
- added a style-contract regression guard
- normalized chat/card/utility styling toward one product family
- defined user-facing auth and admin safety rules
- added auth-expiry frontend recovery coverage
- created a repeatable frontend acceptance matrix
- added a real browser smoke acceptance gate
- added a screenshot-based visual regression baseline
- added the first real user account operations baseline
- added forced first-login/admin-reset password rotation plus self-service password change
- added a repo-owned local startup/stop/health runbook
- added request-rate limiting for login and sensitive admin account actions
- added SQLite-backed admin audit logging for user lifecycle changes
- added reverse-proxy trust, CORS/origin gating, CSP/security headers, and `/api/health`
- added a repeatable local capacity baseline for auth/session/admin/history paths
- added the admin audit center surface with test coverage and stable visual baselines
- added invitation activation and local-preview forgot/reset password recovery
- archived the remaining release mainline queue and release closeout notes
- closed the dedicated forgot-password abuse-throttling gap and extended smoke coverage through the recovery preview handoff
- moved sensitive auth/admin burst guards from process memory into SQLite-backed persistent storage
- promoted email into a validated, admin-managed account attribute for later delivery work
- created a release-readiness checklist
- clarified the `docs/dev` vs `docs/开发过程文档` split
- created the next-step granular TODO queue
- closed the real email delivery baseline on top of the existing notification layer
- added invitation resend/revoke operator controls with audit logging
- extended browser automation through invitation activation, password reset completion, and invalid-token failure states
- refreshed the screenshot visual baselines after the expanded admin invitation controls
- fixed the anonymous desktop sidebar dead-click state caused by auth-gate hit-area overlap
- promoted a `release-core` non-browser regression lane for sessions where browser automation is intentionally deferred or environment-blocked
- re-established `docs/dev` as the sole active write target for the current round

## Historical Context Still Relevant

The following older archive groups remain useful reference material:

1. chat conversation mainline
2. frontend correction rounds
3. startup/environment recovery
4. targeted regression repairs

These remain under:

- `docs/开发过程文档`
