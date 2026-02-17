param(
    [string]$RollbackSha = "",
    [Parameter(Mandatory = $true)]
    [string]$Reason
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$workflowFile = "rollback-production.yml"

Write-Host "[rollback] Requested reason: $Reason"
if ($RollbackSha) {
    Write-Host "[rollback] Requested SHA: $RollbackSha"
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($null -eq $gh) {
    Write-Host "[rollback] gh CLI not found on this machine."
    Write-Host "[rollback] Open GitHub Actions workflow manually:"
    Write-Host "           https://github.com/ahmedsheta89-cell/sale-zone/actions/workflows/$workflowFile"
    Write-Host "[rollback] Required input: reason='$Reason'"
    if ($RollbackSha) {
        Write-Host "[rollback] Optional input: rollback_sha='$RollbackSha'"
    }
    exit 0
}

if ($RollbackSha) {
    gh workflow run $workflowFile --ref main -f rollback_sha="$RollbackSha" -f reason="$Reason"
} else {
    gh workflow run $workflowFile --ref main -f reason="$Reason"
}

if ($LASTEXITCODE -ne 0) {
    throw "[rollback] Failed to dispatch rollback workflow."
}

Write-Host "[rollback] Rollback workflow dispatched successfully."
