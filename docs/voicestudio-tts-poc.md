# VoiceStudio TTS — isolated proof of concept

**Status:** experimental adapter and mocked contract tests only. This is not registered in the production TTS factory and does not change the default Edge TTS pipeline.

## What this tests

- A separate VoiceStudio desktop installation exposes an OpenAI-compatible local API.
- This project sends Vietnamese text to POST /v1/audio/speech.
- The returned MP3 is saved under output/voicestudio-poc/voice.mp3.
- The adapter uses the existing TtsClient interface but is not yet selectable from TTS_PROVIDER.
- SRT is not produced by this endpoint; the adapter intentionally leaves the optional SRT path untouched.

## Windows setup

1. Use Windows 10/11 x64 and install VoiceStudio from the official GitHub Releases:
   https://github.com/debpalash/VoiceStudio/releases/latest
   Verify the installer against the release's SHA256SUMS.txt.
2. Allow the app to complete its first-run setup. The current Windows guide lists about 10 GB free disk as a practical baseline; model and optional engine downloads need additional space.
3. Open Model Catalogue and make sure the OmniVoice TTS weights are installed before the first smoke test. The first generation can spend several minutes downloading multi-GB weights and may hit the server's own generation timeout.
4. Keep the service local. The default loopback API at 127.0.0.1:3900 needs no API key. Do not enable LAN sharing for this test.
5. In this repository, copy the optional settings below into .env.local:

    VOICESTUDIO_URL=http://127.0.0.1:3900/v1
    VOICESTUDIO_MODEL=omnivoice
    VOICESTUDIO_VOICE=default
    VOICESTUDIO_LANGUAGE=vi
    VOICESTUDIO_SPEED=1.0
    VOICESTUDIO_TIMEOUT_MS=600000
    # Only set this when using a remote VoiceStudio server over HTTPS:
    # VOICESTUDIO_API_KEY=your_server_api_key

6. Start the app and run:

    npm run tts:voicestudio:smoke

You can pass a different short Vietnamese sample:

    npm run tts:voicestudio:smoke -- "Đây là câu thử nghiệm giọng đọc tiếng Việt."

The result should be written to output/voicestudio-poc/voice.mp3.

## Model and voice selection

- Start with omnivoice: it is the default engine and has the broadest language coverage, including Vietnamese.
- After the baseline test, install VoxCPM2 in VoiceStudio and try VOICESTUDIO_MODEL=voxcpm2. Its published engine guide lists Vietnamese among its 30 supported languages.
- VOICESTUDIO_VOICE accepts default or a saved VoiceStudio voice-profile ID/name. Create a cloned voice profile in the VoiceStudio UI first if you want to test voice cloning.
- VOICESTUDIO_LANGUAGE=vi selects Vietnamese. Language selection guides synthesis; it does not translate the text.

## Run automated checks

    npm test
    npm run typecheck

The unit tests mock the HTTP API. They verify request fields, MP3 writing, authentication-error reporting, text limits, and endpoint safety. They do not prove that the VoiceStudio app or a GPU model works on a particular Windows PC.

## Important constraints

- VoiceStudio's OpenAI-compatible request accepts up to 4096 input characters. Keep narration in shorter scenes.
- The endpoint returns audio, not SRT. Compare subtitle generation separately before considering production integration.
- The client does not retry failed POST requests; a retry could start duplicate GPU work.
- The client defaults to loopback. Remote HTTP is rejected; remote access requires HTTPS and an API key.
- OmniVoice's published guide recommends around 6 GB dedicated VRAM for accelerated generation. CPU is supported but can be much slower. On first run, install the model weights in the app before timing the generation.

## Licensing and distribution

VoiceStudio is licensed under AGPL-3.0-only. Its license notice permits commercial use of the application under AGPL terms, but modified network-accessible versions must offer corresponding source code. The POC communicates with the separately installed app over its documented HTTP API and does not copy VoiceStudio source. Before bundling, redistributing, or embedding VoiceStudio in a closed-source product, obtain a proper license review; do not package it as a proprietary dependency by assumption.

## Acceptance checklist for the real Windows test

- [ ] VoiceStudio starts and its local API responds.
- [ ] OmniVoice model weights are installed and available.
- [ ] Vietnamese MP3 is generated successfully.
- [ ] Pronunciation of Vietnamese diacritics and numbers is acceptable.
- [ ] Compare female/male or cloned voice profiles.
- [ ] Measure cold-start and warm-generation time.
- [ ] Compare audio quality against the existing Edge TTS and Vbee outputs.
- [ ] Confirm that missing SRT does not break the intended subtitle workflow.

Only after this checklist passes should the provider be added to the production TTS selector.
