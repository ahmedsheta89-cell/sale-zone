# Hostile Red-Team Launch-Blocker Report

## Scope Lock
- Target root: `c:\Users\sale zone store\Downloads\sale-zone-main`
- Snapshot time: `2026-02-24T01:32:31.9312009+02:00`
- Branch: `release/lockdown-stabilization`
- HEAD: `3de127f3b03e4186843d5b077aa06b68a5d75585`
- Dirty tree: `true`

## Trust Boundary Map (Code-Evidence)
- Frontend trust surface:
  - `firebase-api.js:61`, `firebase-api.js:63`, `firebase-api.js:862`, `firebase-api.js:1809`
  - `cloudinary-service.js:47`
  - `firebase-config.js:122`, `firebase-config.js:125`
  - `ادمن_2.HTML:3188`, `ادمن_2.HTML:3255`
  - `متجر_2.HTML:3120`, `متجر_2.HTML:3265`
- Backend boundary:
  - `functions/src/app.js:65`, `functions/src/app.js:72`, `functions/src/app.js:73`
  - `functions/src/middleware/verifyAuth.js:20`
  - `functions/src/middleware/verifyAdmin.js:3`
  - `functions/src/middleware/verifyAppCheck.js:33`
  - `functions/src/middleware/rateLimit.js:2`
- Data boundary:
  - `firestore.rules:22`, `firestore.rules:432`, `firestore.rules:579`

---

## STAGE 1 — Security Boundary Destruction

### Exploit 1: Forged admin client flag
- Path: `sessionStorage.adminLoggedIn=true`
- Repro:
  1. `sessionStorage.setItem('adminLoggedIn','true')`
  2. Call `/v1/admin/products` with non-admin token.
- Evidence:
  - Client flag exists: `ادمن_2.HTML:3255`
  - Server claim gate: `functions/src/middleware/verifyAdmin.js:3`
- Result: **blocked**
- Block point: `verifyAdmin()`
- Severity: **2/10**

### Exploit 2: JWT payload tampering
- Path: modified bearer token body.
- Repro:
  1. Decode token.
  2. Edit payload to set `admin=true`.
  3. Re-sign with invalid key and send.
- Evidence: `functions/src/middleware/verifyAuth.js:20`
- Result: **blocked**
- Block point: `verifyIdToken(token, true)`
- Severity: **1/10**

### Exploit 3: Stale token after admin claim removal
- Path: claim removed server-side, old token reused.
- Repro:
  1. Mint admin token.
  2. Remove admin claim without force revocation.
  3. Keep calling admin routes.
- Evidence:
  - Admin decision from token claims: `functions/src/middleware/verifyAdmin.js:3`
  - No freshness binding in middleware beyond token verification: `functions/src/middleware/verifyAuth.js:20`
- Result: **succeeds**
- Block point: `none`
- Severity: **8/10**
- Impact: temporary unauthorized admin actions until token expiry/revocation.

### Exploit 4: App Check missing/invalid token
- Path: missing header / malformed header.
- Repro:
  1. Send bearer token without `X-Firebase-AppCheck`.
  2. Send empty/random app-check value.
- Evidence:
  - Missing token reject: `functions/src/middleware/verifyAppCheck.js:27`
  - Invalid token reject: `functions/src/middleware/verifyAppCheck.js:33`, `functions/src/middleware/verifyAppCheck.js:43`
- Result: **blocked**
- Block point: `verifyAppCheck()`
- Severity: **2/10**

### Exploit 5: App Check token replay
- Path: replay valid token across repeated requests.
- Repro:
  1. Capture one valid app-check token.
  2. Replay until token expiration.
- Evidence: `functions/src/middleware/verifyAppCheck.js:33`
- Result: **succeeds**
- Block point: `none`
- Severity: **6/10**
- Impact: replay window exists at app layer.

### Exploit 6: Middleware order bypass attempt
- Path: direct route targeting to skip middlewares.
- Evidence:
  - Admin chain: `functions/src/app.js:65`
  - Orders chain: `functions/src/app.js:72`
  - Media chain: `functions/src/app.js:73`
