/**
 * BYOK (Bring Your Own Key) — the user's own AI provider key, stored only on
 * their device and used directly from the browser when ShadowTalk's built-in
 * AI is unavailable (or always, if the user chooses).
 */
import type { CloudChatMessage, CloudChatOptions, CloudChatResult } from "@/lib/cloudChat";

export type ByokProvider = "openai" | "groq" | "openrouter" | "gemini";
export type ByokMode = "fallback" | "always";

export interface ByokConfig {
  provider: ByokProvider;
  apiKey: string;
  model: string;
  mode: ByokMode;
}

export const BYOK_PROVIDERS: Record<ByokProvider, { label: string; url: string; defaultModel: string; keyHint: string }> = {
  openai: { label: "OpenAI", url: "https://api.openai.com/v1/chat/completions", defaultModel: "gpt-4o-mini", keyHint: "sk-..." },
  groq: { label: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", defaultModel: "llama-3.3-70b-versatile", keyHint: "gsk_..." },
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", defaultModel: "openai/gpt-4o-mini", keyHint: "sk-or-..." },
  gemini: { label: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", defaultModel: "gemini-2.0-flash", keyHint: "AIza..." },
};

const STORAGE_KEY = "shadowtalk.byok.v1";

export function getByokConfig(): ByokConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as ByokConfig;
    if (!cfg?.apiKey || !BYOK_PROVIDERS[cfg.provider]) return null;
    return { ...cfg, model: cfg.model || BYOK_PROVIDERS[cfg.provider].defaultModel, mode: cfg.mode === "always" ? "always" : "fallback" };
  } catch {
    return null;
  }
}

export function saveByokConfig(cfg: ByokConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cfg, apiKey: cfg.apiKey.trim() }));
}

export function clearByokConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function toPlainMessages(messages: CloudChatMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/** Stream a chat completion directly from the user's own provider. */
export async function streamByokChat(
  cfg: ByokConfig,
  messages: CloudChatMessage[],
  opts: CloudChatOptions = {},
): Promise<CloudChatResult> {
  const provider = BYOK_PROVIDERS[cfg.provider];
  let resp: Response;
  try {
    resp = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model || provider.defaultModel,
        messages: toPlainMessages(messages),
        stream: true,
        ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { content: "", error: `Could not reach ${provider.label}.`, source: "byok" };
  }

  if (!resp.ok || !resp.body) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body?.error?.message || body?.error || "";
    } catch { /* ignore */ }
    const msg =
      resp.status === 401 ? `Your ${provider.label} key was rejected. Check it in Settings → Your own API key.`
      : resp.status === 429 ? `${provider.label} rate limit or quota reached on your key.`
      : `${provider.label} error (${resp.status})${detail ? `: ${detail}` : ""}`;
    return { content: "", error: msg, source: "byok" };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          opts.onDelta?.(content);
        }
      } catch { /* partial */ }
    }
  }
  return { content, source: "byok", modelUsed: cfg.model };
}
