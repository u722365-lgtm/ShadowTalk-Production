# Deployment runbook

This runbook describes the repository's Firebase Hosting release path. No deployment was run as part of this audit.

## Preconditions

1. Confirm the approved release commit and inspect its full diff, including the existing auth-redesign changes.
2. Confirm Firebase project ID and hosting target with the release owner. Repository defaults identify a project, but this audit did not inspect live Firebase state. Do not rely on a stale CLI alias.
3. Confirm deployed Firestore/Storage rules, Auth provider settings, authorized domains, email action URLs, App Check, Function secrets, quotas/billing, and the Node 20 runtime.
4. Require green CI for frontend typecheck, lint, unit tests, frontend build/prerender, Functions compilation under Node 20, and Firestore emulator rules tests. Local verification passed for app typecheck, test suite (with emulator skips disclosed), lint, build/prerender, and Functions compilation under local Node 26.7.0; the emulator and Node 20 gates remain pending in CI. Current limitations are recorded in the final report.
5. Validate signup/login/recovery, BYOK provider selection and failure, file processing, account switching, and account deletion using disposable staging users in a non-production Firebase project.
6. Ensure the previous successful Hosting release is identifiable in Firebase Hosting release history and that an operator with rollback access is available.
7. Review provider terms/privacy text and determine how billing subscriptions or processor-held records are handled when an account is deleted.

## Build and deploy

Run from the approved release checkout using Node 20 and the npm lockfile:

```powershell
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
npm --prefix functions ci
npm --prefix functions run build
```

Inspect `dist` for `.map` files, secrets, missing required static assets, route HTML, canonical URLs, and the generated sitemap before deployment. Do not deploy if prerender fails.

After explicitly verifying the intended project and Hosting target, use the repository's approved Firebase Hosting deployment workflow. The checked-in workflow deploys Hosting on merge to `main`; this audit intentionally did not trigger it. Do not deploy Functions or rules implicitly as part of a Hosting-only change unless a separately approved release requires it.

## Post-deployment

Run the checks in `POST_DEPLOYMENT_SMOKE_TESTS.md` against the deployed release without deleting a production account or submitting paid AI requests. Record release URL, commit, time, target/project confirmation, smoke results, and any incident.

## Rollback

1. Stop further rollout and capture the release identifier, commit, first observed error, affected routes, and browser/network diagnostics without collecting credentials or user message bodies.
2. Use Firebase Hosting release history to restore the previously known-good Hosting release through the approved owner/operator. Do not guess a project or rollback release.
3. If a backend Function or rules change was separately deployed, roll it back only to a known-compatible revision after checking data/schema compatibility; Hosting rollback alone does not revert Functions, Firestore rules, Auth settings, or stored data.
4. Re-run critical smoke tests after rollback and record the result.
5. Preserve logs with secret and personal-content redaction. Do not run destructive data correction on production without explicit approval and a verified backup/restore plan.

## Current blockers

See `PRODUCTION_READINESS_FINAL_REPORT.md`. In particular, the new account-deletion Function is not deployed or integration-tested, Firestore emulator behavior is unverified, and the Functions build must be repeated under its declared Node 20 runtime. No production deployment was run.
