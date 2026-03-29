# Purpose

This file is the official mode/chooser map for Sale Zone work. Use it to choose the correct operating pattern before starting implementation or verification.

# Quick Chooser

| Symptom / Request | Mode | Mutates Code? | Credentials Needed? | Risk Level | Output |
| --- | --- | --- | --- | --- | --- |
| `فيه bug` | Narrow Hotfix Prompt | Yes | Usually no | High | bounded fix + verification + PR |
| `افحص المشروع` | Full-Stack Audit — Scenario 1 | No | No | Medium | code/governance/integrity report |
| `اختبر كأنك مستخدم` | Post-Merge Real-User Validation | No | Usually yes | High | browser evidence for real user flows |
| `تم الدمج` | Post-Merge Verification | No | No | Medium | merge-on-main + governance + integrity report |
| `قبل الريليز` | Release Readiness Prompt | Usually no | Often yes | Critical | release-go/no-go report |
| browser regression after a fix | Post-Fix Browser Verification | No | Usually yes | High | browser proof on fixed branch content |
| need customer/admin browser proof before merge | Playwright Browser Audit — Scenario 2 | No | Yes | High | screenshots + Playwright report |
| need Firebase backend verification | Firebase Backend Audit — Scenario 3 | No | Yes | High | backend evidence or BLOCKED report |
| need short final code-level closure | Compact Final Closure Audit | No | No | Medium | concise PASS/FAIL/BLOCKED closeout |

# Trigger Phrases

- `فيه bug` -> start with Narrow Hotfix Prompt
- `تم الدمج` -> use Post-Merge Verification
- `اختبر كأنك مستخدم` -> use Post-Merge Real-User Validation or Post-Fix Browser Verification depending whether the change is already merged
- `قبل الريليز` -> use Release Readiness Prompt
- `افحص المشروع` -> use Full-Stack Audit — Scenario 1 unless the user explicitly asks for browser/backend/live validation

# Official Modes

## Compact Final Closure Audit

- Use when: a bounded change is already done and you need a short final integrity/governance closeout
- Mutates code?: No
- Credentials/tooling: no special credentials
- Primary tools: static checks, governance commands, targeted diff review
- Expected outputs: concise PASS/FAIL/BLOCKED closure report
- Can become `BLOCKED`: only if environment/tooling restrictions prevent truthful verification

## Full-Stack Audit — Scenario 1

- Use when: you need code-level, governance, merge, and integrity verification without relying on live credentials
- Mutates code?: No
- Credentials/tooling: none required
- Primary tools: worktree verification, static analysis, governance suite, workflow/integrity checks
- Expected outputs: code-level audit with PASS/FAIL/BLOCKED classifications
- Can become `BLOCKED`: if worktree creation, `npm.cmd ci`, or required tooling cannot run truthfully

## Playwright Browser Audit — Scenario 2

- Use when: you need customer/admin browser validation on store/admin surfaces
- Mutates code?: No
- Credentials/tooling: customer/admin credentials and Playwright tooling
- Primary tools: Playwright, screenshots, browser console/runtime checks
- Expected outputs: screenshot-backed browser report
- Can become `BLOCKED`: missing credentials, browser install failure, or inability to launch the correct content under test

## Firebase Backend Audit — Scenario 3

- Use when: you need direct backend/data-layer verification
- Mutates code?: No
- Credentials/tooling: Firebase project ID plus service-account credentials
- Primary tools: Firebase Admin SDK, Firestore queries, direct backend checks
- Expected outputs: backend evidence report
- Can become `BLOCKED`: missing project/service-account credentials or external environment access

## Post-Fix Browser Verification

- Use when: a fix is implemented on a branch and you need to prove behavior against the fixed branch content before merge
- Mutates code?: No
- Credentials/tooling: often yes for login/checkout/admin paths
- Primary tools: local preview + Playwright/manual browser verification
- Expected outputs: browser evidence tied to the fixed branch content
- Can become `BLOCKED`: no stable preview, missing credentials, or browser tooling failure

## Post-Merge Verification

- Use when: a fix is merged and you must prove it is healthy on `origin/main`
- Mutates code?: No
- Credentials/tooling: usually none
- Primary tools: detached worktree from `origin/main`, fix-signature checks, governance, integrity scans
- Expected outputs: merged-on-main verification report
- Can become `BLOCKED`: fetch/worktree/tooling failure or restricted environment issues that prevent truthful checks

## Post-Merge Real-User Validation

- Use when: merged code affects user-facing behavior and real-user/runtime proof is needed
- Mutates code?: No
- Credentials/tooling: usually browser login credentials
- Primary tools: real browser session, screenshots, runtime auth/behavior checks
- Expected outputs: user-journey evidence after merge
- Can become `BLOCKED`: missing credentials, unstable preview/deployment target, or inability to reproduce the required environment

## Narrow Hotfix Prompt

- Use when: there is a bounded bug or regression that needs the smallest safe fix
- Mutates code?: Yes
- Credentials/tooling: usually no, unless the bug is live-environment dependent
- Primary tools: diagnosis, targeted edits, governance checks, focused verification
- Expected outputs: minimal code change, evidence, branch, commit, PR
- Can become `BLOCKED`: missing environment access or inability to verify the risky path

## Release Readiness Prompt

- Use when: you need a go/no-go assessment before staging/production promotion
- Mutates code?: Usually no
- Credentials/tooling: often yes for environment checks
- Primary tools: governance suite, release policy checks, workflow/deploy evidence, external/manual checks
- Expected outputs: release-ready / not-ready report with manual gaps listed
- Can become `BLOCKED`: missing deploy/environment access, unknown branch protection state, or unavailable Firebase/deployment credentials

# Recommended Order

1. Bug found -> Narrow Hotfix Prompt
2. Fix implemented -> Post-Fix Browser Verification if behavior changed
3. Merge -> Post-Merge Verification
4. User-facing merge -> Post-Merge Real-User Validation
5. Broader system confidence -> Full-Stack Audit — Scenario 1 and, if needed, Scenario 2/3
6. Final promotion decision -> Release Readiness Prompt

# Decision Vocabulary

- `PASS` — proven with evidence
- `FAIL` — proven broken with a concrete root cause or exact failing check
- `PARTIAL` — some intended scope passed, but part of the scope remains unproven or mixed
- `BLOCKED` — could not be run truthfully because a required prerequisite is missing
- `MANUAL` — requires a human or external system action outside the current verification environment

# See Also

- [AGENT_RULES.md](AGENT_RULES.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md)
- [ENGINEERING_OPERATING_STANDARD.md](ENGINEERING_OPERATING_STANDARD.md)
- [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md)
