# 2026-04-20 Auth Surface Round Status

## Purpose

Provide one active `docs/dev` entry for the current 2026-04-20 extension round so future sessions do not need to start from the historical archive first.

## What Is Already Closed

### Auth / Account / Admin Surface Split

Completed:
- public auth page at `/auth/`
- dedicated account page at `/account/`
- dedicated admin page at `/admin/`
- workspace stripped back to creative flow plus minimal auth redirects/nav

Historical source documents:
- `docs/开发过程文档/2026-04-20-auth-account-admin-page-split-plan.md`
- `docs/开发过程文档/2026-04-20-auth-account-admin-page-split-execution.md`
- `docs/开发过程文档/2026-04-20-workspace-auth-admin-dead-code-cleanup-plan.md`

### Browser Smoke Refresh

Completed in code:
- `test-ui-flow-smoke.js` was rewritten for the multi-page structure
- CDP handoff support was added

Current limitation:
- real browser execution is environment-blocked in this session
- this is a browser-launch problem, not a known product-logic regression

Historical source documents:
- `docs/开发过程文档/2026-04-20-browser-ui-flow-smoke-refresh-plan.md`
- `docs/开发过程文档/2026-04-20-browser-ui-flow-smoke-refresh-execution.md`

## What Is Active Now

Current active mainline:
- `Release Core Normalization`

Why this is the active mainline:
- the user explicitly deprioritized browser-launch troubleshooting
- the product still needs a stable non-browser regression lane
- `docs/dev` and git closure need to be normalized before the round is easy to continue

## Current Execution Rule

For this round:

1. use `docs/dev` as the only active write target
2. use release-core regression as the default phase-end gate
3. treat browser UI automation as deferred until a runnable environment exists

## Current Recommended Read Order

1. `docs/dev/2026-04-20-auth-surface-round-status.md`
2. `docs/dev/2026-04-20-release-core-normalization-plan.md`
3. `docs/dev/2026-04-20-release-core-normalization-execution.md` once present
4. `docs/dev/2026-04-19-release-readiness-checklist.md`
5. `docs/dev/2026-04-19-dev-archive-index.md`
