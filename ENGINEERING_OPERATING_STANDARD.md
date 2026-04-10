# Non-Negotiable Principles

- Diagnose first.
- Prefer the smallest safe change.
- No fake `PASS`.
- No silent failure.
- Truthfulness is more important than convenience or optimism.
- `AGENT_RULES.md` is the top rule layer; this file is the master operating standard beneath it.

# Status Model

Every meaningful report should separate:

- `Code Status` — what is proven in code, governance, rules, workflows, and repo structure
- `Behavior Status` — what is proven in browser/runtime behavior
- `Release Status` — what is proven about deploy/readiness/external release controls

Do not collapse these into one undifferentiated “healthy” label.

# Decision Labels

- `PASS` — proven with direct evidence
- `FAIL` — proven broken with a concrete failure or root cause
- `PARTIAL` — mixed outcome; part of scope passed and part remains unproven or blocked
- `BLOCKED` — cannot be executed truthfully because a required prerequisite is missing
- `MANUAL` — requires human or external-system action outside the current environment

Evidence rules:
- Browser `PASS` requires screenshots or equivalent runtime evidence.
- Backend `PASS` requires direct authenticated verification, not assumptions.
- `FAIL` must identify the failing check, behavior, or root cause.
- `BLOCKED` must state the missing prerequisite.

# Risk Classes

- `LOW` — documentation-only or narrow low-impact verification
- `MEDIUM` — bounded code change or repo verification with modest blast radius
- `HIGH` — auth, checkout, admin, Firestore rules, workflows, or user-facing runtime behavior
- `CRITICAL` — production deploy/readiness, security boundary failure, direct data exposure, or anything that can mislead release decisions

# Isolation Rules

- Dirty root checkout is no-touch by default.
- Use worktree-first isolation from `origin/main`.
- No hidden mutations.
- Do not mix verification of merged code with unrelated local changes.

# Fix Quality Rules

- Fix the cause, not only the symptom.
- Preserve working structure and repo conventions.
- Do not casually remove working behavior.
- If UI state and runtime state can diverge, fix the source-of-truth issue rather than only hiding the symptom.

# Governance Rules

- Run `npm.cmd ci` first.
- Set `git config core.hooksPath ".githooks"` before governance checks.
- Required governance quartet before commit:
  - `node tools/usage-check.js`
  - `node tools/contracts-check.js`
  - `node tools/snapshot-check.js --check`
  - `node tools/smoke-check.js`
- `node tools/run-required-checks.js` is the broader gate, but it may require non-sandbox execution in restricted environments for truthful verification.
- If governance fails, fix the change under test, not the governance tools, unless the task explicitly asks for tool work.

## Registry Parity Standard

### القاعدة
كل agent يبدأ العمل يجب أن يشغّل:
  npm ci
قبل توليد أي registry artifact.

### السبب
الـ parser يعمل في وضعين:
  AST mode:      يتطلب deps مثبتة
  Fallback mode: يعمل بدون deps

GitHub CI يستخدم AST mode دائماً.
أي registry مولَّد بدون npm ci
سيسبب hash mismatch وفشل الـ gate.

### التطبيق
هذه القاعدة تُطبَّق على:
  - كل agent جديد
  - كل worktree جديدة
  - كل branch جديد
  - بدون استثناء

### التحقق
بعد npm ci وتوليد الـ registry:
  node tools/snapshot-check.js --check
  يجب PASS قبل أي commit

# Browser Verification Standard

- Verify against fixed branch content or merged `main`.
- Do not treat stale GitHub Pages content as authoritative proof for a recent fix by default.
- Browser `PASS` requires screenshots or equivalent direct evidence.
- Missing credentials or an unusable preview environment => `BLOCKED`.
- If UI and runtime disagree, runtime truth wins.

# Backend Verification Standard

- Real backend verification requires valid project/service-account credentials.
- Missing credentials => `BLOCKED`.
- Deployed backend/rules/index state must not be assumed from repository files alone.

# Auth and Identity Rules

- Firebase live auth is the source of truth.
- Stale cache/localStorage is not identity truth.
- If UI says “logged in” but runtime auth is null, that is a bug, not an acceptable intermediate state.
- Session/auth failures must resolve into explicit user-facing feedback.

# Security and UX Standards

- Unauthorized actions must fail clearly.
- Auth/session failures must be explicit to users.
- Checkout/auth/admin failures must not fail silently.
- Heuristic warnings such as empty catch blocks or script-tag mismatches are concerns, not regressions, until runtime impact is proven.

# Post-Merge Standard

- Verify merged behavior on `origin/main`.
- Treat squash merge by content equivalence, not by requiring the original branch SHA to remain an ancestor.
- Rerun governance after merge when the change is significant or release-adjacent.
- If the change is user-facing, follow with post-merge real-user/browser validation whenever possible.

# Reporting Standard

- Be concise, factual, and evidence-backed.
- State exact boundaries between verified, blocked, manual, and external.
- Do not overstate release readiness from code-only verification.
- If environment restrictions cause a check to fail, say so explicitly instead of reporting a false repo regression.

# Session Start Standard

Future sessions should start in this order:

1. [AGENT_RULES.md](AGENT_RULES.md)
2. [PROJECT_STATUS.md](PROJECT_STATUS.md)
3. Choose the correct mode from [PROMPT_CATALOG.md](PROMPT_CATALOG.md)
4. Use [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md) for execution flow

# What Must Never Be Assumed

- deployed Pages == current branch content
- cached UI == real auth state
- missing credentials == acceptable `PASS`
- branch protection == verified unless directly checked
- deployed Firebase rules/indexes == current repo state unless directly checked
- a release is ready just because code-level checks are green

# See Also

- [AGENT_RULES.md](AGENT_RULES.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [PROMPT_CATALOG.md](PROMPT_CATALOG.md)
- [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md)
- [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md)

Optional future enhancement:
- `SESSION_START_CHECKLIST.md` as a short onboarding companion for new sessions
