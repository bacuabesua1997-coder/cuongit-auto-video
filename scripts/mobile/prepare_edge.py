"""Generate real free Edge speech, then let the unchanged original pipeline reuse it.

edge-tts-universal 1.4.0 uses the old v1 handshake and can exit successfully
without audio after a failed WebSocket open. This CI adapter uses maintained
edge-tts 7.3.1 (v2); no paid TTS provider or alternate video engine is involved.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

VOICES = {"vi-VN-NamMinhNeural", "vi-VN-HoaiMyNeural"}


def validate_scenes(data):
    scenes = data.get("scenes", [])
    if not isinstance(scenes, list) or not 5 <= len(scenes) <= 8:
        raise ValueError("Expected 5–8 scenes validated with the original ScriptSchema.")
    seen = set()
    for scene in scenes:
        name, text = scene.get("id"), scene.get("voiceText")
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", name) or name in seen:
            raise ValueError("Scene IDs must be unique and contain only letters, numbers, hyphens or underscores.")
        if not isinstance(text, str) or not text.strip() or len(text) > 1600:
            raise ValueError("Each scene needs non-empty voiceText of at most 1600 characters.")
        seen.add(name)
    return scenes


async def synthesize_scene(text, voice, destination):
    import edge_tts
    import aiohttp

    partial = destination.with_suffix(".mp3.part")
    srt = destination.with_suffix(".srt")
    subtitle_part = srt.with_suffix(".srt.part")
    for attempt in range(3):
        try:
            async def transfer():
                subtitles = edge_tts.SubMaker()
                client = edge_tts.Communicate(
                    text, voice, boundary="WordBoundary", connect_timeout=15, receive_timeout=45,
                    proxy=os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy"),
                )
                with partial.open("wb") as output:
                    async for chunk in client.stream():
                        if chunk["type"] == "audio":
                            output.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            subtitles.feed(chunk)
                if partial.stat().st_size < 100:
                    raise edge_tts.exceptions.NoAudioReceived("Empty speech audio.")
                subtitle_part.write_text(subtitles.get_srt(), encoding="utf-8")
            await asyncio.wait_for(transfer(), timeout=90)
            partial.replace(destination)
            subtitle_part.replace(srt)
            return destination.stat().st_size
        except (aiohttp.ClientError, asyncio.TimeoutError, edge_tts.exceptions.EdgeTTSException) as error:
            # Never print provider URLs, handshake tokens or a raw exception/body.
            status = getattr(error, "status", None)
            label = f"HTTP {status}" if isinstance(status, int) else type(error).__name__
            print(f"Edge TTS: {label}; attempt {attempt + 1}/3", flush=True)
            if attempt == 2:
                raise RuntimeError("Free Edge TTS could not return speech. Retry the workflow later.") from None
            await asyncio.sleep(2 ** (attempt + 1))
        finally:
            partial.unlink(missing_ok=True)
            subtitle_part.unlink(missing_ok=True)


async def prepare(script_path):
    data = json.loads(script_path.read_text(encoding="utf-8"))
    scenes = validate_scenes(data)
    voice = os.environ.get("EDGE_TTS_VOICE", "vi-VN-NamMinhNeural")
    if voice not in VOICES:
        raise ValueError("Choose one of the supported Vietnamese Edge voices.")
    directory = script_path.parent / "voice"
    directory.mkdir(parents=True, exist_ok=True)
    report = {"provider": "Microsoft Edge TTS (free)", "client": "edge-tts 7.3.1", "voice": voice, "scenes": []}
    for scene in scenes:
        size = await synthesize_scene(scene["voiceText"], voice, directory / f"scene-{scene['id']}.mp3")
        report["scenes"].append({"id": scene["id"], "audioBytes": size})
        print(f"Real Edge speech ready: {scene['id']} ({size} bytes)", flush=True)
    (script_path.parent / "edge-tts-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        asyncio.run(prepare(Path(sys.argv[1])))
    except (OSError, ValueError, RuntimeError, IndexError) as error:
        print("Edge TTS preparation failed: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
