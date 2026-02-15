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

## If Service Account Key Creation Is Blocked (Org Policy)

Some Google Cloud organizations enforce a policy that **disables service account key creation**. In that case you can still set custom claims **without keys** using the Firebase CLI Auth import flow.

1. Get the target user's UID:
   - Firebase Console -> Authentication -> Users -> search by email -> copy `UID`
2. Re-auth Firebase CLI (interactive):
   - Run `firebase login --reauth`
3. Create a minimal import file (example sets both `role=admin` and `admin=true`):

```powershell
$uid = "PASTE_UID_HERE"
$tmp = Join-Path $env:TEMP "sale-zone-admin-claims.json"

@"
{
  "users": [
    {
      "localId": "$uid",
      "customAttributes": "{\"role\":\"admin\",\"admin\":true}"
    }
  ]
}
"@ | Set-Content -Encoding utf8 $tmp

firebase auth:import $tmp --project sale-zone-601f0
```

If `auth:import` is not permitted, ask your org/admin to run the import or grant a role that can manage Firebase Auth users (custom claims).
