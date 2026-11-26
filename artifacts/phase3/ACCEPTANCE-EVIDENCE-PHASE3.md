# SALE ZONE STORE — PHASE 3B ACCEPTANCE, SECURITY & CHECKOUT CLOSURE EVIDENCE
**Release Version:** `2026.11.26.0001` (`PHASE-3B-DIRECT-ORDER-PARITY-CLOSURE-001`)
**Pull Request:** [#293](https://github.com/ahmedsheta89-cell/sale-zone/pull/293)
**Branch:** `fix/phase3-commerce-integrity-2026-11`
**Base:** `main` (`be7ebc445891c44025f282f6aed5cef41f8534b3`)
**Platform Architecture:** Vanilla HTML/CSS/JavaScript (RTL Arabic), Firebase Spark (Free Tier)

---

## 1. PHASE 3B DEFECTS CLOSED

1. **Order Line Identity (`lineId`) & Uniqueness (`firestore.rules` + `firebase-api.js`):**
   - `firestore.rules` requires every item in customer-created `/orders` to carry a non-empty `lineId` (`<= 128` chars) unique across all items (`(0,1)`, `(0,2)`, `(1,2)`).
   - `updateOrderStatus()` disambiguates duplicate/legacy `lineId` keys by index (`__idx_${i}`) and forbids `inventoryDeducted: true` unless every line completes deduction.
2. **Inventory Aggregation & Explicit `trackInventory` Policy (`firestore.rules` + `firebase-api.js`):**
   - Aggregated quantity per `productId` (`aggQtyFrom`) prevents split-line overselling (`6 + 6 = 12 > stock 10` denied by Rules and `verifyAndEnforceCatalogPricing()`).
   - Products with `trackInventory !== false` and missing/non-numeric `stock` fail closed (`permission-denied`).
3. **14-Point Coupon Contract Parity (`firestore.rules` + `firebase-api.js` + `متجر_2.HTML` + `ادمن_2.HTML`):**
   - Unified `minOrderAmount`/`minOrder`, `expiresAt` (`Timestamp`, `expiresAtMs`, ISO string vs `request.time`), `active`/`isActive`/`status`, `usageLimit`/`maxUses` vs `usedCount`, `couponCode` matching `c.code`, `maxDiscount`, and 90% percentage cap.
4. **Concurrent Coupon & Loyalty Integrity (`assets/js/firebase-api.js`):**
   - Removed the silent `Math.min(prevPts, pointsToDeduct)` loyalty bypass and the `couponLimitExceeded` confirmation pass-through in `updateOrderStatus()`; concurrent races now fail closed without confirming unbacked discounts.
5. **Spark-Safe `>3` Item Checkout Compatibility (`/order_intents/{intentId}`):**
   - Direct customer `/orders` creation enforces `1..3` items (`<= 6` `get()` calls worst-case, safely below Spark's 10-read and 1,000-expression limits — 4 distinct items on `/orders` previously hit 1,000 expressions).
   - Carts with `> 3` items (`4, 5, 6+`) route cleanly via `persistOrderOnline()` to `/order_intents/{id}` (`status: 'pending_review'`, `commercialVerified: false`, `requiresAdminReview: true`), appear in customer "طلباتي", and promote to `/orders` only via Admin `approveOrderIntent()`.

---

## 2. VERIFICATION RESULTS (SEPARATED BY REALITY BOUNDARY)

| Layer | Suite / Command | Observed Result |
|:---|:---|:---:|
| **Track A1 — Unit & Mock Integration** | `cloudinary-retry` (18/18), `phase1` (30/30), `phase2` (16/16), `phase3` (23/23) | **87 / 87 PASS** |
| **Track A2 — Real Firestore Rules Emulator** | `tests/firestore-rules-emulator.test.js` (`demo-sale-zone-e2e`, `Rule-1`..`Rule-13`) | **13 / 13 PASS** |
| **Track B1 — Mock UI Playwright Checks** | `npx playwright test` (`tests/e2e/`) | **22 / 22 PASS** |
| **Track B2 + C — Real Browser + Auth/Firestore Emulators** | `npx playwright test --config=playwright.emulator.config.js` (`tests/e2e-emulator/`) | **5 / 5 PASS** |
| **Unified Release Gate** | `node tools/run-required-checks.js` | **14 / 14 PASS** |

---

## 3. GOVERNANCE HANDOVER

- **Status:** **`READY_FOR_SECOND_ACCOUNT_REVIEW`** (`@szs712026-cmyk`)
- No merge to `main`, no production deployment, and no paid Firebase services enabled.
