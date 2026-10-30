/**
 * How-to guides for Phase 3 content marketing — long-tail SEO.
 * Static HTML synced to public/how-to-*.html
 */

export interface HowToGuide {
  slug: string;
  filename: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  steps: string[];
  ctaLabel: string;
  utmCampaign: string;
}

export const HOW_TO_GUIDES: HowToGuide[] = [
  {
    slug: "free-ai-chatbot-no-login",
    filename: "how-to-free-ai-chatbot-no-login.html",
    title: "How to Use a Free AI Chatbot Without Login — ShadowTalk AI",
    metaDescription:
      "Step-by-step guide: try a free AI chatbot with Account + BYOK API key required session, optional E2EE, encrypted vault, and . ShadowTalk privacy-first workspace guide.",
    keywords: ["private AI chat", "encrypted AI chat", "anonymous AI", "AI"],
    steps: [
      "Open /chatbot — anonymous session works without signup",
      "Enable encrypted chat for sensitive threads",
      "Use the encrypted vault in /security for stored secrets",
      "Optional: or on-device models in Settings",
    ],
    ctaLabel: "Start private AI chat",
    utmCampaign: "privacy_howto",
  },
  {
    slug: "shadowtalk-vs-chatgpt-strategy",
    filename: "how-to-shadowtalk-vs-chatgpt-strategy.html",
    title: "ShadowTalk vs ChatGPT for Business Strategy — How To Choose",
    metaDescription:
      "Comparison how-to: when to use ShadowTalk vs ChatGPT for business strategy, marketing plans, and founder workflows. Try ShadowTalk free.",
    keywords: [
      "ShadowTalk vs ChatGPT strategy",
      "best AI for business strategy",
      "ChatGPT alternative strategy",
    ],
    steps: [
      "ChatGPT: strong for single-turn brainstorming and polish",
      "ShadowTalk: missions, /strategy, exports, and tool chains in one workspace",
      "Try both on the same prompt — compare finish rate, not reply length",
      "Use ShadowTalk BYOK for strategy — bring your own API key, no platform fee",
    ],
    ctaLabel: "Try ShadowTalk for strategy — free",
    utmCampaign: "comparison_howto",
  },
];

export function getHowToBySlug(slug: string): HowToGuide | undefined {
  return HOW_TO_GUIDES.find((g) => g.slug === slug);
}
