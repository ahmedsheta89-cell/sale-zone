# Admin Claims (Enterprise Setup)

This project expects **admin access** to be granted via **Firebase Auth custom claims** (server-issued), not by any email fallback.

## Prerequisites

- A Firebase/Google Cloud **Service Account JSON key** for the project.
  - Keep this file outside the repo and never commit it.
- The target admin user must:
  - Have a Firebase Auth account.
  - Have `email_verified == true` (verified email).

## Set Admin Role

```powershell
node tools\\set-admin-claim.js --service-account C:\\path\\to\\service-account.json --email you@example.com --role admin
```

Optional legacy compatibility (sets both `{ role: "admin" }` and `{ admin: true }`):

```powershell
node tools\\set-admin-claim.js --service-account C:\\path\\to\\service-account.json --email you@example.com --role admin --compat-admin-bool
```

## Clear Claims

```powershell
node tools\\set-admin-claim.js --service-account C:\\path\\to\\service-account.json --email you@example.com --clear
```

## Token Refresh

After updating claims, the user must **refresh their ID token**:

- Sign out and sign back in, or
- In code, call `getIdTokenResult(true)` (force refresh).