- Result: **blocked**
- Block point: Express router chain
- Severity: **1/10**

### Exploit 7: Direct Firestore write with non-admin token
- Path: write to `settings`, `products`, `banners`, `coupons`.
- Evidence:
  - Settings admin-only: `firestore.rules:423`, `firestore.rules:425`
  - Products admin-only write: `firestore.rules:407`, `firestore.rules:409`
- Result: **blocked**
- Block point: Firestore Rules
- Severity: **2/10**

### Exploit 8: Client-controlled backend bypass for orders
- Path: `window.__USE_BACKEND_API__ = false` then submit order.
- Repro:
  1. In DevTools: `window.__USE_BACKEND_API__ = false`
  2. Submit checkout flow.
  3. Code falls back to direct Firestore writes.
- Evidence:
  - Toggle gate: `firebase-api.js:63`
  - Backend path switch: `firebase-api.js:862`
  - Direct Firestore order write path: `firebase-api.js:882`, `firebase-api.js:1195`
- Result: **succeeds**
- Block point: `none`
- Severity: **8/10**
- Impact: bypasses backend abuse controls for order path.

---

## STAGE 2 — Business Logic Exploit

### Negative total
- Evidence: `functions/src/lib/validators.js:162`, `firestore.rules:71`
- Result: **blocked**
- Severity: **2/10**

### Revenue manipulation (`items` high, `total` low)
- Evidence:
  - Only non-negative total enforced: `functions/src/lib/validators.js:162`
  - Order persisted as client-supplied totals: `functions/src/routes/orders.js:37`, `functions/src/routes/orders.js:54`
- Result: **succeeds**
- Severity: **9/10**
- Impact: underpayment attack path.

### Oversized `items[]` inside 1MB request
- Evidence:
  - Body limit only: `functions/src/app.js:33`
  - No max-items check: `functions/src/lib/validators.js:159`
- Result: **succeeds**
- Severity: **7/10**

### Duplicate replay with same idempotency key
- Evidence:
  - Transaction duplicate check: `functions/src/routes/orders.js:43`, `functions/src/routes/orders.js:47`
- Result: **blocked**
- Severity: **3/10**

### Variant-key replay spam
- Evidence:
  - New order id derives only from incoming key: `functions/src/routes/orders.js:6`, `functions/src/routes/orders.js:38`
- Result: **succeeds**
- Severity: **8/10**

### Coupon abuse (extreme values, duplicate code)
- Evidence:
  - Discount only checked as `>=0`: `functions/src/lib/validators.js:118`
  - No uniqueness check before insert: `functions/src/routes/adminCoupons.js:37`
- Result: **succeeds**
- Severity: **7/10** (extreme value), **6/10** (duplicate code)

### Settings tampering (arbitrary keys)
- Evidence:
  - Unfiltered patch payload: `functions/src/lib/validators.js:139`
  - Direct merge to settings doc: `functions/src/routes/adminSettings.js:10`
- Result: **succeeds**
- Severity: **7/10**

### Inventory underflow / oversell
- Evidence:
  - No stock reservation/decrement in order transaction path: `functions/src/routes/orders.js:35-87`
- Result: **succeeds**
- Severity: **8/10**

---

## STAGE 3 — Media Pipeline Attack

### Signature replay
- Evidence:
  - Signature generated from `timestamp/folder/public_id` only: `functions/src/routes/media.js:40-46`
  - No server nonce store or one-time signature tracking.
- Result: **succeeds**
- Severity: **7/10**

### Folder traversal attempt
- Evidence: `functions/src/routes/media.js:19-20`
- Result: **blocked**
- Severity: **2/10**

### `public_id` traversal injection
- Evidence: `functions/src/routes/media.js:38`
- Result: **blocked**
- Severity: **2/10**

### Non-image / oversized upload policy gap
- Evidence:
  - Signing endpoint does not validate content type/size: `functions/src/routes/media.js:26-63`
  - Client uploads directly after signature: `cloudinary-service.js:80-93`
- Result: **succeeds**
- Severity: **6/10** (type), **7/10** (size)

