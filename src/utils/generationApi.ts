import type { GeneratedMedia, Settings } from "@/types";

const IMAGE_GEN_PATTERNS = [
  /dall-e/i,
  /stable[-_\s]diffusion/i,
  /\bsd[-_]?xl\b/i,
  /\bsdxl\b/i,
  /flux/i,
  /playground[-_\s]v/i,
  /ideogram/i,
  /imagen/i,
  /wuerstchen/i,
  /kandinsky/i,
  /deepfloyd/i,
  /aura[-_\s]flow/i,
];

const VIDEO_GEN_PATTERNS = [
  /runway/i,
  /kling/i,
  /\bwan\b/i,
  /wan2/i,
  /hailuo/i,
  /\bveo\b/i,
  /\bsora\b/i,
  /cogvideox/i,
  /pika[-_\s]video/i,
  /luma[-_\s]dream/i,
  /\bluma\b/i,
  /animate[-_\s]diff/i,
  /modelscope/i,
];

export function detectImageGenModel(model: string): boolean {
  const m = model.trim();
  return IMAGE_GEN_PATTERNS.some((re) => re.test(m));
}

export function detectVideoGenModel(model: string): boolean {
  const m = model.trim();
  return VIDEO_GEN_PATTERNS.some((re) => re.test(m));
}

export interface ImageGenOptions {
  prompt: string;
  size: string;
  quality: "standard" | "hd";
  n: number;
  style: "vivid" | "natural";
}

export interface VideoGenOptions {
  prompt: string;
  duration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
}

export async function generateImage(
  settings: Settings,
  options: ImageGenOptions,
  signal?: AbortSignal
): Promise<GeneratedMedia[]> {
  const url = settings.baseUrl.replace(/\/$/, "") + "/images/generations";

  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: options.prompt,
    n: options.n,
    size: options.size,
    response_format: "url",
  };
  if (options.quality !== "standard") body.quality = options.quality;
  if (options.style !== "vivid") body.style = options.style;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new Error(
      `Network error: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Generation failed (${res.status}): ${text.slice(0, 240)}`
    );
  }

  const json = (await res.json()) as {
    data?: Array<{
      url?: string;
      b64_json?: string;
      revised_prompt?: string;
    }>;
  };

  const data = json.data ?? [];
  return data.map((item) => ({
    type: "image" as const,
    url:
      item.url ??
      (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ""),
    prompt: options.prompt,
    revisedPrompt: item.revised_prompt,
    model: settings.model,
  }));
}

export async function generateVideo(
  settings: Settings,
  options: VideoGenOptions,
  signal?: AbortSignal
): Promise<GeneratedMedia> {
  const url = settings.baseUrl.replace(/\/$/, "") + "/videos/generations";

  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: options.prompt,
    duration: options.duration,
    aspect_ratio: options.aspectRatio,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new Error(
      `Network error: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Video generation failed (${res.status}): ${text.slice(0, 240)}`
    );
  }

  const json = (await res.json()) as Record<string, unknown>;
  const first =
    Array.isArray(json.data)
      ? (json.data[0] as Record<string, unknown>)
      : json;
  const videoUrl = String(
    first.url ?? first.video_url ?? first.output_url ?? ""
  );

  return {
    type: "video" as const,
    url: videoUrl,
    prompt: options.prompt,
    model: settings.model,
  };
}
