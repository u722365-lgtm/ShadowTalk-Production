import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { streamCloudChat } from "@/lib/cloudChat";

export type ScreenAction = "clone" | "analyze" | "auto";

interface ScreenAgentState {
  isSharing: boolean;
  isCapturing: boolean;
  isAnalyzing: boolean;
  lastScreenshot: string | null;
  streamedResponse: string;
  error: string | null;
}

export function useScreenAgent() {
  const { toast } = useToast();
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [state, setState] = useState<ScreenAgentState>({
    isSharing: false,
    isCapturing: false,
    isAnalyzing: false,
    lastScreenshot: null,
    streamedResponse: "",
    error: null,
  });

  const stopScreenShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((current) => ({ ...current, isSharing: false }));
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
        audio: false,
      });
      streamRef.current = stream;
      setState((current) => ({ ...current, isSharing: true, error: null }));
      stream.getVideoTracks()[0].onended = stopScreenShare;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      toast({ title: "Screen sharing active", description: "Your screen is now visible to ShadowTalk." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Screen sharing failed.";
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError") {
        toast({ title: "Screen share failed", description: message, variant: "destructive" });
      }
      return false;
    }
  }, [stopScreenShare, toast]);

  const captureScreenshot = useCallback(async (): Promise<string | null> => {
    setState((current) => ({ ...current, isCapturing: true }));
    let temporaryStream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      let dataUrl: string;
      const sharedVideo = videoRef.current;
      if (state.isSharing && sharedVideo && sharedVideo.readyState >= 2) {
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = Math.min(sharedVideo.videoWidth, 1280);
        canvas.height = Math.min(sharedVideo.videoHeight, 720);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the screenshot canvas.");
        context.drawImage(sharedVideo, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      } else {
        temporaryStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor" } as MediaTrackConstraints,
          audio: false,
        });
        video = document.createElement("video");
        video.srcObject = temporaryStream;
        await video.play();
        await new Promise((resolve) => setTimeout(resolve, 200));

        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth, 1280);
        canvas.height = Math.min(video.videoHeight, 720);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the screenshot canvas.");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      }

      setState((current) => ({ ...current, isCapturing: false, lastScreenshot: dataUrl }));
      return dataUrl;
    } catch (error) {
      setState((current) => ({ ...current, isCapturing: false }));
      const message = error instanceof Error ? error.message : "Screenshot failed.";
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError") {
        toast({ title: "Screenshot failed", description: message, variant: "destructive" });
      }
      return null;
    } finally {
      temporaryStream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    }
  }, [state.isSharing, toast]);

  const analyzeScreen = useCallback(async (
    screenshot: string,
    action: ScreenAction = "auto",
    userPrompt?: string,
  ): Promise<string> => {
    setState((current) => ({ ...current, isAnalyzing: true, streamedResponse: "", error: null }));
    try {
      const task = action === "clone"
        ? "Describe the visible interface and produce a concise implementation plan."
        : action === "analyze"
          ? "Analyze the visible screen and explain its important content and state."
          : "Understand the visible screen and help the user with their request.";
      const prompt = [task, userPrompt?.trim()].filter(Boolean).join("\n\n");
      const result = await streamCloudChat(
        [
          {
            role: "system",
            content: "You are ShadowTalk Screen Assistant. Analyze only the screenshot content provided by the user.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: screenshot } },
            ],
          },
        ],
        {
          onDelta: (content) => {
            setState((current) => ({ ...current, streamedResponse: content }));
          },
        },
      );
      if (result.error) throw new Error(result.error);
      setState((current) => ({
        ...current,
        isAnalyzing: false,
        streamedResponse: result.content,
      }));
      return result.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Screen analysis failed.";
      setState((current) => ({ ...current, isAnalyzing: false, error: message }));
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
      return "";
    }
  }, [toast]);

  return {
    state,
    videoRef,
    canvasRef,
    startScreenShare,
    stopScreenShare,
    captureScreenshot,
    analyzeScreen,
  };
}
