/**
 * LiveVoiceMode — Full-screen live voice conversation overlay.
 *
 * Uses the browser's SpeechRecognition API for speech-to-text, the AI
 * provider (BYOK key for TECH users, streamCloudChat for NON_TECH) for
 * responses, and the browser's SpeechSynthesis API for text-to-speech.
 *
 * Flow:
 *   1. User taps mic → SpeechRecognition starts listening
 *   2. User speaks → transcript appears
 *   3. User stops → transcript sent to AI (via BYOK key or cloud)
 *   4. AI responds → response spoken via SpeechSynthesis
 *   5. After speaking → automatically starts listening again (loop)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Loader2, Volume2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAIKeyContext } from "@/contexts/AIKeyContext";
import { streamCloudChat, isCloudChatConfigured, type CloudChatMessage } from "@/lib/cloudChat";
import { getByokConfig, streamByokChat } from "@/lib/byok";
import { buildChatSystemPrompt } from "@/lib/shadowTalkPersona";

// Fallback AI response when all providers fail
function getFallbackResponse(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("hello") || lower.includes("hi ") || lower.includes("hey")) {
    return "Hello! I'm here and ready to talk. What's on your mind?";
  }
  if (lower.includes("how are you")) {
    return "I'm doing great, thanks for asking! How about you?";
  }
  if (lower.includes("what can you do") || lower.includes("who are you")) {
    return "I'm ShadowTalk AI, your voice assistant. I can chat, answer questions, and help you think through ideas. What would you like to talk about?";
  }
  return "I heard you, but I'm having trouble connecting to my AI backend right now. Please check your API key in Settings, or try again in a moment.";
}

interface LiveVoiceModeProps {
  open: boolean;
  onClose: () => void;
  personality?: string;
}

interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const LiveVoiceMode: React.FC<LiveVoiceModeProps> = ({
  open,
  onClose,
  personality = "friendly",
}) => {
  const { toast } = useToast();
  const { userCohort, userApiKey } = useAIKeyContext();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const conversationRef = useRef<VoiceMessage[]>([]);
  const shouldContinueRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startListeningRef = useRef<() => void>(() => {});

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      shouldContinueRef.current = false;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Text-to-Speech: speak the AI response
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    // Strip markdown for cleaner speech
    const plain = text
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/[#*_`[\]()]/g, "")
      .replace(/\n{2,}/g, ". ")
      .slice(0, 4000);

    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.rate = 1.05;
    utterance.pitch = 1;

    // Try to pick a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural")
    ) || voices.find(v => v.lang.startsWith("en"));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-resume listening after AI finishes speaking
      if (shouldContinueRef.current && open) {
        setTimeout(() => startListeningRef.current(), 300);
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      if (shouldContinueRef.current && open) {
        setTimeout(() => startListeningRef.current(), 300);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [open]);

  // Send message to AI and speak the response
  const sendToAI = useCallback(async (userText: string) => {
    setIsProcessing(true);
    setError(null);

    const userMsg: VoiceMessage = { role: "user", content: userText, timestamp: Date.now() };
    const newConversation = [...conversationRef.current, userMsg];
    conversationRef.current = newConversation;
    setMessages(newConversation);

    try {
      // Build chat messages for the AI
      const chatMessages: CloudChatMessage[] = [
        {
          role: "system",
          content: buildChatSystemPrompt({ personality }) +
            "\n\n## Voice Mode\nYou are in live voice conversation mode. Keep responses SHORT and conversational — 1-3 sentences max. No markdown formatting, no headers, no bullet points. Speak naturally as if on a phone call.",
        },
        ...newConversation.slice(-10).map(m => ({
          role: m.role === "user" ? "user" as const : "assistant" as const,
          content: m.content,
        })),
      ];

      let responseText = "";
      let aiFailed = false;

      // Route based on cohort
      try {
        if (userCohort === "TECH" && userApiKey) {
          // BYOK mode — use user's API key directly
          const byokConfig = getByokConfig();
          const config = byokConfig || {
            provider: "openrouter" as const,
            apiKey: userApiKey,
            model: "openai/gpt-4o-mini",
            mode: "always" as const,
          };

          const result = await streamByokChat(
            { ...config, apiKey: userApiKey },
            chatMessages,
            { temperature: 0.7 },
          );
          responseText = result.content || "";
          if (!responseText && result.error) {
            console.warn("[VoiceMode] BYOK failed:", result.error);
            aiFailed = true;
          }
        }

        // If BYOK failed or NON_TECH, try cloud chat
        if (!responseText && !aiFailed) {
          const result = await streamCloudChat(chatMessages, {
            temperature: 0.7,
          });
          responseText = result.content || "";
          if (!responseText && result.error) {
            console.warn("[VoiceMode] Cloud chat failed:", result.error);
            aiFailed = true;
          }
        }
      } catch (err: any) {
        console.warn("[VoiceMode] AI request failed:", err?.message);
        aiFailed = true;
      }

      // Fallback if all AI providers failed
      if (!responseText) {
        responseText = getFallbackResponse(userText);
      }

      // Add AI response to conversation
      const aiMsg: VoiceMessage = {
        role: "assistant",
        content: responseText,
        timestamp: Date.now(),
      };
      conversationRef.current = [...conversationRef.current, aiMsg];
      setMessages(conversationRef.current);

      // Speak the response
      speak(responseText);

      if (aiFailed) {
        toast({
          title: "AI connection issue",
          description: "Using offline fallback. Check your API key or try again.",
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || "Could not reach the AI. Please try again.";
      setError(errMsg);
      toast({
        title: "Voice AI error",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [userCohort, userApiKey, personality, speak, toast]);

  // Start listening with SpeechRecognition
  const startListening = useCallback(() => {
    const w = window as any;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast({
        title: "Not supported",
        description: "Voice recognition requires Chrome, Edge, or Safari browser.",
        variant: "destructive",
      });
      return;
    }

    stopSpeaking();
    stopListening();

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      setCurrentTranscript("");
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      setCurrentTranscript(finalTranscript + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      // If we got a transcript, send it to the AI
      if (finalTranscript.trim()) {
        setCurrentTranscript("");
        void sendToAI(finalTranscript.trim());
      } else if (shouldContinueRef.current && open && !isProcessing) {
        // No speech detected — restart listening after a brief pause
        setTimeout(() => {
          if (shouldContinueRef.current && open && !isProcessing && !isSpeaking) {
            startListening();
          }
        }, 1000);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      recognitionRef.current = null;

      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone permissions.");
        shouldContinueRef.current = false;
      } else if (event.error === "no-speech") {
        // No speech detected — restart if still active
        if (shouldContinueRef.current && open) {
          setTimeout(() => startListening(), 500);
        }
      } else if (event.error !== "aborted") {
        console.warn("[VoiceMode] SpeechRecognition error:", event.error);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      // Recognition already started — stop and restart
      console.warn("[VoiceMode] Failed to start recognition:", err);
    }
  }, [open, isProcessing, isSpeaking, sendToAI, stopListening, stopSpeaking, toast]);

  // Keep the ref in sync so speak() can call it without a stale closure
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Toggle listening
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      shouldContinueRef.current = true;
      startListening();
    }
  };

  // Close the overlay
  const handleClose = () => {
    shouldContinueRef.current = false;
    stopListening();
    stopSpeaking();
    setMessages([]);
    conversationRef.current = [];
    setCurrentTranscript("");
    setError(null);
    onClose();
  };

  // Load voices for TTS (Chrome needs this)
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] ios-glass-modal-backdrop flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="ios-glass-modal w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Live Voice Mode</h2>
                  <p className="text-[11px] text-slate-400">
                    {userCohort === "TECH" ? "Powered by your API key" : "Powered by OmniRoute"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation transcript */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-[200px] max-h-[50vh]"
            >
              {messages.length === 0 && !currentTranscript && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Sparkles className="w-10 h-10 text-indigo-500/30 mb-3" />
                  <p className="text-sm text-slate-400">Tap the microphone and start speaking.</p>
                  <p className="text-xs text-slate-500 mt-1">I'll listen, respond, and keep the conversation going.</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm",
                      msg.role === "user"
                        ? "ios-glass-bubble-user text-white"
                        : "ios-glass-bubble-ai text-slate-100"
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Live transcript */}
              {currentTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl ios-glass-bubble-user text-white/70 text-sm italic">
                    {currentTranscript}...
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex justify-center">
                  <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                    {error}
                  </div>
                </div>
              )}
            </div>

            {/* Status + Controls */}
            <div className="px-6 py-6 border-t border-white/[0.06] flex flex-col items-center gap-4">
              {/* Status */}
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  {isProcessing
                    ? "Thinking..."
                    : isSpeaking
                      ? "Speaking..."
                      : isListening
                        ? "Listening..."
                        : messages.length === 0
                          ? "Ready to talk"
                          : "Tap to continue"}
                </p>
              </div>

              {/* Mic button with pulse animation */}
              <div className="relative">
                {isListening && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-indigo-500/30"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                      className="absolute inset-0 rounded-full bg-indigo-500/20"
                    />
                  </>
                )}

                <button
                  onClick={handleMicToggle}
                  disabled={isProcessing || isSpeaking}
                  className={cn(
                    "relative w-20 h-20 rounded-full flex items-center justify-center transition-all",
                    isListening
                      ? "bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10",
                    (isProcessing || isSpeaking) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : isListening ? (
                    <Mic className="w-8 h-8" />
                  ) : (
                    <MicOff className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Secondary controls */}
              <div className="flex items-center gap-3">
                {isSpeaking && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopSpeaking}
                    className="gap-2 rounded-full border-white/10 bg-transparent hover:bg-white/5 text-slate-300"
                  >
                    <Volume2 className="w-4 h-4" />
                    Stop speaking
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="gap-2 rounded-full border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400"
                >
                  <PhoneOff className="w-4 h-4" />
                  End call
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveVoiceMode;
