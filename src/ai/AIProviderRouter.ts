import { AIProvider } from "./AIProvider";
import { CloudAIProvider } from "./CloudAIProvider";
import { LocalAIProvider } from "./LocalAIProvider";

class AIProviderRouterImpl {
  private cloudProvider = new CloudAIProvider();
  private localProvider = new LocalAIProvider();
  private preferLocalOverride = false;

  setPreferLocal(preferLocal: boolean) {
    this.preferLocalOverride = preferLocal;
  }

  async getBestProvider(): Promise<AIProvider> {
    const isOnline = navigator.onLine; // Basic check, will be enhanced with OfflineDetector
    
    // Explicit Local Override
    if (this.preferLocalOverride) {
      if (await this.localProvider.isAvailable()) {
        return this.localProvider;
      }
    }

    // Offline -> LocalAIProvider
    if (!isOnline) {
      if (await this.localProvider.isAvailable()) {
        return this.localProvider;
      }
      throw new Error("offline_not_provisioned");
    }
    
    // Online requests always go through the account's selected BYOK/shared mode.
    return this.cloudProvider;
  }
}

export const AIProviderRouter = new AIProviderRouterImpl();
