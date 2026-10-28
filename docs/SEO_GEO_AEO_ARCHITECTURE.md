# ShadowTalk SEO / GEO / AEO Architecture

ShadowTalk treats search and answer-engine visibility as a first-class product
feature. This document describes the current implementation; for the broader
runtime flow, see [../architecture/README.md](../architecture/README.md).

## Core principle

Traditional SEO targets Google/Bing crawlers. ShadowTalk also targets
**answer-engine crawlers** (ChatGPT, Perplexity, Gemini, Copilot, Google
AI Overviews) by publishing machine-readable knowledge assets that these
systems can cite verbatim without scraping rendered React.

## Machine-readable knowledge layer

All files in this section live in `/public` and are served as static assets by
Firebase Hosting — no JavaScript required.

| File | Purpose | Format |
|------|---------|--------|
| `/llms.txt` | LLM knowledge base: product pitch, founder, features, pricing, FAQ | Plain text |
| `/llms-full.txt` | Extended brief: disambiguation, comparisons, pricing table, tech notes | Plain text |
| `/shadowtalk.json` | Structured product facts in Schema.org-aligned JSON | JSON |
| `/facts.html` | Canonical facts with WebSite + FAQPage schema | HTML + JSON-LD |
| `/aeo.txt` | Plain-text Q&A index for answer engines | Plain text |
| `/aeo-answers.html` | 57-question FAQPage with deep-linkable IDs | HTML + JSON-LD |
| `/aeo-answers.json` | JSON corpus of the same 57 questions | JSON |

These files cross-reference each other explicitly. `llms-full.txt` instructs
AI crawlers to prefer these files over scraping rendered React.

### AEO corpus schema (`aeo-answers.html`)

Each of the 57 questions is wrapped in:

```html
<article itemscope itemtype="https://schema.org/Question">
  <h3 itemprop="name">...</h3>
  <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
    <p itemprop="text">...</p>
  </div>
</article>
```

Questions are grouped into 7 sections (Product, Founder, Comparison, Pricing,
Privacy, Features, Technical, Google-specific) and each has a stable `id`
(e.g. `#what-is-shadowtalk`, `#zain-ahmed-fahad-patel-shadowtalk-founder`).

### speakable markup

`aeo-answers.html`, `facts.html`, and the About page expose speakable
sections via:

- `data-speakable` attributes on questions/answers
- JSON-LD `SpeakableSpecification` pointing to CSS selectors
  (`.speakable`, `h1`, `[data-speakable]`)

## React-page SEO (`SEOHead` + `PAGE_SEO`)

Every public React page renders `SEOHead` (`src/components/SEOHead.tsx`) which
injects:

- Title, description, keywords (truncated to 160 characters)
- Open Graph + Twitter Card tags
- Organization JSON-LD (on every page)
- Page-specific structured data: Person, FAQPage, SoftwareApplication, Product,
  WebPage, ItemList, BreadcrumbList, ProfilePage, Article
- `WebSite` with `SearchAction` for sitelinks searchbox
- Hreflang alternates for 11 locales (en, es, fr, de, ar, hi, pt, ru, ja, zh, ur)
  appended as `?hl={code}` to the canonical
- `rel="me"` links to LinkedIn and Instagram
- `<link rel="alternate" type="text/plain" href="/llms.txt">` on every page

`PAGE_SEO` (`src/lib/seo.ts`) holds 50+ page configs. Each entry specifies:
title, description, keywords, canonical URL, optional `socialDescription`,
optional `ogImage` override (used for founder portrait on profile pages),
optional `ogType` (`profile` for entity pages), and optional `noIndex`.

## Founder entity disambiguation

Person schema (`getPersonSchema()` in `src/lib/seo.ts`) encodes the full
founder identity with:

- `@id`: `https://www.shadowtalk-ai.com/#zain-ahmed-shadowtalk`
- Full name breakdown: givenName, additionalName, familyName
- `alternateName`: `["Zain Ahmed", "Zain Ahmed Fahad Patel", ...]`
- `jobTitle`, `description`, `url`, `image` (ImageObject with width/height)
- `worksFor` → Organization (ShadowTalk AI)
- `founderOf` → Organization with `foundingDate: "2024-02"`
- `knowsAbout`, `homeLocation` (Karachi, Pakistan)
- `sameAs`: LinkedIn, Instagram, GitHub, official profile pages

