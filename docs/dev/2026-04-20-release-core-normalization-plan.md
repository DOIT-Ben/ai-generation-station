# Release Core Normalization Plan

## Background

- The current round already contains substantial auth/account/admin and delivery changes.
- Browser automation is temporarily shelved for this session.
- The user asked for:
  - granular TODOs
  - explicit execution order
  - continued autonomous implementation
  - current-session documents and logs under `docs/dev`
  - a final git commit after regression

## Recommendation

Do not spend the next round chasing browser-launch environment issues.

Do this instead:

1. create a stable non-browser regression lane
2. normalize active docs and worktree rules around `docs/dev`
3. make the writable mirror committable
4. run focused release-core regression
5. commit the current integrated round

## Execution Order

### Phase 1: Release-Core Regression Lane

Goal:
- keep development moving even when browser automation is unavailable

Granular TODO:
1. inspect `test-regression.js` and identify which suites are blocked by browser launch
2. add CLI flags to skip browser-driven suites intentionally
3. define a `release-core` test path that keeps:
   - markup/state/style
   - auth/history/state-store
   - security gateway
   - task persistence
   - local route smoke/failure coverage
4. add package scripts for the new regression lane
5. update release/readiness docs to distinguish:
   - release-core regression
   - full browser-assisted regression

Acceptance:
- one stable non-browser regression command exists
- the command is documented
- it can be used as the default phase-end gate for this session

### Phase 2: Docs/Worktree Normalization

Goal:
- make `docs/dev` the unambiguous active write target for the current round

Granular TODO:
1. create this plan document
2. create a matching execution log
3. archive the current 2026-04-20 extension status under `docs/dev`
4. update the dev archive index with the latest read order
5. update the docs bridge note if the active-path rule needs tightening
6. normalize ignore rules for:
   - historical `docs/开发过程文档`
   - generated `test-artifacts`

Acceptance:
- future sessions can start from `docs/dev` without ambiguity
- historical files no longer pollute the active worktree

### Phase 3: Git Commit Closure

Goal:
- finish this integrated round with a real commit in the writable mirror

Granular TODO:
1. bootstrap `.git` metadata into the writable mirror if it is missing
2. verify git status from the mirror
3. run release-core regression
4. if regression fails, fix issues before staging
5. stage the finalized code and docs set
6. create one commit covering the normalized round
7. record the commit result in the execution log

Acceptance:
- the writable mirror becomes a usable git workspace
- the current round is committed after regression

## Phase-End Test Cadence

1. after Phase 1:
   - run the new release-core regression command once
2. after Phase 2:
   - rerun release-core regression to confirm docs/ignore changes did not disturb scripts
3. after Phase 3:
   - rerun release-core regression immediately before commit if any code changed after the previous run

## Scope Guard

Do not reopen these in this round unless a regression forces it:

- browser launch environment repair
- visual baseline refresh
- new product features outside the current integrated auth/admin/release round
