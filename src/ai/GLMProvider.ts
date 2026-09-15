import { AIProvider } from "./AIProvider";
import { CloudChatMessage, CloudChatOptions, CloudChatResult } from "@/lib/cloudChat";

export class GLMProvider implements AIProvider {
  id = "glm";
  
  private baseUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  private defaultModel = "glm-4";

  private getKey(): string | null {
    try {
      return sessionStorage.getItem('GLM_BYOK_KEY');
    } catch {
      return null;
    }
  }

  isAvailable(): boolean {
    return Boolean(this.getKey());
  }

  async streamChat(messages: CloudChatMessage[], options?: CloudChatOptions): Promise<CloudChatResult> {
    const key = this.getKey();
    if (!key) throw new Error("GLM API Key missing");

    if (options?.structuredOutput) {
      throw new Error("This capability isn't currently supported by your selected GLM model.");
    }
    
    // Add logic for checking if vision is used when model does not support it
    if (messages.some(m => m.image) && !this.defaultModel.includes('vision')) {
      // If a message has an image, Zhipu requires glm-4v model.
      if (options?.model && !options.model.includes('vision') && !options.model.includes('-v')) {
         throw new Error("This capability isn't currently supported by your selected GLM model.");
      }
    }

    const controller = new AbortController();
    
    // Configurable timeout (default 30s)
    const timeoutMs = options?.timeoutMs ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);
    
    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort(new Error("Request aborted by user")), { once: true });
    }

    const payload = {
      model: options?.model || this.defaultModel,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.5,
      max_tokens: options?.maxTokens ?? 4096,
    };

    let res: Response;
    try {
      res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`GLM request failed: ${controller.signal.reason?.message || "Request timed out"}`);
      }
      throw new Error(`GLM network error: ${e instanceof Error ? e.message : 'Unknown network failure'}`);
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errBody = "";
      try {
        errBody = await res.text();
      } catch {
        errBody = "Unreadable error response";
      }
      // Error normalization
      throw new Error(`GLM Provider Error (${res.status}): ${errBody}`);
    }

    if (!res.body) throw new Error("GLM API returned empty response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";
    
    // We mock returning the full result after reading the stream,
    // firing onDelta for real-time updates if provided.
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (line.startsWith('data: [DONE]')) break;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                accumulatedText += delta;
                if (options?.onDelta) options.onDelta(accumulatedText);
              }
            } catch {
              // ignore malformed JSON chunk
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: accumulatedText,
      source: "glm",
      modelUsed: "glm-4"
    };
  }
}
