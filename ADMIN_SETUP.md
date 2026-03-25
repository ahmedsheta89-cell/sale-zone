# Admin Setup

## Firebase Admin Custom Claim

Admin notifications require a refreshed Firebase ID token with an admin claim.

### Recommended claim

```json
{"admin": true}
```

### Also accepted by the current codebase

```json
{"role": "admin"}
```

## Manual setup steps

1. Open Firebase Console:
   `https://console.firebase.google.com/project/sale-zone-601f0/authentication/users`
2. Find the admin user.
3. Edit the user and add custom claims.
4. Save the change.
5. Log out from the admin panel.
6. Log back in so the browser refreshes the ID token.

## Why this matters

- `ادمن_2.HTML` checks the refreshed ID token before starting admin notifications.
- `assets/js/firebase-api.js` also checks the refreshed token before any `collectionGroup('notifications')` query.
- Firestore rules allow notification reads for admins only.

If notifications still show a permissions warning after setting the claim, deploy the latest `firestore.rules` and `firestore.indexes.json`, then log out and log back in again.
