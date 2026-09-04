import type { Message, Settings } from "@/types";

const VISION_YES = [
  /gpt-4o/i,
  /gpt-4.*vision/i,
  /gpt-4-turbo/i,
  /claude-3/i,
  /gemini.*pro.*vision/i,
  /gemini.*flash/i,
  /gemini.*ultra/i,
  /gemini-1\.[05]/i,
  /gemini-2/i,
  /llava/i,
  /bakllava/i,
  /minicpm.*v/i,
  /cogvlm/i,
  /yi.*vl/i,
  /deepseek.*vl/i,
  /internvl/i,
  /intern.*vl/i,
  /qwen.*vl/i,
  /qwen.*vision/i,
  /phi.*vision/i,
  /phi-3.*vision/i,
  /pixtral/i,
  /moondream/i,
  /idefics/i,
  /fuyu/i,
  /paligemma/i,
  /\bvision\b/i,
  /\bvl\b/,
];

const VISION_NO = [
  /gpt-3\.5/i,
  /gpt-3\b/i,
  /o1-mini/i,
  /whisper/i,
  /dall-e/i,
  /tts/i,
  /embedding/i,
  /text-embedding/i,
  /\bada\b/i,
  /babbage/i,
  /\bdavinci\b/i,
  /\bcurie\b/i,
  /claude-2/i,
  /claude-instant/i,
  /text-davinci/i,
  /codex/i,
];

export function detectVisionSupport(model: string): boolean | null {
  const m = model.trim();
  for (const re of VISION_YES) if (re.test(m)) return true;
  for (const re of VISION_NO) if (re.test(m)) return false;
  return null;
}

export async function probeVisionSupport(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<boolean | null> {
  const heuristic = detectVisionSupport(model);
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(model)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return heuristic;
    const json = await res.json() as Record<string, unknown>;
    const capabilities = json?.capabilities as Record<string, unknown> | undefined;
    if (capabilities) {
      if (capabilities.vision === true) return true;
      if (capabilities.vision === false) return false;
    }
    const modalitiesRaw = json?.modalities ?? capabilities?.modalities;
    if (Array.isArray(modalitiesRaw)) {
      const mods = modalitiesRaw as string[];
      if (mods.some((x) => /image|vision|visual/i.test(x))) return true;
      if (mods.length > 0) return false;
    }
    return heuristic;
  } catch {
    return heuristic;
  }
}

interface ApiMessage {
  role: string;
  content: string | ApiContent[];
}

interface ApiContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

function buildApiMessages(messages: Message[]): ApiMessage[] {
  return messages.map((m) => {
    if (m.images && m.images.length > 0) {
      const content: ApiContent[] = [];
      if (m.content.trim()) {
        content.push({ type: "text", text: m.content });
      }
      for (const img of m.images) {
        if (img.base64) {
          const mime = img.mimeType ?? "image/jpeg";
          content.push({
            type: "image_url",
            image_url: { url: `data:${mime};base64,${img.base64}` },
          });
        }
      }
      return { role: m.role, content };
    }
    return { role: m.role, content: m.content };
  });
}

export interface SendOptions {
  onChunk: (text: string) => void;
  onImageChunk?: (url: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  signal?: AbortSignal;
}

function processContentPart(
  part: unknown,
  onChunk: (text: string) => void,
  onImageChunk?: (url: string) => void
): void {
  if (typeof part === "string") {
    if (part) onChunk(part);
    return;
  }
  if (typeof part !== "object" || part === null) return;
  const p = part as Record<string, unknown>;

  if (p.type === "text" && typeof p.text === "string" && p.text) {
    onChunk(p.text);
  } else if (p.type === "image_url" && onImageChunk) {
    const imgObj = p.image_url as Record<string, unknown> | undefined;
    const url = imgObj?.url as string | undefined;
    if (url) onImageChunk(url);
  } else if (p.type === "image" && onImageChunk) {
    const src = p.source as Record<string, unknown> | undefined;
    if (src?.type === "base64" && typeof src.data === "string") {
      const mime = (src.media_type as string | undefined) ?? "image/png";
      onImageChunk(`data:${mime};base64,${src.data}`);
    } else if (typeof p.data === "string") {
      onImageChunk(`data:image/png;base64,${p.data}`);
    }
  }
}

export async function sendMessage(
  settings: Settings,
  messages: Message[],
  opts: SendOptions
): Promise<void> {
  const { baseUrl, apiKey, model, systemPrompt, temperature, topP, topK, maxTokens, streaming } =
    settings;
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";

  const apiMessages = buildApiMessages(messages);
  const withSystem = systemPrompt.trim()
    ? [{ role: "system", content: systemPrompt.trim() }, ...apiMessages]
    : apiMessages;

  const bodyObj: Record<string, unknown> = {
    model,
    messages: withSystem,
    temperature,
    max_tokens: maxTokens,
    stream: streaming,
  };
  if (topP !== null) bodyObj.top_p = topP;
  if (topK !== null) bodyObj.top_k = topK;

  const body = JSON.stringify(bodyObj);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(streaming ? { Accept: "text/event-stream" } : {}),
      },
      body,
      signal: opts.signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") return;
    const msg = e instanceof Error ? e.message : String(e);
    opts.onError(friendlyError(msg));
    return;
  }

  if (!response.ok) {
    let body2 = "";
    try {
      body2 = await response.text();
    } catch {}
    opts.onError(friendlyError(`${response.status}: ${body2.slice(0, 200)}`));
    return;
  }

  if (streaming) {
    const reader = response.body?.getReader();
    if (!reader) {
      opts.onError("No response body received.");
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (Array.isArray(content)) {
              for (const part of content) {
                processContentPart(part, opts.onChunk, opts.onImageChunk);
              }
            } else if (typeof content === "string" && content) {
              opts.onChunk(content);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      opts.onError("Stream interrupted.");
      return;
    } finally {
      reader.releaseLock();
    }
  } else {
    try {
      const json = await response.json() as Record<string, unknown>;
      const choices = json?.choices as Array<{ message?: { content?: unknown } }> | undefined;
      const content = choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          processContentPart(part, opts.onChunk, opts.onImageChunk);
        }
      } else if (typeof content === "string" && content) {
        opts.onChunk(content);
      }
    } catch {
      opts.onError("Failed to parse response.");
      return;
    }
  }
  opts.onDone();
}

function friendlyError(raw: string): string {
  if (raw.includes("401") || raw.toLowerCase().includes("unauthorized")) {
    return "Invalid API key. Please check your settings.";
  }
  if (raw.includes("404") || raw.toLowerCase().includes("not found")) {
    return "Endpoint not found. Check your API Base URL.";
  }
  if (raw.includes("429") || raw.toLowerCase().includes("rate limit")) {
    return "Rate limit exceeded. Please wait and try again.";
  }
  if (raw.includes("500") || raw.includes("502") || raw.includes("503")) {
    return "Server error. The API is temporarily unavailable.";
  }
  if (
    raw.toLowerCase().includes("network") ||
    raw.toLowerCase().includes("fetch")
  ) {
    return "Network error. Check your connection and Base URL.";
  }
  if (raw.toLowerCase().includes("timeout")) {
    return "Request timed out. Please try again.";
  }
  if (raw.toLowerCase().includes("model")) {
    return "Model not found. Check your model name in settings.";
  }
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}
