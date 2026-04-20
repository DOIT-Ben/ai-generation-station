# Next Step Granular TODO

## Purpose

This document defines the next recommended work after the current `User-Facing Productization Baseline` closeout.

The goal here is not to reopen broad strategy discussion.
The goal is to produce a concrete, sequenced TODO queue with enough granularity to execute directly.

## Recommendation

If only one next mainline is chosen, choose:

## Browser-Level Frontend Acceptance Automation

Reason:

- the current structural and server-side regression baseline is already strong
- the largest remaining release risk is still real browser behavior
- this is the biggest gap left by the current closeout round

Do not jump to a broader account-system rebuild first unless the immediate goal has shifted from release confidence to user operations.

## Priority Order

1. P0: browser-level frontend acceptance automation
2. P1: real user account operations baseline
3. P2: archive/worktree/document normalization

---

## P0 TODO: Browser-Level Frontend Acceptance Automation

### Goal

Add one minimal but real browser-driven acceptance layer for the current product shell.

### Files Likely To Touch

- `package.json`
- `test-regression.js`
- `docs/dev/2026-04-19-frontend-acceptance-matrix.md`
- create `playwright.config.js` or equivalent only if needed
- create `test-ui-flow-smoke.js` or `tests/ui/*.spec.js`
- create screenshot/output ignore rules if needed

### Granular TODO

1. Reconfirm the current target local URL:
   - `http://localhost:18791`
2. Inspect whether the repo already has any browser automation dependency or config.
3. Choose the smallest acceptable browser runner:
   - Playwright recommended
   - avoid adding a large test matrix on the first pass
4. Add the dependency to the project.
5. Create the minimal config file only if the chosen runner requires one.
6. Create one browser smoke file for the main user journey.
7. Implement the first test:
   - homepage loads
   - sidebar is visible
   - top-right login button is visible
8. Implement the second test:
   - open auth gate
   - login with bootstrap account
   - assert top-right account state appears
9. Implement the third test:
   - switch from chat to one generator page
   - verify the target page shell renders
10. Implement the fourth test:
    - switch theme
    - verify root/theme state changes
11. Implement the fifth test:
    - trigger logout
    - verify auth gate returns
12. Decide whether mobile viewport is included in the first pass.
13. If included, add one narrow-screen smoke case only:
    - open mobile sidebar
    - verify nav remains usable
14. Add a package script for the browser smoke suite.
15. Wire the new suite into `test-regression.js` only after it is stable locally.
16. Update `docs/dev/2026-04-19-frontend-acceptance-matrix.md` to mark which checks are now automated.
17. Record known limitations:
    - no visual diff yet
    - only core flow coverage

### Acceptance

- one real browser smoke flow exists
- login/theme/tab-switch/logout are covered by automation
- `test-regression.js` can run it without destabilizing the current suite

---

## P1 TODO: Real User Account Operations Baseline

### Goal

Move from bootstrap/demo account logic toward a true user operations baseline.

### Files Likely To Touch

- `server/state-store.js`
- `server/routes/state.js`
- `server/config.js`
- `public/js/app.js`
- `public/js/app-shell.js`
- `public/index.html`
- `test-auth-history.js`
- `test-frontend-state.js`
- new docs under `docs/dev`

### Granular TODO

1. Write a dedicated account-operations plan in `docs/dev`.
2. Decide whether bootstrap credentials remain visible in UI at all.
3. Define the first real admin operations surface:
   - create user
   - reset password
   - disable user
4. Define whether self-service registration exists in this phase.
5. If not, explicitly document admin-created accounts only.
6. Add backend support for creating a user from admin tools.
7. Add backend support for resetting a user's password.
8. Add backend support for forcing password rotation if desired.
9. Extend tests for admin create-user flow.
10. Extend tests for password reset flow.
11. Add frontend admin form for creating a user.
12. Add frontend admin action for resetting a password.
13. Remove or demote bootstrap credentials from the auth gate if a real account path exists.
14. Update copy so the login screen no longer reads like a fixed internal demo.
15. Add manual acceptance checks for:
    - new user login
    - disabled user login rejection
    - reset-password after admin action

### Acceptance

- the product no longer depends on a single visible bootstrap credential path
- admin can manage the basic lifecycle of real users

---

## P2 TODO: Archive / Worktree / Document Normalization

### Goal

Reduce maintenance friction after the recent rapid delivery rounds.

### Files Likely To Touch

- `docs/dev/2026-04-19-dev-archive-index.md`
- possibly a new archive bridge doc in `docs/dev`
- `.gitignore` only if generated artifacts need cleanup rules

### Granular TODO

1. Review current `git status --short`.
2. Separate code changes from historical untracked documents.
3. Decide whether old `docs/开发过程文档` files should remain untracked or be normalized.
4. If keeping both doc trees, add one bridge note explaining the split clearly.
5. If generated browser automation artifacts appear later, add ignore rules before they accumulate.
6. Add one short document explaining:
   - what stays in `docs/dev`
   - what remains historical in `docs/开发过程文档`
7. Verify future sessions have one obvious active doc entry point.

### Acceptance

- future work does not reopen the same document-path confusion
- the worktree is easier to reason about

---

## Immediate Start List

If work starts right now, do these first:

1. inspect whether a browser runner already exists in the repo
2. choose Playwright or explicitly reject it with reason
3. add the minimal browser automation dependency
4. create one smoke test file
5. automate login
6. automate tab switch
7. automate theme toggle
8. automate logout
9. run the browser smoke suite locally
10. only then wire it into `test-regression.js`

## Decision Rule

Choose P0 first unless one of these is true:

1. the next business goal is account onboarding instead of release confidence
2. browser automation would require infrastructure work too large for the next round

If either is true, switch to P1 first.
