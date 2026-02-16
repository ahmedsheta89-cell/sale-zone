# Release Gate Policy (Locked)

## Decision
- Production deploy is blocked if any required check fails.
- No manual bypass for production gate.
- Flow is mandatory: fail -> root cause -> fix -> rerun checks -> stage -> production.

## Required Checks
- `preflight`: `node tools/preflight.js`
- `smoke-check`: `node tools/smoke-check.js`
- `rules`: `node tools/rules-test.js`
- `e2e`: `node tools/e2e-check.js`

## Local Commands
- Run all required checks:
  - `node tools/run-required-checks.js`
- Stage gate:
  - `powershell -File tools/deploy-staging.ps1`
- Production gate:
  - `powershell -File tools/deploy-production.ps1`

## Release Checklist (Mandatory)
Before production, create `release/release-checklist.json` using:
- `release/release-checklist.template.json`

Mandatory fields:
- `failureId`
- `rootCause`
- `fixCommit`
- `validationEvidence`

Validation command:
- `node tools/validate-release-checklist.js`

## GitHub Workflows
- `Release Gate`: runs required checks on PR/push.
- `Deploy Staging`: reruns required checks and publishes staging artifact.
- `Deploy Production`: blocked unless:
  - release gate succeeded for target SHA
  - staging succeeded for same SHA
  - checklist is valid
  - required checks pass again on target SHA

## Failure Handling
- On any failed check:
  - open one failure record with error, file, time, environment.
  - capture root cause and fix commit.
  - rerun all required checks.
  - rerun staging.
  - promote to production only after all green.

## Emergency Rule
- Emergency handling uses rollback to last stable release.
- Emergency never bypasses required checks.

## Regression Rule
- If the same failure signature repeats twice, add a permanent regression check/script before next production deploy.
