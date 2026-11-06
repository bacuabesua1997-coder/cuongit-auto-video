import asyncio
import importlib.util
import io
import json
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import AsyncMock, patch

spec = importlib.util.spec_from_file_location("prepare_edge", Path(__file__).with_name("prepare_edge.py"))
edge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edge)


class ProviderError(Exception):
    pass


class Subtitles:
    def __init__(self):
        self.words = []

    def feed(self, chunk):
        self.words.append(chunk["text"])

    def get_srt(self):
        return "1\n00:00:00,000 --> 00:00:01,000\n" + " ".join(self.words) + "\n"


class EdgePreparationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.destination = Path(self.temporary.name) / "scene-hook.mp3"
        self.attempts = 0
        self.failures = 0

        def communicate(text, voice, **options):
            self.attempts += 1
            self.options = options
            should_fail = self.attempts <= self.failures

            async def stream():
                yield {"type": "audio", "data": b"test audio" * 20}
                if should_fail:
                    raise ProviderError("private-token-in-provider-url")
                yield {"type": "WordBoundary", "text": "Xin chào", "offset": 0, "duration": 10_000_000}
            return types.SimpleNamespace(stream=stream)

        fake = types.SimpleNamespace(Communicate=communicate, SubMaker=Subtitles,
                                     exceptions=types.SimpleNamespace(EdgeTTSException=ProviderError, NoAudioReceived=ProviderError))
        modules = patch.dict(sys.modules, {"edge_tts": fake, "aiohttp": types.SimpleNamespace(ClientError=ProviderError)})
        modules.start()
        self.addCleanup(modules.stop)
        sleeping = patch.object(edge.asyncio, "sleep", new_callable=AsyncMock)
        self.sleep = sleeping.start()
        self.addCleanup(sleeping.stop)

    async def test_writes_audio_and_real_boundary_subtitles_atomically(self):
        self.destination.write_bytes(b"old narration")
        size = await edge.synthesize_scene("Xin chào", "vi-VN-NamMinhNeural", self.destination)
        self.assertEqual(size, 200)
        self.assertIn("Xin chào", self.destination.with_suffix('.srt').read_text())
        self.assertEqual(self.options['boundary'], 'WordBoundary')
        self.assertFalse(self.destination.with_suffix('.mp3.part').exists())

    async def test_network_failure_retries_then_replaces_partial_audio(self):
        self.failures = 1
        log = io.StringIO()
        with redirect_stdout(log):
            await edge.synthesize_scene("Xin chào", "vi-VN-HoaiMyNeural", self.destination)
        self.assertEqual(self.attempts, 2)
        self.assertEqual(self.destination.stat().st_size, 200)
        self.assertNotIn("private-token", log.getvalue())
        self.sleep.assert_awaited_once_with(2)

    async def test_failure_cannot_create_fake_success_or_leave_partial_files(self):
        self.failures = 5
        with redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
            await edge.synthesize_scene("Xin chào", "vi-VN-HoaiMyNeural", self.destination)
        self.assertEqual(self.attempts, 3)
        self.assertEqual(list(self.destination.parent.iterdir()), [])

    def test_scene_ids_cannot_escape_the_original_voice_directory(self):
        data = json.loads(Path('tests/fixtures/sample-script-no-image.json').read_text())
        self.assertEqual(len(edge.validate_scenes(data)), 5)
        for bad in ['../../outside', 'a/b', 'body-1']:
            data['scenes'][0]['id'] = bad
            with self.assertRaises(ValueError):
                edge.validate_scenes(data)

    async def test_empty_or_invalid_script_fails_before_service_calls(self):
        path = self.destination.parent / 'script.json'
        path.write_text('{"scenes": []}')
        with self.assertRaises(ValueError):
            await edge.prepare(path)
        self.assertEqual(self.attempts, 0)


if __name__ == '__main__':
    unittest.main()
