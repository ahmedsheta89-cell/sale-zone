# ?? Decision Log — Sale Zone
> Every important technical decision + rationale

---

## DEC-001: Remove App Check

?? Date: 2025-01
?? Decision: Remove Firebase App Check
?? Batch: BATCH 19

**Reason:**
App Check was blocking development and testing. Project is still in active development phase.

**Alternatives considered:**
A) Keep App Check with debug token ? complex setup
B) Remove App Check temporarily ? chosen
C) App Check in production only ? needs additional setup

**Risks:**
- Site is unprotected without App Check
- Must be re-enabled after production stabilizes

**TODO:**
- [ ] Re-enable App Check after production is stable
- [ ] Add reCAPTCHA v3 as provider

---

## DEC-002: Worktree Instead of Stash for Integration

?? Date: 2025-01
?? Decision: Use git worktree instead of git stash
?? Batch: Post-BATCH19

**Reason:**
Root checkout was dirty on an old branch. git stash could lose work or create conflicts. git worktree is safer and cleaner.

**Result:**
? Integration succeeded without any issues
? Root checkout was not touched

---

## DEC-003: Cherry-Pick Instead of Full Branch Rebase

?? Date: 2025-01
?? Decision: cherry-pick 4 commits instead of rebasing entire branch
?? Batch: Post-BATCH19

**Reason:**
Branch contained commit (22d8b0e) tree-identical to main (b32212b). Rebase would replay it causing phantom conflicts. Cherry-pick selects only new commits.

**Result:**
? 4 commits applied without any conflict
? Affected files = 6 only (within expectation)

---

## DEC-004: Notification Architecture — customers/ and settings/ paths

?? Date: 2025-01
?? Decision: Keep existing notification paths, reject /users/ rewrite
?? Batch: Post-BATCH19 hotfix

**Current Architecture:**
- `customers/{uid}/notifications/{notificationId}` — customer notifications
- `settings/{settingId}/notifications/{notificationId}` — admin/system notifications
- `collectionGroup('notifications')` — admin reads all with fallback

**Why NOT /users/:**
- All existing data is under `customers/` not `users/`
- Code references `customers/` throughout
- Migration would require data move + code rewrite
- No benefit justifies the risk

**Result:**
Rules and indexes aligned to actual `customers/` and `settings/` paths.

---

## Template — Log a New Decision

## DEC-XXX: [Decision Title]

?? Date: YYYY-MM-DD
?? Decision: [What was decided]
?? Batch: [Batch number]

**Reason:**
[Why this decision was made]

**Alternatives considered:**
A) [Option A] ? [status]
B) [Option B] ? [status]

**Risks:**
[Any risks from this decision]

**Result:**
[Outcome]
