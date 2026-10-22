/**
 * LimitReachedModal — Shown when NON_TECH users hit the 50/day cap.
 *
 * Prompts the user to switch to BYOK mode by adding their own OpenRouter
 * API key for unlimited access.
 */

import React, { useState } from 'react';
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
  AlertTriangle,
  KeyRound,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  ExternalLink,
} from 'lucide-react';

interface LimitReachedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LimitReachedModal: React.FC<LimitReachedModalProps> = ({ open, onOpenChange }) => {
  const { setTechCohort, maxDailyLimit } = useAIKeyContext();
  const { toast } = useToast();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const key = apiKeyInput.trim();
    if (!key || !key.startsWith('sk-')) {
      toast({
        title: 'Invalid key',
        description: 'Please enter a valid API key (starts with sk-).',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const provider = key.startsWith('sk-or-') ? 'openrouter' : 'openai';
      setTechCohort(key, provider);
      toast({
        title: 'Unlimited access unlocked!',
        description: 'You\'re now in BYOK mode — no more daily limits.',
      });
      setApiKeyInput('');
      onOpenChange(false);
    } catch {
      toast({
        title: 'Save failed',
        description: 'Could not save your key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-[#030712] border-white/10 rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-3 text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <DialogTitle className="text-lg font-bold text-white">
            You've hit your {maxDailyLimit} free messages for today!
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400 mt-2 leading-relaxed">
            You've reached your 50 free daily messages! Switch to BYOK mode by adding your own OpenRouter or OpenAI API key for unlimited access.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* API Key Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              OpenRouter API Key
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-v1-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
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
            <p className="mt-2 text-[11px] text-slate-500">
              Get a free key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
              >
                openrouter.ai/keys <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !apiKeyInput.trim()}
            className="w-full h-10 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-sm font-semibold rounded-lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4 mr-1.5" />
                Unlock Unlimited Access
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-600">
            <Zap className="h-3 w-3" />
            <span>Limit resets at midnight UTC · Switch anytime</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LimitReachedModal;
