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

## Periodic Sabotage Tests (Not Daily)
Run these periodically (weekly) and on every `policy-change:` PR:
- temporary critical function rename -> expect `CRITICAL_FUNCTION_MISSING`
- critical formatting changes -> regex checks remain robust

These are system validity checks, not per-push checks.

## Staging and Production Flow
1. Merge PR with green checks.
2. Run `Deploy Staging` on target SHA.
3. Observe staging for 24 hours:
   - `client_error_logs`
   - `store_events`
   - critical failures
   - drift findings
   - error spikes
4. Promote to Production using the exact same SHA.
5. Post-production watch:
   - first 30 minutes deep watch
   - regular review during first 24 hours

## Production Incident Rule
If any critical failure appears in production:
1. Rollback to last stable release immediately.
2. Open one incident record (error, file, time, environment, SHA).
3. Fix through full cycle:
   - PR -> checks -> staging 24h -> production

No direct production patching and no gate bypass.

## GitHub Governance (Repository Settings - Mandatory)
Configure `main` branch protection:
- Require pull request before merging: ON
- Required approvals: `1`
- Dismiss stale approvals: ON
- Require conversation resolution: ON
- Require status checks to pass: ON
- Include administrators: ON
- Restrict direct push: ON
- Allow force push: OFF
- Allow branch deletion: OFF

Required status checks on `main`:
- `release-gate`
- `policy-governance`

## Local Gate Commands
- Daily quick gate:
  - `npm run governance:quick`
- Full stage gate:
  - `powershell -File tools/deploy-staging.ps1`
- Full production gate:
  - `powershell -File tools/deploy-production.ps1`
