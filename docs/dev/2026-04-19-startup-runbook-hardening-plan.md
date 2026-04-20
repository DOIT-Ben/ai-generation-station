# Startup Runbook Hardening Plan

## Mainline

- Active phase: `P6 Startup / Deployment / Runbook Hardening`
- Source TODO:
  - `docs/dev/2026-04-19-post-p0-p2-next-granular-todo.md`

## Goal

Make the local service startup path deterministic enough that later sessions do not need to rediscover how to launch, verify, and stop the product.

## Chosen Local Path

Use a repository-owned PowerShell wrapper as the canonical local launcher.

Reason:

- the app is already a Node server, but the unstable part was process management and environment bootstrap, not the server entry itself
- the Windows target environment already depends on `D:\document\PowerShell\profile.ps1` for safe env restoration in Codex-driven shells
- a wrapper can standardize:
  - profile bootstrap
  - working directory
  - log locations
  - PID file
  - health polling

## Planned Deliverables

1. start script
2. stop script
3. health/status script
4. shared helper script for PID/log/path resolution
5. `docs/dev` execution log
6. release-readiness update with the canonical commands

## Operational Rules

- runtime artifacts live under `output/runtime`
- logs use a fixed naming convention:
  - stdout log
  - stderr log
  - PID file
- start should:
  - detect an already-running healthy instance
  - avoid launching duplicates
  - wait for HTTP health before declaring success
- stop should:
  - only kill the managed repo server process
  - clean stale PID state
- health should:
  - verify both process identity and HTTP reachability

## Validation Plan

1. run the new start script from the repo
2. verify `http://localhost:18791` returns `200`
3. run the health script
4. run the stop script
5. verify the listener is gone
6. run the start script again to confirm restartability

## Known Risks

- a healthy listener may exist without a PID file from earlier manual launches
- PID reuse is possible if the PID file is stale
- the wrapper must not kill an unrelated process that happens to reuse the same port