### Resource-type override gap
- Evidence:
  - Resource constraints not locked in signature payload: `functions/src/routes/media.js:40-46`
- Result: **succeeds**
- Severity: **6/10**

### Unsigned fallback
- Evidence:
  - No base64 fallback: `cloudinary-service.js:5`
  - Missing backend URL hard-fails: `cloudinary-service.js:20`
- Result: **blocked**
- Severity: **2/10**

---

## STAGE 4 — Rate-Limit and Abuse Resilience

### Memory-only limiter
- Evidence:
  - Local map state: `functions/src/middleware/rateLimit.js:2`
  - Key strategy: `${routeKey}:${uid||ip}` at `functions/src/middleware/rateLimit.js:45`
- Result: **succeeds** for cold-start reset, scale-out bypass, distributed spam
- Severity: **8/10**

### Order/media flood under autoscaling
- Evidence:
  - Protected routes use same in-process limiter: `functions/src/app.js:72`, `functions/src/app.js:73`
- Result: **succeeds**
- Severity: **9/10** (orders), **8/10** (media signatures)

---

## STAGE 5 — Error and Data-Leak

### Stack trace exposure attempt
- Evidence:
  - Response includes `code/message/requestId` only: `functions/src/app.js:99`
- Result: **blocked**
- Severity: **3/10**

### Internal message disclosure
- Evidence:
  - Raw `error.message` forwarded to response: `functions/src/app.js:84`, `functions/src/app.js:99`
- Result: **succeeds**
- Severity: **6/10**

### Secret leakage checks
- Cloudinary secret:
  - Secret loaded server-side only: `functions/src/index.js:8-10`
  - Signature endpoint response excludes `api_secret`: `functions/src/routes/media.js:58-63`
  - Result: **blocked**
  - Severity: **2/10**
- Firebase web config:
  - Public config visible in client: `firebase-config.js:6-12`
  - Result: **expected/public**
  - Severity: **1/10**

### Unhandled promise crash
- Evidence:
  - Route handlers wrapped in try/catch and centralized error middleware: `functions/src/routes/orders.js:35`, `functions/src/routes/media.js:26`, `functions/src/app.js:83`
- Result: **blocked**
- Severity: **3/10**

---

## STAGE 6 — Scalability Breakpoints

### In-memory search filtering on orders
- Evidence:
  - Pull then filter pattern: `functions/src/routes/orders.js:135`, `functions/src/routes/orders.js:148`
- Result: **succeeds**
- Severity: **6/10**
- Impact: CPU growth + pagination drift under large datasets.

### Write amplification on order creation
- Evidence:
  - Transaction writes order + event + audit: `functions/src/routes/orders.js:54-80`
  - Additional activity logging call: `functions/src/routes/orders.js:95`
- Result: **succeeds**
- Severity: **7/10**

### Unbounded operational log growth
- Evidence:
  - Writes to `admin_activity_logs`, `suspicious_activity_logs`, `auth_failed_attempts`: `functions/src/lib/logging.js:59`, `functions/src/lib/logging.js:77`, `functions/src/lib/logging.js:95`
- Result: **succeeds**
- Severity: **6/10**

### Index coverage risk for combined filters
- Evidence:
  - Dynamic combined filters in orders route: `functions/src/routes/orders.js:122-133`
  - Index file includes subset only: `firestore.indexes.json`
- Result: **succeeds** (risk of query failure/degrade for certain combos)
- Severity: **5/10**

---

## Stage 7 — Zero-Trust Scoring
- Security Boundary Integrity: **5.8 / 10**
- Privilege Escalation Resistance: **5.0 / 10**
- Abuse Resistance: **3.1 / 10**
- Business Logic Safety: **3.4 / 10**
- Media Security: **4.2 / 10**
- Scalability Resilience: **3.6 / 10**
- Overall Production Risk Level: **High**

## Final Verdict
**NOT SAFE FOR LAUNCH**

Launch is blocked by exploitable revenue manipulation, backend-bypass fallback for order flow, memory-only abuse controls, and replay/size policy gaps in media signing flow.
