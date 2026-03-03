# Workers Paranoid Ultra Runbook

## Scope
- Runtime: BullMQ v5 workers.
- Gate policy: fail-closed, no warning bypass in paranoid mode.
- Core commands run from repository root:
  - `npm --prefix workers run detect:best-sha`
  - `npm --prefix workers run preflight:gate`
  - `npm --prefix workers run rollout:safe`

## Required Environment
- `REDIS_URL` (production/staging rollout)
- `NODE_ENV`
- `PARANOID_MODE=true`
- `WORKER_GROUP`
- `HEARTBEAT_KEY_PREFIX`
- `ROLL_OUT_KEY_PREFIX`
- `OUTPUT_DIR`
- `REDIS_FAIL_CLOSED` (`true` in production/staging)
- `REDIS_REQUIRE_TLS` (`true` in production/staging)
- `WATCHDOG_INTERVAL_MS` (default `900000`)
- `WATCHDOG_MAX_SILENCE_MS` (default `2700000`)
- `SHUTDOWN_TIMEOUT_MS` (default `60000`)
- `SCAN_COUNT` (default `100`)
- `SCAN_MAX_LOOPS` (default `1000`)
- `SCAN_TIME_BUDGET_MS` (default `2000`)

For CI dry runtime gate:
- `PREFLIGHT_DRY_RUN=true`

## Boot Sequence
1. Run SHA detector and inspect `workers/output/detect-best-sha.report.json`.
2. Run preflight gate and inspect `workers/output/preflight-gate.report.json`.
3. Trigger rollout workflow with exact SHA.
4. Verify `workers/output/rollout-safe.report.json` and timeline NDJSON.

## Abort Matrix
- `CONTRACT_VIOLATION`: stop rollout, fix contract/modules, rerun gate.
- `REDIS_CONNECTIVITY_FAILURE`: stop rollout, restore Redis availability.
- `RUNTIME_HEALTH_FAILURE`: stop rollout, inspect event loop lag and RSS.
- `ROLLBACK_TRIGGER`: rollout aborted due degraded readiness; hold deployment.
- `TIMEOUT_FAILURE`: treat as hard failure; no automatic continuation.

## Rollback Procedure
1. Mark current rollout as failed in deployment channel.
2. Set old worker group traffic to 100, new group to 0.
3. Drain new group with max timeout from contract.
4. Keep failed timeline artifact for forensics.
5. Open incident branch before any further rollout attempt.

## Preflight Backup And Verification
1. Run backup and baseline capture:
   - `node scripts/preflight-verify.js --create`
2. Validate backup integrity and rollback syntax:
   - `node scripts/preflight-verify.js`
3. Verify report artifacts:
   - `output/preflight-backup.bundle`
   - `output/preflight-baseline.json`
   - `output/preflight-verify.json`

## Redis Failure Playbook
1. Validate `PING` and RTT against contract threshold.
2. Check authentication/tls configuration.
3. Verify worker heartbeat key freshness.
4. Do not resume rollout until preflight passes with `PREFLIGHT_DRY_RUN=false`.

## Stuck Jobs Recovery
1. Inspect queue stalled and failed events.
2. Move poison jobs to dead-letter queue.
3. Requeue only transient failure class jobs.
4. Capture remediation action in incident log.

## Safe Deploy Procedure
1. CI `workers-paranoid-gate` must pass.
2. Trigger `workers-rollout` with locked SHA.
3. Confirm phase sequence:
   - `SHADOW_BOOT`
   - `READINESS_BARRIER`
   - `RAMP_5`
   - `RAMP_25`
   - `RAMP_50`
   - `RAMP_100`
   - `DRAIN_OLD`
   - `COMPLETE`
4. Any deviation means failed rollout.

## Canary Ramp Policy
1. `SHADOW_BOOT`: 0% traffic, 30m monitor-only window.
2. `RAMP_5` (canary): 5% traffic, 2h soak.
3. `RAMP_25`: 25% traffic, 4h soak.
4. `RAMP_50`: 50% traffic, 8h soak.
5. `RAMP_100`: full traffic after all gates pass.
6. Rollback triggers:
   - Error rate > `1.5x` baseline.
   - P99 latency > `2.0x` baseline.
   - Any watchdog silence breach.
   - Any atomic lock failure in cluster leader path.

## On-call Quick Commands
- Read detector report:
  - `cat workers/output/detect-best-sha.report.json`
- Read preflight report:
  - `cat workers/output/preflight-gate.report.json`
- Read rollout summary:
  - `cat workers/output/rollout-safe.report.json`
- Tail rollout timeline:
  - `tail -f workers/output/rollout-timeline.ndjson`
