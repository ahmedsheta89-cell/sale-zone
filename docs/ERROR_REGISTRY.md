# ?? Error Registry � Sale Zone Project
> Cumulative log of every error encountered + root cause + solution + lessons learned
>
> Last updated: auto
> Total errors logged: 29
> Total patterns discovered: 9

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
| [Firestore Rules](#firestore-rules) | 4 | 2026-04 |
| [Firestore Indexes](#firestore-indexes) | 1 | 2025-01 |
| [Deployment Pipeline](#deployment-pipeline) | 3 | 2026-03 |
| [Git & Branching](#git--branching) | 3 | 2026-04 |
| [Governance Checks](#governance-checks) | 3 | 2026-03 |
| [Orders & Checkout](#orders--checkout) | 2 | 2026-03 |
| [Catalog & Import](#catalog--import) | 1 | 2026-04 |
| [Observability & Logging](#observability--logging) | 1 | 2026-03 |
| [Banners & Slider](#banners--slider) | 7 | 2026-04 |

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

### BUG-LOW: Win32 error 5 in local git hooks

?? Date: 2026-04
?? Batch: Banner Image Optimization V1
??? Tags: #git #hooks #windows #env.exe #no-verify

**Symptoms:**
Local `git commit` fails before executing the repo hook chain even when governance checks pass manually.

**Error Message:**
```text
env.exe: *** fatal error - couldn't create signal pipe, Win32 error 5
```

**Root Cause:**
The local Windows Git hook shell (`env.exe`) cannot create the signal pipe required to start the hook process in this environment. This is a workstation/runtime issue, not a repository hook logic failure.

**Temporary Solution:**
Run the governance quartet manually, then use `--no-verify` for local commits only:

```bash
node tools/usage-check.js
node tools/contracts-check.js
node tools/snapshot-check.js --check
node tools/smoke-check.js
git commit -m "..." --no-verify
```

**Important Note:**
The push-time release gate on GitHub continues to run normally and remains the authoritative verification path.

**V3 Cleanup Follow-up (2026-04-09):**
- During `feat/banner-image-optimization-v3`, temporary local commit-message files (`commit-task2.txt`, `commit-task3.txt`) were used because the normal hook path was blocked by the same `env.exe` issue.
- Those files were removed from the unpublished branch history before push so the final branch keeps the intended 3 clean feature commits only.
- This was a local history-cleanup action, not a repository code fix or CI issue.

**Prevention Rule:**
Treat this as a local environment issue only. Do not bypass push-time checks, and do not classify it as a repo regression unless the same failure reproduces on GitHub CI.

**Severity:** ?? Low ï؟½ local workaround exists and GitHub push gate still verifies the branch

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

## Auth & Session Integrity

### ERR-019: Storefront Could Mix a Cached Customer UID with a Persisted Admin Firebase Session

Date: 2026-04
Batch: Critical auth/session isolation fix
Tags: #auth #session #security #storefront #admin

**Error Message:**
```text
[Telemetry] Live session write skipped intentionally.
reason: 'uid-mismatch'
authUid:   'L6478DWwBwfbnEUOkE3kCwLWxGG3'
targetUid: 'DyQdpMVkzHRUYsIFb3xDEnd13gx2'
```

**When it appears:**
- Admin signs in on the same browser/origin as the storefront
- Storefront still holds a cached customer `currentUser`
- A new customer logs in, registers, or opens profile editing
- Telemetry and profile writes see different values for `authUid` and `targetUid`
- The storefront can appear to jump from the customer account to the admin account after refresh or profile interaction

**Root Cause:**
The bug was caused by a session-integrity gap across the storefront and admin surfaces:

1. Firebase Auth used the default shared persistence, so the admin auth session could survive across same-origin surfaces.
2. Store boot ran `checkLoggedInUser()` before the auth listener had fully resolved the live Firebase user.
3. The storefront merged `localStorage.currentUser` with `firebase.auth().currentUser` instead of rejecting stale cache on UID mismatch.
4. Profile edit flows used `currentUser.uid || currentUser.id || authUser.uid`, allowing cached data to compete with the live Firebase UID.

The backend data layer correctly rejected the mismatch, but the UI/session layer fed it inconsistent identity state.

**Solution:**
- Enforce Firebase Auth `SESSION` persistence in `assets/js/firebase-config.js`
- Clear stale storefront cache and same-tab admin session artifacts before customer login/register flows
- Reject admin-claim Firebase sessions on the storefront and sign them out there instead of hydrating store UI with them
- Make storefront cache rebinding auth-bound only: cached `currentUser` is kept only when its UID matches `firebase.auth().currentUser.uid`
- Make profile load/edit flows use the Firebase auth UID as the source of truth
- Reorder store boot so the auth listener binds before cached-user bootstrap work

Files affected:
- `متجر_2.HTML`
- `ادمن_2.HTML`
- `assets/js/firebase-config.js`

**Prevention Rule:**
On same-origin multi-surface apps, Firebase Auth must be the identity source of truth. Cached UI state may decorate the active user, but it must never out-rank `firebase.auth().currentUser.uid`. Any UID mismatch must clear stale cache immediately, and admin sessions must never hydrate storefront customer state.

**Related Errors:** ERR-001
**Severity:** Critical - security and profile-write integrity risk

---
## ERR-020 — Logged-in support chat could fall back to Tawk instead of staying internal
- **Date:** 2026-04-03
- **Severity:** Critical
- **Root Cause:** The storefront correctly preferred internal Firestore support for authenticated customers, but any support readiness error flowed into `handleSupportAccessError()` and auto-opened Tawk. That failure path overrode the routing decision and sent logged-in customers to the guest support channel.
- **Fix:** Kept guest fallback to Tawk/WhatsApp only for unauthenticated users, removed automatic Tawk fallback for authenticated customers, added retry handling inside the account messages tab, and fixed chat history cleanup so the internal chat uses its own nav key.
- **Files:** `متجر_2.HTML`
- **PR:** `fix/chat-routing-faq-registration`

## ERR-021 — Account notifications still flickered on mobile because “patch” logic re-rendered the whole list
- **Date:** 2026-04-03
- **Severity:** High
- **Root Cause:** The notifications view had a `notificationsInitialLoadDone` flag, but the supposed patch path still replaced `innerHTML` on every realtime update. On mobile this made the notifications panel visibly flash and reflow.
- **Fix:** Added stable notification signatures and DOM patching so only changed/new/deleted notification cards are updated after first render, without clearing the whole list.
- **Files:** `متجر_2.HTML`
- **PR:** `fix/chat-routing-faq-registration`

## ERR-022 — FAQ existed only as bot intents and local storage, not as a managed knowledge base
- **Date:** 2026-04-03
- **Severity:** Medium
- **Root Cause:** The previous FAQ implementation was only a lightweight keyword-response bot stored in `storeSettings.faqIntents` and `localStorage`. There was no Firestore-backed FAQ collection, no Arabic question/answer management UI, and no searchable customer FAQ experience.
- **Fix:** Added Firestore-backed FAQ helpers on collection `faq`, upgraded the admin FAQ editor to manage question/answer/category/order/active fields, derived bot intents from those entries for compatibility, and rebuilt the customer FAQ trigger into a searchable accordion panel with Arabic defaults and support fallback.
- **Files:** `assets/js/firebase-api.js`, `ادمن_2.HTML`, `متجر_2.HTML`
- **PR:** `fix/chat-routing-faq-registration`

## ERR-023 — New customer registrations were not guaranteed to appear immediately in admin
- **Date:** 2026-04-03
- **Severity:** High
- **Root Cause:** Customer registration relied on profile creation paths that were usually correct, but the admin customers section itself had no realtime sync, so newly registered customers did not appear immediately unless the admin manually refreshed. Registration also needed a canonical post-auth upsert to guarantee all expected fields were present.
- **Fix:** Forced a canonical customer profile upsert after successful registration and added admin realtime subscription for the `customers` collection so new registrations show up in the customers table immediately.
- **Files:** `assets/js/firebase-api.js`, `ادمن_2.HTML`, `متجر_2.HTML`
- **PR:** `fix/chat-routing-faq-registration`

## ERR-024 — Internal chat close action was wired to FAQ history instead of chat history
- **Date:** 2026-04-03
- **Severity:** Medium
- **Root Cause:** `closeInternalChat()` called `NavHistory.close('faqbot')` instead of `NavHistory.close('chat')`, which mixed chat and FAQ navigation state and made support/FAQ transitions harder to reason about on mobile.
- **Fix:** Corrected the nav-history key so internal chat opens/closes on its own history channel and no longer interferes with the FAQ panel.
- **Files:** `متجر_2.HTML`
- **PR:** `fix/chat-routing-faq-registration`

---
## ERR-025 — Customer notifications could render unreadable Arabic copy from older corrupted records
- **Date:** 2026-04-04
- **Severity:** High
- **Root Cause:** Some historical notification documents already stored mojibake/corrupted Arabic in `title` or `body`. Admin notifications had a defensive display fallback, but the storefront account notifications rendered raw customer copy directly, so live users saw `??????`-style text even though the surrounding UI font stack was correct.
- **Fix:** Added storefront unreadable-text detection plus customer notification display fallback derived from notification type/action metadata, and applied explicit Arabic typography to notification title/body nodes so live users see readable Arabic copy even when old records are malformed.
- **Files:** `متجر_2.HTML`
- **PR:** `fix/critical-font-chat-faq-rules`

## ERR-026 — Support chat rules required verified email, blocking normal signed-in customers
- **Date:** 2026-04-04
- **Severity:** Critical
- **Root Cause:** Firestore rules for `support_threads` and customer support messages required `isVerifiedUser()`. The storefront support flow only requires an authenticated customer session, so non-verified but valid customer accounts hit `Missing or insufficient permissions` on thread create/read-write.
- **Fix:** Relaxed customer-owned support thread/message writes from `isVerifiedUser()` to `isSignedIn()` while keeping owner checks, schema validation, and admin-only moderation paths intact.
- **Files:** `firestore.rules`
- **PR:** `fix/critical-font-chat-faq-rules`

## ERR-027 — FAQ collection had no public read rule, so customer FAQ always fell back or failed
- **Date:** 2026-04-04
- **Severity:** High
- **Root Cause:** The codebase already used a Firestore collection named `faq`, but `firestore.rules` had no match block for it. Customer-side FAQ queries therefore failed with `Missing or insufficient permissions`, and admin saves depended entirely on local fallbacks instead of an explicitly governed collection.
- **Fix:** Added an explicit `match /faq/{itemId}` rule with public read, admin-only write/delete, and schema validation. Also upgraded the admin FAQ manager with bulk activate/deactivate, reordering, and live preview so the Firestore-backed FAQ workflow is complete once rules are deployed.
- **Files:** `firestore.rules`, `ادمن_2.HTML`, `متجر_2.HTML`
- **PR:** `fix/critical-font-chat-faq-rules`

## Banners & Slider

## BUG-P2-001 ? 0 active banners render a fallback card instead of hiding the section
- **Date:** 2026-04-08
- **Severity:** Medium
- **File:** `????_2.HTML:5186`
- **Root Cause:** `renderBanners()` injects a default welcome card when no renderable banners remain, so the banner section stays visible instead of hiding entirely.
- **Evidence:** Empty-state branch writes a fallback slide with `?????? ??` into `#bannerSlider`.
- **Fix applied:** `PENDING in Banner Phase 2`
- **Status:** OPEN

## BUG-P2-002 ? Slider has no hover or touch pause behavior
- **Date:** 2026-04-08
- **Severity:** Medium
- **File:** `????_2.HTML:5232`
- **Root Cause:** Auto-advance is implemented as a bare interval starter with no banner-scoped pause/resume listeners for hover or touch interactions.
- **Evidence:** `startBannerSlider()` starts `setInterval(nextBanner, 5000)` and no banner `mouseenter`, `mouseleave`, `touchstart`, or `touchend` pause hooks exist nearby.
- **Fix applied:** `PENDING in Banner Phase 2`
- **Status:** OPEN

## BUG-P2-003 ? Slider has no swipe support
- **Date:** 2026-04-08
- **Severity:** Medium
- **File:** `????_2.HTML:5173`
- **Root Cause:** Banner navigation currently depends on arrows and dots only; no horizontal touch delta handling is wired to slide navigation.
- **Evidence:** No banner-specific `touchstart`/`touchend` listeners invoke `nextBanner()` or `prevBanner()`.
- **Fix applied:** `PENDING in Banner Phase 2`
- **Status:** OPEN

## BUG-P2-004 ? Hero-style background images are not lazy loaded
- **Date:** 2026-04-08
- **Severity:** Low
- **File:** `????_2.HTML:5192`
- **Root Cause:** Current banner rendering is text-only and has no deferred image-loading mechanism for future hero backgrounds.
- **Evidence:** Existing template renders icon/title/text/button only and never uses `data-src`, `data-lazy`, or a slide image loader.
- **Fix applied:** `PENDING in Banner Phase 2`
- **Status:** OPEN

## [BUG-001] Banner image cropped incorrectly on desktop and mobile

Date: 2026-04-09
Severity: HIGH
File: `assets/js/cloudinary-service.js` `optimizeBannerImageUrl()`

Description:
  `c_fill` with fixed width + height transforms caused Cloudinary
  to crop banner images without smart subject awareness.
  Desktop banners could feel over-expanded, while mobile banners
  could cut important content from the sides.
  Evidence: confirmed by the store owner via live screenshots.

Fix applied:
  Replace fixed `c_fill` transforms with aspect-ratio driven
  banner transforms using AI smart gravity.
  The upgraded implementation uses `ar_`, `g_auto:subject`,
  responsive context presets, and `dpr_auto`.
  `buildBannerSrcset()` was also added for responsive delivery.

Status: FIXED
Branch: `feat/banner-image-optimization-v3`

## [BUG-V4-001] Vertical banner images cropped incorrectly - c_fill forces crop on all images

Date: 2026-04-09
Severity: HIGH
File: `assets/js/cloudinary-service.js` `optimizeBannerImageUrl()` lines 348-381

Description:
  `optimizeBannerImageUrl()` uses `c_fill` in all delivery contexts.
  Vertical or artistic banner images, such as the crescent moon artwork,
  are therefore forced into the aspect-ratio box and can lose important
  visual content on both desktop and mobile.

Evidence:
  Confirmed by the store owner via live screenshots.
  Desktop - crescent image: cropped from sides.
  Mobile  - crescent image: cropped from top.

Fix applied:
  Added `getUltimateBannerUrl()` with `fitMode` support.
  Default `fitMode: 'auto'` uses `c_pad + b_auto:predominant`
  so the full image is preserved with intelligent background fill.
  `optimizeBannerImageUrl()` remains unchanged for backward safety.

Status: FIXED via `getUltimateBannerUrl()`
Branch: `feat/banner-image-v4-ultimate`

## [BUG-V4-002] Admin banner preview uses background-image - cannot reflect fitMode

Date: 2026-04-09
Severity: MEDIUM
File: `ادمن_2.HTML` line 8859+

Description:
  Admin hero preview still renders through `background-image` on a div.
  After storefront hero rendering migrated to real `<img>` delivery,
  preview fidelity diverged. `fitMode` strategies such as `pad` and
  `scale` cannot be represented accurately through the current preview
  background rendering path.

Fix applied: DEFERRED
  Documented for a later dedicated admin preview pass.
  In V4, the `fitMode` selector is added to the admin form so the value
  is persisted correctly even though preview fidelity remains approximate.

Status: OPEN - deferred

## [BUG-HOTFIX-400-001] Banner V4 Cloudinary transforms returned HTTP 400

Date: 2026-04-10
Severity: HIGH
File: `assets/js/cloudinary-service.js` line 417+

Description:
  `getUltimateBannerUrl()` shipped with an aggressive transform chain:
  `c_pad` plus `b_auto:predominant`, gravity tokens, `q_auto:best`,
  and `dpr_auto`. On the live environment this generated Cloudinary
  delivery URLs that returned HTTP 400 for banner images.

Evidence:
  Confirmed by store owner on the live site.
  Broken banners failed to load after V4 merge, especially on the
  hero path that now depends on `getUltimateBannerUrl()`.

Fix applied:
  Simplified the generated transforms to the safest supported set:
  - `auto` / `pad`: `w_,c_pad,ar_,q_auto:good,f_auto`
  - `crop`: `w_,c_fill,g_auto,ar_,q_auto:good,f_auto`
  - `scale`: `w_,c_scale,q_auto:good,f_auto`
  Also removed `b_auto:predominant`, `dpr_auto`, and `q_auto:best`,
  and strengthened the storefront image error path to fall back once
  to the original image URL before showing the gradient fallback.

Status: FIXED
Branch: `hotfix/banner-image-400-fix`

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
