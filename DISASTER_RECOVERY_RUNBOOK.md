# Firestore Disaster Recovery Runbook

## Scope
- Project: `sale-zone-601f0`
- Database: Cloud Firestore `(default)`
- Backup target: Google Cloud Storage bucket

## Daily Backup
Run once per day from CI or scheduled host:

```powershell
powershell -ExecutionPolicy Bypass -File tools/firestore-backup.ps1 `
  -ProjectId sale-zone-601f0 `
  -BucketUri gs://YOUR_BACKUP_BUCKET `
  -Tag daily
```

## Weekly Restore Drill
1. Pick latest backup URI from `gs://YOUR_BACKUP_BUCKET/firestore-backups/sale-zone-601f0/`.
2. Run import in a staging project first.
3. Verify:
- `customers` count
- `orders` count
- `support_threads` count
- admin login + store checkout flow

Restore command:

```powershell
powershell -ExecutionPolicy Bypass -File tools/firestore-restore.ps1 `
  -ProjectId sale-zone-601f0 `
  -BackupUri gs://YOUR_BACKUP_BUCKET/firestore-backups/sale-zone-601f0/YYYYMMDD-HHMMSS-daily
```

## Production Restore Checklist
1. Freeze writes (maintenance mode).
2. Export current damaged state before import.
3. Import selected backup.
4. Run smoke checks:
- `node tools/preflight.js`
- `node tools/smoke-check.js`
5. Validate admin + store critical paths.
6. Unfreeze writes.

## Retention Policy
- Daily: keep 14 days
- Weekly: keep 8 weeks
- Monthly: keep 6 months

## Alerting
- Fail backup job if export command exits non-zero.
- Send alert with project ID, timestamp, and command output.
