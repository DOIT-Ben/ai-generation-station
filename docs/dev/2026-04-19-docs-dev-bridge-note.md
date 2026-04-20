# Docs Dev Bridge Note

## Purpose

Make the active documentation entry point unambiguous for future sessions.

Recent rapid delivery rounds created two documentation trees:

- `docs/dev`
- `docs/开发过程文档`

This note defines how they should be used going forward.

## Rule

### Active Write Target

Use `docs/dev` for:

- current plans
- current execution logs
- acceptance notes
- release-readiness notes
- bridge documents that explain current working conventions

### Historical Archive

Treat `docs/开发过程文档` as historical context for earlier rounds:

- keep it for traceability
- reference it when older decisions matter
- do not treat it as the default place for new active work

## Entry Points

Start here first:

1. `docs/dev/2026-04-19-dev-archive-index.md`
2. the current mainline plan or execution log named in that index

Go to the historical archive only when:

1. the active docs explicitly reference an older round
2. startup/environment recovery details are needed
3. a regression or UI decision was made only in the older archive

## Worktree Note

- active `docs/dev` files should be considered the canonical current-session write target
- historical `docs/开发过程文档` files may remain locally preserved but should not re-enter the active git workflow for the current round
- future cleanup should not mix active and historical docs again without an explicit migration decision

## Current Tightened Rule

For the current round:

1. create all new plans, execution logs, release notes, and bridge notes under `docs/dev`
2. if a historical document is still needed, reference it from a new `docs/dev` summary instead of resuming active writes in the historical tree
3. prefer ignoring the historical tree in the active worktree rather than restaging it opportunistically
