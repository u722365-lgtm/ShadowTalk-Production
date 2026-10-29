# ShadowTalk documentation

This folder contains source-checked architecture, security, authentication, and
release documentation for ShadowTalk AI. The running implementation and
deployment configuration remain the source of truth: `src/`, `functions/`,
`firebase.json`, `firestore.rules`, `firestore.indexes.json`, and `storage.rules`.

## Start here

- [Project overview and developer setup](../README.md)
- [Authentication architecture and user lifecycle](./AUTHENTICATION_ARCHITECTURE.md)
- [SEO / GEO / AEO architecture](./SEO_GEO_AEO_ARCHITECTURE.md)
- [Production readiness final report](./PRODUCTION_READINESS_FINAL_REPORT.md)
- [Production security review](./PRODUCTION_SECURITY_REVIEW.md)
- [Authentication audit](./AUTHENTICATION_AUDIT.md)
- [Authentication test plan](./AUTHENTICATION_TEST_PLAN.md)
- [Deployment runbook](./DEPLOYMENT_RUNBOOK.md)
- [Post-deployment smoke tests](./POST_DEPLOYMENT_SMOKE_TESTS.md)

## Brand references

- [Master Brand Book — Complete Edition](./ShadowTalk_AI_Master_Brand_Book_Complete_Edition.pdf)
- [Master Brand Book](./ShadowTalk_AI_Master_Brand_Book.pdf)

## Keeping documentation current

When code or deployment behavior changes, update the relevant source-linked
documentation in the same change. Do not copy test counts, build timings, or
other machine-specific verification results here as permanent guarantees.
Run the current commands from the root README to verify the working tree.
