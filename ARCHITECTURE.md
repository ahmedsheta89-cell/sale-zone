# Sale Zone — Architecture Guide

## File Map
| File | Purpose | Used by |
|------|---------|---------|
| `ادمن_2.HTML` | Admin dashboard SPA | Direct URL |
| `متجر_2.HTML` | Store frontend SPA | Direct URL |
| `firebase-api.js` | Firestore data access layer | Admin + Store |
| `firebase-config.js` | Firebase init, transport policy, App Check prep | Admin + Store |
| `firebase-data.js` | Data seeding and realtime glue | Store |
| `cloudinary-service.js` | Cloudinary upload integration | Admin |
| `ERROR_DETECTION_SYSTEM.js` | Global error monitoring and image fallback handling | Admin + Store |
| `REAL_TIME_SYNC.js` | Realtime store synchronization | Store |
| `enhancement-utils.js` | UI/performance utilities | Admin + Store |
| `smart-features.js` | Store smart UX helpers | Store |
| `advanced-features.js` | Advanced storefront behaviors | Store |
| `UI_COMPONENTS.js` | Shared UI components | Admin + Store |
| `auth-utils.js` | Auth helpers and session logic | Admin + Store |
| `storage-keys.js` | localStorage key registry | Admin + Store |
| `core/logger.js` | Central logging core | Admin + Store |

## Data Flow
`Admin -> firebase-api.js -> Firestore <- firebase-api.js <- Store`

`Admin -> cloudinary-service.js -> Cloudinary`

`Store <- REAL_TIME_SYNC.js <- Firestore`

## Collections Reference
| Collection | Admin | Store | Notes |
|------------|-------|-------|-------|
| `products` | R/W/D | R (published only) | Store filters by `isPublished === true` |
| `banners` | R/W/D | R | Active storefront banners |
| `coupons` | R/W/D | R | Store reads active codes |
| `orders` | R/W | W | Customers create, admin updates status |
| `customers` | R/W/D | R/W (own) | Auth required for self-service |
| `suppliers` | R/archive | — | Soft delete only |
| `settings` | R/W | R | Store configuration and release gate state |
| `support_threads` | R/W | R/W (own) | Per-user support messaging |

## Why Firestore Direct (No Backend)
Firebase Spark plan does not support the project’s original Cloud Functions backend path.

All operational reads/writes now use the Firestore client SDK directly.

`callBackendApi()` still exists only as a compatibility stub and is intentionally unused.

To restore a backend API:
1. Upgrade to Blaze
2. Re-enable Cloud Functions deployment
3. Reintroduce signed server-side operations where needed

## Known Limitations
1. App Check is prepared but not activated until the owner provides a reCAPTCHA v3 site key.
2. Cloudinary delete is soft only because signed CDN deletion requires a backend.
3. Firebase Analytics is available in config but not fully instrumented.
4. Email/notification workflows still need backend support or third-party automation.
