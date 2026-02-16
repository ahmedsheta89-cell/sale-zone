param(
    [switch]$SkipFirebaseRulesDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "[prod] Running required checks..."
node tools/run-required-checks.js
if ($LASTEXITCODE -ne 0) {
    throw "[prod] Required checks failed. Production deploy blocked."
}

Write-Host "[prod] Validating release checklist..."
node tools/validate-release-checklist.js
if ($LASTEXITCODE -ne 0) {
    throw "[prod] Release checklist is invalid. Production deploy blocked."
}

if ($SkipFirebaseRulesDeploy) {
    Write-Host "[prod] Checks passed. Firebase deploy skipped by flag."
    exit 0
}

Write-Host "[prod] Deploying Firestore rules..."
firebase deploy --only firestore:rules
if ($LASTEXITCODE -ne 0) {
    throw "[prod] Firebase rules deploy failed."
}

Write-Host "[prod] Production deploy finished successfully."
