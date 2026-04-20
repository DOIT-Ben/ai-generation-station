# User-Facing Productization Execution Log

## Mainline

- Active mainline: `User-Facing Productization Baseline`
- Canonical plan:
  - `docs/dev/2026-04-19-user-facing-productization-baseline-plan.md`

## Document Path Transition

- Old active path:
  - `docs/开发过程文档`
- New active path:
  - `docs/dev`

Reason:

- the user explicitly required all new document outputs for the current round to be stored under `docs/dev`
- continuing to split new artifacts across two folders would make later troubleshooting and archive lookup worse

Decision:

- historical documents in `docs/开发过程文档` remain unchanged as archive context
- all new plan, execution, acceptance, and closeout documents for this mainline will be written to `docs/dev`

Planning gap found:

- the earlier granular execution plan was correct in structure, but it still pointed to the old document root
- this happened because the plan was written before the new storage constraint was given

## Working Tree Baseline

`git status --short` at execution start:

```text
 M public/css/style.css
 M public/index.html
 M public/js/app-shell.js
 M public/js/app.js
 M server/route-meta.js
 M server/routes/state.js
 M server/state-store.js
 M test-auth-history.js
 M test-frontend-state.js
 M test-page-markup.js
?? docs/开发过程文档/...
```

Current interpretation:

- the worktree is already dirty from the earlier chat-history, auth, and frontend rounds
- those changes are the current project baseline and must be preserved
- new work in this mainline must build on top of them without reverting unrelated edits

Boundary conditions noted:

- the repo already contains many historical documents that are still untracked
- future archive cleanup must not assume those files are disposable

## Track 0 Baseline Verification

Executed before new implementation:

1. `node test-page-markup.js`
   - result: passed
2. `node test-frontend-state.js`
   - result: passed
3. `node test-auth-history.js`
   - result: passed
4. `node test-failures.js`
   - result: passed
5. `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
   - result: `8/8` passed
6. `http://localhost:18791`
   - result: reachable, HTTP `200`

Track 0 answer:

- the current baseline is stable enough to begin the productization round
- no immediate startup blocker is present

New issues found:

- none blocking in Track 0

Missed earlier:

- the execution log should have been moved to `docs/dev` before any new round started

## Next Batch

1. Write `docs/dev/2026-04-19-product-ui-contract-baseline.md`
2. Add `test-style-contract.js`
3. Wire the new test into `package.json` and `test-regression.js`
4. Run focused verification for the new style-contract guard

## Track 1-2 Closeout

Completed:

- wrote the product UI contract baseline in:
  - `docs/dev/2026-04-19-product-ui-contract-baseline.md`
- added a structural style-contract test in:
  - `test-style-contract.js`
- wired the new test into:
  - `package.json`
  - `test-regression.js`

Track 1 answer:

- the current frontend now has an explicit contract for page shell, cards, utility controls, and theme behavior
- the contract also records which drift patterns are forbidden based on the previous correction rounds

Track 2 answer:

- future frontend drift now has a structural guard in regression
- this guard protects the shared card contract and prevents `.chat-card` from silently becoming a second card system

New issues found:

- the current chat area still carries duplicated layout definitions in `style.css`
- that duplication is not a Track 1-2 blocker, but it is a Track 3 cleanup target because it can hide layout drift

Boundary conditions handled:

- kept the new guard structural instead of pixel-specific so it does not become too brittle
- did not enforce exact visual values for every selector because manual review is still required

Missed earlier:

- a style guard should have been added during the first frontend correction round, not after multiple polish passes

## Next Batch

1. Run `node test-style-contract.js`
2. Run `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
3. If green, start Track 3 visual cleanup on shared card/utility consistency

## Track 3 Closeout

Completed:

- normalized shared utility-shell sizing with reusable workspace tokens in `public/css/style.css`
- reduced the chat workspace's nested-card weight so it no longer reads like a separate product shell
- kept `.chat-card` on the shared card contract while softening the internal workspace surfaces

Verification:

- `node test-style-contract.js` passed
- `node test-page-markup.js` passed
- `node test-frontend-state.js` passed
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797` passed with `9/9`

New issues found:

- the first version of the new style-contract test matched selectors too loosely
- after introducing shared utility tokens, the test had to be updated to accept tokenized radius rules instead of hardcoded pixel values

Boundary conditions handled:

- kept the guard structural so CSS tokenization remains possible
- avoided HTML or JS changes for Track 3 unless the CSS cleanup truly required them

Missed earlier:

- style guards should have been designed around shared tokens from the beginning, not hardcoded values

## Track 4-5 Closeout

Completed:

- wrote `docs/dev/2026-04-19-user-facing-auth-rules.md`
- extended auth coverage for:
  - disabled login
  - temporary lockout
  - expired session
  - admin self-protection
- updated backend auth/session responses in:
  - `server/state-store.js`
  - `server/routes/state.js`
