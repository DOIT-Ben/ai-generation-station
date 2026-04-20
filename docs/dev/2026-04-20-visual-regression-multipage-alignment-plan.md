# Visual Regression Multi-Page Alignment Plan

## Background

- the product no longer uses the old workspace-embedded auth/admin panels
- the current visual-regression script still targets legacy selectors such as:
  - `#auth-gate`
  - `#auth-form`
  - `#admin-panel`
- as a result, `node test-ui-visual.js --port 18797 --launch-server` now fails before it can validate real UI drift

## Goal

Realign screenshot coverage with the current multi-page product structure without expanding scope into a large visual-testing rewrite.

## Scope

Include:

- `test-ui-visual.js`
- refreshed tracked baselines under `test-artifacts/visual-baseline`
- visual-regression execution notes in `docs/dev`

Exclude:

- mobile/tablet visual coverage
- full-page screenshots
- new Playwright test-runner adoption

## Design Choice

Keep the current lightweight screenshot-diff harness and update it to capture the real current surfaces:

1. auth portal form surface
2. authenticated utility cluster
3. account-center security surface
4. admin console layout
5. chat card in dark theme
6. chat card in light theme
7. lyrics card in light theme

## Execution Order

### Phase 1: Selector And Flow Audit

1. identify legacy selectors in `test-ui-visual.js`
2. map each capture to the current page and stable selector
3. identify dynamic fields that still require normalization

### Phase 2: Script Realignment

1. replace legacy auth flow helpers with the dedicated `/auth/` flow
2. navigate explicitly across:
   - `/auth/`
   - `/account/`
   - `/admin/`
   - `/`
3. normalize dynamic admin timestamps again on the new page structure

### Phase 3: Baseline Refresh

1. regenerate the visual baselines intentionally
2. validate the new baseline set with a clean second pass

### Phase 4: Docs

1. update the visual-regression execution record
2. record why the baseline set changed

## Risks To Watch

1. updating the test script but forgetting to refresh the tracked baselines
2. missing a dynamic admin timestamp and creating screenshot flake
3. coupling portal-page screenshots to fixed utility controls unintentionally
