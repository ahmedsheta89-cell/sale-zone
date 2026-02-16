Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "[stage] Running required checks..."
node tools/run-required-checks.js
if ($LASTEXITCODE -ne 0) {
    throw "[stage] Required checks failed. Staging deploy blocked."
}

Write-Host "[stage] Required checks passed."
Write-Host "[stage] Commit this state and run staging workflow on GitHub Actions:"
Write-Host "        Actions -> Deploy Staging -> Run workflow"
