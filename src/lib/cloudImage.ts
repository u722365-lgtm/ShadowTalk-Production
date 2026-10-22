/**
 * Cloud AI image generation — multi-backend with automatic fallback.
 *
 * Primary:   Supabase Edge Function (`generate-image`) → Lovable AI Gateway
 *            (google/gemini-3-pro-image) with streaming preview frames.
 * Fallback:  Pollinations.ai (free, no key required, works from any domain).
 *
 * The fallback ensures image generation works even when the Supabase Edge
 * Function is unreachable (CORS, network, or the function isn't deployed).
 */

import { flushSync } from "react-dom";
import { cloudAuthHeaders, cloudFunctionUrl, cloudAnonKey } from "@/lib/cloudConfig";
import { applyImageWatermark } from "@/lib/imageWatermark";
import { fbAuth } from "@/integrations/firebase/app";

export interface GenerateImageOptions {
  model?: string;
  /** Optional reference image (data URL) for image-to-image edits. */
  referenceImage?: string;
  signal?: AbortSignal;
  /** Stamp the final image with the ShadowTalk watermark (default: true). */
  watermark?: boolean;
  /** Called for every frame with a renderable data URL. */
  onFrame?: (dataUrl: string, isFinal: boolean) => void;
}

export function isCloudImageConfigured(): boolean {
  // Always returns true — we have the Pollinations.ai fallback.
  return true;
}

function getFunctionUrl(): string {
  return cloudFunctionUrl("generateImage");
}

async function authHeaders() {
  const idToken = await fbAuth().currentUser?.getIdToken().catch(() => null);
  const token = idToken || cloudAnonKey();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

type Frame =
  | { type: "image_generation.partial_image"; b64_json: string }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error?: { message?: string } };

/**
 * Generate an image, streaming progressive previews.
 * Resolves with the final image as a `data:image/png;base64,...` URL.
 */
export async function generateCloudImage(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<string> {
  const url = getFunctionUrl();
  if (!url) throw new Error("Image generation is not configured.");

  const requestBody = {
    prompt,
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.referenceImage ? { referenceImage: opts.referenceImage } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let message = `Image generation failed (${res.status})`;
    try {
      const json = await res.json();
      message = json?.error || message;
    } catch { /* keep status message */ }
    throw new Error(message);
  }

  const finalize = async (dataUrl: string): Promise<string> => {
    if (opts.watermark === false) return dataUrl;
    const stamped = await applyImageWatermark(dataUrl);
    if (stamped !== dataUrl && opts.onFrame) opts.onFrame(stamped, true);
    return stamped;
  };

  const emit = (b64: string, isFinal: boolean) => {
    const dataUrl = `data:image/png;base64,${b64}`;
    if (opts.onFrame) flushSync(() => opts.onFrame!(dataUrl, isFinal));
    return dataUrl;
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let eventName = "";
  let last = "";
  let sawAny = false;
  let sawCompleted = false;
  let streamError: string | undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, "");
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith("data:")) continue;
        const payloadText = line.slice(5).trim();
        if (!payloadText || payloadText === "[DONE]") continue;
        let payload: Frame | undefined;
        try {
          payload = JSON.parse(payloadText) as Frame;
        } catch {
          continue;
        }
        if (eventName === "error" || payload.type === "error") {
          sawAny = true;
          streamError =
            (payload as { error?: { message?: string } }).error?.message || "Image generation failed";
          continue;
        }
        const b64 = (payload as { b64_json?: string }).b64_json;
        if (!b64) continue;
        sawAny = true;
        const isFinal =
          eventName === "image_generation.completed" || payload.type === "image_generation.completed";
        last = emit(b64, isFinal);
        if (isFinal) sawCompleted = true;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);

  if (!sawAny) {
    // Zero events = transport hiccup → replay once, non-streamed.
    const replay = await fetch(url, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ ...requestBody, stream: false }),
      signal: opts.signal,
    });
    if (!replay.ok) {
      let message = `Image generation failed (${replay.status})`;
      try {
        const json = await replay.json();
        message = json?.error || message;
      } catch { /* keep status message */ }
      throw new Error(message);
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image generation returned no image");
    return finalize(emit(b64, true));
  }

  if (!sawCompleted && !last) throw new Error("Image stream ended without an image");
  return finalize(last);
}

// ── Pollinations.ai fallback (free, no key, no CORS issues) ─────────────

/**
 * Generate an image via Pollinations.ai — a free, open image generation
 * service that requires no API key and works from any domain (no CORS
 * restrictions). Used as a fallback when the primary Supabase Edge
 * Function is unreachable.
 *
 * The URL format is: https://image.pollinations.ai/prompt/<encoded-prompt>?width=1024&height=1024&nologo=true
 * We fetch it as a blob, convert to a data URL, and return.
 */
async function generateViaPollinations(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<string> {
  const encoded = encodeURIComponent(prompt.slice(0, 500));
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${seed}`;

  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`Pollinations.ai returned ${res.status}. Please try again.`);
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error("Pollinations.ai returned an empty image.");

  // Convert blob to data URL.
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });

  // Emit the frame.
  if (opts.onFrame) {
    flushSync(() => opts.onFrame!(dataUrl, true));
  }

  // Apply watermark.
  if (opts.watermark === false) return dataUrl;
  return applyImageWatermark(dataUrl);
}

// ── Master function with fallback ──────────────────────────────────────

/**
 * Generate an image with automatic fallback:
 *   1. Try the Supabase Edge Function (Lovable AI Gateway / Gemini).
 *   2. If it fails (network, CORS, timeout), fall back to Pollinations.ai.
 *   3. If both fail, throw a helpful error message.
 */
export async function generateImageWithFallback(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<string> {
  // Try primary (Supabase Edge Function).
  try {
    return await generateCloudImage(prompt, opts);
  } catch (primaryErr) {
    const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn("[cloudImage] Primary image generation failed, trying Pollinations.ai fallback:", errMsg);

    // If the user aborted, don't fall back.
    if (primaryErr instanceof DOMException && primaryErr.name === "AbortError") {
      throw primaryErr;
    }

    // Try fallback (Pollinations.ai).
    try {
      return await generateViaPollinations(prompt, opts);
    } catch (fallbackErr) {
      const fbErrMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.error("[cloudImage] Both primary and fallback image generation failed:", fbErrMsg);
      throw new Error(
        `Image generation is currently unavailable. The primary service failed (${errMsg}) and the fallback also failed (${fbErrMsg}). Please try again in a moment.`,
      );
    }
  }
}
