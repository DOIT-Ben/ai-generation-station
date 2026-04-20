# User-Facing Productization Baseline Plan

## Purpose

This is the canonical execution plan for the current mainline.

From this point forward, all new planning, execution logs, closeout notes, and release-readiness documents for this mainline live under `docs/dev`.

Historical documents already written under `docs/开发过程文档` remain valid as archive context, but they are no longer the active write target.

## Mainline

Do not add more generator features next.

The current mainline is:

## User-Facing Productization Baseline

The product already has enough feature breadth for this stage:

- AI chat
- lyrics
- image generation
- speech synthesis
- music generation
- voice cover
- chat history and account-backed persistence
- minimal admin controls

The real bottleneck is no longer missing tabs. The real bottleneck is whether the existing frontend, account behavior, and operational surface can hold up when the product is treated as user-facing instead of internal.

## Scope

This mainline will close four product gaps:

1. Freeze the product UI contract so frontend changes stop drifting.
2. Upgrade auth/account behavior from internal-demo logic to user-facing baseline rules.
3. Build a stronger frontend acceptance gate than the current mostly structural tests.
4. Close operational readiness and release-evaluation documents.

Out of scope:

- new generator tabs
- redesigning the navigation again
- payment/billing
- large backend refactors without direct release value

## Execution Rules

1. All new documents go to `docs/dev`.
2. After each TODO closes, update the execution log with:
   - new problems found
   - boundary conditions handled
   - what the earlier plan missed
3. Keep the current regression baseline green throughout:
   - `node test-page-markup.js`
   - `node test-frontend-state.js`
   - `node test-auth-history.js`
   - `node test-failures.js`
   - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
4. Run broader regression after several connected subtasks, not after every single tiny edit.
5. No CSS cleanup starts before the UI contract doc is written.
6. No auth code changes start before the auth/account rules doc is written.

## Deliverables

- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-user-facing-productization-baseline-plan.md`
- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-user-facing-productization-execution.md`
- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-product-ui-contract-baseline.md`
- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-user-facing-auth-rules.md`
- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-frontend-acceptance-matrix.md`
- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-release-readiness-checklist.md`
- `E:\Agents\AI-Generation-Stations\docs\dev\2026-04-19-dev-archive-index.md`
- `E:\Agents\AI-Generation-Stations\test-style-contract.js`
- optional if lightweight and justified: `E:\Agents\AI-Generation-Stations\test-ui-flow-smoke.js`

## Ordered Tracks

### Track 0. Baseline Freeze And Working Context

1. Create the execution log in `docs/dev`.
2. Record the current dirty worktree from `git status --short`.
3. Record the document-path transition from `docs/开发过程文档` to `docs/dev`.
4. Re-run the current baseline tests.
5. Re-run `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`.
6. Verify `http://localhost:18791`.

Acceptance:

- new canonical execution log exists under `docs/dev`
- baseline commands are recorded with results
- local service reachability is confirmed

### Track 1. Freeze The Product UI Contract

Files to inspect:

- `public/index.html`
- `public/css/style.css`
- `public/js/app.js`
- `public/js/app-shell.js`

Tasks:

1. Document page-shell rules.
2. Document card rules.
3. Document button and utility-action rules.
4. Document light/dark theme surface rules.
5. Document allowed exceptions and forbidden drift patterns.
6. Add a manual visual review checklist.

Acceptance:

- the frontend has an explicit contract for cards, utilities, and theme surfaces
- the chat card is defined as a product rule, not an exception by accident

### Track 2. Add Automated Style-Contract Guards

Files to touch:

- `test-style-contract.js`
- `package.json`
- `test-regression.js`

Tasks:

1. Add a structural CSS contract test.
2. Assert presence of shared card rules, top-right utility area, and light-theme card rules.
3. Wire the test into package scripts and the regression suite.

Acceptance:

- frontend style drift has an automated structural guard

### Track 3. Normalize Layout, Card, And Utility Styling

Files to touch:

- `public/css/style.css`
- `public/index.html` only if structure must change
- `public/js/app.js` only if class binding must change

