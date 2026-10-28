# ShadowTalk Architecture

This document describes the architecture visible in the current repository.
For setup and validation commands, see the [project README](../../README.md).

## Runtime Overview

```text
Browser
  └─ src/main.tsx
      └─ src/App.tsx
          ├─ React providers (auth, security, memory, themes, query cache, AI keys, shadow memory, auto-improve, stealth kill switch)
          ├─ React Router v6 pages (mostly lazy-loaded, 60+ routes)
          ├─ Firebase-backed app client (src/integrations/firebase/)
          │   ├─ Firebase Authentication (email/password + Google OAuth)
          │   ├─ Cloud Firestore via Supabase-style query adapter (src/integrations/local/client.ts)
          │   ├─ Cloud Storage
          │   └─ HTTPS Cloud Functions v2
          ├─ AI features
          │   ├─ Cloud provider paths (OpenRouter, OpenAI, Anthropic, Google, Groq)
          │   ├─ BYOK (Bring Your Own Key) — user keys stored in browser storage per UID
          │   └─ Local inference paths (WebLLM / WebGPU via @mlc-ai/web-llm)
          ├─ PWA (vite-plugin-pwa, service worker auto-update)
          └─ WebContainer (Computer Mode) — in-browser npm/node shell via @webcontainer/api
```

`src/main.tsx` initializes global error handling, performance helpers, and the React root.
`src/App.tsx` composes app-wide providers, router behavior, transitions, and deferred global UI.
Page components live in `src/pages/` (60+ pages); shared components, hooks, contexts, and feature logic live in their corresponding `src/` directories.

## Backend and Data Access

Firebase is the primary backend configured by `src/integrations/firebase/`.

The app-facing `backend` object in `src/integrations/local/client.ts` adapts Firebase services to an API used by existing call sites:

- `auth` wraps Firebase Authentication.
- `from(...)` provides a Supabase/PostgREST-style query interface backed by Firestore. It implements a subset of query operations; it is not a PostgreSQL or general PostgREST server.
- `storage` wraps Firebase Cloud Storage.
- `channel`/realtime functionality is implemented over Firestore listeners.
- `functions.invoke(...)` sends requests to the configured Firebase HTTPS Functions base URL and includes the current user's Firebase ID token when available.

`src/integrations/supabase/` and `supabase/functions/` are also present. Their presence does not make Supabase the primary backend for the app client; confirm a feature's actual imports and call path before changing or deploying these integrations.

### Security Configuration

- `firestore.rules` contains the Firestore authorization rules.
- `firestore.indexes.json` declares composite Firestore indexes.
- `storage.rules` contains Cloud Storage authorization rules.
- `firebase.json` connects those rules and indexes to Firebase deployment.

Review the deployed rules and indexes alongside the calling code when changing data access. Firestore client writes are authorized by rules; Cloud Functions use the Firebase Admin SDK and must enforce their own authentication, authorization, validation, and quotas.

### Firestore Collections (Current)

| Collection | Purpose |
|------------|---------|
| `user_settings` | Per-user settings (ai_access_mode, theme, preferences) |
| `daily_usage` | Daily AI request counters per UID (UTC date) |
| `usage_analytics` | Event log for chat, deep_research, generate_image |
| `conversations` | Encrypted conversation storage (E2EE) |
| `shadow_memory` | User memory/graph data |
| `shadow_twin` | Public shadow twin configurations |
| `shared_answers` | Shared answer slugs (`/s/:slug`) |

## AI Request Paths

Authenticated users select their AI access mode once on the chatbot page.

### Access Modes

| Mode | Key Storage | Request Path | Quota |
|------|-------------|--------------|-------|
| **Shared** | Firebase Functions secret (`OPENROUTER_API_KEY`) | Browser → Cloud Function `chat`/`generateImage` → OpenRouter | 100 requests/user/day (UTC) |
| **BYOK (Tech)** | Browser storage (IndexedDB) scoped to UID | Browser → Provider API directly (OpenAI, Anthropic, Google, Groq, OpenRouter) | User's provider limits |
| **Local** | Model cached in browser (WebLLM) | On-device inference via WebGPU | Unlimited (device-dependent) |

### Key Modules

- `src/lib/aiAccessMode.ts` — persists account preference in Firestore, caches non-secret mode per Firebase UID.
- `src/lib/byok.ts` — manages BYOK credentials in browser storage per UID.
- `src/lib/cloudChat.ts` — central text/vision router used by chat, Turbo-based AI features, screen analysis, voice copilot, strategy generation, presentation generation, and provider-routed chat features.

### Shared Request Flow

