import { useEffect, useState } from "react";
import { KeyRound, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BYOK_PROVIDERS,
  getByokConfig,
  saveByokConfig,
  streamByokChat,
  type ByokProvider,
} from "@/lib/byok";
import { loadAiAccessMode, saveAiAccessMode, type AiAccessMode } from "@/lib/aiAccessMode";

interface AiAccessOnboardingProps {
  userId: string;
}

export function AiAccessOnboarding({ userId }: AiAccessOnboardingProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AiAccessMode | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"choose" | "byok">("byok");
  const [provider, setProvider] = useState<ByokProvider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(BYOK_PROVIDERS.openrouter.defaultModel);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void loadAiAccessMode(userId)
      .then((savedMode) => {
        if (!active) return;
        const existingKey = getByokConfig();
        setMode(savedMode);
        if (savedMode === "byok" && !existingKey?.apiKey) {
          setProvider(existingKey?.provider ?? "openrouter");
          setApiKey("");
          setModel(existingKey?.model ?? BYOK_PROVIDERS.openrouter.defaultModel);
          setStep("byok");
        } else if (!savedMode) {
          setStep("choose");
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load your AI setup.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const saveByokMode = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError("Enter an API key to continue.");
      return;
    }

    setSaving(true);
    setError("");
    const config = {
      provider,
      apiKey: trimmedKey,
      model: model.trim() || BYOK_PROVIDERS[provider].defaultModel,
      mode: "always" as const,
    };

    try {
      const result = await streamByokChat(config, [{ role: "user", content: "Reply with OK." }]);
      if (result.error || !result.content) {
        throw new Error(result.error || "The provider returned an empty response.");
      }
      saveByokConfig(config);
      await saveAiAccessMode(userId, "byok");
      setMode("byok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify or save this API key.");
    } finally {
      setSaving(false);
    }
  };

  const existingKey = getByokConfig();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("shadowtalk_onboarding_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const open = !loading && !dismissed && (!mode || (mode === "byok" && !existingKey?.apiKey));

  const handleDismiss = () => {
    try {
      sessionStorage.setItem("shadowtalk_onboarding_dismissed", "1");
    } catch {
      // sessionStorage may be unavailable — non-fatal, just close in-memory
    }
    setDismissed(true);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
      <DialogContent
        className="max-w-xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Allow click-outside to close — overrides the pointer-down-outside preventDefault
          event.preventDefault();
          handleDismiss();
        }}
      >
        <DialogHeader>
          <DialogTitle>Connect your API key</DialogTitle>
          <DialogDescription>
            ShadowTalk is BYOK-only. Paste your provider API key below — it's stored in this browser only and sent directly to your provider. Never sent to ShadowTalk servers.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Connect your API key</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            ShadowTalk is built for developers. Bring your own OpenAI, Anthropic, Google, Groq, or OpenRouter key — your key is stored in this browser only and never sent to ShadowTalk servers.
          </p>
        </div>
        <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="byok-provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(value) => {
                  const next = value as ByokProvider;
                  setProvider(next);
                  setModel(BYOK_PROVIDERS[next].defaultModel);
                }}
              >
                <SelectTrigger id="byok-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BYOK_PROVIDERS).map(([id, details]) => (
                    <SelectItem key={id} value={id}>{details.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="byok-model">Model</Label>
              <Input
                id="byok-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={BYOK_PROVIDERS[provider].defaultModel}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="byok-api-key">Provider API key</Label>
              <Input
                id="byok-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={BYOK_PROVIDERS[provider].keyHint}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Stored in this browser only and sent directly to {BYOK_PROVIDERS[provider].label}. Use a provider key with appropriate usage limits.
              </p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-between gap-2">
              {mode !== "byok" && (
                <Button variant="ghost" onClick={handleDismiss} disabled={saving}>
                  Skip
                </Button>
              )}
              <Button onClick={() => void saveByokMode()} disabled={saving} className="ml-auto">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify and save key
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
