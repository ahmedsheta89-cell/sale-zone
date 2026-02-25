# Production Drift Report (Evidence-Locked)

## Production Lock
| field | value |
|---|---|
| run_id | `22288209688` |
| workflow | `Deploy Production` (`deploy-production.yml`) |
| status | `success` |
| event | `workflow_dispatch` |
| prod_sha | `b149371382b96bf644cebd622ddd48b0aaa0e986` |

## Commit Graph
| node | sha |
|---|---|
| HEAD | `b149371382b96bf644cebd622ddd48b0aaa0e986` |
| origin/main | `b149371382b96bf644cebd622ddd48b0aaa0e986` |
| PROD_SHA | `b149371382b96bf644cebd622ddd48b0aaa0e986` |
| merge-base(HEAD, PROD_SHA) | `b149371382b96bf644cebd622ddd48b0aaa0e986` |

## Divergence Table
| side | commits |
|---|---|
| only in working branch vs `PROD_SHA` | none (committed divergence = 0) |
| only in `PROD_SHA` vs working branch | none (committed divergence = 0) |

## File Drift Table
### Committed drift (`PROD_SHA..HEAD`)
| file | status |
|---|---|
| none | no committed drift |

### Uncommitted drift (working tree)
| file | status |
|---|---|
| `.github/workflows/deploy-production.yml` | modified |
| `.github/workflows/deploy-backend.yml` | added |
| `firebase-api.js` | modified |
| `functions/src/lib/validators.js` | added |
| `functions/src/routes/adminSettings.js` | added |
| `monitoring/admin-function-registry.json` | modified |
| `tools/contracts-check.js` | modified |
| `tools/run-required-checks.js` | modified |
| `tools/smoke-check.js` | modified |
| `ادمن_2.HTML` | modified |
| `security/production-drift-report.md` | modified |

## Workflow Parity
| contract item | before patch (`PROD_SHA`) | current working tree |
|---|---|---|
| `deploy-firestore-rules.yml` present | yes | yes |
| `deploy-staging.yml` present | yes | yes |
| `deploy-production.yml` present | yes | yes |
| `deploy-backend.yml` present | no | yes |
| production verify-gates includes backend workflow | no | yes |
| production verifies backend artifact `backend-<sha>` | no | yes |
| production validates backend metadata commit SHA | no | yes |
| release manifest job to `release-records` | no | yes |

## Silent Mutation Forensics
| probe | command | first matching commit (sha \| date \| author \| subject) |
|---|---|---|
| Orders filter symbol | `git log -S "ordersStatusFilter" -- ادمن_2.HTML` | `b149371 \| 2026-02-23 00:58:16 +0200 \| szs712026-cmyk \| chore: finalize release stabilization cycle (#12)` |
| Orders local filter fn | `git log -S "applyOrdersFilterLocal" -- ادمن_2.HTML` | `b149371 \| 2026-02-23 00:58:16 +0200 \| szs712026-cmyk \| chore: finalize release stabilization cycle (#12)` |
| Admin banners source call | `git log -S "getAllBanners()" -- ادمن_2.HTML` | `f00bcdc \| 2026-02-09 07:40:19 +0200 \| ahmedsheta89-cell \| Add files via upload` |
| Store/public banner read call | `git log -S "getBanners(" -- firebase-api.js متجر_2.HTML` | `f00bcdc \| 2026-02-09 07:40:19 +0200 \| ahmedsheta89-cell \| Add files via upload` |
| Countdown local authority key | `git log -S "ADMIN_24H_CHANGE_TRACKER_KEY" -- ادمن_2.HTML` | `b149371 \| 2026-02-23 00:58:16 +0200 \| szs712026-cmyk \| chore: finalize release stabilization cycle (#12)` |

### Removal Evidence Check
| feature | removal commit found in available git history |
|---|---|
| orders filter | no removal evidence in git history; runtime drift class remains cache/partial-deployment candidate |
| banner canonical calls | no removal evidence in git history |
| countdown local authority | present and active at `PROD_SHA` |

## Root-Cause Classification (Locked)
| class | status | evidence |
|---|---|---|
| `workflow_parity_gap` | confirmed | backend deploy workflow absent at `PROD_SHA` |
| `authority_misplacement` | confirmed | countdown decision authority in localStorage (`ADMIN_24H_CHANGE_TRACKER_KEY`) |
| `cache_dominance` | risk present | fallback/cache paths exist in admin/store load flows |
| `partial_deployment` | risk present | production chain previously did not include backend/functions/indexes |
| `refactor_side_effect` | not proven from git removal evidence | no direct removal commit for orders filter found |

## Reproducibility Proof
| file | sha256 |
|---|---|
| `.github/workflows/deploy-production.yml` | `117ac767c20303c5e7a06740ab5a5e0d29cdd6ea3ec76c68b3d81e569a8b4b54` |
| `.github/workflows/deploy-backend.yml` | `936d50d7db3afecc89e5e60e6c2db4290f94ce7806e823b975a5b405b0f57990` |
| `firebase-api.js` | `43138fa8a1b1058252efa0742721146b49bfc60e01c1cbd23f4b2c727e01c17b` |
| `ادمن_2.HTML` | `e23cb3265b3b136cd4864bfd23009e4806410c52a8f91a84aeb195b30be63ee6` |
