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
    
    if (!isOnline || this.preferLocalOverride) {
      if (await this.localProvider.isAvailable()) {
        return this.localProvider;
      }
      if (!isOnline) {
        throw new Error("offline_not_provisioned");
      }
    }
    
    return this.cloudProvider;
  }
}

export const AIProviderRouter = new AIProviderRouterImpl();
