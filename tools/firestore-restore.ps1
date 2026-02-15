param(
    [string]$ProjectId = "sale-zone-601f0",
    [string]$BackupUri = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BackupUri)) {
    throw "BackupUri is required. Example: gs://your-backup-bucket/firestore-backups/sale-zone-601f0/20260215-120000"
}

Write-Host "[WARN] Firestore import is destructive for overlapping documents."
Write-Host "       Project : $ProjectId"
Write-Host "       Source  : $BackupUri"

& gcloud firestore import $BackupUri --project $ProjectId

Write-Host "[OK] Firestore import completed from: $BackupUri"
