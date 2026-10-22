/**
 * AIKeyContext — Unified API Key & User Onboarding System for ShadowTalk AI.
 *
 * Splits users into two cohorts on first visit to /chatbot:
 *  - 'TECH'     : BYOK mode — user supplies their own OpenRouter/OpenAI key.
 *                 Unlimited messages, direct provider connection.
 *  - 'NON_TECH' : Instant Start mode — uses the shared platform key
 *                 (VITE_OPENROUTER_SHARED_KEY or backend /api/ai-proxy).
 *                 Hard-capped at 50 messages/day (UTC reset).
 *
 * All AI features (Chat, Doc Gen, Image Gen, Vision, Doc Analysis) route
 * through executeAIRequest() which reads this context to decide auth.
 *
 * Storage:
 *  - shadowtalk_ai_cohort       : 'TECH' | 'NON_TECH'
 *  - shadowtalk_ai_api_key      : encrypted-ish user key (localStorage)
 *  - shadowtalk_ai_onboarded    : '1' when onboarding is complete
 *  - shadowtalk_daily_usage     : { count, date } — UTC date-stamped
 *
 * Backward compatibility:
 *  - Existing BYOK system (shadowtalk.byok.v1) is respected — if a user
 *    already has a BYOK config, we auto-migrate them to the TECH cohort
 *    on first load without showing the onboarding modal.
 *  - Existing daily message counter (shadowtalk-daily-msgs-YYYY-MM-DD)
 *    is NOT touched — this context uses its own shadowtalk_daily_usage key
 *    with a {count, date} object so we can reset cleanly on UTC midnight.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { getByokConfig, saveByokConfig, clearByokConfig, type ByokConfig } from '@/lib/byok';

// ── Types ──────────────────────────────────────────────────────────────

export type UserCohort = 'TECH' | 'NON_TECH';

export interface DailyUsage {
  count: number;
  date: string; // 'YYYY-MM-DD' (UTC)
}

export interface AIKeyContextValue {
  /** Current cohort — null until onboarding is completed. */
  userCohort: UserCohort | null;
  /** User's API key (TECH only). Stored in localStorage. */
  userApiKey: string;
  /** Whether the one-time onboarding has been completed. */
  hasCompletedOnboarding: boolean;
  /** Messages sent today (NON_TECH only). */
  dailyUsageCount: number;
  /** Hard daily cap for NON_TECH users. */
  readonly maxDailyLimit: number;
  /** Remaining messages for today (NON_TECH). */
  remainingMessages: number;
  /** Whether the daily limit has been reached. */
  isLimitReached: boolean;

  /** Set TECH cohort with a user-provided API key. */
  setTechCohort: (apiKey: string, provider?: ByokConfig['provider']) => void;
  /** Set NON_TECH cohort (uses shared platform key). */
  setNonTechCohort: () => void;
  /** Increment the daily usage counter (NON_TECH only). No-op for TECH. */
  incrementUsage: () => void;
  /** Reset onboarding — allows switching cohorts from settings. */
  resetOnboarding: () => void;
  /** Clear the stored API key (used on sign-out or key rotation). */
  clearApiKey: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const COHORT_KEY = 'shadowtalk_ai_cohort';
const API_KEY_STORAGE = 'shadowtalk_ai_api_key';
const ONBOARDED_KEY = 'shadowtalk_ai_onboarded';
const DAILY_USAGE_KEY = 'shadowtalk_daily_usage';
const MAX_DAILY_LIMIT = 50;

const AIKeyContext = createContext<AIKeyContextValue | undefined>(undefined);

// ── Helpers ────────────────────────────────────────────────────────────

/** Today's date in UTC as 'YYYY-MM-DD'. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Read the daily usage object, resetting if the date has rolled over. */
function readDailyUsage(): DailyUsage {
  if (typeof localStorage === 'undefined') return { count: 0, date: todayUTC() };
  try {
    const raw = localStorage.getItem(DAILY_USAGE_KEY);
    if (!raw) return { count: 0, date: todayUTC() };
    const parsed = JSON.parse(raw) as DailyUsage;
    // If the stored date isn't today, reset the counter.
    if (parsed.date !== todayUTC()) {
      const reset = { count: 0, date: todayUTC() };
      localStorage.setItem(DAILY_USAGE_KEY, JSON.stringify(reset));
      return reset;
    }
    return { count: Math.max(0, parsed.count || 0), date: parsed.date };
  } catch {
    return { count: 0, date: todayUTC() };
  }
}

/** Write the daily usage object. */
function writeDailyUsage(usage: DailyUsage): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DAILY_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // storage full or unavailable — best-effort
  }
}

/**
 * Check for an existing BYOK config and auto-migrate it to the TECH cohort.
 * This ensures backward compatibility for users who already set up BYOK
 * before the onboarding system was added.
 */
function migrateExistingByok(): { cohort: UserCohort; key: string } | null {
  const existing = getByokConfig();
  if (existing?.apiKey) {
    return { cohort: 'TECH', key: existing.apiKey };
  }
  return null;
}

