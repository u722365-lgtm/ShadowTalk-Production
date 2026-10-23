import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
const cors = require("cors");

admin.initializeApp();

const corsHandler = cors({ origin: true });
const openRouterApiKey = defineSecret("OPENROUTER_API_KEY");
const SHARED_DAILY_AI_LIMIT = 100;
const SHARED_CHAT_MODEL = "openrouter/free";
const SHARED_IMAGE_MODEL = "google/gemini-2.5-flash-image-preview";

class AiRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function requireAuthenticatedUser(
  authorization: string | undefined,
): Promise<admin.auth.DecodedIdToken> {
  const match = (authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AiRequestError("Unauthorized. Sign in to continue.", 401);
  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch {
    throw new AiRequestError("Unauthorized. Sign in to continue.", 401);
  }
}

async function requireSharedAiMode(
  db: admin.firestore.Firestore,
  uid: string,
): Promise<void> {
  const snapshot = await db
    .collection("user_settings")
    .where("user_id", "==", uid)
    .where("setting_key", "==", "ai_access_mode")
    .limit(1)
    .get();
  const value = snapshot.docs[0]?.data()?.setting_value;
  const mode = typeof value === "string" ? value : value?.mode;
  if (mode !== "shared") {
    throw new AiRequestError(
      mode === "byok"
        ? "This account uses BYOK. Send the request directly through the selected provider."
        : "Complete AI setup in the chatbot before using shared AI.",
      403,
    );
  }
}

async function reserveSharedAiRequest(
  db: admin.firestore.Firestore,
  uid: string,
): Promise<admin.firestore.DocumentReference> {
  const date = new Date().toISOString().slice(0, 10);
  const usageRef = db.collection("daily_usage").doc(`${uid}_${date}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const used = Number(snapshot.data()?.ai_requests ?? 0);
    if (used >= SHARED_DAILY_AI_LIMIT) {
      throw new AiRequestError(
        "Daily AI limit reached (100 requests). Your limit resets at 00:00 UTC.",
        429,
      );
    }
    transaction.set(
      usageRef,
      {
        user_id: uid,
        usage_date: date,
        ai_requests: used + 1,
      },
      { merge: true },
    );
  });
  return usageRef;
}

async function releaseSharedAiRequest(
  db: admin.firestore.Firestore,
  usageRef: admin.firestore.DocumentReference,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const used = Number(snapshot.data()?.ai_requests ?? 0);
    if (used > 0) transaction.update(usageRef, { ai_requests: used - 1 });
  });
}

function sendError(res: any, error: unknown): void {
  const status = error instanceof AiRequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Internal server error";
  if (status >= 500) console.error("AI function error:", error);
  res.status(status).json({ error: message });
}

export const chat = onRequest({ secrets: [openRouterApiKey] }, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") return;
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

    let usageRef: admin.firestore.DocumentReference | null = null;
    let upstreamStarted = false;
    const db = admin.firestore();
    try {
      const user = await requireAuthenticatedUser(req.headers.authorization);
      await requireSharedAiMode(db, user.uid);
      if (!openRouterApiKey.value()) {
        throw new AiRequestError(
          "Shared AI is not configured. Set the OPENROUTER_API_KEY Firebase secret.",
          503,
        );
      }

      const {
        messages,
        stream = true,
        personality,
        deepResearch,
        maxTokens,
        structuredOutput,
      } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
        throw new AiRequestError("messages must contain between 1 and 40 entries.", 400);
      }
      for (const message of messages) {
        if (
          !message ||
          !["system", "user", "assistant"].includes(message.role) ||
          !(typeof message.content === "string" || Array.isArray(message.content))
        ) {
          throw new AiRequestError("Invalid chat message format.", 400);
        }
      }

      usageRef = await reserveSharedAiRequest(db, user.uid);
      const systemPrompts = [
        "You are ShadowTalk AI, a helpful, accurate, and concise AI assistant.",
      ];
      if (personality && personality !== "default") {
        systemPrompts.push(`Personality mode: ${String(personality).slice(0, 100)}`);
      }
      if (deepResearch) {
        systemPrompts.push(
          "The user has requested deep research. Provide thorough, well-structured analysis with citations where possible.",
        );
      }

      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey.value()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://shadowtalk-ai-7a513.web.app",
          "X-Title": "ShadowTalk AI",
        },
        body: JSON.stringify({
          model: SHARED_CHAT_MODEL,
          messages: [{ role: "system", content: systemPrompts.join("\n\n") }, ...messages],
          stream: Boolean(stream),
          ...(structuredOutput ? { response_format: { type: "json_object" } } : {}),
          max_tokens: Math.max(
            256,
            Math.min(
              4096,
              Number.isFinite(Number(maxTokens))
                ? Math.floor(Number(maxTokens))
                : deepResearch ? 4096 : 2048,
            ),
          ),
        }),
      });

      if (!upstream.ok) {
        const detail = (await upstream.text()).slice(0, 500);
        await releaseSharedAiRequest(db, usageRef);
        usageRef = null;
        return res.status(upstream.status === 429 ? 503 : 502).json({
          error: `OpenRouter request failed (${upstream.status}). ${detail}`,
        });
      }

      upstreamStarted = true;
      void db.collection("usage_analytics").add({
        user_id: user.uid,
        action_type: deepResearch ? "deep_research" : "chat_message",
        feature_used: `openrouter:${SHARED_CHAT_MODEL}`,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((error) => console.error("Failed to record shared AI usage:", error));

      if (!stream) return res.json(await upstream.json());

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Provider", "openrouter");
      res.setHeader("X-Model", SHARED_CHAT_MODEL);
      const reader = upstream.body?.getReader();
      if (!reader) throw new Error("OpenRouter returned an empty response stream.");
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      return res.end();
    } catch (error) {
      if (usageRef && !upstreamStarted) {
        await releaseSharedAiRequest(db, usageRef).catch((releaseError) =>
          console.error("Failed to release AI request reservation:", releaseError),
        );
      }
      return sendError(res, error);
    }
  });
});

export const audio = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") return;
    try {
      await requireAuthenticatedUser(req.headers.authorization);
      const { prompt, duration, type } = req.body || {};
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return res.json({
        audioUrl: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg",
        prompt,
        type,
        duration,
      });
    } catch (error) {
      return sendError(res, error);
    }
  });
});

export const drive = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") return;
    try {
      await requireAuthenticatedUser(req.headers.authorization);
      const { action, params } = req.body || {};
      if (action === "drive.list") {
        return res.json({
          data: [
            { id: "mock-1", name: "Q3 Strategy Presentation.pptx", mimeType: "presentation", modifiedTime: new Date().toISOString() },
            { id: "mock-2", name: "Financial Projections 2024.xlsx", mimeType: "spreadsheet", modifiedTime: new Date(Date.now() - 86400000).toISOString() },
            { id: "mock-3", name: "Product Requirements Doc.docx", mimeType: "document", modifiedTime: new Date(Date.now() - 7 * 86400000).toISOString() },
          ],
        });
      }
      if (action === "drive.get") {
        return res.json({
          data: { content: `# Mock File\n\n[Imported mock content from Google Drive for file ID: ${params?.fileId}]` },
        });
      }
      return res.status(400).json({ error: "Unknown action" });
    } catch (error) {
      return sendError(res, error);
    }
  });
});

