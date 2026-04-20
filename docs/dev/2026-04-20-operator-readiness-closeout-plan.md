# Operator Readiness Closeout Plan

## Goal

Close the gap between the newly landed visual-regression and notification-failover behavior and the operator-facing release workflow.

## Scope

Include:

- release checklist updates
- runbook wording updates
- package-script entry points for:
  - visual baseline refresh
  - browser-assisted release validation
- `docs/dev` archive updates

Exclude:

- new product behavior
- new provider integrations
- new frontend surfaces

## Execution Order

1. audit current release/readiness docs and package scripts
2. add one explicit visual baseline refresh command
3. add one browser-assisted release gate command
4. update release/readiness docs to reference those commands
5. record the closeout in `docs/dev`
6. run the new lightweight entry points where practical

## Acceptance

- operators have one documented command for visual baseline refresh
- operators have one documented command for browser-assisted release validation
- release/readiness docs mention the new visual baseline set and notification failover checks
