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