// ── Provider ───────────────────────────────────────────────────────────

export const AIKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userCohort, setUserCohort] = useState<UserCohort | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>({ count: 0, date: todayUTC() });
  const migratedRef = useRef(false);

  // Bootstrap from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Try the new onboarding system first.
    const storedCohort = localStorage.getItem(COHORT_KEY) as UserCohort | null;
    const storedKey = localStorage.getItem(API_KEY_STORAGE) || '';
    const onboarded = localStorage.getItem(ONBOARDED_KEY) === '1';

    if (storedCohort && onboarded) {
      setUserCohort(storedCohort);
      setUserApiKey(storedKey);
      setHasCompletedOnboarding(true);
    } else if (!migratedRef.current) {
      // 2. Backward-compat: migrate existing BYOK users to TECH cohort.
      const migrated = migrateExistingByok();
      if (migrated) {
        localStorage.setItem(COHORT_KEY, migrated.cohort);
        localStorage.setItem(API_KEY_STORAGE, migrated.key);
        localStorage.setItem(ONBOARDED_KEY, '1');
        setUserCohort(migrated.cohort);
        setUserApiKey(migrated.key);
        setHasCompletedOnboarding(true);
        migratedRef.current = true;
      }
    }

    // 3. Load daily usage (auto-resets on UTC date rollover).
    setDailyUsage(readDailyUsage());
  }, []);

  // Check for UTC date rollover every 60s (so a long-running tab resets at midnight).
  useEffect(() => {
    const interval = setInterval(() => {
      const current = readDailyUsage();
      setDailyUsage((prev) => {
        if (prev.date !== current.date) return current;
        return prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const setTechCohort = useCallback((apiKey: string, provider: ByokConfig['provider'] = 'openrouter') => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;

    localStorage.setItem(COHORT_KEY, 'TECH');
    localStorage.setItem(API_KEY_STORAGE, trimmed);
    localStorage.setItem(ONBOARDED_KEY, '1');

    // Also sync to the existing BYOK system so all current AI code paths work.
    const model = provider === 'openai' ? 'gpt-4o-mini'
      : provider === 'groq' ? 'llama-3.3-70b-versatile'
      : provider === 'gemini' ? 'gemini-2.0-flash'
      : 'openai/gpt-4o-mini'; // openrouter default
    saveByokConfig({ provider, apiKey: trimmed, model, mode: 'always' });

    setUserCohort('TECH');
    setUserApiKey(trimmed);
    setHasCompletedOnboarding(true);
  }, []);

  const setNonTechCohort = useCallback(() => {
    localStorage.setItem(COHORT_KEY, 'NON_TECH');
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.setItem(ONBOARDED_KEY, '1');

    // Clear any existing BYOK config so it doesn't interfere with the
    // OmniRoute gateway routing. NON_TECH requests go through
    // VITE_OMNIROUTE_ENDPOINT (handled in executeAIRequest.ts).
    clearByokConfig();

    setUserCohort('NON_TECH');
    setUserApiKey('');
    setHasCompletedOnboarding(true);
  }, []);

  const incrementUsage = useCallback(() => {
    // Only NON_TECH users are metered.
    if (userCohort !== 'NON_TECH') return;

    setDailyUsage((prev) => {
      // Ensure we're incrementing today's count (reset if date rolled).
      const base = prev.date === todayUTC() ? prev : { count: 0, date: todayUTC() };
      const next = { count: base.count + 1, date: todayUTC() };
      writeDailyUsage(next);
      return next;
    });
  }, [userCohort]);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(COHORT_KEY);
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(ONBOARDED_KEY);
    // Don't clear BYOK here — let the user re-pick.
    setUserCohort(null);
    setUserApiKey('');
    setHasCompletedOnboarding(false);
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(API_KEY_STORAGE);
    clearByokConfig();
    setUserApiKey('');
  }, []);

  const dailyUsageCount = dailyUsage.count;
  const remainingMessages = Math.max(0, MAX_DAILY_LIMIT - dailyUsageCount);
  const isLimitReached = userCohort === 'NON_TECH' && dailyUsageCount >= MAX_DAILY_LIMIT;

  const value: AIKeyContextValue = {
    userCohort,
    userApiKey,
    hasCompletedOnboarding,
    dailyUsageCount,
    maxDailyLimit: MAX_DAILY_LIMIT,
    remainingMessages,
    isLimitReached,
    setTechCohort,
    setNonTechCohort,
    incrementUsage,
    resetOnboarding,
    clearApiKey,
  };

  return <AIKeyContext.Provider value={value}>{children}</AIKeyContext.Provider>;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useAIKeyContext(): AIKeyContextValue {
  const ctx = useContext(AIKeyContext);
  if (ctx === undefined) {
    throw new Error('useAIKeyContext must be used within an AIKeyProvider');
  }
  return ctx;
}

export default AIKeyContext;
