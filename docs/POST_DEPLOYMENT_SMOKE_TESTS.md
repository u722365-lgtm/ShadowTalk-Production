# Post-deployment smoke-test plan

Run this checklist on a staging release first. Production checks must be read-only or use a designated test account; do not delete real accounts or trigger paid provider usage.

## Availability and routing

- [ ] Load `/`, `/home`, `/auth`, `/auth/action`, `/chatbot`, `/profile`, `/privacy`, `/status`, and one prerendered public content route directly in a fresh browser session.
- [ ] Confirm assets load, no unexpected `.map` source-map requests are exposed, and browser console has no uncaught startup errors.
- [ ] Confirm unknown routes reach the expected not-found experience and SPA refresh does not return a server error.
- [ ] Check HTTPS, cache behavior, and configured response headers on the deployed host.

## Authentication and data boundaries

- [ ] Create/sign in with an approved staging account; verify email remains advisory/non-blocking and the notice reports actual status.
- [ ] Refresh and confirm the Firebase session restores. Sign out and verify the protected UI no longer shows the prior account.
- [ ] Switch between two disposable accounts in the same browser. Verify BYOK key, ElevenLabs key, AI cohort/quota, user settings, business memories, profile, and chat history do not cross identities.
- [ ] Verify password recovery and email verification action links use the expected same-origin `/auth/action` route.
- [ ] Verify another user's Firestore documents are denied by the rules emulator tests; do not attempt probing production accounts.

## BYOK and core chat

- [ ] Configure a disposable test key for the intended provider/model; confirm the request reaches only that provider and model.
- [ ] With a deliberately invalid staging key, confirm an actionable error is shown and no shared/platform key is used.
- [ ] Verify cancellation, rate-limit, network failure, and provider outage states with a controlled test provider or mock endpoint; ensure no fabricated success or cost/token metrics appear.
- [ ] Upload an allowed staging file and verify client-side validation, processing result, temporary object cleanup, and no unintended provider transmission.
- [ ] Try an oversized and malformed file; confirm rejection is recoverable and no stuck loading state remains.
- [ ] Check mobile keyboard/focus, form labels, reduced motion, and responsive chat/profile layout on a real device or browser emulation.

## Deletion and monitoring

- [ ] On a disposable staging account only, seed a record in each deletion collection, a nested subcollection, a payment receipt object, a UID profile/role document, a linked billing/audit row, and a daily usage row. Delete the account; confirm all test fixtures disappear and Auth is removed only after cleanup succeeds.
- [ ] Induce a cleanup failure in staging and confirm the Function returns an error, the Auth account remains for retry, and a second request safely completes.
- [ ] Confirm the current Status page says live monitoring is unavailable until a real monitor is connected; do not interpret configured service names as health evidence.
- [ ] Confirm Deep Research does not create a report while provider-backed research is unavailable.

## Evidence record

Record the app URL/environment, deployed commit/release ID, date/time, browser/device, test account identifiers in a secure internal system (not this document), pass/fail, error references with secrets/content redacted, and operator. Any failed item blocks release sign-off until triaged. Never record API keys, auth tokens, prompts, uploaded file contents, or personal account data in the report.
