import { CreateWebWorkerMLCEngine, WebWorkerMLCEngine, InitProgressReport } from "@mlc-ai/web-llm";
import { DEFAULT_LOCAL_MODEL } from "@/ai/ModelRegistry";
import { CloudChatMessage, CloudChatOptions, CloudChatResult } from "@/lib/cloudChat";

export class LocalInferenceEngine {
  private engine: WebWorkerMLCEngine | null = null;
  private isInitializing = false;
  private isReady = false;

  async initialize(onProgress?: (progress: InitProgressReport) => void): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false; // Or wait for it

    this.isInitializing = true;
    try {
      const worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
      this.engine = await CreateWebWorkerMLCEngine(
        worker,
        DEFAULT_LOCAL_MODEL.id,
        { initProgressCallback: onProgress },
      );
      this.isReady = true;

      return true;
    } catch (error) {
      console.error("Failed to initialize WebLLM engine:", error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  isLoaded(): boolean {
    return this.isReady;
  }

  async generate(messages: CloudChatMessage[], options?: CloudChatOptions): Promise<CloudChatResult> {
    if (!this.engine || !this.isReady) {
      return { content: "", error: "Local engine not ready." };
    }

    try {
      // Map CloudChatMessage to WebLLM message format
      const webLlmMessages = messages.map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content
      }));

      const chunks = await this.engine.chat.completions.create({
        messages: webLlmMessages,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      });

      let content = "";
      for await (const chunk of chunks) {
        if (options?.signal?.aborted) {
          break;
        }
        const delta = chunk.choices[0]?.delta?.content || "";
        content += delta;
        options?.onDelta?.(content);
      }
      return { content };
    } catch (error: any) {
      console.error("Local generation error:", error);
      return { content: "", error: error.message || "Local generation failed." };
    }
  }

  async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
export const localInferenceEngine = new LocalInferenceEngine();
