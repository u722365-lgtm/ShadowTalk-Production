# ShadowTalk AI

ShadowTalk is a React and TypeScript AI workspace with chat, account and profile
management, memory, Shadow Twin, knowledge, and supporting product pages. The
web application is built with Vite and uses Firebase as its primary hosted
backend.

**Production:** [Workspace](https://shadowtalk-ai-7a513.web.app/chatbot) ·
[Home](https://shadowtalk-ai-7a513.web.app/home)

## Project at a glance

- **Web client:** React 18, TypeScript, Vite, React Router, and TanStack Query.
- **Authentication and data:** Firebase Authentication, Cloud Firestore, and
  Cloud Storage.
- **Backend endpoints:** Firebase Cloud Functions v2 for chat, image
  generation, audio, and demo Google Drive actions.
- **AI:** Cloud-provider and local-inference code paths, including WebLLM /
  WebGPU support. Available providers and behavior depend on the feature and
  its configuration; see [Architecture](./docs/architecture/README.md).
- **Build and hosting:** Vite production build, Puppeteer prerendering, and
  Firebase Hosting. Vite also includes a PWA plugin; check service-worker
  behavior before changing offline or update behavior.

## Getting started

Use Node.js 20 or a compatible newer release, then install the web dependencies
and start Vite:

```bash
git clone https://github.com/u722365-lgtm/ShadowTalk-Production.git
cd ShadowTalk-Production
npm ci
npm run dev
```

Vite serves the local app at `http://localhost:8080` by default.

Firebase web configuration has defaults in the source for the deployed
project. To override it locally, copy [`env.example`](./env.example) to `.env`
and set the relevant `VITE_FIREBASE_*` values. Set
`VITE_FIREBASE_FUNCTIONS_URL` when using a non-default Cloud Functions base
URL. The web app's Firebase configuration is public client configuration; it
is not a place for private credentials.

New accounts choose an AI access mode on their first visit to `/chatbot`.
Tech users' provider keys are saved in browser storage scoped to their signed-in
account and sent directly to the selected provider. Non-tech users share the
server-side OpenRouter integration, limited to 100 AI requests per user per UTC
day (chat and image generation share the quota). Configure the shared provider
key as a Firebase Functions secret, then deploy Functions:

```bash
firebase functions:secrets:set OPENROUTER_API_KEY
firebase deploy --only functions
```

Do not put provider secrets in `VITE_*` variables: Vite embeds those values in
client assets. BYOK image generation is supported for OpenAI and OpenRouter;
other BYOK providers can still power text and vision requests when the chosen
model supports them. Audio and Google Drive Functions currently remain
demo/mock integrations and are not powered by the selected AI provider.

For local Cloud Functions development, install and build that package
separately:

```bash
npm ci --prefix functions
npm --prefix functions run build
```

## Main application routes

Routes are declared in [`src/App.tsx`](./src/App.tsx). The primary routes
include:

| Area | Routes |
| --- | --- |
| Home and sign-in | `/home`, `/auth` |
| Workspace and account | `/chatbot`, `/profile`, `/settings` |
| Memory and identity | `/shadow-memory`, `/shadow-twin`, `/t/:username` |
| Shared content | `/s/:slug`, `/docs`, `/changelog` |
| Company and support | `/about`, `/founder`, `/contact`, `/help`, `/faq`, `/blog`, `/case-studies` |
| Legal | `/gdpr`, `/cookies`, `/terms`, `/privacy` |

Additional biography, founder-access, private-AI, and authentication-design
routes are also defined in the router. Routes not found by the client are
handled by the not-found page.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the client and prerender configured routes |
| `npm run build:dev` | Build with Vite's development mode |
| `npm run preview` | Serve the built client locally |
| `npm test` | Run the Vitest suite once |
| `npm run lint` | Run ESLint |
| `npm --prefix functions run build` | Type-check/build the Cloud Functions package |

The prerender step is implemented in [`prerender.cjs`](./prerender.cjs) and
uses Puppeteer. The route list there is separate from the React router, so
update both when changing prerendered routes.

## Firebase deployment

The Firebase project and deployment targets are configured in
[`firebase.json`](./firebase.json) and [`.firebaserc`](./.firebaserc). After
installing and authenticating the Firebase CLI and configuring server-side
function credentials, deploy with:

```bash
firebase deploy
```

Firebase runs the Functions build as a predeploy step. You can deploy Hosting,
Firestore rules/indexes, Storage rules, and Functions separately with the
Firebase CLI when only one target needs an update.

## Repository layout

```text
src/
  ai/                  AI provider interfaces and provider selection
  components/          Shared UI and feature components
  contexts/             App-wide React contexts
  hooks/                Reusable React hooks
  integrations/
    firebase/           Firebase app, auth, Firestore, realtime, and storage adapters
    local/              App-facing backend compatibility client
    supabase/           Supabase client and generated types
  lib/                  Feature logic and service modules
  offline/              Local inference and device capability code
  pages/                Route-level page components
functions/src/          Firebase Cloud Functions
supabase/functions/     Supabase Edge Function sources retained in the repo
public/                 Static assets and published web content
docs/                   Documentation and supporting PDFs
```

For the current integration flow and security-rule entry points, see
[Architecture](./docs/architecture/README.md). The PDFs in `docs/` are
supporting design documents; verify implementation details against the source
and configuration files, which are authoritative.

## Validation

Run the relevant checks before submitting changes:

```bash
npm run build
npm test
npm run lint
npm --prefix functions run build
```

These commands exercise different parts of the repository. The client build
does not validate the separate Cloud Functions package, and a successful
production build does not imply that the full test suite or lint output is
clean.
