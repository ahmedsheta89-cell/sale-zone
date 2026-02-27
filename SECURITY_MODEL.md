# Security Model

## Trust Boundaries
- Untrusted: browser runtime (`ادمن_2.HTML`, `متجر_2.HTML`, `firebase-api.js`, `cloudinary-service.js`).
- Trusted enforcement: Cloud Functions API (`functions/src/app.js` and route handlers).
- Data authority: Firestore documents written by backend (Admin SDK).
- Media authority: Cloudinary signed upload parameters issued by backend only.

## Security Invariants
- Business writes are backend-only for:
  - order creation
  - order status update
  - admin settings update
  - cloudinary signature issuance
- Client payload totals are never trusted; server recomputes canonical totals from product data.
- Stock must never go below zero.
- Replay attempts are blocked within configured windows for orders and media signatures.
- Admin routes require:
  - verified Firebase ID token
  - live admin claims check
  - valid App Check token
  - route-level rate limit

## Abuse Scenarios
- Price tampering: blocked by server recomputation + `validation/price-mismatch`.
- Oversell race: blocked by transaction + negative stock guard.
- Stale admin token after role downgrade: blocked by live claim re-check in `verifyAdmin`.
- Replay order submission: blocked by replay guard scope `orders`.
- Replay media signature request: blocked by replay guard scope `media-signature`.

## Threat Model Focus
- Privilege escalation through client-only flags: blocked by server-side middleware chain.
- Direct write bypass from browser to sensitive collections: blocked by fail-closed API usage and deny rules.
- Burst abuse at API edges: blocked by distributed Firestore-backed limiter and route-specific quotas.

