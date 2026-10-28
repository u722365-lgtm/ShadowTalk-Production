# ShadowTalk documentation

This folder contains architecture notes and reference PDFs for ShadowTalk AI.
The running implementation and deployment configuration are the source of
truth: `src/`, `functions/`, `firebase.json`, `firestore.rules`,
`firestore.indexes.json`, and `storage.rules`.

## Start here

- [Project overview and developer setup](../README.md)
- [Current architecture and runtime flow](./architecture/README.md)
- [SEO / GEO / AEO architecture](./SEO_GEO_AEO_ARCHITECTURE.md)

## Reference PDFs

The PDFs below are supporting design and product documents. Some describe
planned, historical, or aspirational architecture and have not been verified
against the current source. Treat implementation-specific statements in them
as unverified until checked against the repository.

### System and architecture

- [Master System Documentation](./ShadowTalk_AI_Master_System_Documentation.pdf)
- [Comprehensive Architecture Analysis](./ShadowTalk_AI_Comprehensive_Architecture_Analysis.pdf)
- [Volume 1: Architecture and Foundations](./ShadowTalk_AI_Volume_1_Architecture_and_Foundations.pdf)
- [Volume 2: AI Engines and Agentic Tools](./ShadowTalk_AI_Volume_2_AI_Engines_and_Agentic_Tools.pdf)
- [Volume 3: Developer Studio and Security Vault](./ShadowTalk_AI_Volume_3_Developer_Studio_and_Security_Vault.pdf)
- [Volume 4: Enterprise SaaS and File Dictionary](./ShadowTalk_AI_Volume_4_Enterprise_SaaS_and_File_Dictionary.pdf)

### Brand

- [Master Brand Book — Complete Edition](./ShadowTalk_AI_Master_Brand_Book_Complete_Edition.pdf)
- [Master Brand Book](./ShadowTalk_AI_Master_Brand_Book.pdf)

## Keeping documentation current

When code or deployment behavior changes, update the relevant source-linked
documentation in the same change. Do not copy test counts, build timings, or
other machine-specific verification results here as permanent guarantees.
Run the current commands from the root README to verify the working tree.
