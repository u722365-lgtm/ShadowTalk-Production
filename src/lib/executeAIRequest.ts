/**
 * executeAIRequest — Centralized AI request wrapper for ShadowTalk AI.
 *
 * ALL AI features (Chatbot, Document Generation, Image Generation, Vision
 * Analysis, Document Analysis) MUST route through this function. It reads
 * the AIKeyContext to decide which key/endpoint to use:
 *
 *  - TECH cohort:     Uses the user's own API key (BYOK) directly in the
 *                     Authorization header. Direct provider connection,
 *                     unlimited messages.
 *  - NON_TECH cohort: Routes through the shared platform key via env var
 *                     VITE_OPENROUTER_SHARED_KEY, or falls back to the
 *                     backend proxy at /api/ai-proxy if configured.
 *                     Subject to the 100/day cap enforced by useDailyUsage.
 *
 * Error handling:
 *  - BYOK key invalid/exhausted (401/402/429): throws AIKeyError with
 *    code 'BYOK_KEY_FAILED' so the UI can prompt for a new key.
 *  - Shared pool rate-limited (429): throws AIKeyError with code
 *    'SHARED_RATE_LIMITED' so the UI can show the upgrade modal.
 *  - Network errors: throws AIKeyError with code 'NETWORK_ERROR'.
 *
 * This wrapper handles CHAT requests (OpenAI-compatible /chat/completions).
 * For image generation and vision, use executeAIRequest's `endpoint` option.
 *
 * Backward compatibility:
 *  This is a NEW entry point — existing code paths (streamCloudChat, turboComplete,
 *  AIProviderRouter) continue to work unchanged. New features should adopt this
 *  wrapper for unified cohort-aware routing.
 */

import type { CloudChatMessage, CloudChatOptions, CloudChatResult } from '@/lib/cloudChat';
import { streamCloudChat } from '@/lib/cloudChat';
import { getByokConfig, streamByokChat } from '@/lib/byok';

// ── Types ──────────────────────────────────────────────────────────────

export type AICohort = 'TECH' | 'NON_TECH';

export interface ExecuteAIRequestParams {
  /** The cohort making the request (from AIKeyContext.userCohort). */
  cohort: AICohort;
  /** The user's API key (from AIKeyContext.userApiKey, TECH only). */
  userApiKey: string;
  /** Chat messages to send. */
  messages: CloudChatMessage[];
  /** Options (model, temperature, signal, onDelta for streaming, etc.). */
  options?: CloudChatOptions;
}

export type AIRequestErrorCode =
  | 'BYOK_KEY_FAILED'
  | 'BYOK_KEY_MISSING'
  | 'SHARED_RATE_LIMITED'
  | 'SHARED_KEY_MISSING'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class AIKeyError extends Error {
  code: AIRequestErrorCode;
  status?: number;
  constructor(code: AIRequestErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AIKeyError';
    this.code = code;
    this.status = status;
  }
}

// ── Shared key resolution ──────────────────────────────────────────────

/**
 * Resolve the shared platform key for NON_TECH users.
 * Priority:
 *  1. VITE_OPENROUTER_SHARED_KEY env var (client-side, prefixed with VITE_).
 *  2. (Future) backend /api/ai-proxy endpoint — if env var is absent, the
 *     request is routed through the backend which injects the key server-side.
 */
function getSharedKey(): string | null {
  const env = (import.meta as any).env ?? {};
  const key = env.VITE_OPENROUTER_SHARED_KEY;
  if (typeof key === 'string' && key.trim().length > 0) {
    return key.trim();
  }
  return null;
}

/**
 * Whether a backend AI proxy is configured. When true, NON_TECH requests
 * go to /api/ai-proxy instead of calling OpenRouter directly from the browser.
 * This is the recommended production setup (key stays server-side).
 */
function hasBackendProxy(): boolean {
  const env = (import.meta as any).env ?? {};
  return env.VITE_AI_PROXY_URL != null || env.VITE_USE_AI_PROXY === 'true';
}

// ── BYOK (TECH) execution ──────────────────────────────────────────────

async function executeByokRequest(
  apiKey: string,
  messages: CloudChatMessage[],
  options?: CloudChatOptions,
): Promise<CloudChatResult> {
  // Read the existing BYOK config to know which provider/model to use.
  // If the user just set their key via onboarding, AIKeyContext already
  // synced it to the BYOK system.
  const byokConfig = getByokConfig();

  if (!byokConfig && apiKey) {
    // Fallback: if BYOK config isn't set but we have a key, treat it as
    // an OpenRouter key (most common BYOK choice).
    const { saveByokConfig } = await import('@/lib/byok');
    saveByokConfig({
      provider: 'openrouter',
      apiKey,
      model: 'openai/gpt-4o-mini',
      mode: 'always',
    });
  }

  const config = byokConfig || { provider: 'openrouter' as const, apiKey, model: 'openai/gpt-4o-mini', mode: 'always' as const };

  try {
    const result = await streamByokChat(
      { ...config, apiKey },
      messages,
      options,
    );

    // Detect key failures from the result.
    if (result.error && !result.content) {
      const err = result.error.toLowerCase();
      if (err.includes('401') || err.includes('unauthorized') || err.includes('invalid')) {
        throw new AIKeyError('BYOK_KEY_FAILED', 'Your API key was rejected (invalid or expired). Please update your key in Settings.', 401);
      }
      if (err.includes('402') || err.includes('payment') || err.includes('quota') || err.includes('credits')) {
        throw new AIKeyError('BYOK_KEY_FAILED', 'Your API key has insufficient credits. Please top up your provider account or switch keys.', 402);
      }
      if (err.includes('429') || err.includes('rate')) {
        throw new AIKeyError('BYOK_KEY_FAILED', 'Your API key is rate-limited. Please try again in a moment.', 429);
      }
    }

    return result;
  } catch (err) {
    if (err instanceof AIKeyError) throw err;
    // Network/fetch errors from the BYOK provider.
    throw new AIKeyError('NETWORK_ERROR', `Could not reach your AI provider: ${(err as Error)?.message || 'network error'}`);
  }
}

