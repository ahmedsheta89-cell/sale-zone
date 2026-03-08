# Sale Zone — Governance Guide

## Project Stack
- Frontend: Vanilla JS + GitHub Pages
- Database: Firebase Firestore (Spark plan)
- Media: Cloudinary
- CI/CD: GitHub Actions
- Admin: ادمن_2.HTML
- Store: متجر_2.HTML
- API Layer: assets/js/firebase-api.js (126 functions, all Firestore direct)

## Architecture Decisions
### Firebase Spark Plan
- Cloud Functions: DISABLED (no payment)
- All data operations use Firestore directly
- `callBackendApi()` exists but is intentionally unused
- DO NOT re-enable backend API without upgrading to Blaze

### Server Truth Only
- Firestore = single source of truth
- localStorage = mirror/cache only, never primary source
- On Firestore error -> return `[]` and log the failure

### Branch Protection
Required checks (exact names):
- `policy-governance`
- `hash-stability`
- `release-gate`
- `smoke-check`
- `contracts-check`
- `admin-function-monitor`

## Security — App Check
- Status: ACTIVE
- Site key: configured
- Activated: 2026-03-06
- Residual risk: MEDIUM if the key is rotated in reCAPTCHA/Firebase and not updated here
- Activation / rotation steps:
  1. Open `https://www.google.com/recaptcha/admin`
  2. Register `ahmedsheta89-cell.github.io` as a reCAPTCHA v3 site
  3. Copy the site key
  4. Open Firebase App Check for `sale-zone-601f0`
  5. Register the web app and paste the site key
  6. Set the key in `<meta name="firebase-app-check-site-key">`, `window.FIREBASE_APP_CHECK_SITE_KEY`, or `DEFAULT_FIREBASE_APP_CHECK_SITE_KEY` in `assets/js/firebase-config.js`
  7. Reload the app and verify App Check is active

## Release Gate Jobs
| Job | Purpose | Trigger |
|-----|---------|---------|
| preflight | Basic sanity checks | PR + push |
| hash-stability | Registry hash matches code | PR + push |
| smoke-check | Sensitive files + version guard | PR + push |
| contracts-check | API contracts valid | PR + push |
| admin-function-monitor | Admin functions registry | PR + push |
| console-smoke-check | Frontend markers present | PR + push |
| release-gate | Aggregates required jobs | PR + push |
| policy-governance | Governance policy validation | PR + push |
| security-regression-check | Security regression guard | PR + push |
| e2e | End-to-end test gate | PR + push |
| ci-parity | CI configuration parity | PR + push |

## Golden Rules
1. NEVER remove Required checks to unblock a PR
2. NEVER push directly to main
3. NEVER merge without Release Gate green
4. NEVER disable passing workflows
5. NEVER force push to main
6. If PR blocked -> fix code, not governance
7. Always use clean worktree
8. Always run preflight before starting work
9. Server Truth Only — Firestore = source of truth
10. Fix the code — not the checks

## Workflow: How to Make a Change
1. `npm run preflight` (verify main is healthy)
2. `git worktree add ../my-feature origin/main`
3. `cd ../my-feature`
4. `git checkout -b feat/my-feature`
5. Make changes
6. `node tools/smoke-check.js`
7. `node tools/contracts-check.js`
8. `node tools/admin-function-monitor.js`
9. `git commit` + `git push`
10. Open PR -> wait for Release Gate
11. Get approval -> merge

## Emergency: Main is Broken
If main Release Gate is failing:
1. DO NOT merge anything new
2. Identify which PR broke main
3. Create fix branch from main
4. Fix only the failing checks
5. Open PR -> verify ALL checks green
6. Merge the fix before anything else

## On Hold
- `release/lockdown-stabilization`
  - Status: ON HOLD — DO NOT merge
  - Reason: contains unfinished governance markers
  - `GATE_STATE_BACKEND_OPTIONAL_DISABLED`
  - `admin24hLastSource`
  - These markers must exist in ادمن_2.HTML before merging

## Sensitive Files
These files require `version.json` bump when changed:
- `assets/js/firebase-api.js`
- `ادمن_2.HTML`
- `متجر_2.HTML`
- `assets/js/firebase-config.js`

## Feature Protection System
- `monitoring/feature-registry.json` is the source of truth for critical admin/store features that must never be removed accidentally.
- Add a new critical feature by updating the correct file block in `monitoring/feature-registry.json`:
  - `critical_ids` for protected DOM ids
  - `critical_functions` for protected function definitions
  - `critical_strings` for other must-exist markers such as section ids or modal ids
- `node tools/contracts-check.js` reads the registry locally and in Release Gate.
- If any protected feature is missing, `contracts-check` exits with code `1`, Release Gate fails, and the PR cannot merge until the feature is restored or the registry is intentionally updated.

## Workflow Status
| Workflow | Status | Last Run | When to enable |
|----------|--------|----------|----------------|
| `release-gate.yml` | ACTIVE | Every PR/push | Always on |
| `policy-governance.yml` | ACTIVE | Every PR/push | Always on |
| `workers-paranoid-gate.yml` | ACTIVE | Every PR/push | Always on |
| `deploy-firestore-rules.yml` | ACTIVE | On rules change | Always on |
| `daily-health-check.yml` | ACTIVE | Daily 6AM UTC | Always on |
| `deploy-backend.yml` | DISABLED | 2026-02-27 | Upgrade to Blaze |
| `rollback-production.yml` | READY | Manual only | Emergency only |
| `workers-rollout.yml` | READY | Manual only | When workers are deployed |

## PR History
| PR | Description | Status |
|----|-------------|--------|
| #19 | Firestore rules | Merged |
| #20 | deploy-backend workflow | Merged |
| #21 | assets/js/firebase-api.js markers | Merged |
| #22 | ادمن_2.HTML CRUD | Merged |
| #23 | متجر_2.HTML improvements | Merged |
| #24 | Release Gate fix | Merged |
| #25 | CORS fix | Merged |
| #26 | Settings -> Firestore | Merged |
| #27 | All API -> Firestore direct | Merged |
| #28 | Line endings normalized | Merged |
| #29 | Governance Phases 2-6 | Merged |
| #30 | Comprehensive fixes | Merged |

## Notes
- CI installs tool parser dependencies from `sale-zone/` before running root-level governance scripts.
- `tools/verify-branch-protection.js` requires `GITHUB_TOKEN` to compare live protection with the baseline.
