import { fbAuth } from "@/integrations/firebase/app";
import { backend } from "@/integrations/local/client";

export type AiAccessMode = "byok" | "shared";

const SETTING_KEY = "ai_access_mode";
const CACHE_PREFIX = "shadowtalk.ai-access-mode.v1";

function cacheKey(uid: string): string {
  return `${CACHE_PREFIX}.${uid}`;
}

function readMode(value: unknown): AiAccessMode | null {
  if (typeof value === "string") {
    return value === "byok" || value === "shared" ? value : null;
  }
  if (value && typeof value === "object" && "mode" in value) {
    const mode = (value as { mode?: unknown }).mode;
    return mode === "byok" || mode === "shared" ? mode : null;
  }
  return null;
}

export function getCachedAiAccessMode(uid = fbAuth().currentUser?.uid): AiAccessMode | null {
  if (!uid || typeof localStorage === "undefined") return null;
  try {
    return readMode(localStorage.getItem(cacheKey(uid)));
  } catch {
    return null;
  }
}

export async function loadAiAccessMode(uid: string): Promise<AiAccessMode | null> {
  const { data, error } = await backend
    .from("user_settings")
    .select("setting_value")
    .eq("user_id", uid)
    .eq("setting_key", SETTING_KEY)
    .maybeSingle();

  if (error) throw error;

  const mode = readMode(data?.setting_value);
  if (mode) {
    try {
      localStorage.setItem(cacheKey(uid), mode);
    } catch {
      // Firestore remains the source of truth when browser storage is unavailable.
    }
  }
  return mode;
}

export async function saveAiAccessMode(uid: string, mode: AiAccessMode): Promise<void> {
  const { error } = await backend.from("user_settings").upsert(
    {
      user_id: uid,
      setting_key: SETTING_KEY,
      setting_value: { mode },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,setting_key" },
  );

  if (error) throw error;

  try {
    localStorage.setItem(cacheKey(uid), mode);
  } catch {
    // The account preference is still safely persisted in Firestore.
  }
}
