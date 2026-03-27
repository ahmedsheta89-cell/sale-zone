# ?? Discovered Patterns — Sale Zone
> Recurring patterns discovered from errors.
> Each pattern groups multiple errors with the same root cause.

---

## PATTERN-001: Auth Timing Pattern

**Pattern:** Firestore Query before Auth Initialization

**Related Errors:** ERR-001, ERR-002, ERR-003

**Description:**
Any code that makes a Firestore query depending on auth but runs before onAuthStateChanged completes = permission denied.

**General Solution:**
1. Never make Firestore queries in:
   - DOMContentLoaded
   - window.onload
   - Any place outside onAuthStateChanged

2. Use auth readiness pattern:
```javascript
let isAuthReady = false;
firebase.auth().onAuthStateChanged(user => {
    isAuthReady = true;
    // Only here make queries
});
```

3. For admin: also await getIdTokenResult

**How to detect you hit this pattern:**
- ? See "permission denied" in console
- ? Error appears on first page load
- ? Error disappears on refresh
- ? Error is more frequent on slow connections

**Detection command:**
```bash
grep -n "DOMContentLoaded\|window.onload" file.html
# If Firestore queries are inside them = potential problem
```

---

## PATTERN-002: CollectionGroup Requires Both Rules AND Index Support

**Pattern:** collectionGroup query needs two things, not one

**Related Errors:** ERR-004

**Description:**
Firestore collectionGroup queries require:
1. Rule in firestore.rules with wildcard: `match /{path=**}/collection/{docId}`
2. Index support matching the actual query shape in `firestore.indexes.json`

If either is missing or mismatched = runtime failure

**How to detect:**
- ? Regular collection query works
- ? collectionGroup on same collection fails
- ? Rule exists but collectionGroup still fails

---

## PATTERN-003: Cherry-Pick vs Rebase Decision

**Pattern:** When to use cherry-pick instead of rebase

**Related Errors:** ERR-010

**Decision Tree:**
```text
Does the branch have commits already on main?
?? YES ? cherry-pick -x (new ones only)
?? NO  ? Is the checkout clean?
          ?? YES ? rebase is safe
          ?? NO  ? worktree + cherry-pick
```

---

## PATTERN-004: Governance Check Sequence

**Pattern:** Correct order to run governance checks

**Related Errors:** ERR-011

**Correct Order:**
1. `npm ci` (or `npm install` as fallback)
2. `node tools/generate-admin-function-registry.js`
3. Bump `version.json` (if files changed)
4. `node tools/usage-check.js`
5. `node tools/contracts-check.js`
6. `node tools/snapshot-check.js --update`
7. `node tools/smoke-check.js`
8. `node tools/admin-function-monitor.js`
9. `node tools/hash-stability-check.js`
10. `node tools/run-required-checks.js`

**If order is wrong:**
- contracts-check fails without version bump
- snapshot-check fails without --update after changes
- admin-function-monitor fails without generate first

---

## PATTERN-005: Verify Actual Code Paths Before Writing Rules

**Pattern:** Always check the real Firestore paths in code before writing rules

**Related Errors:** ERR-005

**Description:**
External suggestions or AI-generated rules may assume wrong collection paths. The actual paths in this project are:
- `customers/{uid}/notifications/{notificationId}` — NOT `users/{userId}/notifications`
- `settings/{settingId}/notifications/{notificationId}` — for system/admin
- `collectionGroup('notifications')` — admin reads all

**Rule:** ALWAYS run this before writing Firestore rules:
```bash
grep -n "collection\|doc(" assets/js/firebase-api.js | grep -i "notif"
```

---

## Template — Log a New Pattern

## PATTERN-XXX: [Pattern Name]

**Pattern:** [Short description]

**Related Errors:** ERR-XXX, ERR-XXX

**Description:**
[Explain the pattern]

**How to detect:**
- ? [Sign 1]
- ? [Sign 2]

**General Solution:**
[The fix]

**Detection command:**
[Command or code to check]
