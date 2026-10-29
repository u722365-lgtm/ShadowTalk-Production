/**
 * Lovable Cloud AI chat — streaming client.
 *
 * Calls the `chat` edge function, which proxies the Lovable AI Gateway with
 * `stream: true`, and yields incremental text through `onDelta`.
 */

import { fbAuth, functionsBaseUrl } from "@/integrations/firebase/app";
import { getByokConfig, streamByokChat } from "@/lib/byok";
import { getCachedAiAccessMode } from "@/lib/aiAccessMode";

export type CloudChatContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export interface CloudChatMessage {
  role: "system" | "user" | "assistant";
  content: CloudChatContent;
  /** Optional attached image (data URL) for vision-capable providers. */
  image?: string;
}

export interface CloudChatOptions {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  /** Called with the full accumulated text on every delta. */
  onDelta?: (accumulated: string) => void;
  /** Request a strict JSON output format when the provider supports it. */
  structuredOutput?: boolean;
  /** Request timeout in milliseconds (provider-dependent). */
  timeoutMs?: number;
  /** Maximum output tokens (provider-dependent). */
  maxTokens?: number;
  /** Use the user's provider-backed web search capability for this request. */
  webSearch?: boolean;
  /** Allow OpenRouter to fetch the URL asked about in this request. */
  webFetch?: boolean;
}

export interface CloudChatResult {
  content: string;
  error?: string;
  /** Provider-reported source identifier (adapter-specific). */
  source?: string;
  /** Model actually used (adapter-specific). */
  modelUsed?: string;
}

export function isCloudChatConfigured(): boolean {
  return Boolean(functionsBaseUrl);
}

function getFunctionsUrl(): string {
  return `${functionsBaseUrl}/chat`;
}

/**
 * Stream a chat reply through the provider selected during account onboarding.
 */
export async function streamCloudChat(
  messages: CloudChatMessage[],
  opts: CloudChatOptions = {},
): Promise<CloudChatResult> {
  const accessMode = getCachedAiAccessMode();
  if (accessMode === "byok") {
    const byok = getByokConfig();
    if (!byok?.apiKey) {
      return { content: "", error: "No API key set. Add your OpenAI/Anthropic/Google/Groq/OpenRouter key in Settings → Personalization → BYOK to start chatting." };
    }
    return streamByokChat(byok, messages, opts);
  }
  if (accessMode !== "shared") {
    return { content: "", error: "Add your API key in Settings → Personalization → BYOK to start chatting. ShadowTalk is BYOK-only." };
  }
  return streamBuiltInChat(messages, opts);
}

async function streamBuiltInChat(
  messages: CloudChatMessage[],
  opts: CloudChatOptions = {},
): Promise<CloudChatResult> {
  const url = getFunctionsUrl();
  if (!url) {
    return { content: "", error: "Firebase Cloud Functions are not configured." };
  }

  const idToken = await fbAuth().currentUser?.getIdToken().catch(() => null);
  if (!idToken) {
    return { content: "", error: "Sign in to use ShadowTalk AI." };
  }

  const maxRetries = 1;
  let attempt = 0;
  let resp: Response | null = null;
  
  while (attempt <= maxRetries) {
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          messages,
          ...(opts.model ? { model: opts.model } : {}),
          ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
          ...(typeof opts.maxTokens === "number" ? { maxTokens: opts.maxTokens } : {}),
          ...(opts.structuredOutput ? { structuredOutput: true } : {}),
          stream: true,
        }),
        signal: opts.signal,
      });
      
      if (resp.ok || (resp.status !== 502 && resp.status !== 503 && resp.status !== 504)) {
        break; // Success or a non-retriable error
      }
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    
    attempt++;
    if (attempt <= maxRetries) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  if (!resp || !resp.ok) {
    let message = `AI request failed (${resp?.status || 'Network Error'})`;
    try {
      const body = await resp?.json();
      message = body?.error || message;
    } catch {
      /* keep default */
    }
    if (resp?.status === 429) message = "Rate limit reached — please try again in a moment.";
    if (resp?.status === 402) message = message || "AI credits exhausted.";
    return { content: "", error: message };
  }

  if (!resp.body) return { content: "", error: "Empty response from AI service." };

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
        const parsed = JSON.parse(payload);
        const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          opts.onDelta?.(content);
        }
      } catch {
        /* partial JSON — ignore, next chunk completes it */
      }
    }
  }

  return { content };
}
