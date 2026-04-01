# ?? Error Registry � Sale Zone Project
> Cumulative log of every error encountered + root cause + solution + lessons learned
>
> Last updated: auto
> Total errors logged: 18
> Total patterns discovered: 8

---

## How to Use

### To find an error:
1. Search by Error Message (Ctrl+F)
2. Or search by Category
3. Or search by Tag

### To log a new error:
1. Copy the Template at the bottom
2. Fill in all fields
3. Add it under the correct Category
4. Update the counters above

---

## Index

| Category | Count | Last Added |
|----------|-------|------------|
| [Firebase Auth](#firebase-auth) | 3 | 2025-01 |
| [Firestore Rules](#firestore-rules) | 2 | 2025-01 |
| [Firestore Indexes](#firestore-indexes) | 1 | 2025-01 |
| [Deployment Pipeline](#deployment-pipeline) | 3 | 2026-03 |
| [Git & Branching](#git--branching) | 2 | 2025-01 |
| [Governance Checks](#governance-checks) | 3 | 2026-03 |
| [Orders & Checkout](#orders--checkout) | 2 | 2026-03 |
| [Catalog & Import](#catalog--import) | 1 | 2026-04 |
| [Observability & Logging](#observability--logging) | 1 | 2026-03 |

---

## Firebase Auth

### ERR-001: Permission Denied � Customer Notifications Before Auth Ready

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #auth #notifications #timing #race-condition

**Error Message:**
```text
FirebaseError: Missing or insufficient permissions
at notifications collection query
```

**When it appears:**
- Customer opens storefront
- Code tries to read notifications from Firestore
- But onAuthStateChanged has not fired yet
- user = null at query time

**Root Cause:**
Code was executing Firestore queries in DOMContentLoaded before Firebase Auth completed initialization. Firestore Rules require `request.auth != null`, so the query gets rejected because auth is still null.

Timeline:
1. Page loads ? DOMContentLoaded fires
2. Code requests notifications ? Firestore query
3. Firebase Auth still verifying session
4. request.auth = null ? PERMISSION DENIED
5. After ~500ms: onAuthStateChanged fires ? auth ready
6. But the error already happened

**Solution:**
Move all Firestore queries inside onAuthStateChanged callback:

```javascript
// ? Before (wrong)
document.addEventListener('DOMContentLoaded', function() {
    loadNotifications(); // auth not ready!
});

// ? After (correct)
firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        loadNotifications(); // auth is ready
    }
});
```

Files affected: `����_2.HTML`, `assets/js/firebase-api.js`
Commit: `c907dac`

**Prevention Rule:**
Any Firestore query that depends on auth MUST be inside onAuthStateChanged, never in DOMContentLoaded or window.onload.

**Related Errors:** ERR-002, ERR-003
**Severity:** ?? High � affects every site visitor

---

### ERR-002: Admin Notification Race Condition

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #auth #admin #notifications #race-condition

**Error Message:**
```text
Admin notifications failed to load
getIdTokenResult returned null claims
```

**When it appears:**
- Admin opens control panel
- Notifications try to load
- But getIdTokenResult has not returned yet

**Root Cause:**
Same pattern as ERR-001 but with an extra layer:
1. onAuthStateChanged fires ? user exists
2. Code calls getIdTokenResult ? async
3. Before it returns: code tries to load admin notifications
4. claims.admin = undefined ? fallback fails

**Solution:**
Sequential waiting:

```javascript
firebase.auth().onAuthStateChanged(async function(user) {
    if (user) {
        const idTokenResult = await user.getIdTokenResult();
        if (idTokenResult.claims.admin) {
            loadAdminNotifications();
        }
    }
});
// + Fallback: retry after 2 seconds (token refresh)
```

Commit: `2acd338`

**Prevention Rule:**
Any code that depends on admin claims MUST await getIdTokenResult first and have a fallback + retry mechanism.

**Related Errors:** ERR-001, ERR-003
**Severity:** ?? Medium � affects admin only

---

### ERR-003: Storefront Firestore Queries Before Auth Init

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #auth #storefront #firestore #initialization

**Error Message:**
```text
upsertLiveSession permission denied (repeated)
Firestore query failed before auth ready
```

**Root Cause:**
Storefront calls upsertLiveSession to record user visits but fires it before auth is ready. Result: repeated permission denied every second.

**Solution:**
Add auth readiness gate:
- Boolean variable: `isAuthReady = false`
- onAuthStateChanged sets it to `true`
- All Firestore operations check it first

Commit: `640476c`

**Discovered Pattern:** PATTERN-001 (Auth Timing Pattern)
**Related Errors:** ERR-001, ERR-002
**Severity:** ?? High � fills console and slows site

---

## Firestore Rules

### ERR-004: CollectionGroup Query Blocked by Missing Rules or Index

?? Date: 2025-01
?? Batch: Post-BATCH19 hotfix
??? Tags: #firestore #rules #collectionGroup #notifications

**Error Message:**
```text
Missing or insufficient permissions
at collectionGroup('notifications')
```

**Root Cause:**
Firestore collectionGroup queries require rules and indexes aligned to the actual query shape. Regular path rules like `match /customers/{uid}/notifications/{notifId}` do not replace a top-level wildcard match for collectionGroup reads.

Additionally, collectionGroup queries can require collection-group indexing support matching the actual query shape.

**Solution:**
1. Keep notification paths aligned to the real architecture
2. Ensure the wildcard collectionGroup read rule exists in `firestore.rules`
3. Ensure `firestore.indexes.json` contains collection-group index support matching the real admin query shape

**Important Lesson:**
Firestore collectionGroup queries need TWO layers to align:
- ? Rule with wildcard path: `/{path=**}/collection/{docId}`
- ? Index support matching the actual collectionGroup query shape
If either side is wrong = runtime failure

**Severity:** ?? High � admin notifications broken

---

### ERR-005: Notification Paths Mismatch Between Code and Rules

?? Date: 2025-01
?? Batch: Post-BATCH19 hotfix
??? Tags: #firestore #rules #notifications #architecture

**Root Cause:**
External suggestions proposed `/users/{userId}/notifications` path, but the actual codebase uses:
- `customers/{uid}/notifications/{notificationId}` � for customer notifications
- `settings/{settingId}/notifications/{notificationId}` � for admin/system notifications
- `collectionGroup('notifications')` � for admin to read all

Applying the wrong path structure would break all existing notification data.

**Prevention Rule:**
ALWAYS check actual code paths in `firebase-api.js` BEFORE writing Firestore rules. Never assume path structure from external suggestions.

**Severity:** ?? High � would break all notifications if applied

---

## Firestore Indexes

### ERR-006: Unnecessary Composite Index Causing Deploy Warnings

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #firestore #indexes #deploy #cleanup

**Symptoms:**
Firebase deploy shows warnings about composite index for orders collection (uid + createdAt + __name__) that is not used by any query.

**Solution:**
Remove the index from `firestore.indexes.json`.
Commit: `b9832e0`

**Prevention Rule:**
Review indexes periodically. Delete unused ones. Every index consumes storage and slows writes.

**Severity:** ?? Low � warning only

---

## Deployment Pipeline

### ERR-007: Deploy Backend Workflow Failing

?? Date: 2026-03
?? Batch: Post-PR#104 audit
??? Tags: #deploy #backend #github-actions #pipeline

**Symptoms:**
Multiple `deploy-backend.yml` runs were failing, blocking backend promotion.

**Root Cause:**
The repository declared Firebase Spark mode with Cloud Functions disabled, but `deploy-backend.yml` still attempted `firebase deploy --only functions` and even generated a fallback `functions/package.json` when none existed. `deploy-production.yml` then required backend metadata with `functionsDeployed: true`, so same-SHA promotion could stall even when the release only needed Firestore indexes.

**Solution:**
Make the workflow Spark-compatible:
- Deploy Firestore indexes from the target SHA on every backend promotion run
- Skip Cloud Functions unless `deploy_functions=true`
- Emit backend metadata that records whether functions were requested/deployed
- Let production require `indexesAttempted=true` and accept `functionsDeployed=false` on Spark

**Severity:** ?? High ? backend not deploying

---

### ERR-008: PR Creation Blocked by GitHub Integration Permissions

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #github #permissions #pr #automation

**Error Message:**
```text
403 Resource not accessible by integration
```

**Root Cause:**
GitHub App/Token used by Codex does not have Pull Request creation permissions.

**Workaround:**
Create PR manually via browser URL:
`https://github.com/ahmedsheta89-cell/sale-zone/compare/main...[branch]`

**Permanent Fix:**
Update GitHub App permissions: Settings ? Developer Settings ? Fine-grained tokens ? Add Pull Requests (Read and Write)

**Severity:** ?? Medium � manual workaround available

---

## Git & Branching

### ERR-009: Dirty Root Checkout Blocking Operations

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #git #checkout #dirty #worktree

**Symptoms:**
Root checkout stuck on old branch (`feat/batch9-appcheck-chat-unification`) with uncommitted changes. Cannot checkout or rebase safely.

**Solution:**
Use `git worktree` instead of touching dirty checkout:
```bash
git worktree add worktrees/[name] -b [branch] origin/main
```

**Prevention Rule:**
`git worktree` is the safest way to work when root checkout is dirty. Avoid `git stash` which can lose work.

**Severity:** ?? Medium � blocks work but has workaround

---

### ERR-010: Rebase Duplicates Already-Merged Commits

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #git #rebase #duplicate #cherry-pick

**Symptoms:**
Rebasing entire branch replays commits already on main. Creates phantom conflicts and duplicated code.

**Root Cause:**
Branch contained commit (`22d8b0e`) that is tree-identical to commit on main (`b32212b`). Rebase tries to reapply it = conflict.

**Solution:**
Use `cherry-pick -x` for only the new commits instead of rebasing the entire branch.

**Decision Rule:**
```text
IF branch has commits already on main
  ? cherry-pick -x (new ones only)
ELSE IF branch is entirely new
  ? rebase is safe
ELSE IF checkout is dirty
  ? worktree + cherry-pick
```

**Severity:** ?? High � can corrupt code if not caught

---

## Governance Checks

### ERR-011: contracts-check Fails Without Version Bump

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #governance #contracts #version #bump

**Symptoms:**
`node tools/contracts-check.js` fails after cherry-pick or file changes.

**Root Cause:**
contracts-check verifies that `version.json` was updated when core files change. Without version bump = broken contract.

**Solution:**
Bump patch version in `version.json` before running governance checks.

**Prevention Rule:**
Any change to core files = bump `version.json` BEFORE running governance checks.

**Severity:** ?? Medium � blocks pipeline

---

### ERR-012: Branch Protection Context Drift

?? Date: 2026-03
?? Batch: Post-PR#104 audit
??? Tags: #governance #branch-protection #release-gate #drift

**Symptoms:**
Branch-protection docs, baseline JSON, and enforcement scripts disagreed on which status checks were required for `main`.

**Root Cause:**
`scripts/enforce-branch-protection.mjs` and `scripts/verify-branch-protection.mjs` used hard-coded contexts (`preflight`, `contracts-check`, `security-regression-check`, `workers-paranoid-gate`, `ci-parity`) that drifted away from `.github/branch-protection-baseline.json` and the written policy. This made audits contradictory and weakened confidence in what GitHub was actually enforcing.

**Solution:**
- Use `.github/branch-protection-baseline.json` as the single repository source of truth
- Keep the required branch-protection contexts stable: `release-gate`, `policy-governance`, `hash-stability`
- Let `release-gate` remain the aggregate blocker for internal governance jobs

**Prevention Rule:**
Never hard-code required status-check names in multiple places. Read them from the baseline file.

**Severity:** ?? High ? governance drift can hide real enforcement gaps

---

### ERR-013: Branch Protection Verification Was Silently Skipping

?? Date: 2026-03
?? Batch: Post-PR#104 audit
??? Tags: #github-actions #governance #verification #branch-protection

**Symptoms:**
`release-gate.yml` reported branch-protection evidence, but the verification step could skip without proving the live repository settings matched the policy.

**Root Cause:**
The `Verify branch protection` step in `release-gate.yml` did not pass `GITHUB_TOKEN` to `scripts/verify-branch-protection.mjs`, so the script had no GitHub context and wrote a skipped result. Even with a token, branch protection still depends on repository settings and adequate GitHub permissions outside the repo.

**Solution:**
- Pass `GITHUB_TOKEN` into the verify step
- Keep branch-protection verification evidence in CI
- Document the remaining manual requirement: GitHub branch protection must be configured in repository settings with the baseline contexts

**Prevention Rule:**
If a governance script depends on GitHub API context, wire the token into the workflow step explicitly and document any external admin setup that CI cannot self-apply.

**Severity:** ?? High ? governance checks could look healthy without proving live enforcement

---

## Deployment Pipeline

### ERR-014: Firestore Rules and Indexes Drifted Behind Merged Code

?? Date: 2026-03
?? Batch: Post-PR#104 runtime fix
??? Tags: #firestore #deploy #rules #indexes #production

**Error Message:**
```text
FirebaseError: Missing or insufficient permissions
```

**When it appears:**
- Signed-in customer opens notifications
- Admin opens notifications panel
- Repo files on `origin/main` already contain the matching rules and indexes
- Runtime still returns permission-denied

**Root Cause:**
The repository already contained the correct notification paths and indexes, but merging code to GitHub does not publish Firestore rules or indexes by itself. The customer query path `customers/{uid}/notifications` is covered by the repo rules, and the admin collection-group query shape is covered by the repo indexes, so repeated production permission-denied logs point to the live Firebase project still serving older rules and/or index state.

Known contributing factors:
- Firestore deploy is separate from code merge
- `deploy-backend.yml` had backend/index deployment drift history
- `deploy-firestore-rules.yml` deploys rules only, not indexes

**Solution:**
- Treat Firestore deploy as a separate production step
- Deploy both:
  - `firestore:rules`
  - `firestore:indexes`
- Verify the admin collection-group index has finished building before judging the fix

**Prevention Rule:**
After any PR that changes `firestore.rules` or `firestore.indexes.json`, verify the live Firebase project was updated. Do not assume GitHub merge equals Firestore deployment.

**Related Errors:** ERR-004, ERR-007
**Severity:** ?? Critical

---

## Observability & Logging

### ERR-015: GATE_STATE_SOURCE Log Spam

?? Date: 2026-03
?? Batch: Post-PR#104 runtime fix
??? Tags: #logging #admin #release-gate #noise

**Error Message:**
```text
[GATE_STATE_SOURCE] Release gate state source resolved
```

**When it appears:**
- Admin panel initializes release-gate tracking
- Backend/cache source resolution runs more than once
- The same informational message repeats many times in the console

**Root Cause:**
The release-gate status logger emitted the same `GATE_STATE_SOURCE` message from multiple resolution paths without a once-per-source guard, so repeated sync cycles produced noisy duplicate logs.

**Solution:**
- Add a dedicated helper that logs the resolved source only once per source value
- Reset the guard only when the watcher restarts

**Prevention Rule:**
Low-signal operational logs should be guarded with `logOnce` or equivalent state when the same message can be emitted by polling, snapshots, or fallback paths.

**Related Errors:** ERR-014
**Severity:** ?? Low

---

## Orders & Checkout

### ERR-016: Order Creation Fails with permission-denied Due to Unconstrained Query

Date: 2026-03
Tags: #orders #firestore #query #idempotency #permission-denied

**Error Message:**
```text
FirebaseError: Missing or insufficient permissions
```

**Displayed as:**
```text
Check your email to complete verification
```

**When it appears:**
- Customer signs in successfully
- Customer opens checkout and submits an order
- Storefront calls `addOrder()`
- `persistOrderOnline()` checks for duplicates before writing the order

**Root Cause:**
The duplicate-check query in `persistOrderOnline()` queried:

```javascript
db.collection('orders')
  .where('idempotencyKey', '==', key)
  .limit(1)
  .get()
```

Customer order reads are protected by the rule:

```javascript
allow read: if isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid);
```

Because the query did not constrain `uid`, Firestore could not prove that every matching document belonged to the signed-in customer, so it rejected the entire query with `permission-denied` before the order write happened.

The storefront then misclassified that generic permission error as an email-verification failure and showed the wrong message.

**Solution:**
- Scope the duplicate-check query by customer uid:

```javascript
.where('uid', '==', payload.uid)
.where('idempotencyKey', '==', key)
```

- Handle `permission-denied` separately from `auth/email-not-verified` in checkout UI error handling

Files affected: `assets/js/firebase-api.js`, storefront checkout UI

**Prevention Rule:**
If a Firestore read rule depends on `resource.data.<field> == request.auth.<value>`, every customer query must include the same field constraint or Firestore may reject the whole query.

**Related Errors:** ERR-011
**Severity:** Critical - customers cannot place orders

---


### ERR-017: Storefront Shows All Products as Unavailable Because Live Catalog Prices Are Zero

Date: 2026-03
Batch: Post-PR#121/#122 merged-main validation
Tags: #catalog #pricing #browser-validation #data-quality #storefront

**Error Message:**
```text
غير متاح للبيع
```

**When it appears:**
- Merged `origin/main` is served locally over HTTP
- Storefront loads and renders products successfully
- Product cards show availability state
- Browser validation finds zero sellable products even after the inventory-tracking fix is merged

**Root Cause:**
The inventory fix from PR #121 correctly changed sellability rules so products are sellable by default unless `trackInventory === true && stock <= 0`.

However, the live catalog data still contains products with invalid pricing, especially `price: 0` and `sellPrice: 0`. The storefront pricing/availability logic still treats zero-priced products as unavailable for sale. That means the code fix is present, but the live Firebase catalog remains commercially blocked by bad product data.

Observed during post-merge browser validation:
- Store loaded successfully
- Product count was non-zero
- Sellable count was `0`
- Unavailable count was `24`

This is a live-data regression boundary, not evidence that the inventory fix failed to merge.

**Solution:**
- Use the admin product edit fix from PR #122 to correct product prices in Firestore
- Use the Excel import fix from PR #122 for future catalog imports so Arabic numerals and localized price formats do not collapse to zero
- Re-run browser validation after catalog pricing is corrected

Files affected: `متجر_2.HTML`, `ادمن_2.HTML`, live Firestore `products` data

**Prevention Rule:**
When validating sellability fixes, separate code truth from catalog-data truth. An inventory logic fix does not repair already-bad product pricing data in Firebase.

**Related Errors:** ERR-016
**Severity:** High - storefront loads but no customer can buy products

---

## Catalog & Import

### ERR-018: Excel Import Prices Were Being Recomputed, Large Images Were Rejected Before Compression, and Storefront Cart Still Blocked Zero-Price Untracked Products

Date: 2026-04
Batch: Critical production fix after PR #122
Tags: #excel-import #pricing #cloudinary #inventory #storefront

**Error Message:**
```text
price: 0.00 after refresh
EXCEL_IMAGE_UPLOAD upload failed: حجم الصورة أكبر من 5MB
غير متاح للبيع
```

**When it appears:**
- Admin imports products from Excel/CSV with a valid price column
- Imported rows appear correct during the import flow
- After save or refresh, product prices can collapse back to zero
- Large product images are rejected before compression runs
- Storefront products with `trackInventory` off still fail purchase paths when price is zero or stock is zero

**Root Cause:**
This production issue had three linked causes:

1. Excel-imported prices were not always treated as explicit manual prices.
   - Rows that only supplied the base price column could miss the `manualPriceOverride` path
   - Later normalization/write flows could recompute pricing instead of preserving the imported value

2. Cloudinary validation rejected raw image files before compression.
   - The upload guard enforced the 5MB limit on the original file
   - Large images never reached `compressImageBeforeUpload()`

3. Storefront sellability and cart behavior still had a hard stock gate.
   - The broader sellability fix made untracked products available by default
   - But `addToCart()` still blocked `stock === 0` even when inventory tracking was disabled

**Solution:**
- Treat any imported explicit `price` or `sellPrice` value as manual pricing and preserve it through normalization/write flows
- Add debug logs for import payloads and pricing normalization during verification
- Allow pre-compression image validation up to 20MB, then enforce the final 5MB upload limit after compression
- Remove the remaining cart-path stock gate for products that do not use inventory tracking
- Treat `price = 0` as a valid free product instead of auto-marking it unavailable

Files affected:
- `ادمن_2.HTML`
- `متجر_2.HTML`
- `assets/js/firebase-api.js`
- `assets/js/cloudinary-service.js`

Commit: pending on `fix/critical-excel-import-pricing-images`

**Prevention Rule:**
If import data carries an explicit price, mark it as manual before any downstream normalization. For image uploads, validate both pre-compression and post-compression phases separately. For sellability, inventory rules must not be reintroduced indirectly in cart code.

**Related Errors:** ERR-017
**Severity:** Critical - imported catalog data becomes commercially unusable

---
## Template - Log a New Error

### ERR-XXX: [Clear short title]

?? Date: YYYY-MM-DD
?? Batch: [Batch number]
??? Tags: #tag1 #tag2 #tag3

**Error Message:**
```text
[Exact message as it appeared]
```

**When it appears:**
[Steps to reproduce]

**Root Cause:**
[Why it happened � not symptoms, the real cause]

**Solution:**
[What was done exactly]
[Code or commands]
[Files affected]
[Commit hash]

**Prevention Rule:**
[Rule or check to prevent recurrence]

**Related Errors:** [Links to similar errors]
**Severity:** ?? High / ?? Medium / ?? Low
