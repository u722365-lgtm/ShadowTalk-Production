import React, { useEffect, useState } from 'react';
import { offlineDetector } from '@/offline/OfflineDetector';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(offlineDetector.isOffline);

  useEffect(() => {
    const unsubscribe = offlineDetector.subscribe(setIsOffline);
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500/10 text-yellow-500 text-xs px-4 py-1 flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-3 h-3" />
      <span>Offline Mode - Running locally on your device</span>
    </div>
  );
};
