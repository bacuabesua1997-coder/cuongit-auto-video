import axios from "axios";
import { writeFile } from "node:fs/promises";
import type { TtsClient } from "./tts-client.js";

export interface VoiceStudioOpts {
  /** VoiceStudio OpenAI-compatible base URL, including /v1. */
  baseUrl: string;
  /** Optional only for remote/server-mode instances. Loopback needs no key. */
  apiKey?: string;
  /** VoiceStudio engine ID. OmniVoice is the broad-language default. */
  model?: string;
  /** Saved voice-profile ID/name, or "default". */
  voice?: string;
  /** ISO 639-1 language code. */
  language?: string;
  /** VoiceStudio accepts 0.25–4.0. */
  speed?: number;
  /** Client-side timeout. The VoiceStudio server has its own generation timeout. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_INPUT_CHARS = 4096;

function normalizeBaseUrl(value: string, apiKey?: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VoiceStudio baseUrl must be a valid absolute HTTP(S) URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VoiceStudio baseUrl must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Do not put credentials in the VoiceStudio URL; use VOICESTUDIO_API_KEY");
  }

  const host = url.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (!isLoopback && url.protocol !== "https:") {
    throw new Error("Remote VoiceStudio endpoints must use HTTPS to protect audio and credentials");
  }
  if (!isLoopback && !apiKey) {
    throw new Error("Remote VoiceStudio endpoints require VOICESTUDIO_API_KEY");
  }

  return url.toString().replace(/\/+$/, "");
}

function errorMessageFromBody(data: unknown): string | undefined {
  let raw: string | undefined;

  if (Buffer.isBuffer(data)) {
    raw = data.toString("utf8");
  } else if (data instanceof ArrayBuffer) {
    raw = Buffer.from(data).toString("utf8");
  } else if (typeof data === "string") {
    raw = data;
  } else if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    const error = body.error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail.trim();
  }

  if (!raw || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const error = parsed.error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
  } catch {
    // A non-JSON error body is returned as a short diagnostic below.
  }
  return raw.trim().slice(0, 500);
}

/**
 * Optional adapter for a separately installed, local VoiceStudio instance.
 *
 * This class is deliberately not registered in createTtsClient yet. It can be
 * smoke-tested independently before becoming a production provider.
 * VoiceStudio's OpenAI-compatible speech endpoint returns audio but no SRT.
 */
export class VoiceStudioClient implements TtsClient {
  private readonly baseUrl: string;

  constructor(private readonly cfg: VoiceStudioOpts) {
    this.baseUrl = normalizeBaseUrl(cfg.baseUrl, cfg.apiKey);
    const speed = cfg.speed ?? 1;
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) {
      throw new Error("VoiceStudio speed must be between 0.25 and 4.0");
    }
    if (cfg.timeoutMs !== undefined && (!Number.isFinite(cfg.timeoutMs) || cfg.timeoutMs <= 0)) {
      throw new Error("VoiceStudio timeoutMs must be a positive number");
    }
  }

  async generate(text: string, audioOutPath: string, _srtOutPath?: string): Promise<void> {
    const input = text.trim();
    if (!input) throw new Error("VoiceStudio TTS input must not be empty");
    if (input.length > MAX_INPUT_CHARS) {
      throw new Error("VoiceStudio accepts at most " + MAX_INPUT_CHARS + " characters per request; split the text into shorter scenes");
    }

    try {
      const response = await axios.post<ArrayBuffer>(
        this.baseUrl + "/audio/speech",
        {
          model: this.cfg.model ?? "omnivoice",
          input,
          voice: this.cfg.voice ?? "default",
          response_format: "mp3",
          speed: this.cfg.speed ?? 1,
          language: this.cfg.language ?? "vi",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
            ...(this.cfg.apiKey ? { Authorization: "Bearer " + this.cfg.apiKey } : {}),
          },
          responseType: "arraybuffer",
          timeout: this.cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        },
      );

      const audio = Buffer.from(response.data);
      if (audio.length === 0) throw new Error("VoiceStudio returned an empty audio file");

      const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
      if (contentType.includes("application/json")) {
        const detail = errorMessageFromBody(audio) ?? "unexpected JSON response";
        throw new Error("VoiceStudio returned JSON instead of audio: " + detail);
      }

      await writeFile(audioOutPath, audio);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = errorMessageFromBody(error.response?.data) ?? error.message;
        const code = status ? "HTTP " + status : (error.code ?? "network error");
        throw new Error("VoiceStudio TTS failed (" + code + "): " + detail);
      }
      throw error;
    }
  }
}