1. Browser calls Firebase `chat` or `generateImage` HTTPS function with Firebase ID token.
2. Function verifies Auth, enforces `shared` mode, transactionally reserves 1 of 100 daily requests per user (UTC-based, shared with `generateImage`).
3. Function uses OpenRouter key pool (round-robin with 429/5xx cooldown) to call provider.
4. Function streams response back to browser (SSE for chat, JSON for images).
5. Usage recorded in `usage_analytics`.

**Shared model**: `openrouter/free` (chat), `google/gemini-2.5-flash-image` (images).

**BYOK image generation**: Available with OpenAI or OpenRouter; other BYOK providers currently support text/vision only.

**Offline local inference**: Available where explicitly selected or when device is offline and a local model is installed (WebLLM: Llama-3.2-1B, SmolLM, Gemma variants).

**Demo/mock functions**: `audio` and `drive` Cloud Functions are currently demo/mock integrations, not LLM-powered features.

**Setup**: Set the shared credential with `firebase functions:secrets:set OPENROUTER_API_KEY` and deploy Functions. Never put provider secrets in `VITE_*` variables: Vite embeds those values in browser-delivered bundles.

## SEO / GEO / AEO Architecture (Generative Engine Optimization)

ShadowTalk implements a comprehensive **Answer Engine Optimization** layer designed for LLM crawlers (ChatGPT, Perplexity, Google AI Overviews, Gemini, Copilot) and traditional search.

### Machine-Readable Knowledge Assets (Static, No-JS Required)

| File | Purpose | Schema |
|------|---------|--------|
| `/llms.txt` | LLM knowledge base (product, founder, features, FAQ, tech specs) | Plain text |
| `/llms-full.txt` | Extended version with disambiguation, full pricing, comparisons | Plain text |
| `/shadowtalk.json` | Structured product JSON (Schema.org aligned) | JSON-LD |
| `/facts.html` | Static HTML with FAQPage schema + feature tables | HTML + JSON-LD |
| `/aeo.txt` | Plain-text Q&A index for answer engines | Plain text |
| `/aeo-answers.html` | **57 FAQPage-schema questions** across 7 sections | HTML + FAQPage schema |
| `/aeo-answers.json` | JSON version of AEO corpus | JSON |

All served from `/public` — crawlable without JavaScript execution.

### AEO Corpus Structure (`aeo-answers.html`)

**57 questions** organized in 7 sections, each with `itemscope itemtype="https://schema.org/Question"`:

| Section | Questions | Topics |
|---------|-----------|--------|
| Product | 8 | What is ShadowTalk, tagline, target user, wrapper question, referral, partnerships |
| Founder | 14 | Identity, disambiguation vs Rastah/NAPA, social profiles, age, location |
| Comparison | 5 | vs ChatGPT, Claude, Perplexity, cheapest agentic, privacy |
| Pricing | 2 | Free tier, full pricing table |
| Privacy | 5 | Security controls, offline, ShadowSpectre, safety, WebLLM models |
| Features | 7 | Desktop, Computer Mode, voice, marketplace, Google Workspace/WhatsApp, deep research |
| Technical | 6 | Where AI reads facts, AEO explanation, GitHub, contact, agentic definition, safety |
| Google-specific | 12 | "best agentic workspace 2026", "best free ChatGPT alternative", "is ShadowTalk legit", founder on Google, pricing, AI Overviews, best AI for developers, strategy consultant, anonymous chat, multilingual, marketing planner |

Each question has deep-linkable `id` (`#what-is-shadowtalk`, `#zain-ahmed-fahad-patel-shadowtalk-founder`, etc.).

### Founder Entity Disambiguation (Critical for Knowledge Graph)

Explicit separation in all schemas and machine-readable files:

- **Zain Ahmed Fahad Patel (ShadowTalk AI)** — Founder & Lead Architect, 17, Karachi, Pakistan
- **Zain Ahmad** — Co-founder of Rastah (luxury streetwear); unrelated
- **Zain Ahmed** — Artistic director at NAPA Karachi (theatre); unrelated

Person schema includes `alternateName` array, `@id`, `sameAs` (LinkedIn, Instagram, GitHub, official profiles), `knowsAbout`, `homeLocation`, `founderOf` → Organization.

### Structured Data on React Pages

Every public page uses `SEOHead` component (`src/components/SEOHead.tsx`) injecting:

- Title, description, keywords (truncated 160 chars)
- Open Graph + Twitter Card tags
- Organization JSON-LD (all pages)
- Page-specific schemas: Person, FAQPage, SoftwareApplication, Product, WebPage, ItemList, BreadcrumbList, ProfilePage, Article
- `SpeakableSpecification` for voice assistants (CSS selectors: `.speakable`, `h1`, `[data-speakable]`)
- `WebSite` with `SearchAction` for sitelinks searchbox
- Hreflang alternates for 11 locales (en, es, fr, de, ar, hi, pt, ru, ja, zh, ur) appended as `?hl={code}`

