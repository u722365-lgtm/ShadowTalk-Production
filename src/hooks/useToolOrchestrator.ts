import { useCallback } from 'react';

export type ToolType = 
  | 'strategy_agent'
  | 'stealth_vault'
  | 'knowledge_vault'
  | 'memory_panel'
  | 'document_generator'
  | 'presentation_builder';

export interface ToolDetectionResult {
  tool: ToolType | null;
  confidence: number;
  action?: string;
  params?: Record<string, string>;
  autoExecute?: boolean;
  originalMessage?: string;
}

const TOOL_PATTERNS: Array<{
  tool: ToolType;
  patterns: RegExp[];
  priority: number;
  autoExecute?: boolean;
  extractParams?: (message: string) => Record<string, string>;
}> = [
  {
    tool: 'document_generator',
    patterns: [
      /\b(open|launch|show)\s+(document\s*studio|doc\s*generator|document\s*generator)/i,
      /\b(generate|create|write|draft|compose)\s+(a\s+|an\s+)?(document|formal\s+report|whitepaper|business\s+plan|contract|proposal|sop|memo)\b/i,
      /\bdocument\s+(studio|forge|generator)\b/i,
    ],
    priority: 9,
    autoExecute: true,
    extractParams: (msg) => {
      const cleaned = msg
        .replace(/^(open|launch|show|generate|create|write|draft|compose)\s+(me\s+)?(a\s+|an\s+)?(document|formal\s+report|report|whitepaper|business\s+plan|contract|proposal|sop|memo)?\s*(about|for|on|regarding)?\s*/i, '')
        .trim();
      return { topic: cleaned || msg, prompt: cleaned || msg };
    },
  },
  {
    tool: 'presentation_builder',
    patterns: [
      /\b(create|make|build|generate|design)\s+(?:a\s+|an\s+)?(?:presentation|ppt|pptx|slides?|slide\s*deck|deck|powerpoint|pitch\s*deck)/i,
      /\bpresentation\s+(?:builder|creator|maker|generator)/i,
      /\b(build|create)\s+(?:me\s+)?(?:a\s+)?(?:slide\s*)?deck/i,
      /\bpitch\s*deck/i,
      /\bpowerpoint/i,
      /\bslide\s*show/i,
      /\bkimi\s+slides?\b/i,
      /\bslide\s+studio\b/i,
    ],
    priority: 10,
    autoExecute: true,
    extractParams: (msg: string) => {
      const cleaned = msg
        .replace(/^(create|make|build|generate|design)\s+(me\s+)?(a\s+|an\s+)?(presentation|ppt|pptx|slides?|slide\s*deck|deck|powerpoint|pitch\s*deck)\s*(about|on|for)?\s*/i, '')
        .trim();
      return { topic: cleaned || msg, mode: /\bvisual\b/i.test(msg) ? "visual" : "adaptive" };
    }
  },
  {
    tool: 'strategy_agent',
    patterns: [
      /\b(strategy|swot|business\s+plan|market\s+analysis)\b/i,
      /\b(analyze|run)\s+strategy/i,
    ],
    priority: 9,
    autoExecute: true,
  },
  {
    tool: 'stealth_vault',
    patterns: [
      /\b(encrypt|secure|protect|hide)\s+(?:my\s+)?(?:data|notes|secrets|passwords)/i,
      /\bopen\s+(?:the\s+)?(?:stealth\s+)?vault/i,
      /\bsave\s+(?:to\s+)?(?:stealth\s+)?vault/i,
      /\bprivacy\s+vault/i,
    ],
    priority: 3,
    autoExecute: false,
  },
  {
    tool: 'knowledge_vault',
    patterns: [
      /\bknowledge\s+(?:vault|base|graph)/i,
      /\b(open|show|manage)\s+(?:my\s+)?knowledge/i,
      /\bsave\s+(?:this\s+)?(?:to\s+)?knowledge/i,
      /\brag\s+(?:search|query)/i,
    ],
    priority: 5,
    autoExecute: false,
  },
  {
    tool: 'memory_panel',
    patterns: [
      /\b(open|show|manage)\s+(?:my\s+)?(?:ai\s+)?memory/i,
      /\bmemory\s+(?:panel|vault|manager)/i,
      /\bwhat\s+do\s+you\s+(?:remember|know)\s+about\s+me/i,
      /\bbusiness\s+(?:memory|context|profile)/i,
      /\bremember\s+(?:this|that|my)/i,
    ],
    priority: 5,
    autoExecute: false,
  },
];

export const useToolOrchestrator = () => {
  const detectTool = useCallback((message: string): ToolDetectionResult => {
    const normalizedMessage = message.trim().toLowerCase();
    if (!normalizedMessage || normalizedMessage.length < 3) {
      return { tool: null, confidence: 0 };
    }
    let bestMatch: ToolDetectionResult = { tool: null, confidence: 0 };
    for (const toolDef of TOOL_PATTERNS) {
      for (const pattern of toolDef.patterns) {
        if (pattern.test(message)) {
          const confidence = toolDef.priority * 10;
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              tool: toolDef.tool,
              confidence,
              params: toolDef.extractParams?.(message),
              autoExecute: toolDef.autoExecute ?? false,
              originalMessage: message,
            };
          }
          break;
        }
      }
    }
    return bestMatch;
  }, []);

  return {
    detectTool,
  };
};

export default useToolOrchestrator;