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
  const [step, setStep] = useState<"choose" | "byok">("choose");
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

  const saveSharedMode = async () => {
    setSaving(true);
    setError("");
    try {
      await saveAiAccessMode(userId, "shared");
      setMode("shared");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your AI setup.");
    } finally {
      setSaving(false);
    }
  };

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
          <DialogTitle>Choose how ShadowTalk powers AI</DialogTitle>
          <DialogDescription>
            Pick the setup that fits you. Your choice is saved to your account; API keys are never saved to ShadowTalk servers.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                const current = getByokConfig();
                setProvider(current?.provider ?? "openrouter");
                setApiKey(current?.apiKey ?? "");
                setModel(current?.model ?? BYOK_PROVIDERS[current?.provider ?? "openrouter"].defaultModel);
                setStep("byok");
                setError("");
              }}
              className="rounded-xl border border-border p-5 text-left transition-colors hover:border-primary/60 hover:bg-muted/30"
            >
              <KeyRound className="mb-3 h-5 w-5 text-primary" />
              <span className="block font-semibold">Tech-User</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Connect your own provider key. Requests use your provider account and are not subject to ShadowTalk's shared-key quota.
              </span>
            </button>
            <button
              type="button"
              onClick={() => void saveSharedMode()}
              disabled={saving}
              className="rounded-xl border border-border p-5 text-left transition-colors hover:border-primary/60 hover:bg-muted/30 disabled:opacity-60"
            >
              <Sparkles className="mb-3 h-5 w-5 text-primary" />
              <span className="block font-semibold">Non-Tech-Users</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Use ShadowTalk's hosted OpenRouter provider for up to 100 AI requests per UTC day.
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="mt-1 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now — I'll set this up later
          </button>
        ) : (
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
                <Button variant="ghost" onClick={() => setStep("choose")} disabled={saving}>
                  Back
                </Button>
              )}
              <Button onClick={() => void saveByokMode()} disabled={saving} className="ml-auto">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify and save key
              </Button>
            </div>
          </div>
        )}

        {step === "choose" && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {step === "choose" && saving && (
          <p className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving your selection…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
