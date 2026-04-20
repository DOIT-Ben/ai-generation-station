# Capacity Baseline Plan

## Mainline

- Active phase: `P9 Capacity Baseline`
- Source queue:
  - approved post-`P8` follow-up TODO list

## Goal

Establish one repeatable local baseline for the current product before adding more user-facing operational scope.

## Chosen Scope

First-pass benchmark paths:

1. `POST /api/auth/login`
2. `GET /api/auth/session`
3. `POST /api/admin/users`
4. `GET /api/history/chat`

Profiles:

- low:
  - `10` concurrent workers
- medium:
  - `50` concurrent workers

## Chosen Approach

Use one repo-owned Node benchmark script instead of pulling in a heavier external load-testing dependency.

Reason:

- the current goal is baseline clarity, not production-scale load generation
- a local script is easier to version, tweak, and rerun alongside the app test suite
- the script can share the same temporary SQLite/test-server harness style as the existing regression files

## Metrics

Record at least:

- total requests
- success rate
- mean latency
- p50
- p95
- max
- throughput
- error-code distribution

## Validation Plan

1. create a benchmark script with warm-up support
2. run low profile
3. run medium profile
4. persist JSON artifacts under `test-artifacts/performance`
5. summarize bottlenecks and whether indexes/cleanup changes are needed
6. run one regression confidence pass after any follow-up code changes

## Known Limits

- the benchmark is local and single-host only
- the benchmark does not measure CPU/memory directly in this phase
- the benchmark does not simulate multi-process or multi-node deployment
