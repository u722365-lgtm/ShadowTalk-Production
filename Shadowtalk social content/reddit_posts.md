# Reddit Posts for ShadowTalk AI — BYOK + WebGPU Push

Target subreddits: r/LocalLLaMA, r/ChatGPT, r/OpenAI, r/WebDev, r/SideProject, r/selfhosted.

Posting order: r/LocalLLaMA first (highest-converting dev audience), then r/SideProject,
then r/ChatGPT, then r/WebDev. Wait 48h between subreddits to avoid the spam filter.

Rules of thumb before posting:
- Do NOT use marketing language ("revolutionary", "game-changer"). Redditors will smell it.
- Always share the technical implementation, not just the demo.
- Be honest about limitations (no GPT-4o on local RAG, requires WebGPU-capable GPU, etc.).
- Disclose founder affiliation in the first comment, not in the post itself.
- Link to a working demo, not a landing page.

---

## Post 1 — r/LocalLLaMA

**Title:** I built a multi-model canvas that runs Claude, GPT-4o, and a local Llama-3 side-by-side with live diffing — entirely in the browser, 100% BYOK

**Body:**

Hey r/LocalLLaMA — long-time lurker, first post here.

I've been frustrated by the copy-paste workflow between ChatGPT / Claude / my local Llama-3 setup. So I built a single workspace where you:

1. Bring your own API keys (OpenAI, Anthropic, Google, Groq, OpenRouter) — no markup, you pay the provider directly.
2. Install a local model via WebLLM (Llama-3.2-1B, Mistral-7B, Qwen-2.5) — runs on your GPU via WebGPU.
3. Drop a PDF/code/Markdown into the workspace and ShadowTalk builds a vector index in your browser for RAG — entirely on-device.

The bit I'm proudest of: a true **multi-model canvas**. Send one prompt to Claude + GPT-4o + Gemini simultaneously, and the responses render side-by-side with live color-coded diffing — every difference highlighted green/red. You pick the best answer in seconds instead of opening 3 tabs.

**Stack:** React + Vite + WebGPU + WebLLM + IndexedDB. No backend for local mode. Cloud mode is just a thin BYOK proxy.

**Honest limitations:**
- WebGPU requires Chrome 113+ or any modern Firefox/Edge. Safari support is still partial.
- Local RAG works best with quantized 7B-13B models. Don't expect GPT-4o reasoning on local inference.
- First model download is ~800MB. Subsequent loads are instant from cache.
- I'm a solo dev (17yo, based in Karachi). Bug reports welcome, PRs welcome even more.