- updated frontend auth recovery behavior in:
  - `public/js/app-shell.js`
  - `public/js/app.js`

Verification:

- `node test-frontend-state.js` passed
- `node test-auth-history.js` passed
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797` passed with `9/9`

New issues found:

- frontend auth failure handling originally lacked a dedicated session-loss recovery path
- a purely global 401 handler would have caused duplicate generic error toasts unless local catches were taught to ignore protected-session errors

Boundary conditions handled:

- login failure messages remain local to the auth form
- only protected-request `401` responses trigger the auth-expired frontend event
- bootstrap `studio` credentials are now labeled as a local bootstrap account, not a production default account

Missed earlier:

- the frontend should have had a protected-session recovery mechanism as soon as cookie-backed auth was introduced

## Track 6-8 Closeout

Completed:

- added new localized auth/bootstrap/session-expiry copy guards to `test-page-markup.js`
- wrote:
  - `docs/dev/2026-04-19-frontend-acceptance-matrix.md`
  - `docs/dev/2026-04-19-release-readiness-checklist.md`
  - `docs/dev/2026-04-19-dev-archive-index.md`

Current answer:

- browser-level automation is intentionally deferred in this mainline
- the stronger frontend gates for this round are:
  - markup anchor coverage
  - style-contract coverage
  - auth-expiry event coverage
  - manual acceptance matrix

Boundary conditions handled:

- avoided introducing a new browser automation toolchain inside a productization closeout round
- kept `docs/dev` as the canonical active archive while leaving historical docs untouched

Next closeout step:

1. run the final local verification set
2. confirm the local frontend address still answers
3. close the mainline summary

## Final Verification

Focused checks:

- `node test-style-contract.js` passed
- `node test-page-markup.js` passed
- `node test-frontend-state.js` passed
- `node test-auth-history.js` passed
- `node test-failures.js` passed
- `http://localhost:18791` returned HTTP `200`

Regression:

- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
  - result: `9/9` passed
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js`
  - result: `14/14` passed

## Mainline Closeout

Completed in this round:

1. moved the active documentation stream to `docs/dev`
2. created a canonical productization plan and execution log
3. froze the shared UI contract
4. added a style-contract regression guard
5. normalized chat workspace and utility-shell styling toward one product family
6. defined user-facing auth/session/admin rules
7. implemented disabled-user, lockout, expired-session, and admin self-protection behavior
8. added frontend auth-expiry recovery behavior
9. created the frontend acceptance matrix and release-readiness checklist
10. created the `docs/dev` archive index

New problems found during execution:

- structural frontend tests can become brittle if they bind to raw pixel values instead of design tokens
- auth recovery needs both a global invalid-session signal and local catch-block suppression to avoid duplicate user-facing errors

Residual risks:

- browser-level UI automation is still deferred
- historical documents remain split across `docs/开发过程文档` and `docs/dev`, even though new active work now stays in `docs/dev`

What should come next:

1. if the next goal is tighter visual QA, add a dedicated browser automation/tooling mainline
2. if the next goal is product operations, build a real multi-user onboarding/password-reset/admin workflow beyond the bootstrap account

## Continuation Round Closeout (P0-P2)

After the baseline closeout above, the approved follow-on phases were executed in order:

1. `P0` browser-level frontend acceptance automation
2. `P1` real user account operations baseline
3. `P2` archive/worktree/document normalization

### What Was Added

- real browser smoke automation via:
  - `test-ui-flow-smoke.js`
  - `UiFlowSmoke` hook in `test-regression.js`
- first real account-operations baseline via:
  - admin create user
  - admin reset password
  - reset-session invalidation rules
  - admin panel forms for account creation and password reset
- docs-path normalization via:
  - `docs/dev/2026-04-19-docs-dev-bridge-note.md`
  - updated `docs/dev/2026-04-19-dev-archive-index.md`

### Verification

Validated on April 19, 2026:

- `node test-ui-flow-smoke.js --port 18797 --launch-server`
  - passed
- `node test-frontend-state.js`
  - passed
- `node test-page-markup.js`
  - passed
- `node test-auth-history.js`
  - passed
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18797`
  - passed `10/10`
- `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js`
  - passed `15/15`

### Updated Answer

- browser-level automation is no longer deferred
- the product no longer depends only on one visible bootstrap credential path for basic user operations
- `docs/dev` is now the unambiguous active document root, while `docs/开发过程文档` remains historical archive context

### New Problems Found

- browser automation requires a real listening HTTP server and cannot use the in-memory request harness alone
- password reset needed explicit session invalidation rules, not just credential overwrite
- the archive entry point needed a bridge note because older historical docs remain present and useful

### Remaining Risks

- no mobile browser smoke automation yet
- no screenshot-based visual regression layer yet
- no self-service user onboarding or password recovery flow yet
