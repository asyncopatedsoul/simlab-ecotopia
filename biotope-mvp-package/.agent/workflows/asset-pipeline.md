# Workflow: Asset pipeline

How raw assets become ship-ready compressed bundles. Use this for any task that touches `content/scenarios/*/{scenes,audio,images}/` — and as the reference for `bd-auth.3` itself.

**Reads:**
- `docs/biotope-gtm.md` § 3 (Asset Production Pipeline) for the founder-vs-contractor split.
- `docs/biotope-mvp-planning.md` § 1 for asset budgets per scenario and per total install.

---

## Targets

| Format | Source | Shipped as | Reason |
|---|---|---|---|
| 3D models | glTF 2.0 (Blender export) | glTF + Draco mesh + KTX2 textures | 70-90% size reduction over raw glTF |
| Audio (VO) | WAV/AIFF 48kHz mono | Opus 96 kbps | 5-10× smaller than WAV with no perceptible loss for speech |
| Audio (music) | WAV/AIFF 48kHz stereo | Opus 128 kbps | Standard for ambient/music |
| Images (UI / illustration) | PNG/PSD | AVIF + WebP fallback | AVIF is ~50% smaller than WebP |
| Images (photographs) | JPEG | AVIF + WebP fallback | Same |
| Narrative | Ink (.ink) | Compiled .json | Runtime expects .json |

---

## Tooling

```bash
# 3D
npm install -g @gltf-transform/cli       # glTF compression + optimization
npm install -g gltfpack                   # alternative glTF compressor (meshopt)

# Textures (KTX2 / Basis Universal)
# Use the binary from KhronosGroup/KTX-Software releases:
# basisu, toktx, ktx tools

# Audio
brew install ffmpeg                       # for Opus encoding
brew install opus-tools                   # opusenc for fine control

# Images
npm install -g sharp-cli                  # for AVIF / WebP

# Ink
npm install -g inklecate                  # ink → json compiler
```

The pipeline orchestrator wraps these as `npm run build:scenario <slug>` (implementation lives at `tools/build-scenario.mjs`).

---

## 3D pipeline detail

### 1. Author in Blender

- Use real-world units (meters).
- Avoid quad ngons; triangulate before export.
- UV-unwrap textures cleanly.
- For animated characters: bake actions to NLA strips with single deformers — avoid IK chains in exported rigs.
- Material: Principled BSDF only. The Three.js glTF loader handles this; custom shader nodes don't survive export.

Export with the Khronos glTF 2.0 exporter:
- Format: glTF Binary (`.glb`).
- Include: Mesh, Materials, Textures, Animation.
- Compression: **none** at export time — let the pipeline compress.
- Apply modifiers: yes.

### 2. Compress

```bash
# Mesh: Draco compression
gltf-transform draco input.glb output.glb \
  --method edgebreaker \
  --quantize-position 14 \
  --quantize-normal 10 \
  --quantize-texcoord 12

# Textures: KTX2 with Basis Universal supercompression
gltf-transform ktx2 output.glb output.glb \
  --filter mitchell

# Optional: meshopt for additional savings
gltf-transform meshopt output.glb output.glb
```

Or use the wrapper:

```bash
npm run build:scenario backyard-bird-hour
```

### 3. Verify

- Visual diff: render the compressed mesh in the dev sandbox and compare side-by-side with the raw glTF. If quantization artifacts are visible, raise the quantize-position bits.
- Size check: target ≥70% reduction from raw glTF.
- Loader test: `useGLTF(path)` succeeds, animations play, materials render correctly.

---

## Audio pipeline detail

### Voice-over

```bash
# Source: 48kHz mono WAV
# Target: Opus 96 kbps mono

opusenc --bitrate 96 --vbr --discard-comments \
  source.wav target.opus
```

For warmth, apply a gentle compressor and 80Hz high-pass before encoding (Ableton, Audacity, or `sox`):

```bash
sox source.wav -b 16 -r 48000 source-prepped.wav \
  highpass 80 \
  compand 0.05,0.1 -90,-90,-70,-55,-50,-30,-30,-22,0,-15
opusenc --bitrate 96 --vbr source-prepped.wav target.opus
```

### Background ambient

```bash
# Stereo 128 kbps for music; mono 96 kbps for ambient if mono content
opusenc --bitrate 128 --vbr --music \
  ambient_morning.wav ambient_morning.opus
```

### iOS silent-mode considerations

The audio engine (`bd-engn.4`) routes correctly with iOS silent mode — audio still plays through headphones. This is a runtime concern, not an asset concern. Don't pre-bake "loud" or "quiet" variants of files.

---

## Image pipeline detail

### Source quality

