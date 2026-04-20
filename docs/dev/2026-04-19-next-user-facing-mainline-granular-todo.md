# Next User-Facing Mainline Granular TODO

## Purpose

Define the next recommended execution queue after `P14 Persistent Auth Rate-Limit Storage`.

This queue assumes the product is moving from local/user-testing baseline toward a more realistic user-facing operating model.

## Recommendation

If only one next mainline is chosen, choose:

## P15 Email Identity Baseline

Reason:

- real invitation or recovery delivery is not credible without stored email addresses
- the database already has `email`, but current admin UX and route validation do not yet treat it as an intentional first-class field
- doing delivery first would force ad hoc fallbacks and create avoidable refactor churn

## Priority Order

1. `P15` email identity baseline
2. `P16` real email delivery baseline
3. `P17` invite/recovery operator controls and delivery observability
4. `P18` full end-to-end automation and release hardening

## Scope Guard

Keep these out of the next mainline unless the goal changes:

- SMS delivery
- MFA
- billing or payment
- self-service public registration
- cross-machine distributed rate limiting

---

## P15 TODO: Email Identity Baseline

### Goal

Make email an intentional, validated, test-covered account attribute so later delivery work has a stable target.

### Likely Files

- `server/routes/state.js`
- `server/state-store.js`
- `public/index.html`
- `public/js/app.js`
- `public/js/app-shell.js`
- `test-auth-history.js`
- `test-frontend-state.js`
- `test-page-markup.js`
- `docs/dev/*`

### Granular TODO

1. Re-read current admin user create/reset/update flows in `public/js/app.js`.
2. Re-read current user schema and lookup paths in `server/state-store.js`.
3. Confirm where `email` already exists in SQLite and where it is still ignored in route payloads.
4. Add backend email normalization helper.
5. Add backend email format validation rule.
6. Add backend unique-email conflict rule with explicit error copy.
7. Extend admin create-user route to accept `email`.
8. Extend admin update-user route to allow email updates.
9. Extend list-users payload so email is always returned intentionally.
10. Add admin create-user form email field.
11. Add admin user list email display.
12. Add admin per-user email edit affordance with minimal UX.
13. Ensure empty email remains allowed only if delivery mode is still optional for this phase.
14. Add backend tests for:
    - valid email create
    - invalid email reject
    - duplicate email reject
    - email update persistence
15. Add frontend state tests for email payload round-trip.
16. Add page-markup assertions for new email controls.
17. Run focused validation:
    - `node test-auth-history.js`
    - `node test-frontend-state.js`
    - `node test-page-markup.js`
18. Update docs:
    - auth rules
    - release checklist
    - execution log

### Acceptance

- admin can create and maintain user email addresses intentionally
- email validation and uniqueness are enforced
- docs and tests treat email as part of the user model

---

## P16 TODO: Real Email Delivery Baseline

### Goal

Replace `local_preview`-only invitation/recovery delivery with a real email delivery path while keeping a safe local fallback for development.

### Likely Files

- `server/config.js`
- `server/routes/state.js`
- `server/route-meta.js`
- create `server/lib/notifications.js`
- maybe create `server/lib/email-templates.js`
- `test-auth-history.js`
- `docs/dev/2026-04-19-production-env-matrix.md`
- `docs/dev/*`

### Granular TODO

1. Re-read invitation/recovery route behavior and current `local_preview` assumptions.
2. Decide minimum provider scope:
   - email only
   - SMS deferred
3. Decide the first transport abstraction:
   - provider mode
   - `local_preview` mode
   - optional `disabled` mode
4. Extend `server/config.js` with notification delivery env vars.
5. Update `docs/dev/2026-04-19-production-env-matrix.md` with the new env contract.
6. Create a notification transport module with one stable send interface.
7. Add one provider implementation.
8. Add one `local_preview` implementation that preserves current dev usability.
9. Create invite email subject/body template.
10. Create password-reset email subject/body template.
11. Wire admin invitation issuance to the new mailer.
12. Wire forgot-password issuance to the new mailer.
13. Keep forgot-password response generic even when send fails.
14. Decide and implement provider-failure behavior:
    - fail closed for invite send
    - generic success plus logged failure for forgot-password
15. Add backend tests for:
    - successful invite send
    - successful forgot-password send
    - provider failure path
    - `local_preview` fallback behavior
