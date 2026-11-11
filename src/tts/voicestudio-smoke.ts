import { config as loadEnv } from "dotenv";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { VoiceStudioClient } from "./voicestudio-client.js";

loadEnv({ path: ".env.local" });

const text = process.argv.slice(2).join(" ").trim()
  || "Xin chào. Đây là bản kiểm tra giọng đọc tiếng Việt bằng VoiceStudio. Chúng ta đang thử nghiệm chất lượng phát âm, nhịp đọc và độ tự nhiên của giọng nói.";

const outputDir = join(process.cwd(), "output", "voicestudio-poc");
const outputPath = join(outputDir, "voice.mp3");

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(name + " must be a number");
  return value;
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const client = new VoiceStudioClient({
    baseUrl: process.env.VOICESTUDIO_URL ?? "http://127.0.0.1:3900/v1",
    apiKey: process.env.VOICESTUDIO_API_KEY || undefined,
    model: process.env.VOICESTUDIO_MODEL ?? "omnivoice",
    voice: process.env.VOICESTUDIO_VOICE ?? "default",
    language: process.env.VOICESTUDIO_LANGUAGE ?? "vi",
    speed: numberFromEnv("VOICESTUDIO_SPEED", 1),
    timeoutMs: numberFromEnv("VOICESTUDIO_TIMEOUT_MS", 600_000),
  });

  console.log("Generating Vietnamese speech with VoiceStudio...");
  console.log("Model: " + (process.env.VOICESTUDIO_MODEL ?? "omnivoice"));
  console.log("Voice: " + (process.env.VOICESTUDIO_VOICE ?? "default"));
  await client.generate(text, outputPath);
  console.log("Done: " + outputPath);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