**`PAGE_SEO` config** (`src/lib/seo.ts`) defines 50+ page configs with targeted keywords, canonical URLs, OG image overrides, `ogType` (profile for entity pages).

### Comparison SEO (16 Static Pages)

`/public/vs/*.html` — dedicated comparison pages targeting high-intent queries:

| Horizontal | Vertical-Specific |
|------------|-------------------|
| vs ChatGPT | vs ChatGPT for Privacy |
| vs Perplexity | vs ChatGPT for Startups |
| vs Claude | vs ChatGPT for Students |
| vs Gemini | vs ChatGPT for Marketers |
| vs Copilot | vs ChatGPT for Strategy |
|  | vs ChatGPT for Business Planning |
|  | vs Perplexity for Research |
|  | vs Claude for Writing |
|  | vs Copilot for Coding |
|  | Why ShadowTalk Feels Better Than ChatGPT |
|  | Best Free AI Chatbot |

Each has canonical URL, Article/WebPage schema with `about` referencing both SoftwareApplications, author = Founder Person, verdict summary, CTA with UTM parameters.

### Topic Guide Cluster (12 Static Pages)

`/public/learn/*.html` — Article schema pages for long-tail SEO:

- best-agentic-ai-workspace.html
- chatgpt-alternative-free.html
- zain-ahmed-fahad-patel-founder.html
- shadowtalk-ai-review.html
- ai-founder-pakistan.html
- ai-strategy-consultant.html
- anonymous-ai-no-login.html
- multilingual-ai-chat.html
- ai-marketing-planner.html
- ai-workspace-for-students.html
- private-ai-chat-no-training.html
- what-is-agentic-ai.html

### Hub Pages

- `/public/discover.html` — Comparison hub with ItemList schema linking all `/vs/*` pages
- `/public/google-seo-hub.html` — Index of all SEO/AEO assets with ItemList schema
- `/public/zain-ahmed-fahad-patel.html` — Founder entity page (Person schema)

### International SEO

11 languages supported natively in UI + hreflang: en, es, fr, de, ar, hi, pt, ru, ja, zh, ur.

Hreflang implementation: appended as `?hl={code}` to canonical on every page via `SEOHead`. `x-default` points to base canonical.

### Prerendering (Puppeteer)

`prerender.cjs` generates static HTML for critical routes at build time. **Current route list in prerender.cjs (12 routes):**

```
/, /founder, /about, /pricing, /chatbot, /execute, /research, /computer, /security, /insights, /forge, /marketplace, /missioncontrol
```

**Gap**: Prerender list does not include `/vs/*`, `/learn/*`, `/discover.html`, `/google-seo-hub.html`, `/aeo-answers.html`, `/facts.html`, `/llms.txt`, `/shadowtalk.json`, `/zain-ahmed-fahad-patel.html`. These static HTML files in `/public` are served directly by Firebase Hosting and don't need prerendering, but React routes that should be prerendered are missing.

## Hosting and Build

`firebase.json` deploys the Vite `dist/` directory to Firebase Hosting and rewrites requests to the SPA entry point.

**Build pipeline**: `npm run build` → `vite build` → `prerender.cjs` (Puppeteer).

**Vite config** (`vite.config.ts`):
- React + SWC plugin
- Manual vendor chunks (react, firebase, ui, query, 3d, editor, ai)
- PWA plugin (vite-plugin-pwa): autoUpdate, Workbox caching (10MB limit for wasm/model artifacts)
- Base: `/`, dev server on port 8080 with COOP/COEP headers for WebContainer

**Service Worker**: Registered in `src/main.tsx` with auto-update. Also schedules service-worker unregistration path — review both before changing offline caching behavior.

**Security headers** (firebase.json + public/_headers):
- COOP: `same-origin`, COEP: `credentialless` (required for WebContainer)
- Assets: long-term caching (1 year, immutable)

## Cloud Functions (Firebase Functions v2)

Separate `functions/` package (TypeScript). Predeploy runs `npm --prefix "$RESOURCE_DIR" run build`.

**Exported HTTPS Functions:**

| Export | Purpose | Auth | Quota |
|--------|---------|------|-------|
| `chat` | Authenticated chat with provider fallback + usage accounting | Required (Firebase ID token) | 100/day shared |
| `generateImage` | Authenticated image generation | Required | 100/day shared |
| `audio` | Demo/mock response | Required | — |
| `drive` | Demo Drive list/get responses | Required | — |