16. Re-run focused validation:
    - `node test-auth-history.js`
    - `node test-frontend-state.js`
17. Update docs:
    - auth rules
    - runbook
    - execution log

### Acceptance

- invitations and recovery can be delivered by real email
- local development still has a usable fallback path
- failure behavior is explicit and documented

---

## P17 TODO: Invite/Recovery Operator Controls And Observability

### Goal

Make invitation and recovery operationally manageable instead of fire-and-forget.

### Likely Files

- `server/routes/state.js`
- `server/state-store.js`
- `public/js/app.js`
- `public/js/app-shell.js`
- `test-auth-history.js`
- `test-ui-flow-smoke.js`
- `docs/dev/*`

### Granular TODO

1. Re-read admin user management and audit-log surfaces.
2. Decide the minimum operator controls:
   - resend invitation
   - revoke active invitation
   - inspect latest invitation status
3. Decide whether password-reset delivery events need admin visibility or only auditability.
4. Add state-store helpers for querying active invite/reset token summaries.
5. Add state-store helper for revoking active invitation tokens.
6. Add backend route for invitation resend.
7. Add backend route for invitation revoke.
8. Extend audit logging with explicit delivery/revoke actions.
9. Expose invite status fields in admin user payload or a dedicated route.
10. Add admin UI for resend invitation.
11. Add admin UI for revoke invitation.
12. Add admin feedback copy for delivery success/failure and revoke success/failure.
13. Ensure resend respects existing abuse controls or add a dedicated resend throttle if needed.
14. Add backend tests for:
    - resend success
    - revoke success
    - revoked token no longer usable
    - resend invalidates older invitation token
15. Add frontend state tests for new operator APIs.
16. Add smoke coverage for at least one resend/revoke admin action if cost stays low.
17. Run focused validation:
    - `node test-auth-history.js`
    - `node test-frontend-state.js`
    - `node test-ui-flow-smoke.js --port 18797 --launch-server`
18. Update docs:
    - audit rules
    - release checklist
    - execution log

### Acceptance

- admins can resend or revoke invitation flows intentionally
- invitation lifecycle is auditable
- stale invite links fail predictably after resend or revoke

---

## P18 TODO: Full End-To-End Automation And Release Hardening

### Goal

Turn the new email-based onboarding/recovery flow into a regression-backed release candidate for real user-facing testing.

### Likely Files

- `test-ui-flow-smoke.js`
- maybe create `test-notification-flow.js`
- `test-regression.js`
- `docs/dev/2026-04-19-release-readiness-checklist.md`
- `docs/dev/2026-04-19-local-service-runbook.md`
- `docs/dev/*`

### Granular TODO

1. Decide the smallest reliable test-delivery harness:
   - mocked transport
   - captured local outbox
   - provider sandbox inbox
2. Add one deterministic test path for invitation happy path.
3. Add one deterministic test path for forgot-password happy path.
4. Add one deterministic test path for consumed/expired token failure.
5. Ensure browser automation can read the test-delivery artifact without external manual steps.
6. Wire the new flow test into `test-regression.js` only after local stability is proven.
7. Re-run screenshot and smoke checks if UI copy changes.
8. Re-run capacity baseline if delivery/audit writes change materially.
9. Re-run skip-live regression.
10. Re-run full regression.
11. Refresh release readiness checklist with the new operator and delivery gates.
12. Refresh local-service runbook if new env vars or local harness steps exist.
13. Write release closeout notes for this mainline.
14. Record remaining deferred items explicitly instead of leaving them implied.

### Acceptance

- onboarding and recovery are regression-backed end to end
- release docs match the actual operator steps
- remaining risk is explicit and narrow

---

## Suggested Test Cadence

Use this execution rhythm once implementation starts:

1. After `P15` backend + frontend changes, run focused auth/frontend tests.
2. After `P16` delivery integration, run focused auth tests before broader smoke.
3. After `P17` operator controls, run smoke plus focused auth/state tests.
4. After `P18`, run:
   - `node test-capacity-baseline.js --port 18820`
   - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
   - `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`

## Decision Rule

Choose `P15` first unless one of these becomes true:

1. you explicitly want to skip real email work and stay in `local_preview`
2. you already have a fixed provider decision and guaranteed email data source outside the product

If neither is true, do not jump over `P15`.
