# ShadowTalk architecture

This document describes the architecture visible in the current repository.
For setup and validation commands, see the [project README](../../README.md).

## Runtime overview

```text
Browser
  └─ src/main.tsx
      └─ src/App.tsx
          ├─ React providers (auth, security, memory, themes, query cache)
          ├─ React Router pages (mostly lazy-loaded)
          ├─ Firebase-backed app client
          │   ├─ Firebase Authentication
          │   ├─ Cloud Firestore through a Supabase-style query adapter
          │   ├─ Cloud Storage
          │   └─ HTTPS Cloud Functions
          └─ AI features
              ├─ Cloud provider paths
              └─ Local inference paths (WebLLM / WebGPU where supported)
```

`src/main.tsx` initializes global error handling, performance helpers, and
the React root. `src/App.tsx` composes app-wide providers, router behavior,
transitions, and deferred global UI. Page components live in `src/pages/`;
shared components, hooks, contexts, and feature logic live in their
corresponding `src/` directories.

## Backend and data access

Firebase is the primary backend configured by `src/integrations/firebase/`.
The app-facing `backend` object in `src/integrations/local/client.ts` adapts
Firebase services to an API used by existing call sites:

- `auth` wraps Firebase Authentication.
- `from(...)` provides a Supabase/PostgREST-style query interface backed by
  Firestore. It implements a subset of query operations; it is not a
  PostgreSQL or general PostgREST server.
- `storage` wraps Firebase Cloud Storage.
- `channel`/realtime functionality is implemented over Firestore listeners.
- `functions.invoke(...)` sends requests to the configured Firebase HTTPS
  Functions base URL and includes the current user's Firebase ID token when
  available.

`src/integrations/supabase/` and `supabase/functions/` are also present. Their
presence does not make Supabase the primary backend for the app client;
confirm a feature's actual imports and call path before changing or deploying
these integrations.

### Security configuration

- `firestore.rules` contains the Firestore authorization rules.
- `firestore.indexes.json` declares composite Firestore indexes.
- `storage.rules` contains Cloud Storage authorization rules.
- `firebase.json` connects those rules and indexes to Firebase deployment.

Review the deployed rules and indexes alongside the calling code when changing
data access. Firestore client writes are authorized by rules; Cloud Functions
use the Firebase Admin SDK and must enforce their own authentication,
authorization, validation, and quotas.

## AI request paths

Authenticated users select their AI access mode once on the chatbot page.
`src/lib/aiAccessMode.ts` persists the account preference in Firestore and
caches the non-secret mode per Firebase UID. `src/lib/byok.ts` keeps Tech-user
provider credentials in browser storage scoped to that UID; provider requests
are sent directly from the browser. The shared key is never delivered to the
client.

`src/lib/cloudChat.ts` is the central text/vision router used by chat,
Turbo-based AI features, screen analysis, voice copilot, strategy generation,
presentation generation, and provider-routed chat features.
Shared requests go to the Firebase `chat` function, which verifies Firebase
Auth, enforces the selected `shared` mode, and transactionally reserves one of
100 daily requests per user. The daily counter is UTC-based and shared with
`generateImage`. Tech-user text and vision requests go to the configured
OpenAI, Groq, OpenRouter, or Gemini-compatible endpoint using that user's
local key. The provider/model must support the requested capability.

Shared requests use the fixed OpenRouter free-model route. Shared image
generation uses OpenRouter's Gemini image model. BYOK image generation is
available with OpenAI or OpenRouter; other BYOK providers currently support
text/vision only. Some complex features can make multiple backend requests, so
the quota unit is an AI request, not a top-level user action.

Offline local inference remains available where explicitly selected or when
the device is offline and a local model is installed. The `audio` and `drive`
Cloud Functions are currently demo/mock integrations, not LLM-powered
features. Set the shared credential with
`firebase functions:secrets:set OPENROUTER_API_KEY` and deploy Functions.
Never put provider secrets in `VITE_*` variables: Vite embeds those values in
browser-delivered bundles.

## Hosting and build

`firebase.json` deploys the Vite `dist/` directory to Firebase Hosting and
rewrites requests to the SPA entry point. The root `npm run build` script
runs `vite build` followed by `prerender.cjs`. That script uses Puppeteer to
render its own configured route list; this list is maintained separately from
the React Router routes in `src/App.tsx`.

`vite.config.ts` configures React, manual vendor chunks, and a PWA plugin.
`src/main.tsx` registers the generated service worker and also schedules
service-worker unregistration. Review both paths together before changing
offline caching or service-worker update behavior.

## Cloud Functions

The separate `functions/` package uses TypeScript and Firebase Functions v2.
Its current exported HTTPS functions are:

| Export | Purpose |
| --- | --- |
| `chat` | Authenticated chat with provider fallback and usage accounting |
| `generateImage` | Authenticated image-generation request |
| `audio` | Authenticated demo response |
| `drive` | Authenticated demo Drive list/get responses |

Firebase is configured to run `npm --prefix "$RESOURCE_DIR" run build` before
deploying Functions. Install the package's dependencies separately when
building it locally.

## Tests and diagnostics

The web test suite is Vitest-based and is configured by `vitest.config.ts`.
Run `npm test` for the current result; test expectations and external-service
mocks should be kept aligned with the current routes and integrations.

The frontend and Functions packages have separate TypeScript configurations.
`npm run build` is the client production build and prerender step; it is not a
substitute for building the Functions package. See the root README for all
validation commands.
