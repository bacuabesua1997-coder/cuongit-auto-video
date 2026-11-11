# AI Affiliate Studio — Implementation Plan

## Decision

Build Affiliate Studio as an upgrade to the existing `cuongit-auto-video` repository. Do not create a second rendering engine or merge three repositories wholesale.

- Primary project: `cuongit-auto-video`
- Working branch: `feature/affiliate-studio`
- Existing renderer: HyperFrames + FFmpeg (reuse after validating local-video support)
- Existing TTS: Edge TTS as zero-cost default; retain existing optional providers
- Motion design references: Huashu Motion (MIT) and Video Shotcraft (Apache-2.0), selectively adapt patterns/recipes; do not run duplicate renderers in MVP
- Motion Video Kit (MIT): optional quality/directing reference, not a required runtime dependency

## Product goal

Input one affiliate product plus seller-provided photos/videos. Generate three distinct short-form edits:

1. Review / experience-led
2. Cinematic product commercial
3. Direct-response sales video

Default output: MP4, vertical 9:16, 1080x1920, 20–60 seconds. Generate caption and hashtags as separate editable text.

## Non-negotiable visual integrity rules

1. Seller-provided assets are the only source for depictions of the actual product in MVP.
2. Every scene that shows the product must reference an asset ID belonging to the current product.
3. Never use unrelated stock footage, unrelated product footage, or arbitrary web search results as fallback.
4. Never invent product colors, dimensions, components, use cases, functions, performance, warranty, price, or customer testimonials.
5. If a scene has no verified matching asset, use typography, diagrams, simple graphic treatment, or a close-up/crop of a verified seller asset. Otherwise block the scene and ask for a suitable asset.
6. AI may classify and suggest assets, but uncertain matches must be flagged for human review.
7. Preserve the original seller asset; all crop, trim, overlay, and transcode operations are non-destructive.
8. Keep asset source, uploader, file hash, and any usage permission note in the project record.

## Proposed modules

- `product-manager`: product record, URL, SKU, seller facts, price snapshot and source notes
- `asset-manager`: multi-file image/video upload, metadata, thumbnails, duration, dimensions, file hash
- `asset-understanding`: image/video keyframe inspection, product identity and scene-content labels
- `claim-grounding`: map every factual claim to seller-provided product facts; mark unsupported claims
- `script-writer`: create three different scripts with hook, proof/demo, benefit, objection handling and CTA
- `storyboard`: scene timing, narration, on-screen text, asset IDs, crop/trim and transition instructions
- `asset-matcher`: enforce product ID lock and scene-to-asset relevance; no random fallback
- `video-renderer`: reuse existing HyperFrames/FFmpeg pipeline where compatible; add real local video clip support
- `voice-generator`: reuse existing TTS adapters
- `quality-control`: verify visual relevance, product consistency, factual claims, audio, subtitles, aspect ratio and render integrity
- `export-manager`: MP4, caption, hashtags, thumbnail and editable project package

## Data model additions

Keep existing news-video schema backward compatible. Add separate affiliate project entities:

- Product: id, title, category, sellerUrl, sku, approvedFacts[], restrictedClaims[], price, priceCheckedAt
- Asset: id, productId, filePath, mediaType, sha256, duration, width, height, source, usagePermission, tags[], detectedObjects[], confidence, reviewStatus
- Scene: id, projectId, versionType, voiceText, onScreenText[], duration, assetIds[], crop, trimIn, trimOut, transition, claimRefs[]
- VideoProject: id, productId, status, selectedStyle, scenes[], outputs[], approvalStatus

Do not store API keys or secrets in project JSON, logs, or Git.

## Three editing profiles

### Review
- Human-sounding narration and product close-ups
- Use only real seller demonstration footage for demonstrations
- Avoid first-person claims such as "I used this" unless the user supplies a genuine testimonial

### Cinematic
- Product hero shots, close-ups, kinetic typography, controlled transitions and sound design
- Effects may enhance seller assets but must not alter product identity or create fake capabilities

### Direct response
- Problem → product → verified benefit → CTA
- Urgent pricing, discounts, scarcity and guarantees only when supported by a current source and timestamp

All three versions must use different edit decisions, not merely recolor the same template.

## Implementation phases

### Phase 0 — Audit and safety baseline
- Run current unit tests and typecheck.
- Inspect current HyperFrames capabilities for local MP4/video scenes.
- Document current render limitations and environment requirements.
- Keep existing news pipeline behavior unchanged.

### Phase 1 — Product and asset workspace
- Add product CRUD.
- Add multi-image and multi-video upload.
- Generate thumbnails and technical metadata.
- Add asset review UI and product ownership lock.
- Do not add public scraping of private TikTok Shop pages; allow manual facts and seller files when a product URL cannot be read.

### Phase 2 — Product facts and scripts
- Extract only verifiable product facts from accessible product pages and seller-supplied text.
- Create claim ledger: claim, evidence, source, checked time, status.
- Generate three scripts.
- Reject unsupported claims or ask for missing information.

### Phase 3 — Storyboard and matching
- Generate per-scene visual brief and asset candidates.
- Match each scene only to assets with the same productId.
- Use vision inspection on keyframes when a vision provider is configured.
- Require manual review when confidence is below the configured threshold.
- Provide storyboard preview before rendering.

### Phase 4 — Video production
- Implement local MP4 scene playback/trim/crop in the chosen renderer.
- Reuse existing TTS and SFX components.
- Add three editing profiles using selected Huashu/Shotcraft motion patterns.
- Export draft and final 9:16 MP4s.

### Phase 5 — Quality control and library
- Check scene-to-asset match and product identity.
- Check claim ledger against narration and on-screen text.
- Check audio duration, subtitle timing, black frames, missing assets, output dimensions and codec.
- Store project, source assets, versions and outputs.
- Add analytics only after core production is reliable.

## Acceptance criteria for the first MVP

Using one real product and seller-provided files:

- Upload at least 5 product photos and 3 seller videos.
- Every asset is assigned to the correct product.
- Generate three meaningfully different scripts and storyboards.
- Every product scene references one or more approved asset IDs.
- No unrelated footage is inserted.
- Unverified claims are blocked or flagged.
- User can approve/edit the storyboard before final render.
- Export three playable MP4 files at 1080x1920.
- Produce caption and hashtags for each version.
- Existing news-video tests and pipeline continue to pass.

## Cost and provider policy

- Default to local processing, FFmpeg and Edge TTS.
- Vision/LLM providers must be adapter-based and opt-in.
- Never make paid API calls without explicit approval.
- Show estimated cost before any paid generation.
- A missing AI provider must not silently substitute unrelated assets.

## Immediate next engineering tasks

1. Run `npm ci`, `npm test`, and `npm run typecheck` in a local Codex workspace.
2. Inspect HyperFrames local-video support and decide whether it can render source MP4 clips directly.
3. Add product/asset data model and upload UI.
4. Add a test that proves a scene cannot reference an asset from another product.
5. Add a test that proves missing matching assets block render instead of falling back to random media.

## Explicitly out of scope for MVP

- Automatic TikTok publishing
- Scraping private or login-protected seller content
- Downloading third-party copyrighted product videos without permission
- Fake reviews, fake testimonials, fabricated demonstrations
- Automated ad spend or affiliate campaign management