**Demo:** [shadowtalk-ai.com/chatbot?demo=true](https://www.shadowtalk-ai.com/chatbot?demo=true)

**Source / docs:** [shadowtalk-ai.com/docs](https://www.shadowtalk-ai.com/docs)

**Founder disclosure:** I'm Zain, the founder. Not here to spam — genuinely want feedback from people who actually run local LLMs. AMA about the WebGPU pipeline, the diffing algorithm, or the RAG architecture.

---

## Post 2 — r/SideProject

**Title:** After 8 months of solo dev, I shipped a BYOK AI workspace that lets you compare Claude/GPT-4o/Gemini side-by-side with live diffing

**Body:**

I'm 17, based in Karachi, and I've been building ShadowTalk AI since Feb 2024. Started as a frustration project — I was tired of juggling ChatGPT + Claude + a local Llama-3 install across browser tabs.

Today it ships with:

- **100% BYOK** — paste your API keys (OpenAI, Anthropic, Google, Groq, OpenRouter). Keys are encrypted on your device with PBKDF2 + AES-256-GCM. The workspace never sits between you and the provider.
- **Multi-model canvas** — one prompt, multiple models, side-by-side responses with live color-coded diffing. You see exactly where Claude and GPT-4o disagree.
- **WebGPU local inference** — install Llama-3.2-1B or Mistral-7B via WebLLM, run prompts on your GPU. No provider, no token cost.
- **Local vector RAG** — drop a PDF or codebase, ShadowTalk builds a vector index in your browser using WebGPU-accelerated embeddings. Nothing leaves your device.
- **Agentic workflows** — chain multiple model calls + tools into a multi-step mission with approval gates.

**Free tier:** 50 msgs/day, no credit card. Pro is $5/mo for unlimited. Lifetime deal at $99.

**Why I'm posting:** I hit 100 visits/day this week and I want honest feedback from builders before I scale. The product works — I want to know what's missing.

**Demo (no signup):** [shadowtalk-ai.com/chatbot?demo=true](https://www.shadowtalk-ai.com/chatbot?demo=true)

**What I'd love feedback on:**
1. Is the multi-model canvas diffing actually useful, or just a gimmick?
2. Would you trust BYOK with a workspace you didn't write yourself? What would convince you?
3. What's the #1 feature that would make you switch from your current stack?

AMA.

---

## Post 3 — r/ChatGPT

**Title:** If you've ever pasted the same prompt into ChatGPT and Claude to compare answers, this might save you 30 minutes a day

**Body:**

I built a workspace where one prompt gets sent to multiple models at once — Claude, GPT-4o, Gemini, or a local Llama-3 — and the responses render side-by-side with live diffing. Every difference is highlighted green/red so you can spot where they disagree in seconds.

It's 100% BYOK. You bring your own OpenAI / Anthropic / Google API key. No markup — you pay the provider directly. The workspace doesn't see your key (encrypted on your device) or your conversations (stored locally in IndexedDB).

For sensitive docs (NDAs, source code, medical records), there's a WebGPU local mode: install a quantized model via WebLLM, drop your document, and the RAG pipeline runs entirely on your GPU. Zero network calls.

**Free tier:** 50 msgs/day, no card. No signup required to try.

**Demo:** [shadowtalk-ai.com/chatbot?demo=true](https://www.shadowtalk-ai.com/chatbot?demo=true)

Not trying to compete with ChatGPT — trying to make it easier to use ChatGPT alongside Claude/Gemini without the tab marathon. Curious if anyone else has this workflow.

---

## Post 4 — r/WebDev

**Title:** Show r/WebDev: A multi-model AI canvas with WebGPU local inference + on-device vector RAG — built in React + Vite, no backend

**Body:**

Posting to share an architecture I've been iterating on. ShadowTalk AI is a BYOK multi-model AI canvas with three modes:

1. **BYOK cloud mode:** User pastes their own OpenAI/Anthropic/Google API key. Browser calls the provider directly (with CORS-friendly proxy fallback). Workspace never sees the key.
2. **WebGPU local mode:** User installs a quantized LLM (Llama-3.2-1B, Mistral-7B, Qwen-2.5) via WebLLM. Inference runs on their GPU. No network calls.
3. **Local RAG mode:** Drop a PDF/code/Markdown file. ShadowTalk chunks it, embeds it via WebGPU-accelerated embeddings, stores the vector index in IndexedDB. Retrieval is on-device.

**Tech stack:**
- React 18 + Vite + TypeScript
- Tailwind + shadcn/ui for the UI
- WebGPU + WebLLM for local inference
- IndexedDB (via idb) for vector store + chat history
- Web Crypto API for client-side AES-256-GCM encryption of API keys

**The interesting bit — multi-model canvas with live diffing:**
One prompt gets sent to N models in parallel. Responses render side-by-side. A diffing pass highlights token-level differences between responses — green for tokens unique to one model, red for missing tokens. Lets you spot where Claude and GPT-4o disagree without manually comparing.

**Live demo:** [shadowtalk-ai.com/chatbot?demo=true](https://www.shadowtalk-ai.com/chatbot?demo=true)

**Things I'd love to discuss:**
- WebGPU + Web Worker architecture: I'm running inference in a worker to keep the main thread free. Anyone else doing this?
- IndexedDB vector store: I'm using a brute-force cosine similarity search right now. Considering HNSW. Thoughts?
- CORS for direct BYOK calls: works for OpenAI + Groq + OpenRouter, but Anthropic + Google require a thin proxy. Anyone found a workaround?

Founder disclosure: I'm Zain. Solo dev. Built this over 8 months. AMA about the architecture.

---

## Post 5 — r/selfhosted

**Title:** A self-hostable (browser-only) AI workspace with WebGPU local inference + local RAG — no server required

**Body:**

Hey r/selfhosted — I know this sub loves "no cloud, my data, my hardware" tooling. I built something that fits the bill.

ShadowTalk AI runs entirely in your browser. No backend. No cloud. No account required for the free tier.

**Three modes:**

1. **Local-only mode (the one for this sub):** Install a quantized LLM via WebLLM (Llama-3.2-1B, Mistral-7B, Qwen-2.5). The model is cached in your browser. Prompts run on your GPU via WebGPU. Zero network calls after install. Perfect for air-gapped workflows.
2. **Local RAG mode:** Drop a PDF or codebase into the workspace. ShadowTalk chunks + embeds it on-device, stores the vector index in IndexedDB. Retrieval is on-device. The document never leaves your machine.
3. **BYOK cloud mode (optional):** If you want GPT-4o / Claude / Gemini, paste your own API key. Browser calls the provider directly. The workspace never sees your key or your conversations.

**Use cases that have come up:**
- Lawyers running RAG over NDA contracts without uploading to OpenAI
- Devs running RAG over private source code
- Folks in countries where ChatGPT is blocked — local mode still works
- Privacy-conscious users who just don't want a third party seeing their chats

**Demo:** [shadowtalk-ai.com/chatbot?demo=true](https://www.shadowtalk-ai.com/chatbot?demo=true)

**Honest limitations:**
- WebGPU requires Chrome 113+ / Firefox 141+ / Edge 113+. Safari TP only.
- Local mode maxes out around Mistral-7B on a mid-tier GPU. Bigger models need more VRAM.
- First model download is ~800MB. After that, it's instant from cache.

**Founder disclosure:** I'm Zain, solo dev. The whole thing is built to be browser-first because I'm in Pakistan and couldn't afford server costs. AMA about the architecture.

---

## Comment templates

### Reply to "is this open source?"
> The core workspace is closed-source right now (solo dev, can't compete with forks yet), but the docs are public at shadowtalk-ai.com/docs and I publish the architecture in detail. If there's enough demand I'd consider an open-core model where the BYOK layer + local RAG layer are open and the agentic layer is paid. What would convince you to try it?

### Reply to "how does this compare to LibreChat / Open WebUI?"
> Both are excellent projects. The main differences:
> 1. LibreChat is a server-first BYOK chat UI — ShadowTalk is browser-first, no install required.
> 2. Open WebUI is the best Ollama front-end — ShadowTalk uses WebLLM (browser-native) instead, so no Ollama install required.
> 3. ShadowTalk ships a multi-model canvas with live diffing (compare Claude vs GPT-4o side-by-side). Neither LibreChat nor Open WebUI has this yet.
> 4. ShadowTalk's local RAG runs entirely in IndexedDB — no separate vector DB to install.
> If you're already running LibreChat/Open WebUI self-hosted and happy, no reason to switch. If you want zero install + multi-model diffing + RAG in one workspace, try ShadowTalk.

### Reply to "is this just a ChatGPT wrapper?"
> No — three things make it different:
> 1. It's BYOK, not a reskinned ChatGPT. You bring your own OpenAI/Anthropic/Google key and the workspace calls the provider directly. ShadowTalk never sees your key.
> 2. It runs local models via WebGPU. Install Llama-3 / Mistral / Qwen and run prompts on your GPU. No provider roundtrip required.
> 3. The multi-model canvas sends one prompt to multiple models at once and shows responses side-by-side with live diffing. ChatGPT can't do this.
> The free tier also requires no signup — try it without giving me your email.

### Reply to any criticism
> Fair point. I'm a solo dev and I'd rather hear this now than after I scale. What would you want to see changed before you'd consider trying it?