Tasks:

1. Normalize shared spacing/radius/shadow tokens.
2. Ensure generator cards and chat card share one card family.
3. Reduce unnecessary framing in light theme.
4. Normalize theme toggle, login state, and logout control as one utility cluster.
5. Verify manually in browser.

Acceptance:

- the UI reads as one product across chat and generator pages

### Track 4. Freeze User-Facing Auth And Account Rules

Files to inspect:

- `server/routes/state.js`
- `server/state-store.js`
- `public/js/app.js`
- `public/js/app-shell.js`
- `test-auth-history.js`

Tasks:

1. Define anonymous, authenticated, admin, disabled, locked, and expired-session states.
2. Define backend status codes and payload expectations.
3. Define frontend copy and rendering per state.
4. Define admin safety rules.

Acceptance:

- auth behavior is explicit instead of inferred from current code

### Track 5. Harden Auth, Session, And Admin Safety Behavior

Files to touch:

- `server/state-store.js`
- `server/routes/state.js`
- `server/config.js` only if needed
- `public/js/app.js`
- `public/js/app-shell.js` only if needed
- `test-auth-history.js`

Tasks:

1. Add failing auth-history coverage for under-defined states.
2. Implement backend rules.
3. Implement frontend handling.
4. Re-run focused tests, then regression.

Acceptance:

- invalid or expired sessions cannot leave the UI half-authenticated
- admin safety rules are enforced by backend logic

### Track 6. Standardize Empty, Loading, Validation, And Error States

Files to touch:

- `public/index.html`
- `public/js/app.js`
- `public/css/style.css`
- `test-page-markup.js`
- `test-failures.js`
- `test-frontend-state.js` if needed

Tasks:

1. Inventory state coverage across major tabs.
2. Normalize shared failure copy and handling.
3. Add or align UI anchors required for testing.
4. Verify manually.

Acceptance:

- no major page falls into raw or inconsistent error handling

### Track 7. Build The Frontend Acceptance Matrix And Minimal UI Gate

Files to touch:

- `docs/dev/2026-04-19-frontend-acceptance-matrix.md`
- `test-suite.js`
- optional `test-ui-flow-smoke.js`
- `package.json` if a new test is added
- `test-regression.js` if a new test is added

Tasks:

1. Write a viewport/theme/account-state acceptance matrix.
2. Record why current smoke tests are insufficient for real UI acceptance.
3. Add the smallest acceptable UI-flow gate, or explicitly defer it with reason.

Acceptance:

- release review has one concrete acceptance matrix
- the product has at least one stronger UI-oriented gate or one explicitly documented gap

### Track 8. Operational Readiness, Archive, And Final Closeout

Files to touch:

- `docs/dev/2026-04-19-release-readiness-checklist.md`
- `docs/dev/2026-04-19-dev-archive-index.md`

Tasks:

1. Record startup/runbook notes.
2. Record support/triage notes.
3. Record release gates.
4. Re-run final regression:
   - `node test-style-contract.js`
   - `node test-page-markup.js`
   - `node test-frontend-state.js`
   - `node test-auth-history.js`
   - `node test-failures.js`
   - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
   - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js`
5. Write the final archive index and closeout summary.

Acceptance:

- one release-readiness checklist exists
- one `docs/dev` archive index exists
- the repo has a single current answer for whether the product is ready for user-facing testing

## First Batch

The first execution batch is:

1. Create the execution log.
2. Record the current dirty worktree.
3. Record the docs-path transition.
4. Record baseline tests and local service reachability.
5. Write the UI contract document.
6. Add the style-contract test and wire it into regression.

## Success Criteria

This mainline is done only if:

1. Chat and generator pages look and behave like one product family.
2. Light theme stops drifting into arbitrary gray surfaces and over-framed blocks.
3. Auth and session behavior are intentionally defined.
4. Frontend acceptance is documented and materially stronger than the current structural-only baseline.
5. New development knowledge for this round is fully archived under `docs/dev`.
