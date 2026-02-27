# System State Map

## API Surface (`functions/src/app.js`)

### Public
- `GET /v1/health`
- `GET /v1/products`
- `GET /v1/banners`
- `GET /v1/coupons`

### Protected Customer
- `POST /v1/orders`
  - middleware: `verifyAppCheck -> verifyAuth -> ordersRateLimiter`
  - writes: `orders`, `order_events`, `audit_logs`, product stock updates (transaction)
- `GET /v1/orders`
  - middleware: `verifyAppCheck -> verifyAuth -> ordersRateLimiter`
  - read scope: own orders unless admin claim present

### Protected Admin
- root middleware: `verifyAppCheck -> verifyAuth -> verifyAdmin -> adminRateLimiter`
- routes:
  - `/v1/admin/products` (CRUD)
  - `/v1/admin/banners` (CRUD)
  - `/v1/admin/coupons` (CRUD)
  - `/v1/admin/settings/store` (PATCH allowlist)
  - `/v1/admin/orders/:id/status` (PATCH status)

### Protected Media
- `/v1/media/cloudinary-signature`
  - middleware: `verifyAppCheck -> verifyAuth -> verifyAdmin -> mediaRateLimiter`
  - replay guard scope: `media-signature`

## Validation Layers
- Input normalization/validation:
  - `functions/src/lib/validators.js`
- Order canonical recomputation and invariants:
  - `functions/src/routes/orders.js`
- Coupon uniqueness transaction guard:
  - `functions/src/routes/adminCoupons.js`

## Rate Limits
- Admin routes: 90 req / 60s
- Orders routes: 30 req / 60s
- Media signature routes: 10 req / 60s
- Storage: Firestore bucket collection `rate_limit_buckets`

## Replay Controls
- `functions/src/lib/replayGuard.js`
- scopes:
  - `orders` (20s window)
  - `media-signature` (45s window)

## Firestore Write Paths (Backend)
- `orders`
- `order_events`
- `audit_logs`
- `products` (stock decrement + admin CRUD)
- `banners` / `coupons` / `settings`
- `rate_limit_buckets`
- `request_replay_guards`
- audit collections:
  - `admin_activity_logs`
  - `suspicious_activity_logs`
  - `auth_failed_attempts`

## Client-Side Fail-Closed Behavior
- Sensitive operations in `firebase-api.js` throw if backend API URL is not configured:
  - `addOrder`
  - `updateOrderStatus`
  - `saveSettings`