- Photographs: shoot or source at 2x the maximum displayed size (retina).
- Illustration: export PNG at 2x maximum displayed size.
- Never include unused alpha channels.

### Compress

```bash
# AVIF (preferred): smaller, modern
sharp source.png \
  --avif quality=70 \
  -o target.avif

# WebP fallback: broader compatibility
sharp source.png \
  --webp quality=80 \
  -o target.webp
```

The runtime serves AVIF where supported, WebP elsewhere. Ship both.

### Sizing rules

- Thumbnails: 256×256 max.
- In-scene illustrations: 1024×1024 max.
- Photographs in fact cards: 1280×1280 max.
- Hero / cover art: 2048×2048 max.

---

## Narrative pipeline detail

```bash
# Compile Ink to JSON
inklecate -o narrative/en.json narrative/en.ink

# The runtime loads en.json. en.ink is source-only.
```

Validate that every Ink node referenced by the manifest exists:

```bash
npx biotope-validate ./content/scenarios/<slug>
```

---

## Budget enforcement

Every scenario declares `assets.total_size_max_mb` in its manifest. The pipeline aggregates all bundle sizes and refuses to ship if over:

```bash
npm run build:scenario backyard-bird-hour --strict
# Fails the build if ≤ budget isn't met.
```

The aggregate install budget is ≤250MB (per `docs/biotope-mvp-planning.md` § 1). If a scenario is at risk of overshooting, options in order of preference:

1. **Reduce 3D mesh density.** Most scenes have 2-5× more polygons than they need. Use Blender's Decimate modifier.
2. **Lower KTX2 quality.** Drop `--quality` from default 128 down to 96 or 64 for non-hero textures.
3. **Drop a non-essential asset.** A 4th bird is cheaper to remove than a hero animation to compress.
4. **Move to streaming.** Ship a placeholder, fetch the heavy asset on first scenario launch.

Streaming is a last resort because it breaks the cold-offline guarantee. If you need to ship streaming, file a `bd-engn` issue first to add streaming-fetch + cache logic.

---

## Validation pipeline (the full check)

Before any scenario commit:

```bash
npx biotope-validate ./content/scenarios/<slug>
```

This runs:

- Manifest schema validation (zod).
- Cross-reference: all Ink nodes referenced by the manifest exist.
- Cross-reference: all assets referenced exist.
- Per-rung dry-run: walks the loop for every declared (rung, mode) and verifies no path errors.
- Asset budget check.
- License audit: every asset has a license entry; no CC-BY-NC; no unlicensed.
- Localization completeness: all `languages_available` have all required Ink nodes.

If any check fails, the validator prints actionable error messages with line numbers and asset paths. Fix and re-run.

---

## License manifest

Every shipped asset is logged in `content/scenarios/<slug>/LICENSES.json`:

```json
{
  "scenes/backyard_morning.glb": {
    "creator": "Mike Garrido",
    "license": "proprietary",
    "year": 2026
  },
  "audio/birds/american_robin.opus": {
    "creator": "Macaulay Library / Cornell Lab of Ornithology",
    "source_url": "https://...",
    "license": "CC-BY-NC-4.0",
    "REJECTED_REASON": "CC-BY-NC incompatible with Hybrid Subscription"
  }
}
```

Never ship an asset whose license entry is `proprietary` without permission, or whose license is incompatible with the commercial Hybrid tier. The validator enforces this; manual auditing reinforces it.

---

## Working with contractors

Per the GTM doc, ~25% of production assets come from contractors:

- **Hero rigged 3D animation:** spec sheet on the founder side describes pose, rig, animation states. Contractor delivers Blender file. Pipeline above applies as normal.
- **Final voice-over:** contractor delivers WAV. Pipeline applies as normal.
- **Original score / anchor music cues:** contractor delivers WAV. Pipeline applies as normal.

Contracted assets follow the same path. The pipeline doesn't know or care who authored the source. License manifest entry must reflect the contract terms (typically work-for-hire = `proprietary`, owned by Lights Out Games).

---

## Common failure modes

- **Texture quantization artifacts:** raise quantize-position bits, or reduce KTX2 compression aggression.
- **Animation jitters after Draco:** Draco can break tightly-keyed animations. Try `gltfpack -kn` (keep node hierarchy) or skip Draco on animation-heavy meshes.
- **iOS Safari can't decode AVIF:** that's why we ship WebP fallback. Verify the runtime serves WebP to Safari < 16.
- **Opus VO sounds harsh on phone speakers:** check the source — are you encoding from a 22kHz source instead of 48kHz? Re-encode from a higher-rate source.
- **Cold-load too slow:** the bundle is being decoded on the main thread. Verify the `ScenarioBundleLoader` (per `bd-engn.3`) is using a Web Worker for verification + decompression.