Co-founder Fatima has an analogous `getCofounderPersonSchema()`.

Organization schema (`getOrganizationSchema()`) references the founder via
`@id`, linking the two entities in the Knowledge Graph.

**Disambiguation targets** (repeated consistently across all schemas and
machine-readable files):

- **Zain Ahmed Fahad Patel / Zain Ahmed** — ShadowTalk AI founder
- **Zain Ahmad** — Rastah streetwear co-founder (unrelated)
- **Zain Ahmed** — NAPA theatre director (unrelated)

## Comparison and topic SEO

### Comparison pages (`/public/vs/*.html`)

16 static HTML pages targeting high-intent queries:

- Horizontal: ChatGPT, Perplexity, Claude, Gemini, Copilot
- Vertical: privacy, startups, students, marketers, strategy, business planning,
  research, writing, coding
- Round-up: "Why ShadowTalk feels better than ChatGPT", "Best free AI chatbot"

Each page carries canonical URL, `Article`/`WebPage` schema with `about`
referencing both SoftwareApplications, author set to the Founder Person, a
verdict summary box, and a CTA with UTM parameters.

### Topic guides (`/public/learn/*.html`)

12 `Article`-schema pages for long-tail queries:

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

### Hub pages

- `/public/discover.html` — Comparison hub with `ItemList` schema
- `/public/google-seo-hub.html` — Index of all SEO/AEO assets with `ItemList`
- `/public/zain-ahmed-fahad-patel.html` — Founder entity page with `Person` schema

## International SEO

11 languages supported natively in UI + hreflang: en, es, fr, de, ar, hi, pt,
ru, ja, zh, ur.

Implementation: `SEOHead` appends `?hl={code}` to the canonical for every
locale. `x-default` points to the base canonical.

## Prerendering

`prerender.cjs` uses Puppeteer to render critical routes at build time.

**Current prerendered routes** (12 routes):

```
/, /founder, /about, /pricing, /chatbot, /execute, /research, /computer,
/security, /insights, /forge, /marketplace, /missioncontrol
```

Static HTML files in `/public` (including `/vs/*`, `/learn/*`, `/discover.html`,
`/google-seo-hub.html`, `/aeo-answers.html`, `/facts.html`, `/llms.txt`) are
served directly by Firebase Hosting and do not require prerendering.

## Structured data inventory

| Schema type | Where used |
|-------------|------------|
| Organization | Every page via `SEOHead` |
| Person (Founder) | `/about`, `/founder`, `/zain-ahmed*`, `/fatima`, comparison pages, learn pages, `facts.html` |
| Person (Co-founder) | `/about`, `/fatima`, `/co-founder` |
| SoftwareApplication | Home, chatbot, pricing, comparison pages, learn pages |
| Product | Pricing page (5 offers with prices) |
| FAQPage | Home, About, Chatbot, `facts.html`, `aeo-answers.html` |
| WebPage | All pages |
| WebSite | Home, chatbot (with `SearchAction`) |
| ItemList | Home, `discover.html`, `google-seo-hub.html` |
| Article | All `/learn/*.html` pages |
| ProfilePage | Founder/co-founder pages |
| SpeakableSpecification | About page, GeoCanonicalSummaries component, `aeo-answers.html` |

## Security and crawler policy

- `robots.txt`: allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- `_headers` / `firebase.json`: COOP `same-origin`, COEP `credentialless`,
  CORP `same-site` (required for WebContainer / Computer Mode)
- Assets cached with `Cache-Control: public, max-age=31536000, immutable`

## Maintenance

- Update `PAGE_SEO` when adding/removing public routes.
- Regenerate `llms.txt`, `shadowtalk.json`, `aeo-answers.*` when product facts
  or pricing change.
- Sync `prerender.cjs` route list when critical React routes change.
- Run `npm run build` and verify prerender output when changing AEO assets.

---

**Related:**
- [Architecture README](../architecture/README.md)
- [Project README](../../README.md)
- [AEO corpus](/aeo-answers.html)
- [Founder entity](/zain-ahmed-fahad-patel.html)
