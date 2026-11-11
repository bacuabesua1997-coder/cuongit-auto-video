import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VoiceStudioClient } from "./voicestudio-client.js";

const ORIGIN = "http://127.0.0.1:3900";
let tempDir = "";

function makeClient(overrides: Partial<ConstructorParameters<typeof VoiceStudioClient>[0]> = {}) {
  return new VoiceStudioClient({
    baseUrl: ORIGIN + "/v1",
    ...overrides,
  });
}

beforeEach(async () => {
  nock.cleanAll();
  tempDir = await mkdtemp(join(tmpdir(), "voicestudio-tts-"));
});

afterEach(async () => {
  nock.cleanAll();
  await rm(tempDir, { recursive: true, force: true });
});

describe("VoiceStudioClient", () => {
  it("sends Vietnamese TTS parameters and writes the returned MP3", async () => {
    const audio = Buffer.from("ID3-test-mp3-data");
    const scope = nock(ORIGIN)
      .post("/v1/audio/speech", (body) =>
        body.model === "omnivoice"
        && body.input === "Xin chào Việt Nam"
        && body.voice === "default"
        && body.language === "vi"
        && body.response_format === "mp3"
        && body.speed === 1,
      )
      .matchHeader("authorization", "Bearer local-test-key")
      .reply(200, audio, { "Content-Type": "audio/mpeg" });

    const output = join(tempDir, "voice.mp3");
    await makeClient({ apiKey: "local-test-key" }).generate("  Xin chào Việt Nam  ", output);

    expect(await readFile(output)).toEqual(audio);
    expect(scope.isDone()).toBe(true);
  });

  it("surfaces VoiceStudio authentication errors clearly", async () => {
    nock(ORIGIN)
      .post("/v1/audio/speech")
      .reply(401, {
        error: { message: "API key required" },
        detail: "API key required",
      }, { "Content-Type": "application/json" });

    await expect(
      makeClient({ apiKey: "wrong-key" }).generate("Xin chào", join(tempDir, "failed.mp3")),
    ).rejects.toThrow(/HTTP 401.*API key required/);
  });

  it("rejects empty or over-limit text before making a request", async () => {
    await expect(makeClient().generate("   ", join(tempDir, "empty.mp3")))
      .rejects.toThrow(/must not be empty/);
    await expect(makeClient().generate("x".repeat(4097), join(tempDir, "long.mp3")))
      .rejects.toThrow(/4096 characters/);
    expect(nock.pendingMocks()).toEqual([]);
  });

  it("rejects unsafe remote HTTP endpoints and invalid speed values", () => {
    expect(() => new VoiceStudioClient({
      baseUrl: "http://192.168.1.20:3900/v1",
      apiKey: "secret",
    })).toThrow(/must use HTTPS/);

    expect(() => new VoiceStudioClient({
      baseUrl: ORIGIN + "/v1",
      speed: 4.1,
    })).toThrow(/between 0.25 and 4.0/);
  });
});