export const generateImage = onRequest({ secrets: [openRouterApiKey] }, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") return;
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

    const db = admin.firestore();
    let usageRef: admin.firestore.DocumentReference | null = null;
    let upstreamStarted = false;
    try {
      const user = await requireAuthenticatedUser(req.headers.authorization);
      await requireSharedAiMode(db, user.uid);
      if (!openRouterApiKey.value()) {
        throw new AiRequestError(
          "Shared image generation is not configured. Set the OPENROUTER_API_KEY Firebase secret.",
          503,
        );
      }

      const { prompt, referenceImage } = req.body || {};
      if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
        throw new AiRequestError("prompt must be a non-empty string under 4000 characters.", 400);
      }
      if (
        referenceImage !== undefined &&
        (typeof referenceImage !== "string" ||
          !referenceImage.startsWith("data:image/") ||
          referenceImage.length > 8_000_000)
      ) {
        throw new AiRequestError("referenceImage must be an image data URL under 8 MB.", 400);
      }

      usageRef = await reserveSharedAiRequest(db, user.uid);
      const content = referenceImage
        ? [
            { type: "text", text: prompt.trim() },
            { type: "image_url", image_url: { url: referenceImage } },
          ]
        : prompt.trim();
      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey.value()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://shadowtalk-ai-7a513.web.app",
          "X-Title": "ShadowTalk AI",
        },
        body: JSON.stringify({
          model: SHARED_IMAGE_MODEL,
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
          stream: false,
        }),
      });
      if (!upstream.ok) {
        const detail = (await upstream.text()).slice(0, 500);
        await releaseSharedAiRequest(db, usageRef);
        usageRef = null;
        return res.status(upstream.status === 429 ? 503 : 502).json({
          error: `OpenRouter image request failed (${upstream.status}). ${detail}`,
        });
      }

      upstreamStarted = true;
      const result = await upstream.json() as {
        choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      };
      const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageUrl || !imageUrl.startsWith("data:image/")) {
        throw new AiRequestError("OpenRouter returned no generated image.", 502);
      }

      void db.collection("usage_analytics").add({
        user_id: user.uid,
        action_type: "generate_image",
        feature_used: `openrouter:${SHARED_IMAGE_MODEL}`,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((error) => console.error("Failed to record shared image usage:", error));

      return res.json({ data: [{ b64_json: imageUrl }] });
    } catch (error) {
      if (usageRef && !upstreamStarted) {
        await releaseSharedAiRequest(db, usageRef).catch((releaseError) =>
          console.error("Failed to release AI request reservation:", releaseError),
        );
      }
      return sendError(res, error);
    }
  });
});
