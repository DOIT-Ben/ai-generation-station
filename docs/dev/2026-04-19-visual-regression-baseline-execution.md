# Visual Regression Baseline Execution Log

## Mainline

- Active mainline: `Screenshot-Based Visual Regression Baseline`
- Source TODO:
  - `docs/dev/2026-04-19-post-p0-p2-next-granular-todo.md`

## Goal

Add the smallest stable screenshot-based regression layer for the current product shell.

## Strategy Decision

- keep Playwright as the capture engine
- do not add the Playwright Test runner in this phase
- compare PNG baselines with a lightweight pixel diff

## Initial Baseline Targets

1. auth gate card
2. authenticated utility cluster
3. admin panel
4. chat card in dark theme
5. chat card in light theme
6. lyrics card

## Initial Risks

- full-page screenshots would be noisier because the app contains fixed controls and dynamic areas
- font loading and animations can create screenshot flake unless the test stabilizes the page state
- visual artifacts need a clear storage split between:
  - tracked baselines
  - transient current captures
  - generated diffs

## Implementation

- Added a standalone visual-regression command:
  - `node test-ui-visual.js`
- Added artifact storage split:
  - tracked baseline: `test-artifacts/visual-baseline`
  - transient current captures: `test-artifacts/visual-current`
  - generated diffs: `test-artifacts/visual-diff`
- Added ignore rules for transient capture directories in `.gitignore`.
- Added the npm script:
  - `npm run test:ui-visual`
- Implemented `test-ui-visual.js` on plain Node + Playwright + `pngjs` + `pixelmatch`.
- Kept the suite on one desktop viewport only in this phase to control maintenance cost.

## Stabilization Decisions

- Used element screenshots instead of full-page screenshots to reduce noise from fixed controls and long pages.
- Forced reduced-motion rendering and disabled transitions, animations, and caret blinking before capture.
- Hid transient toast and loading surfaces during screenshot capture so notification timing does not pollute the baseline.
- Waited for font readiness before screenshot so card typography does not drift between runs.
- Re-opened a fresh browser context per capture to avoid state contamination between themes or tabs.
- Normalized the admin-panel login timestamp text before capture because it changes on every temp-db login.
- Added capture-specific fixed-utility visibility control so non-utility screenshots are not coupled to the floating top-right shell.
- Added a stable backdrop override for translucent card captures so viewport-relative background effects do not create false diffs.

## Final Capture Set

1. `auth-gate-card`
2. `utility-cluster-authenticated`
3. `admin-panel`
4. `chat-card-dark`
5. `chat-card-light`
6. `lyrics-card-light`

## Verification

Passed:

1. `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
2. `node test-ui-visual.js --port 18797 --launch-server`

Result:

- all six captures produced `0 px` diff on the validation run after baseline generation
- after the later P5 auth/account UI round, the baseline was intentionally refreshed again only after the screenshot stabilizers were tightened and revalidated to `0 px`

## New Problems Surfaced During This Round

- The admin panel includes dynamic “last login” time text. Without normalization, the screenshot would fail every run even when the UI was unchanged.
- Font loading and transition effects remain a real flake source in browser-level visual tests. These had to be stabilized explicitly instead of assuming Playwright screenshots would be deterministic by default.
- Full-page screenshots would have exaggerated fixed-shell noise and hidden the real intent of the baseline, which is component-level UI drift detection.
- Transient toast notifications and viewport-relative translucent backdrops can still poison element screenshots if they are not neutralized explicitly.

## Missed Earlier Assumptions

- Earlier docs still described screenshot-diff coverage as deferred. That is no longer true and had to be updated in the release and acceptance docs.
- “Visual regression” was initially treated as just storing screenshots, but the real requirement also included drift normalization for dynamic data and transient rendering behavior.

## Remaining Limits

- visual regression currently covers desktop only
- it does not cover tablet or mobile screenshots yet
- it does not cover generated result payloads, long chat transcripts, or upload states
- baseline fidelity still depends on the current local rendering environment, especially font availability
