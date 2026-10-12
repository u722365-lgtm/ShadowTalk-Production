/**
 * Lovable Cloud AI chat — streaming client.
 *
 * Calls the `chat` edge function, which proxies the Lovable AI Gateway with
 * `stream: true`, and yields incremental text through `onDelta`.
 */

import { cloudAnonKey, cloudFunctionUrl } from "@/lib/cloudConfig";
import { fbAuth } from "@/integrations/firebase/app";
import { getByokConfig, streamByokChat } from "@/lib/byok";

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
  return Boolean(cloudFunctionUrl("chat"));
}

function getFunctionsUrl(): string {
  return cloudFunctionUrl("chat");
}

/**
 * Stream a chat reply. Uses the user's own key (BYOK) when set to "always";
 * otherwise uses ShadowTalk's AI and falls back to the user's key on failure.
 */
export async function streamCloudChat(
  messages: CloudChatMessage[],
  opts: CloudChatOptions = {},
): Promise<CloudChatResult> {
  const byok = getByokConfig();
  if (byok?.mode === "always") return streamByokChat(byok, messages, opts);

  let primary: CloudChatResult;
  try {
    primary = await streamBuiltInChat(messages, opts);
  } catch (err) {
    if ((err as Error)?.name === "AbortError" || !byok) throw err;
    primary = { content: "", error: "Network error" };
  }
  if (byok && primary.error && !primary.content && !opts.signal?.aborted) {
    const fallback = await streamByokChat(byok, messages, opts);
    return fallback.content ? fallback : { ...fallback, error: `${primary.error} — and your own key also failed: ${fallback.error}` };
  }
  return primary;
}

async function streamBuiltInChat(
  messages: CloudChatMessage[],
  opts: CloudChatOptions = {},
): Promise<CloudChatResult> {
  const url = getFunctionsUrl();
  if (!url) {
    return { content: "", error: "Lovable Cloud AI is not configured." };
  }

  // Get Firebase ID token for authorization against Firebase Functions
  const idToken = await fbAuth().currentUser?.getIdToken().catch(() => null);
  const authHeader = idToken ? `Bearer ${idToken}` : `Bearer ${cloudAnonKey()}`;

  const maxRetries = 1;
  let attempt = 0;
  let resp: Response | null = null;
  
  while (attempt <= maxRetries) {
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          messages,
          ...(opts.model ? { model: opts.model } : {}),
          ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
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
