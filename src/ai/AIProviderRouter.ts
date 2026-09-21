import { AIProvider } from "./AIProvider";
import { CloudAIProvider } from "./CloudAIProvider";
import { LocalAIProvider } from "./LocalAIProvider";
import { GLMProvider } from "./GLMProvider";

class AIProviderRouterImpl {
  private cloudProvider = new CloudAIProvider;
  private localProvider = new LocalAIProvider;
  private glmProvider = new GLMProvider;
  private preferLocalOverride = false;

  setPreferLocal(preferLocal: boolean) {
    this.preferLocalOverride = preferLocal;
  }

  async getBestProvider: Promise<AIProvider> {
    const isOnline = navigator.onLine; // Basic check, will be enhanced with OfflineDetector
    
    // Explicit Local Override
    if (this.preferLocalOverride) {
      if (await this.localProvider.isAvailable) {
        return this.localProvider;
      }
    }

    // Offline -> LocalAIProvider
    if (!isOnline) {
      if (await this.localProvider.isAvailable) {
        return this.localProvider;
      }
      throw new Error("offline_not_provisioned");
    }
    
    // Online -> Check explicit preference or fallback
    // We check if the user selected GLM explicitly, or if GLM is configured and they opted-in to .
    // Assuming if GLM key is configured, they want to use it as unless they prefer local.
    const Enabled = localStorage.getItem("shadowtalk__enabled") === "true";

    if (Enabled && this.glmProvider.isAvailable) {
      return this.glmProvider;
    }

    return this.cloudProvider;
  }
}

export const AIProviderRouter = new AIProviderRouterImpl;
