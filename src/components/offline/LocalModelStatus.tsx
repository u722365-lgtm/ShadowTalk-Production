import React, { useEffect, useState } from 'react';
import { localInferenceEngine } from '@/offline/LocalInferenceEngine';
import { DEFAULT_LOCAL_MODEL } from '@/ai/ModelRegistry';
import { DeviceCapability } from '@/offline/DeviceCapability';

export const LocalModelStatus: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(localInferenceEngine.isLoaded());
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);

  useEffect(() => {
    DeviceCapability.hasWebGPU().then(setHasWebGPU);
    // In a real implementation, we'd want to subscribe to engine state changes
    const interval = setInterval(() => {
      setIsLoaded(localInferenceEngine.isLoaded());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 rounded-lg bg-card border text-sm space-y-2">
      <h3 className="font-semibold flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isLoaded ? 'bg-green-500' : 'bg-muted'}`} />
        ShadowTalk Local
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        <span>Model:</span>
        <span className="text-foreground">{DEFAULT_LOCAL_MODEL.displayName}</span>
        <span>Storage:</span>
        <span className="text-foreground">~{DEFAULT_LOCAL_MODEL.approxStorageRequirementMB} MB</span>
        <span>Acceleration:</span>
        <span className="text-foreground">{hasWebGPU ? 'WebGPU' : 'CPU'}</span>
        <span>Status:</span>
        <span className="text-foreground">{isLoaded ? 'Ready Offline' : 'Not Loaded'}</span>
      </div>
    </div>
  );
};
