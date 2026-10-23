import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BYOK_PROVIDERS, type ByokProvider, clearByokConfig, getByokConfig, saveByokConfig, streamByokChat,
} from "@/lib/byok";

export function SettingsByokCard() {
  const existing = getByokConfig();
  const [provider, setProvider] = useState<ByokProvider>(existing?.provider ?? "openai");
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [model, setModel] = useState(existing?.model ?? BYOK_PROVIDERS.openai.defaultModel);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(Boolean(existing));

  const cfg = () => ({ provider, apiKey: apiKey.trim(), model: model.trim() || BYOK_PROVIDERS[provider].defaultModel, mode: "always" as const });

  const save = () => {
    if (!apiKey.trim()) return toast.error("Paste your API key first.");
    saveByokConfig(cfg());
    setSaved(true);
    toast.success("Your API key is saved on this device.");
  };

  const test = async () => {
    if (!apiKey.trim()) return toast.error("Paste your API key first.");
    setTesting(true);
    const r = await streamByokChat(cfg(), [{ role: "user", content: "Reply with: OK" }]);
    setTesting(false);
    if (r.error || !r.content) toast.error(r.error || "No reply from provider.");
    else toast.success(`Key works — ${BYOK_PROVIDERS[provider].label} replied.`);
  };

  const remove = () => {
    clearByokConfig();
    setApiKey("");
    setSaved(false);
    toast.success("Your API key was removed.");
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" /> Your own API key</CardTitle>
        <CardDescription>
          In Tech-User mode, AI requests use this provider key directly. The key is stored in this browser only and is not sent to ShadowTalk servers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => { const p = v as ByokProvider; setProvider(p); setModel(BYOK_PROVIDERS[p].defaultModel); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BYOK_PROVIDERS).map(([id, p]) => <SelectItem key={id} value={id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={BYOK_PROVIDERS[provider].defaultModel} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>API key</Label>
          <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={BYOK_PROVIDERS[provider].keyHint} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save}>Save</Button>
          <Button variant="outline" onClick={test} disabled={testing}>{testing ? "Testing…" : "Test key"}</Button>
          {saved && <Button variant="ghost" onClick={remove}>Remove</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