**Key implementation details** (`functions/src/index.ts`):
- OpenRouter key pool with round-robin rotation + per-key cooldown on 429/5xx (60s)
- Primary key via `defineSecret("OPENROUTER_API_KEY")` (works on Spark plan)
- Additional keys via `process.env.OPENROUTER_API_KEY_2..5` (set via `firebase functions:config:set`)
- Transactional daily usage counter in `daily_usage` collection (UTC date)
- SSE streaming for chat responses
- CORS enabled for all functions

## PWA & Offline

- **Manifest**: name "ShadowTalk AI", short_name "ShadowTalk", theme/background #000000
- **Icons**: pwa-192x192.png, pwa-512x512.png in `/public`
- **Workbox**: caches JS, CSS, HTML, images, JSON, WASM (10MB limit)
- **Service Worker**: autoUpdate registration in `src/main.tsx`
- **Offline AI**: WebLLM models cached in browser; local inference runs without network

## Computer Mode (WebContainer)

Route: `/computer` → `ComputerPage` → `ComputerModeShell` → `@webcontainer/api`

In-browser npm/node shell via WebContainer (StackBlitz). Paired with agentic workflows for autonomous dev tasks. Requires COOP/COEP headers (configured in firebase.json and vite dev server).

## Frontend Architecture Highlights

### State Management
- **Zustand** (`zustand`) for client stores (chat, UI, settings)
- **TanStack Query** (`@tanstack/react-query`) for server state (5min staleTime, 30min gcTime)
- **React Context** for app-wide providers (Auth, Theme, Security, ShadowMemory, AIKey, AutoImprove, ThemeTemplate, StealthKillSwitch)

### Routing
- React Router v6 with lazy-loaded pages (`React.lazy` + `Suspense`)
- 60+ routes defined in `src/App.tsx`
- Root `/` → `RootRoute` redirects: signed-in/returning → `/chatbot`, new visitors → `/home` (Index page)

### UI Framework
- **TailwindCSS** + **Radix UI** primitives (40+ components)
- **Framer Motion** for page transitions and animations
- **Lucide React** icons
- **Monaco Editor** (`@monaco-editor/react`) for code IDE
- **Three.js** (`@react-three/fiber`, `@react-three/drei`) for 3D visualizations

### Key Feature Modules
| Module | Path | Description |
|--------|------|-------------|
| Chat | `src/components/chat/`, `src/pages/ChatbotPage.tsx` | Main workspace, multi-model, tools |
| Deep Research | `src/components/research/`, `/research` | Multi-step cited research |
| Code IDE | `src/components/ide/`, `/ide` | Monaco + live preview |
| Computer Mode | `src/components/computer/`, `/computer` | WebContainer shell |
| Voice | `src/components/voice/`, ElevenLabs TTS | ShadowTalk Live |
| Encrypted Vault | `src/components/vault/`, `src/lib/encryption/` | PBKDF2 + AES-256-GCM |
| Shadow Twin | `src/pages/PublicShadowTwinChat.tsx`, `/t/:username` | Public AI persona |
| Shadow Memory | `src/pages/ShadowMemoryPage.tsx`, `/shadow-memory` | Personal knowledge graph |
| Marketplace | `src/components/marketplace/`, `/marketplace` | Installable agents |
| Security Hub | `src/components/security/`, `/security` | Vault, audit, ShadowSpectre |
| Pricing | `src/components/pricing/`, `/pricing` | 5-tier pricing shells |

## Tests and Diagnostics

- **Vitest** configured by `vitest.config.ts` — run `npm test`
- **ESLint** (flat config) — run `npm run lint`
- **TypeScript** — separate configs for web (`tsconfig.app.json`) and functions (`functions/tsconfig.json`)
- Frontend build (`npm run build`) does NOT validate Functions package — run `npm --prefix functions run build` separately

## Deployment Checklist

1. `npm run build` — client build + prerender
2. `npm --prefix functions run build` — Functions TypeScript compile
3. `firebase deploy` — deploys Hosting, Firestore rules/indexes, Storage rules, Functions
4. Verify `OPENROUTER_API_KEY` secret set: `firebase functions:secrets:set OPENROUTER_API_KEY`

## Documentation Maintenance

When code or deployment behavior changes, update the relevant source-linked documentation in the same change. Do not copy test counts, build timings, or other machine-specific verification results here as permanent guarantees. Run the current commands from the root README to verify the working tree.

---

**Related Documents:**
- [SEO/GEO/AEO Architecture](./SEO_GEO_AEO_ARCHITECTURE.md) — Deep dive on answer engine optimization implementation
- [Firebase Rules & Indexes](../firestore.rules, ../firestore.indexes.json)
- [Functions Source](../functions/src/index.ts)