/**
 * OnboardingChoiceModal — One-time cohort selection modal for ShadowTalk AI.
 *
 * Appears on /chatbot when AIKeyContext.hasCompletedOnboarding is false.
 * Presents two cards:
 *
 *  1. "Instant Start" (NON_TECH) — 100 msgs/day, zero setup, shared pool.
 *  2. "Power User" (TECH / BYOK) — unlimited, user's own API key.
 *
 * Design: dark-mode glassmorphism matching ShadowTalk's aesthetic.
 * Canvas: #030712, Cards: #0f172a, Accent: #6366f1 (indigo).
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAIKeyContext } from '@/contexts/AIKeyContext';
import {
  Zap,
  KeyRound,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Infinity as InfinityIcon,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingChoiceModalProps {
  /** Controls modal visibility. */
  open: boolean;
  /** Called when the user dismisses the modal (e.g. clicks outside). */
  onOpenChange: (open: boolean) => void;
}

export const OnboardingChoiceModal: React.FC<OnboardingChoiceModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { setTechCohort, setNonTechCohort } = useAIKeyContext();
  const { toast } = useToast();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<'instant' | 'power' | null>(null);

  // ── Test the API key with a minimal request ──
  const handleTestKey = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setKeyError('Please enter an API key first.');
      return;
    }

    // Basic format validation.
    if (!key.startsWith('sk-')) {
      setKeyError('API keys typically start with "sk-" (OpenAI) or "sk-or-" (OpenRouter). Please check your key.');
      return;
    }

    setTesting(true);
    setKeyError(null);

    try {
      // Determine the provider from the key prefix.
      const provider = key.startsWith('sk-or-') ? 'openrouter' : 'openai';
      const url = provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const model = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': window.location.origin } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with: OK' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Key verified!',
          description: 'Your API key is valid and ready to use.',
        });
        setKeyError(null);
      } else if (response.status === 401) {
        setKeyError('This key was rejected (401). Check that you copied it correctly.');
      } else if (response.status === 402) {
        setKeyError('This key has no credits (402). Add credits to your provider account.');
      } else if (response.status === 429) {
        setKeyError('This key is rate-limited (429). Try again in a moment.');
      } else {
        setKeyError(`Provider returned status ${response.status}. The key may still work — try saving it.`);
      }
    } catch {
      setKeyError('Could not reach the provider. Check your internet connection and try again.');
    } finally {
      setTesting(false);
    }
  }, [apiKeyInput, toast]);

  // ── Save the BYOK key and set TECH cohort ──
  const handleSaveByok = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setKeyError('Please enter an API key.');
      return;
    }
    if (!key.startsWith('sk-')) {
      setKeyError('Invalid key format. Keys start with "sk-" (OpenAI) or "sk-or-" (OpenRouter).');
      return;
    }

    setSaving(true);
    try {
      const provider = key.startsWith('sk-or-') ? 'openrouter' : 'openai';
      setTechCohort(key, provider);
      toast({
        title: 'Welcome to ShadowTalk!',
        description: 'BYOK mode activated — unlimited messages unlocked.',
      });
      // Clear the input for security.
      setApiKeyInput('');
      setKeyError(null);
      // The modal will close automatically via the useEffect in ChatbotPage
      // that watches hasCompletedOnboarding. We also call onOpenChange(false)
      // as a backup to ensure immediate close.
      onOpenChange(false);
    } catch {
      setKeyError('Could not save your key. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [apiKeyInput, setTechCohort, toast, onOpenChange]);

  // ── Choose Instant Start (NON_TECH) ──
  const handleInstantStart = useCallback(() => {
    setNonTechCohort();
    toast({
      title: 'Welcome to ShadowTalk!',
      description: 'You\'re all set — 100 free messages per day.',
    });
    // The modal will close automatically via the useEffect in ChatbotPage.
    // Also call onOpenChange(false) as a backup.
    onOpenChange(false);
  }, [setNonTechCohort, toast, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-[#030712] border-white/10 rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-8 pt-8 pb-4 text-center">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-indigo-400" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-white tracking-tight">
            Welcome to ShadowTalk AI
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400 mt-1.5">
            Choose how you'd like to power your AI workspace:
          </DialogDescription>
        </DialogHeader>

        {/* Cards */}
        <div className="px-8 pb-8 grid md:grid-cols-2 gap-4">
          {/* ── Card 1: Instant Start (NON_TECH) ── */}
          <div
            onMouseEnter={() => setActiveCard('instant')}
            onMouseLeave={() => setActiveCard(null)}
            className={cn(
              'relative rounded-2xl border p-5 transition-all cursor-pointer group',
              'bg-[#0f172a] hover:border-indigo-500/50',
              activeCard === 'instant' ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : 'border-white/10',
            )}
            onClick={handleInstantStart}
          >
            {/* Glow accent */}
            <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-indigo-400" />
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-500/20">
                RECOMMENDED
              </span>
            </div>

            <h3 className="text-base font-bold text-white">Instant Free Access</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Zero setup required. Powered by ShadowTalk's load-balanced OmniRoute AI Gateway.
            </p>

            {/* Badges */}
            <div className="mt-4 space-y-2">
              {[
                { icon: InfinityIcon, text: '100 Messages / Day' },
                { icon: ShieldCheck, text: 'Auto-Fallback Protection' },
                { icon: CheckCircle2, text: 'All Features Unlocked (Docs, Images, Chat)' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-slate-300">
                  <Icon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleInstantStart();
              }}
              className="w-full mt-5 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Start Chatting Free
            </Button>
          </div>

          {/* ── Card 2: Power User (TECH / BYOK) ── */}
          <div
            onMouseEnter={() => setActiveCard('power')}
            onMouseLeave={() => setActiveCard(null)}
            className={cn(
              'relative rounded-2xl border p-5 transition-all',
              'bg-[#0f172a] hover:border-indigo-500/50',
              activeCard === 'power' ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : 'border-white/10',
            )}
          >
            {/* Glow accent */}
            <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-500/20">
                POWER USER
              </span>
            </div>

            <h3 className="text-base font-bold text-white">Bring Your Own Key (BYOK)</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Use your own OpenRouter, OpenAI, or Gemini API key for total privacy and unlimited usage.
            </p>

            {/* Badges */}
            <div className="mt-4 space-y-2">
              {[
                { icon: InfinityIcon, text: 'Unlimited Daily Messages' },
                { icon: CheckCircle2, text: 'Custom Model Selection' },
                { icon: ShieldCheck, text: 'Direct Provider Connection' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-slate-300">
                  <Icon className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* API Key Input */}
            <div className="mt-4">
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                API Key <span className="text-slate-500">(sk-or-... or sk-...)</span>
              </label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-or-v1-..."
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setKeyError(null);
                  }}
                  className="h-9 pr-9 bg-[#030712] border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 text-xs text-white placeholder:text-slate-600 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {keyError && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{keyError}</span>
                </div>
              )}

              {/* Test + Save buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestKey}
                  disabled={testing || !apiKeyInput.trim()}
                  className="h-8 text-xs border-white/10 bg-transparent hover:bg-white/5 text-slate-300"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Key'
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveByok}
                  disabled={saving || !apiKeyInput.trim()}
                  className="flex-1 h-8 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-3 w-3 mr-1" />
                      Save & Unlock Unlimited
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
                Get a free OpenRouter key at{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  openrouter.ai/keys
                </a>
                . Your key is stored locally in your browser only.
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-8 pb-6 -mt-2 text-center">
          <p className="text-[10px] text-slate-600">
            You can switch modes anytime from the header settings. No commitment, cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingChoiceModal;
