# Release Closeout Execution Log

## Mainline

- Active phase: `P12 Release Closeout`

## Goal

Freeze the current round into a documented, regression-backed release baseline for user-facing testing.

## What Was Closed In This Round

- `P10` admin audit center
- `P11` invitation activation + forgot/reset password recovery
- active doc archive and release checklist refresh

## Validation

Passed:

1. `node test-auth-history.js`
2. `node test-frontend-state.js`
3. `node test-page-markup.js`
4. `node test-ui-flow-smoke.js --port 18797 --launch-server`
5. `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
6. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js --skip-live --port 18797`
7. `. 'D:\\document\\PowerShell\\profile.ps1'; node test-regression.js`
8. `node test-capacity-baseline.js --port 18820`

Final result:

- skip-live regression: `12/12`
- full regression: `17/17`
- latest capacity artifact:
  - `test-artifacts/performance/capacity-baseline-1776608843293.json`
- latest capacity snapshot:
  - login throughput remains around `17.77/s`
  - admin create-user throughput remains around `17.25-17.9/s`
  - session/history read throughput remains in the low-thousands per second

## Release Notes

- admins can now browse audit logs with filters and pagination from the product UI
- admins can issue invitation activation links for existing users
- users can request a local-preview reset link and complete password recovery without admin intervention
- visual baseline has been refreshed to match the accepted current UI

## Known Remaining Limits

- invitation and recovery delivery are still local-preview only
- dedicated throttling for forgot-password requests is still deferred
- MFA, email verification, and real notification delivery remain outside this round