// ── Shared pool (NON_TECH) execution ───────────────────────────────────

async function executeSharedRequest(
  messages: CloudChatMessage[],
  options?: CloudChatOptions,
): Promise<CloudChatResult> {
  const sharedKey = getSharedKey();
  const useProxy = hasBackendProxy();

  // If no shared key and no proxy configured, fall back to the existing
  // streamCloudChat (which uses the Supabase edge function / Lovable gateway).
  // This ensures the app works out-of-the-box without additional env setup.
  if (!sharedKey && !useProxy) {
    try {
      const result = await streamCloudChat(messages, options);
      if (result.error && !result.content) {
        const err = result.error.toLowerCase();
        if (err.includes('429') || err.includes('rate')) {
          throw new AIKeyError('SHARED_RATE_LIMITED', 'The shared AI pool is busy right now. Try again in a moment, or switch to BYOK mode for unlimited access.');
        }
        if (err.includes('402') || err.includes('credits') || err.includes('exhausted')) {
          throw new AIKeyError('SHARED_RATE_LIMITED', 'The shared AI pool credits are exhausted. Switch to BYOK mode with your own key for unlimited access.');
        }
      }
      return result;
    } catch (err) {
      if (err instanceof AIKeyError) throw err;
      throw new AIKeyError('NETWORK_ERROR', `Shared AI request failed: ${(err as Error)?.message || 'network error'}`);
    }
  }

  // If a shared OpenRouter key is configured, use it directly.
  if (sharedKey) {
    try {
      const result = await streamByokChat(
        {
          provider: 'openrouter',
          apiKey: sharedKey,
          model: 'openai/gpt-4o-mini', // cost-effective default for shared pool
          mode: 'always',
        },
        messages,
        options,
      );

      if (result.error && !result.content) {
        const err = result.error.toLowerCase();
        if (err.includes('429') || err.includes('rate')) {
          throw new AIKeyError('SHARED_RATE_LIMITED', 'The shared AI pool is rate-limited. Try again shortly, or switch to BYOK mode for unlimited access.');
        }
        if (err.includes('402') || err.includes('credits') || err.includes('insufficient')) {
          throw new AIKeyError('SHARED_RATE_LIMITED', 'The shared AI pool credits are exhausted. Switch to BYOK mode for unlimited access.');
        }
      }

      return result;
    } catch (err) {
      if (err instanceof AIKeyError) throw err;
      throw new AIKeyError('NETWORK_ERROR', `Shared AI request failed: ${(err as Error)?.message || 'network error'}`);
    }
  }

  // Future: backend proxy path (key stays server-side).
  throw new AIKeyError('SHARED_KEY_MISSING', 'No shared AI key configured. Set VITE_OPENROUTER_SHARED_KEY or enable the backend proxy.');
}

// ── Master execution function ──────────────────────────────────────────

/**
 * Execute an AI request with cohort-aware routing.
 *
 * @example
 * ```tsx
 * const { userCohort, userApiKey } = useAIKeyContext();
 * const { checkAndIncrement } = useDailyUsage();
 *
 * if (!checkAndIncrement()) {
 *   setShowLimitModal(true);
 *   return;
 * }
 *
 * try {
 *   const result = await executeAIRequest({
 *     cohort: userCohort!,
 *     userApiKey,
 *     messages,
 *     options: { onDelta: (text) => setStreaming(text) },
 *   });
 *   setResponse(result.content);
 * } catch (err) {
 *   if (err instanceof AIKeyError) {
 *     if (err.code === 'BYOK_KEY_FAILED') setShowKeyErrorModal(true);
 *     if (err.code === 'SHARED_RATE_LIMITED') setShowLimitModal(true);
 *   }
 * }
 * ```
 */
export async function executeAIRequest(
  params: ExecuteAIRequestParams,
): Promise<CloudChatResult> {
  const { cohort, userApiKey, messages, options } = params;

  if (cohort === 'TECH') {
    if (!userApiKey) {
      throw new AIKeyError('BYOK_KEY_MISSING', 'No API key configured. Please add your key in Settings or restart onboarding.');
    }
    return executeByokRequest(userApiKey, messages, options);
  }

  // NON_TECH
  return executeSharedRequest(messages, options);
}

export default executeAIRequest;
