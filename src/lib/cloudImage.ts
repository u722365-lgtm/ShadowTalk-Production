import { fbAuth, functionsBaseUrl } from "@/integrations/firebase/app";
import { applyImageWatermark } from "@/lib/imageWatermark";
import { getCachedAiAccessMode } from "@/lib/aiAccessMode";
import { getByokConfig } from "@/lib/byok";

export interface GenerateImageOptions {
  model?: string;
  referenceImage?: string;
  signal?: AbortSignal;
  watermark?: boolean;
  onFrame?: (dataUrl: string, isFinal: boolean) => void;
}

const OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image-preview";

export function isCloudImageConfigured(): boolean {
  return Boolean(functionsBaseUrl);
}

function decodeImageResult(body: any): string {
  const imageUrl =
    body?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
    body?.data?.[0]?.url ??
    body?.data?.[0]?.b64_json;
  if (typeof imageUrl !== "string" || !imageUrl) {
    throw new Error("The selected AI provider returned no image.");
  }
  return imageUrl.startsWith("data:")
    ? imageUrl
    : `data:image/png;base64,${imageUrl}`;
}

async function generateWithByok(
  prompt: string,
  options: GenerateImageOptions,
): Promise<string> {
  const config = getByokConfig();
  if (!config?.apiKey) {
    throw new Error("Your API key is not available on this device. Re-enter it in AI settings.");
  }

  if (config.provider === "openai") {
    if (options.referenceImage) {
      throw new Error("Reference-image editing currently requires an OpenRouter key.");
    }
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal: options.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || `OpenAI image generation failed (${response.status}).`);
    }
    return decodeImageResult(await response.json());
  }

  if (config.provider === "openrouter") {
    const content = options.referenceImage
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: options.referenceImage } },
        ]
      : prompt;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "ShadowTalk AI",
      },
      body: JSON.stringify({
        model: options.model || OPENROUTER_IMAGE_MODEL,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
        stream: false,
      }),
      signal: options.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || `OpenRouter image generation failed (${response.status}).`);
    }
    return decodeImageResult(await response.json());
  }

  throw new Error(
    `${config.provider} does not support image generation through ShadowTalk. Use an OpenAI or OpenRouter key for image generation.`,
  );
}

async function generateWithSharedKey(
  prompt: string,
  options: GenerateImageOptions,
): Promise<string> {
  const idToken = await fbAuth().currentUser?.getIdToken().catch(() => null);
  if (!idToken) throw new Error("Sign in to generate images.");

  const response = await fetch(`${functionsBaseUrl}/generateImage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      prompt,
      referenceImage: options.referenceImage,
      stream: false,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Image generation failed (${response.status}).`);
  }
  return decodeImageResult(await response.json());
}

export async function generateCloudImage(
  prompt: string,
  options: GenerateImageOptions = {},
): Promise<string> {
  const accessMode = getCachedAiAccessMode();
  if (!accessMode) {
    throw new Error("Choose Tech-User or Non-Tech-Users in the chatbot setup before using AI.");
  }
  if (!prompt.trim()) throw new Error("Describe the image you want to generate.");

  const image = accessMode === "byok"
    ? await generateWithByok(prompt, options)
    : await generateWithSharedKey(prompt, options);
  const finalImage =
    options.watermark === false ? image : await applyImageWatermark(image);
  options.onFrame?.(finalImage, true);
  return finalImage;
}
