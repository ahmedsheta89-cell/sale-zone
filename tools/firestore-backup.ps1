param(
    [string]$ProjectId = "sale-zone-601f0",
    [string]$BucketUri = "",
    [string]$Tag = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BucketUri)) {
    throw "BucketUri is required. Example: gs://your-backup-bucket"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$suffix = if ([string]::IsNullOrWhiteSpace($Tag)) { "" } else { "-$Tag" }
$exportUri = "$BucketUri/firestore-backups/$ProjectId/$timestamp$suffix"

Write-Host "[INFO] Starting Firestore export..."
Write-Host "       Project: $ProjectId"
Write-Host "       Target : $exportUri"

& gcloud firestore export $exportUri --project $ProjectId

Write-Host "[OK] Firestore export completed: $exportUri"
