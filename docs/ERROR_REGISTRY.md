# ?? Error Registry ó Sale Zone Project
> Cumulative log of every error encountered + root cause + solution + lessons learned
>
> Last updated: auto
> Total errors logged: 11
> Total patterns discovered: 5

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
| [Deployment Pipeline](#deployment-pipeline) | 2 | 2025-01 |
| [Git & Branching](#git--branching) | 2 | 2025-01 |
| [Governance Checks](#governance-checks) | 1 | 2025-01 |

---

## Firebase Auth

### ERR-001: Permission Denied ó Customer Notifications Before Auth Ready

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

Files affected: `„ Ã—_2.HTML`, `assets/js/firebase-api.js`
Commit: `c907dac`

**Prevention Rule:**
Any Firestore query that depends on auth MUST be inside onAuthStateChanged, never in DOMContentLoaded or window.onload.

**Related Errors:** ERR-002, ERR-003
**Severity:** ?? High ó affects every site visitor

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
**Severity:** ?? Medium ó affects admin only

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
**Severity:** ?? High ó fills console and slows site

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

**Severity:** ?? High ó admin notifications broken

---

### ERR-005: Notification Paths Mismatch Between Code and Rules

?? Date: 2025-01
?? Batch: Post-BATCH19 hotfix
??? Tags: #firestore #rules #notifications #architecture

**Root Cause:**
External suggestions proposed `/users/{userId}/notifications` path, but the actual codebase uses:
- `customers/{uid}/notifications/{notificationId}` ó for customer notifications
- `settings/{settingId}/notifications/{notificationId}` ó for admin/system notifications
- `collectionGroup('notifications')` ó for admin to read all

Applying the wrong path structure would break all existing notification data.

**Prevention Rule:**
ALWAYS check actual code paths in `firebase-api.js` BEFORE writing Firestore rules. Never assume path structure from external suggestions.

**Severity:** ?? High ó would break all notifications if applied

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

**Severity:** ?? Low ó warning only

---

## Deployment Pipeline

### ERR-007: Deploy Backend Workflow Failing

?? Date: 2025-01
?? Batch: Post-BATCH19
??? Tags: #deploy #backend #github-actions #pipeline

**Symptoms:**
Multiple `deploy-backend.yml` runs were failing, blocking backend promotion.

**Possible Causes:**
A) Missing secret: FIREBASE_SERVICE_ACCOUNT
B) Wrong project ID in workflow
C) Missing `functions/` directory or `functions/package.json`
D) Node.js version mismatch

**Status:** Under investigation ó update after diagnosis confirms the concrete cause

**Severity:** ?? High ó backend not deploying

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

**Severity:** ?? Medium ó manual workaround available

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

**Severity:** ?? Medium ó blocks work but has workaround

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

**Severity:** ?? High ó can corrupt code if not caught

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

**Severity:** ?? Medium ó blocks pipeline

---

## Template ó Log a New Error

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
[Why it happened ó not symptoms, the real cause]

**Solution:**
[What was done exactly]
[Code or commands]
[Files affected]
[Commit hash]

**Prevention Rule:**
[Rule or check to prevent recurrence]

**Related Errors:** [Links to similar errors]
**Severity:** ?? High / ?? Medium / ?? Low
