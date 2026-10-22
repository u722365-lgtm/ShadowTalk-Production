/**
 * KeySettingsModal — Settings modal for switching cohorts / updating keys.
 *
 * Accessible from the ChatHeader cohort badge. Lets users:
 *  - View their current cohort and usage.
 *  - Switch from NON_TECH → TECH (add API key).
 *  - Switch from TECH → NON_TECH (remove key, use shared pool).
 *  - Update their BYOK key.
 *  - Reset onboarding entirely.
 */

import React, { useState, useEffect } from 'react';
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
  KeyRound,
  Zap,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Infinity as InfinityIcon,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeySettingsModal: React.FC<KeySettingsModalProps> = ({ open, onOpenChange }) => {
  const {
    userCohort,
    userApiKey,
    dailyUsageCount,
    maxDailyLimit,
    remainingMessages,
    setTechCohort,
    setNonTechCohort,
    resetOnboarding,
  } = useAIKeyContext();
  const { toast } = useToast();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync the input with the current stored key.
  useEffect(() => {
    if (open) setKeyInput(userApiKey);
  }, [open, userApiKey]);

  const handleSaveKey = () => {
    const key = keyInput.trim();
    if (!key || !key.startsWith('sk-')) {
      toast({
        title: 'Invalid key',
        description: 'API keys start with sk- (OpenAI) or sk-or- (OpenRouter).',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const provider = key.startsWith('sk-or-') ? 'openrouter' : 'openai';
      setTechCohort(key, provider);
      toast({ title: 'Key saved', description: 'BYOK mode activated — unlimited messages.' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Save failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToShared = () => {
    setNonTechCohort();
    toast({
      title: 'Switched to Instant Start',
      description: `${maxDailyLimit} messages/day. Switch back anytime.`,
    });
    onOpenChange(false);
  };

  const handleResetOnboarding = () => {
    resetOnboarding();
    toast({ title: 'Onboarding reset', description: 'Choose your mode again.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-[#030712] border-white/10 rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-400" />
            API Key Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            Manage your AI access mode and keys.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Current status */}
          <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Current Mode</span>
              {userCohort === 'TECH' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  <InfinityIcon className="h-3 w-3" />
                  BYOK · Unlimited
                </span>
              ) : userCohort === 'NON_TECH' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Zap className="h-3 w-3" />
                  Free · {remainingMessages}/{maxDailyLimit} left
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500">Not set</span>
              )}
            </div>
            {userCohort === 'TECH' && userApiKey && (
              <p className="text-xs text-slate-500 font-mono">
                Key: {userApiKey.slice(0, 8)}...{userApiKey.slice(-4)}
              </p>
            )}
            {userCohort === 'NON_TECH' && (
              <p className="text-xs text-slate-500">
                {dailyUsageCount} of {maxDailyLimit} messages used today. Resets at UTC midnight.
              </p>
            )}
          </div>

          {/* BYOK Key Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {userCohort === 'TECH' ? 'Update API Key' : 'Add API Key (switch to BYOK)'}
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-v1-... or sk-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="h-10 pr-9 bg-[#0f172a] border-white/10 focus:border-indigo-500/50 text-sm text-white placeholder:text-slate-600 rounded-lg font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="button"
              onClick={handleSaveKey}
              disabled={saving || !keyInput.trim()}
              className="w-full mt-2 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-semibold rounded-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Save & Use BYOK Mode
                </>
              )}
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Switch to shared */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSwitchToShared}
            disabled={userCohort === 'NON_TECH'}
            className={cn(
              'w-full h-10 text-sm rounded-lg border-white/10 bg-transparent',
              userCohort === 'NON_TECH' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 text-slate-300',
            )}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            Use Instant Start (100 msgs/day free)
          </Button>

          {/* Reset onboarding */}
          <button
            type="button"
            onClick={handleResetOnboarding}
            className="w-full text-center text-[11px] text-slate-600 hover:text-slate-400 transition-colors flex items-center justify-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset onboarding & choose again
          </button>

          {/* Security note */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 pt-1">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            <span>Your key is stored locally in your browser only — never sent to our servers.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeySettingsModal;
