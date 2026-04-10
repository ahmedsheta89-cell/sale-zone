## 🔴 MANDATORY WORKTREE SETUP
## يجب قبل أي كود في أي branch

```
□ git checkout [branch]
□ git pull origin main
□ npm ci                    ← لا تتخطاه أبداً
□ node tools/admin-function-monitor.js
□ node tools/snapshot-check.js --check
  → PASS مطلوب قبل المتابعة
  → إذا FAIL: أعد npm ci ثم أعد التوليد
```

### العواقب إذا تخطيت npm ci
  - registry يُولَّد في fallback mode
  - hash-stability يفشل على GitHub
  - PR يُحجب
  - وقت ضائع في debugging

### القاعدة الذهبية
npm ci أولاً
في كل worktree جديدة
في كل branch جديد
بدون أي استثناء

1. Read [AGENT_RULES.md](AGENT_RULES.md) first.
2. Read [PROJECT_STATUS.md](PROJECT_STATUS.md) to understand the current verified state and truth boundary.
3. Read [PROMPT_CATALOG.md](PROMPT_CATALOG.md) and choose the operating mode before doing anything else.
4. Read [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md) if the task involves execution, verification, merge follow-up, or release work.
5. Read [ENGINEERING_OPERATING_STANDARD.md](ENGINEERING_OPERATING_STANDARD.md) for labels, risk classes, auth truth rules, and reporting standards.
6. Declare the mode explicitly: Fix, Verify-Only, Post-Merge Verification, Post-Merge Real-User Validation, Browser/Backend Audit, or Release Readiness.
7. Declare whether the task mutates code or is verify-only, and confirm the dirty root checkout will not be touched.
8. Declare the isolated workspace: new worktree from `origin/main`, target branch, and primary files/surfaces under review.
9. Declare credential/tooling status up front and mark any missing prerequisite as `BLOCKED` before testing.
10. Declare the evidence plan before starting: required checks, screenshots/logs if needed, and PASS/FAIL/PARTIAL/BLOCKED/MANUAL criteria.

## PRE-MERGE LIVE VALIDATION GATE

This checklist must be completed by the store owner
(not the agent) before any PR is merged:

Before opening PR:
□ governance quartet passes: PASS
□ git diff shows only expected files
□ no unexpected files in diff
□ branch based on latest origin/main

Before declaring ready to merge:
□ store owner tested CREATE on live admin
□ store owner tested EDIT + page refresh
□ store owner tested DELETE + page refresh
□ store owner confirmed storefront reflects changes
□ no new console errors on admin
□ no new console errors on storefront
□ no regression on unrelated features

After merge:
□ GitHub Pages deployment confirmed (green)
□ live CRUD re-tested on newly deployed version
□ any failure → immediate hotfix branch
□ hotfix branch must pass all gates before merge

Agent rule:
If live CRUD cannot be tested (BLOCKED by credentials
or environment), the agent must explicitly state:
"LIVE VALIDATION: BLOCKED — cannot declare ready"
The store owner then decides whether to proceed.
