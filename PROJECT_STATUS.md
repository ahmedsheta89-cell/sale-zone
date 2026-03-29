# Project Identity

Sale Zone is an Arabic/RTL storefront and admin system with Firebase-centered runtime behavior.

Primary runtime surfaces:
- `متجر_2.HTML` — storefront UI and customer journeys
- `ادمن_2.HTML` — admin UI and operational controls
- `assets/js/firebase-api.js` — Firebase-facing data and order flows
- `firestore.rules` — security model
- `firestore.indexes.json` — Firestore query/index support
- `.github/workflows/*.yml` — governance, deploy, and rollback automation

Current supporting docs exist across the repo, but this file is the canonical current-status layer for future sessions. `AGENT_RULES.md` remains the top safety/rules document.

# Current Truth Boundary

- Code-level verification is strong.
- Browser/behavior verification is partial and often credential-dependent.
- Release-level readiness must not be assumed without explicit release-readiness validation plus external/manual checks.
- Dirty root checkouts are off-limits for normal work; future sessions should prefer isolated worktrees from `origin/main`.

# Current Verified State

## Code Status

- Governance tooling exists and is required before commit.
- Safe verification from detached/new worktrees on `origin/main` has been validated.
- Main runtime surfaces, Firestore rules, indexes, and workflow files are present and have passed recent repo-level checks.
- The auth/UI desync fix is present on `origin/main` by merged content, not only by original branch SHA.

## Behavior Status

- Store/admin browser behavior has been verified at code and targeted browser levels, but not every live path is continuously proven.
- Auth truth must come from live Firebase auth state, not stale cache or UI appearance.
- Browser verification is considered authoritative only when it targets fixed branch content or merged `origin/main`; stale deployed pages are not sufficient proof for recent fixes.
- Playwright browser validation becomes `BLOCKED` when login credentials are unavailable.
- Firebase backend validation becomes `BLOCKED` when project/service-account credentials are unavailable.

## Release Status

- Governance and post-merge code verification are in good shape.
- Release readiness is still partially manual because branch protection, deployed Firebase rules/indexes state, and environment readiness are external unless directly checked.
- Production safety expectations are defined in [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md), but that policy is not itself proof that the external settings/deployments are currently correct.

## Confidence

Conservative confidence is:
- Code Status: high
- Behavior Status: medium
- Release Status: medium-low until release-specific external checks are completed

# Merged Fixes Confirmed On Main

The following fix families have been verified on `origin/main`:

- PR #103 — auth timing hotfixes
- PR #104 — notifications collection-group index and knowledge-base alignment
- CI/CD governance and deploy alignment fixes
- Firestore diagnostics/logging fix
- order idempotency `uid`-scope fix
- `.nojekyll` support for GitHub Pages artifact handling
- auth/UI desync fix
  - original branch commit: `87898c4`
  - merged equivalent commit on `origin/main`: `e1df5eb`
  - future sessions must treat this as a squash/content-equivalent merge, not as a requirement that the original branch SHA remains an ancestor on `main`

# Current Known Risks / Caveats

- Empty catch blocks remain a review concern; they are not automatic regressions by themselves.
- Script-tag count mismatches are heuristic only unless a runtime break is proven.
- `run-required-checks.js` can false-fail in restricted/sandboxed environments when hooksPath lookup or process spawning is blocked.
- Browser verification must use fixed branch content or merged `main`, not stale GitHub Pages content by default.
- Playwright and Firebase backend verification require real credentials/tooling and should be classified as `BLOCKED` when unavailable.
- Branch protection, deployed Firebase rules/indexes state, and live release state are commonly `MANUAL` unless directly verified.
- Legacy docs may contain outdated operational or security guidance. The operating layer introduced by this file, [PROMPT_CATALOG.md](PROMPT_CATALOG.md), [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md), [ENGINEERING_OPERATING_STANDARD.md](ENGINEERING_OPERATING_STANDARD.md), and [AGENT_RULES.md](AGENT_RULES.md) takes precedence.

# Manual / External Checks Still Required

- GitHub branch protection live settings on `main`
- Deployed Firebase rules/indexes state for the target environment
- Real-user browser validation after merge when the fix affects login, checkout, or privileged flows
- Release-readiness checks tied to staging/production environment state
- Any Firebase backend verification that requires service-account access

# Immediate Next Actions

- Use [PROMPT_CATALOG.md](PROMPT_CATALOG.md) to choose the correct mode before any new work.
- For bug work, prefer narrow fixes plus post-fix verification before merge.
- For merged changes, run post-merge verification on `origin/main` and, if user-facing behavior changed, follow with real-user validation.
- Before release, follow [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md) and [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md) rather than assuming readiness from code checks alone.

# Session Startup Guidance

Future Codex/engineer sessions should start in this order:

1. Read [AGENT_RULES.md](AGENT_RULES.md)
2. Read this file
3. Choose an operating mode from [PROMPT_CATALOG.md](PROMPT_CATALOG.md)
4. Execute from a new worktree based on `origin/main`

Default assumptions for future sessions:
- Root dirty checkout is not a workspace to reuse.
- Code truth is stronger than stale UI appearance.
- Behavior truth requires browser/runtime evidence.
- Release truth requires external/manual confirmation unless directly verified.

# See Also

- [AGENT_RULES.md](AGENT_RULES.md)
- [PROMPT_CATALOG.md](PROMPT_CATALOG.md)
- [WORKFLOW_RUNBOOK.md](WORKFLOW_RUNBOOK.md)
- [ENGINEERING_OPERATING_STANDARD.md](ENGINEERING_OPERATING_STANDARD.md)
- [RELEASE_GATE_POLICY.md](RELEASE_GATE_POLICY.md)
- Supporting context only: [README.md](README.md), [SECURITY_AUDIT_FACTS.md](SECURITY_AUDIT_FACTS.md), [TECHNICAL_AUDIT_RESPONSE.md](TECHNICAL_AUDIT_RESPONSE.md)
