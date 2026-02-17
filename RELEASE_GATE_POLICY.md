# Controlled Production Pipeline (Locked)

## Decision
- Production deploy is blocked if any required check fails.
- No manual bypass for production gate.
- Promotion flow is fixed: `PR -> Release Gate -> Staging (24h) -> Production`.
- Staging and Production must use the same commit SHA.
- Any post-production critical failure triggers rollback first, not hotfix-in-place.

## Daily Quick Check (Before Any Push)
Use one command only:
- `npm run governance:quick`

What it enforces:
1. Runs registry generator twice.
2. Verifies `registryHash`, `sourceHash`, and `policyHash` are stable.
3. Verifies committed registry is drift-free (no manual edits).
4. Runs all required checks.

If any step fails, push is blocked.

## Required Checks
- `preflight`: `node tools/preflight.js`
- `hash-stability`: `node tools/hash-stability-check.js`
- `smoke-check`: `node tools/smoke-check.js`
- `admin-function-monitor`: `node tools/admin-function-monitor.js`
- `rules`: `node tools/rules-test.js`
- `e2e`: `node tools/e2e-check.js`

Runner:
- `node tools/run-required-checks.js`

## Admin Function Monitoring Rules
- `monitoring/admin-function-registry.json` is generated artifact only.
- Source of truth:
  - `ادمن_2.HTML`
  - `monitoring/admin-function-policy.json`
- Generator:
  - `node tools/generate-admin-function-registry.js`
- Critical enforcement:
  - Missing critical function => `CRITICAL_FUNCTION_MISSING` => gate fail.
  - Invalid policy regex => `POLICY_INVALID_REGEX` => gate fail.
  - Drift in registry content/hash => gate fail.
- Admin UI monitor is redacted:
  - show status and general reason only
  - no regex internals / no `requiredPatterns`

## Policy Governance
- Policy file now includes `policyVersion`.
- If PR changes either file:
  - `monitoring/admin-function-policy.json`
  - `tools/generate-admin-function-registry.js`
- Then PR title must start with:
  - `policy-change:`
- Enforced by workflow:
  - `.github/workflows/policy-governance.yml`

## Same-SHA Promotion Enforcement
- Staging writes metadata file:
  - `output/staging-metadata.json`
  - fields: `targetSha`, `actualSha`, `createdAt`
- Firestore rules must be deployed from the same SHA before production:
  - workflow: `.github/workflows/deploy-firestore-rules.yml`
  - input: `target_sha`
- Production validates checkout SHA explicitly:
  - `git rev-parse HEAD` must match `target_sha`
- Production checks that staging artifact exists for the same SHA:
  - `staging-<target_sha>`
- Production also checks that `deploy-firestore-rules.yml` has a successful run on the same SHA.

## Periodic Sabotage Tests (Not Daily)
Run these periodically (weekly) and on every `policy-change:` PR:
- temporary critical function rename -> expect `CRITICAL_FUNCTION_MISSING`
- critical formatting changes -> regex checks remain robust

These are system validity checks, not per-push checks.

## Staging and Production Flow
1. Merge PR with green checks.
2. Run `Deploy Staging` on target SHA.
3. Run `Deploy Firestore Rules` on the same target SHA.
4. Observe staging for 24 hours:
   - `client_error_logs`
   - `store_events`
   - critical failures
   - drift findings
   - error spikes
5. Promote to Production using the exact same SHA.
6. Post-production watch:
   - first 30 minutes deep watch
   - regular review during first 24 hours

## Production Incident Rule
If any critical failure appears in production:
1. Rollback to last stable release immediately.
2. Open one incident record (error, file, time, environment, SHA).
3. Fix through full cycle:
   - PR -> checks -> staging 24h -> production

No direct production patching and no gate bypass.

## Rollback Automation
- Workflow:
  - `.github/workflows/rollback-production.yml`
- Trigger:
  - manual dispatch (`workflow_dispatch`)
- Inputs:
  - `reason` (required)
  - `rollback_sha` (optional)
- Default target resolution:
  - if `rollback_sha` is empty, workflow auto-selects `head_sha` from latest successful `deploy-production.yml` run.
- Local helper:
  - `powershell -File tools/deploy-rollback.ps1 -Reason "<reason>" [-RollbackSha "<sha>"]`

## GitHub Governance (Repository Settings - Mandatory)
Configure `main` branch protection:
- Require pull request before merging: ON
- Required approvals: `1`
- Dismiss stale approvals: ON
- Require conversation resolution: ON
- Require status checks to pass: ON
- Require linear history: ON
- Disable auto-merge before all required checks pass: ON
- Do not allow admin bypass: ON (if available in your GitHub plan)
- Include administrators: ON
- Restrict direct push: ON
- Allow force push: OFF
- Allow branch deletion: OFF

Required status checks on `main`:
- `release-gate`
- `policy-governance`
- `hash-stability`

## Local Gate Commands
- Daily quick gate:
  - `npm run governance:quick`
- Full stage gate:
  - `powershell -File tools/deploy-staging.ps1`
- Full production gate:
  - `powershell -File tools/deploy-production.ps1`
- Emergency rollback:
  - `powershell -File tools/deploy-rollback.ps1 -Reason "<reason>"`
