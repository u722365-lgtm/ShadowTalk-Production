import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { BRAND } from '@/lib/brand';

export function BYOKModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const existingKey = sessionStorage.getItem('GLM_BYOK_KEY');
    if (!existingKey) {
      setIsOpen(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim().length > 5) {
      setIsValidating(true);
      setError('');
      try {
        const payload = {
          model: "glm-4",
          messages: [{ role: "user", content: "hi" }],
          stream: false,
          max_tokens: 1,
        };
        const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error("Invalid API Key or authorization error.");
        }
        sessionStorage.setItem('GLM_BYOK_KEY', apiKey.trim());
        localStorage.setItem('shadowtalk_byok_enabled', 'true');
        setIsOpen(false);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to validate key");
      } finally {
        setIsValidating(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative w-full max-w-lg mx-4 flex flex-col bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Top Graphic / Content Area */}
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <ShieldCheck className="w-8 h-8 text-white/80" />
            </div>
            
            <h2 className="text-2xl font-semibold tracking-tight text-white mb-3">
              Welcome to {BRAND.name}
            </h2>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              To activate the {BRAND.name} AI workspace, connect your GLM API key.
              <br /><br />
              <a href="https://open.bigmodel.cn/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                How do I get a GLM API key?
              </a>
            </p>
          </div>

          {/* Bottom Input Area */}
          <div className="p-6 bg-white/[0.02] border-t border-white/10 mt-auto">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="w-4 h-4 text-white/30" />
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your GLM API key"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    autoFocus
                    disabled={isValidating}
                  />
                </div>
                <button
                  type="submit"
                  disabled={apiKey.trim().length < 5 || isValidating}
                  className="bg-white text-black px-6 rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isValidating ? "Verifying..." : "Start"}
                  {!isValidating && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <div className="text-red-400 text-sm mt-1">{error}</div>
              )}
              <div className="text-xs text-white/40 mt-2">
                Your key stays in-memory on this device and is used to communicate with the selected AI provider. ShadowTalk does not display your key in analytics or chat history.
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
