import { streamCloudChat } from "@/lib/cloudChat";
import type { PresentationData } from "@/components/presentation/types";
import type { ThemeKey } from "@/components/presentation/types";
import { THEMES as THEME_MAP } from "@/components/presentation/types";
import { postProcessPresentation } from "@/lib/presentation/slideQuality";

export type KimiPresentationMode = "adaptive" | "visual";

export const KIMI_PRESENTATION_MODES: { value: KimiPresentationMode; label: string; description: string }[] = [
  {
    value: "adaptive",
    label: "Adaptive",
    description: "Deep research, citations, data-heavy decks (Kimi default)",
  },
  {
    value: "visual",
    label: "Visual",
    description: "Designer-quality visuals, bold layouts, faster polish",
  },
];

export const PRESENTATION_SESSION_KEY = "shadowtalk_presentation_payload";

export interface GeneratePresentationOptions {
  topic: string;
  slideCount?: number;
  style?: ThemeKey;
  mode?: KimiPresentationMode;
  additionalContext?: string;
  sourceDocument?: string;
}

export function extractPresentationTopic(message: string): string {
  return message
    .replace(
      /^(?:please\s+)?(?:create|make|build|generate|design|draft)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:\d+\s*-?\s*slide\s+)?(?:professional\s+)?(?:presentation|ppt|pptx|slides?|slide\s*deck|deck|powerpoint|pitch\s*deck)\s*(?:about|on|for|regarding)?\s*/i,
      ""
    )
    .trim() || message;
}

export function inferPresentationMode(message: string): KimiPresentationMode {
  if (/\b(visual|beautiful|designer|keynote|marketing|brand)\b/i.test(message)) return "visual";
  return "adaptive";
}

export async function generateKimiPresentation(
  options: GeneratePresentationOptions
): Promise<PresentationData> {
  const { topic, slideCount = 10, style = "corporate", mode = "adaptive", additionalContext, sourceDocument } = options;

  const safeSlideCount = Math.max(3, Math.min(30, Math.floor(slideCount)));
  const prompt = [
    `Create a ${safeSlideCount}-slide ${mode} presentation about: ${topic}.`,
    `Use the ${style} visual theme.`,
    additionalContext ? `Additional context:\n${additionalContext}` : "",
    sourceDocument ? `Source document:\n${sourceDocument}` : "",
    "Return valid JSON only with shape { title: string, subtitle: string, slides: [{ title: string, subtitle?: string, layout: string, html: string, speakerNotes?: string, content?: object }] }.",
    "Make each slide self-contained, concise, visually distinct, and based only on the supplied context and established general knowledge. Do not fabricate citations or claim live research.",
  ].filter(Boolean).join("\n\n");
  const result = await streamCloudChat([
    { role: "system", content: "You create clear, accurate presentation decks. Return only the requested JSON object." },
    { role: "user", content: prompt },
  ], { structuredOutput: true, maxTokens: 6000 });
  if (result.error) throw new Error(result.error);
  const json = result.content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("The presentation provider did not return valid slide data.");
  const presentation = JSON.parse(json) as PresentationData;
  if (
    typeof presentation.title !== "string" ||
    !Array.isArray(presentation.slides) ||
    presentation.slides.length === 0 ||
    presentation.slides.some((slide) => typeof slide.title !== "string" || typeof slide.html !== "string")
  ) {
    throw new Error("The presentation provider returned incomplete slide data.");
  }
  const themeColors = THEME_MAP[style] || THEME_MAP.corporate;
  postProcessPresentation(presentation as unknown as { slides: import("@/lib/presentation/slideQuality").SlideLike[] }, {
    bg: themeColors.bg,
    accent: themeColors.accent,
    accentEnd: themeColors.accentEnd ?? themeColors.accent,
    text: themeColors.text,
    secondaryBg: themeColors.secondaryBg,
    cardBg: themeColors.secondaryBg,
    mutedText: themeColors.text,
  });
  return presentation;
}

export function savePresentationToSession(presentation: PresentationData, style: ThemeKey): void {
  sessionStorage.setItem(
    PRESENTATION_SESSION_KEY,
    JSON.stringify({ presentation, style, savedAt: Date.now() })
  );
}

export function loadPresentationFromSession(): { presentation: PresentationData; style: ThemeKey } | null {
  try {
    const raw = sessionStorage.getItem(PRESENTATION_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
