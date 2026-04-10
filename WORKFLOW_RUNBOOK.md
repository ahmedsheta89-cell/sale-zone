# Operating Sequence

This runbook defines the safe operational sequence for Sale Zone work. It is intentionally practical and assumes the root checkout may already be dirty.

## ⚠️ CRITICAL: Registry Hash Parity
## Mandatory Before Every Push

### لماذا هذا مهم
monitoring/admin-function-registry.json
يجب أن يُولَّد في AST mode فقط.
GitHub Actions يستخدم AST mode دائماً.
إذا وُلِّد في fallback mode:
  → sourceHash يختلف
  → registryHash يختلف
  → hash-stability يفشل
  → admin-function-monitor يفشل
  → release-gate يفشل
  → PR يُحجب

### الـ Pattern المتكرر
هذا الخطأ حدث في:
  PR #158 — hotfix/banner-image-400-fix
  PR #160 — feat/banner-visual-polish-v4.2

### الإجراء الإلزامي — كل worktree جديدة

لا تبدأ العمل قبل هذه الخطوات:

Step 1 — تثبيت deps:
  npm ci
  (لا npm install — npm ci فقط)

Step 2 — توليد registry:
  node tools/admin-function-monitor.js

Step 3 — تحقق من hash:
  node tools/snapshot-check.js --check
  يجب PASS قبل المتابعة

Step 4 — إذا FAIL:
  أعد من Step 1
  لا تتابع العمل إذا هذا يفشل

### الفرق بين AST و Fallback
AST mode (صح):
  يتطلب: npm ci
  ينتج:  registry دقيق مطابق لـ CI
  متى:   GitHub Actions دائماً

Fallback mode (خطأ):
  يعمل:  بدون deps
  ينتج:  registry مختلف
  النتيجة: hash mismatch → CI failure

### علامات الإصابة بالمشكلة
❌ hash-stability: FAILING on GitHub
❌ admin-function-monitor: FAILING on GitHub
✅ نفس الـ checks تمر locally
السبب دائماً: npm ci لم يُشغَّل أولاً

## When a Bug Is Found

1. Read [AGENT_RULES.md](AGENT_RULES.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md).
2. Diagnose first. Do not start by editing.
3. Create a new worktree from `origin/main`; do not use the dirty root checkout.
4. Apply the smallest safe fix that addresses the real cause.
5. If auth/UI state is involved, treat live Firebase auth as truth and cached UI/localStorage as suspect until proven otherwise.

## After a Fix Is Implemented

1. Run `npm.cmd ci`.
2. Set `git config core.hooksPath ".githooks"`.
3. Run the required governance quartet:
   - `node tools/usage-check.js`
   - `node tools/contracts-check.js`
   - `node tools/snapshot-check.js --check`
   - `node tools/smoke-check.js`
4. If the change affects runtime behavior, run browser/backend verification only when prerequisites exist.
5. Capture evidence before claiming success.

## After Merge

1. Fetch `origin`.
2. Create a detached worktree from `origin/main`.
3. Verify the fix is present on merged content.
4. If the original branch commit SHA is not an ancestor, check whether merge happened by squash and confirm content equivalence instead of declaring a false failure.
5. Rerun governance and integrity checks on merged `main`.

## Post-Merge Real-User Validation

Use this when the merged change affects login, checkout, orders, admin access, or any other user-facing behavior.

- Prefer the same browser session when auth continuity matters.
- If UI appearance and runtime auth disagree, runtime auth wins and the desync is a bug.
- Screenshots, browser console/runtime state, and reproducible steps are required evidence.
- Use merged `main` content or an equivalent deployment target; do not rely on stale GitHub Pages content by default.

## Before Release

1. Follow [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md).
2. Verify same-SHA expectations for staging/production flows.
3. Confirm external/manual items that code checks cannot prove:
   - branch protection
   - deployed Firebase rules/indexes state
   - environment readiness
4. Do not claim release readiness from code checks alone.

## Banner Image Quality Standards

### حدود الرفع
  البانرات: 15MB maximum
  المنتجات: 5MB maximum (لا تغيير)

### إعدادات الضغط للبانرات
  maxWidth:  3840 (4K)
  maxHeight: 2160 (4K)
  quality:   0.92 (عالية جداً)

### لماذا 4K للبانرات؟
  البانرات تُعرض على شاشات كبيرة
  وعلى Retina/HiDPI displays
  الجودة المرئية أولوية قصوى
  Cloudinary يضغط للتسليم تلقائياً

### قاعدة الجودة
  الصورة الأصلية → أعلى جودة ممكنة
  Cloudinary → يضغط للتسليم فقط
  لا تضغط الأصل بشكل مفرط

## Browser Validation Flow

- Use fixed branch content or merged `main`.
- Use Playwright or real-browser validation depending the question.
- Credentials are required for login, checkout, loyalty, order history, and admin paths.
- Missing credentials => `BLOCKED`.
- Screenshot-backed evidence is required for browser `PASS`.
- Browser results against stale deployed content are informative at best, not authoritative for recent fixes.

## Backend Validation Flow

- Requires service account/project context when direct backend proof is needed.
- Missing service account or project credentials => `BLOCKED`.
- Treat backend deploy state as external/manual unless directly verified against the target environment.

## Dirty Root Tree Policy

- Never clean, repurpose, or test against the dirty root checkout.
- Never assume dirty-root changes are yours to reuse or remove.
- New work should happen in a fresh worktree or clearly isolated branch/worktree pair.

## Safe Worktree Rules

1. `git fetch origin --prune`
2. Create worktree from `origin/main`
3. Set `git config core.hooksPath ".githooks"`
4. Run `npm.cmd ci`
5. Keep audit/test artifacts inside the isolated worktree unless the task explicitly requires moving them elsewhere

## Safe Cleanup Rules

- Surface findings before removing a worktree.
- Preserve evidence paths or copy artifacts before cleanup if the results may be needed later.
- Do not delete a worktree that still contains the only copy of important evidence unless the user clearly prefers cleanup over retention.

## BANNER DELETE BUG — ROOT CAUSE REGISTER

Issue: `deleteBannerFromFirebase()` called the wrong function  
Discovered: post-merge live test, April 2026  
PR: #150

Symptoms:
- Banner disappears from admin list after delete
- Banner returns after page refresh
- No error shown to user

Root cause:
- Global scope name collision between
  `assets/js/firebase-api.js:deleteBanner()` and
  `ادمن_2.HTML:deleteBanner()`

Fix:
- `deleteBannerRecord()` in `assets/js/firebase-api.js`
- Route both API and admin delete paths through the
  collision-safe helper

Status:
- fixed in PR #150
- live follow-up must still confirm:
  1. GitHub Pages is serving the new code
  2. deployed runtime matches the merged fix
  3. live CRUD passes after refresh

## Failure Interpretation

- Repo regression: code, rules, workflows, or governance actually fail on the content under test.
- Environment/tooling issue: sandbox/process restrictions, missing credentials, blocked network, missing CLI auth, PowerShell execution-policy friction, or similar host-side limitations.
- If a check fails because the environment blocks truthful execution, classify it as `BLOCKED` or environment-specific, not as a fake repo `FAIL`.

# See Also

- [AGENT_RULES.md](AGENT_RULES.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [PROMPT_CATALOG.md](PROMPT_CATALOG.md)
- [ENGINEERING_OPERATING_STANDARD.md](ENGINEERING_OPERATING_STANDARD.md)
- [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md)
