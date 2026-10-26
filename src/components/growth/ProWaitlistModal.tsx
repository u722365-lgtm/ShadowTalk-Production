import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, ArrowRight, Check } from "lucide-react";

/**
 * Pro Waitlist modal — monetizes the 7-minute session length.
 *
 * Non-intrusive: triggers ONCE per browser (localStorage gated) after the
 * user has been in-session for >= 5 minutes. Slide-in card bottom-right,
 * dismissable, captures email for the Pro Waitlist.
 *
 * Copy targets the two unshipped flagship features:
 *   - 1-click Consensus Merging
 *   - WebGPU Local Vector RAG
 */

const WAITLIST_SHOWN_KEY = "shadowtalk_pro_waitlist_shown";
const WAITLIST_SEEN_AT_KEY = "shadowtalk_pro_waitlist_seen_at";
const WAITLIST_EMAIL_KEY = "shadowtalk_pro_waitlist_email";
const TRIGGER_DELAY_MS = 5 * 60 * 1000; // 5 minutes

interface ProWaitlistModalProps {
  /** Force-show the modal (for testing or manual triggers). */
  forceOpen?: boolean;
  /** Elapsed session time in ms. If not provided, the component tracks its own timer. */
  elapsedMs?: number;
  /**
   * Copy variant:
   *   - "waitlist" (default): generic Pro Waitlist for Consensus Merging + WebGPU RAG.
   *   - "consensus": shown when user clicks "Synthesize Consensus" — copy references
   *     the Shadow Consensus Engine specifically and the "200+ power users" social proof.
   *   - "rag": shown when user clicks "Upload Folder RAG" — copy references WebGPU
   *     Local Vector RAG specifically.
   */
  variant?: "waitlist" | "consensus" | "rag";
}

export function ProWaitlistModal({ forceOpen = false, elapsedMs: externalElapsed, variant = "waitlist" }: ProWaitlistModalProps) {
  const [internalElapsed, setInternalElapsed] = useState(0);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const elapsed = externalElapsed ?? internalElapsed;

  // Track elapsed time internally if no external value provided
  useEffect(() => {
    if (externalElapsed !== undefined) return;
    const start = Number(sessionStorage.getItem("shadowtalk_session_start_ts") || Date.now());
    const tick = () => setInternalElapsed(Date.now() - start);
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, [externalElapsed]);

  // Trigger once after delay (and not previously shown)
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    if (dismissed) return;
    const alreadyShown = localStorage.getItem(WAITLIST_SHOWN_KEY) === "1";
    if (alreadyShown) return;
    if (elapsed >= TRIGGER_DELAY_MS) {
      setOpen(true);
      localStorage.setItem(WAITLIST_SHOWN_KEY, "1");
      localStorage.setItem(WAITLIST_SEEN_AT_KEY, String(Date.now()));
    }
  }, [elapsed, forceOpen, dismissed]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setDismissed(true);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    try {
      // Store locally so we can sync when the user creates an account
      localStorage.setItem(WAITLIST_EMAIL_KEY, email);
      // Fire-and-forget analytics event
      if (typeof window !== "undefined" && "gtag" in window) {
        // @ts-expect-error gtag is loaded by GA
        window.gtag("event", "pro_waitlist_signup", { source: "session_modal" });
      }
      setSubmitted(true);
      // Auto-close 4s after success
      window.setTimeout(() => setOpen(false), 4000);
    } catch {
      setSubmitted(true); // still confirm to the user
    }
  }, [email]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] max-w-md"
      role="dialog"
      aria-labelledby="pro-waitlist-title"
      aria-modal="true"
    >
      <div className="relative rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-cyan-400 to-primary" />

        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 pt-6">
          {!submitted ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Pro Waitlist
                </span>
              </div>
              <h3 id="pro-waitlist-title" className="text-base font-bold text-foreground mb-1.5 leading-snug">
                {variant === "consensus" && "Shadow Consensus Engine is in Early Access"}
                {variant === "rag" && "WebGPU Local Vector RAG is in Early Access"}
                {variant === "waitlist" && "Want 1-click Consensus Merging & WebGPU Local Vector RAG?"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {variant === "consensus" && "Join 200+ power users on the Pro Waitlist and get early access when 1-click Consensus Merging ships. No spam — one email when it's live, then we delete your address."}
                {variant === "rag" && "Join 200+ power users on the Pro Waitlist and get early access when unlimited WebGPU Local Vector RAG (folder indexing) ships. No spam — one email when it's live, then we delete your address."}
                {variant === "waitlist" && "Join the Pro Waitlist and get early access when these ship. No spam — one email when the feature is live, then we delete your address."}
              </p>
              <form onSubmit={handleSubmit} className="space-y-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
                  aria-label="Email address"
                />
                <Button type="submit" size="sm" className="w-full text-sm">
                  Join the Waitlist
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
              <p className="text-[10px] text-muted-foreground/70 text-center mt-3">
                You&apos;ve been here a while — we noticed. Help us build the features you want.
              </p>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/15 mb-3">
                <Check className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">You&apos;re on the list</h3>
              <p className="text-xs text-muted-foreground">
                We&apos;ll email <span className="text-foreground font-medium">{email}</span> the moment
                {variant === "consensus" && " the Shadow Consensus Engine ships."}
                {variant === "rag" && " WebGPU Local Vector RAG ships."}
                {variant === "waitlist" && " Consensus Merging & WebGPU RAG ship."}
                {" "}One email, then we delete your address.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProWaitlistModal;
