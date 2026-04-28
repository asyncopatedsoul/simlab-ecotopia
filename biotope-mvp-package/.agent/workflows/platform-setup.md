# Workflow: Platform setup

End-to-end playbook for the foundation issues (`bd-plat.*` and the early `bd-engn.*`). After this workflow, you have a Vite + React + R3F PWA installable on iOS and Android, with offline storage, asset loading, audio, and privacy defaults wired up. No scenarios yet — that's the next workflow.

**Reads:**
- `docs/biotope-design.md` § 7 (Component Matrix) for the canonical tech choices.
- `docs/biotope-mvp-planning.md` § 1 for what's in/out of MVP.

**Issues this covers:** `bd-plat.1, .2, .3, .4, .5`, then `bd-engn.1, .3, .4`.

---

## Phase 1: project scaffold (`bd-plat.1`)

```bash
bd update bd-plat.1 --claim

# Vite + React + TS
npm create vite@latest biotope -- --template react-ts
cd biotope

# Workspace structure
mkdir -p app engine content tools docs
mv src app/

# Strict TS, path aliases, prettier
npm install -D prettier eslint @typescript-eslint/{parser,eslint-plugin}
npm install -D vite-tsconfig-paths
```

Update `tsconfig.json` to strict, set up path aliases (`@app/*`, `@engine/*`, `@content/*`, `@tools/*`).

```bash
# Verify
npm run dev    # should boot in <2s
npm run build  # should produce a static bundle

# Acceptance:
#   - dev cold reload <2s
#   - build succeeds
#   - tsc --noEmit passes with strict mode

bd close bd-plat.1 --reason "Acceptance met. Vite scaffold, strict TS, path aliases, lints clean."
git add . && git commit -m "Vite + React + TS scaffold (bd-plat.1)" && git push
```

---

## Phase 2: PWA + service worker (`bd-plat.2`)

```bash
bd update bd-plat.2 --claim

npm install -D vite-plugin-pwa
```

Configure `vite.config.ts` with `VitePWA` plugin. Workbox config:

- **Precache:** the app shell (HTML/CSS/JS).
- **Runtime cache:** scenario assets (cache-first), API stubs (network-first with offline fallback).
- **Manifest:** name "Biotope", short_name "Biotope", display "standalone", theme_color matching brand.

Generate icons (1024px → all required sizes) — for now use a placeholder; final hero creative comes via the GTM doc's contractor budget.

```bash
# Verify offline mode:
#   1. npm run build && npx serve dist
#   2. Open in Chrome, install to homescreen
#   3. DevTools → Network → Offline
#   4. Reload — app still works

# Acceptance:
#   - installs to homescreen on iOS Safari + Android Chrome
#   - offline reload works after first install
#   - Lighthouse PWA audit ≥90

bd close bd-plat.2 --reason "PWA installable, offline-first cache strategy works, Lighthouse 92."
git commit -am "PWA shell + Workbox service worker (bd-plat.2)" && git push
```

---

## Phase 3: storage layer (`bd-plat.4`)

`bd-plat.4` runs in parallel with `bd-plat.2` — pick whichever you want first.

```bash
bd update bd-plat.4 --claim

npm install dexie idb
npm install sqlocal             # SQLite-WASM via OPFS
```

Implement a single `Storage` facade in `engine/storage/` with three backing stores:

```ts
// engine/storage/index.ts
export interface Storage {
  // Dexie-backed (small, queryable, structured app state)
  state: StateStore;

  // OPFS-backed (large blobs, scenario asset bundles)
  blobs: BlobStore;

  // sqlocal-backed (queryable species data, region packs)
  species: SpeciesStore;
}
```

Add a quota observer that fires at 80% utilization. Request `navigator.storage.persist()` at first scenario load (NOT app launch).

```bash
# Acceptance:
#   - 50MB blob round-trip via OPFS in <500ms on a real tablet
#   - 10K-row species query in <50ms
#   - quota observer fires at 80%

bd close bd-plat.4 --reason "Three-store facade. Benchmarks pass on iPad 9th gen."
git commit -am "Three-store offline storage layer (bd-plat.4)" && git push
```

---

## Phase 4: privacy defaults (`bd-plat.5`)

```bash
bd update bd-plat.5 --claim
```

Build the `PermissionRequester` component that wraps every OS-level permission prompt:

```tsx
<PermissionRequester
  permission="camera"
  explainer={<CameraExplainerNode />}
  onGranted={...}
  onDenied={...}
/>
```

Where `<CameraExplainerNode />` is an Ink-driven scene with illustration + voice-over. Ink stories for the explainers go in `content/permissions/en.ink`.

Set up a global `Privacy` context with current rules and audit them at every storage write:

```ts
const Privacy = {
  photoStorage: 'local_only',     // never 'cloud' in MVP
  voiceInput: 'off',
  locationPrecisionMeters: 100,   // round before any storage
  telemetry: 'off',
};
```

```bash
# Acceptance:
#   - no permissions requested at app launch
#   - camera/GPS prompts only fire from explicit field activity steps
#   - GPS coordinates round to 100m before any storage write
#   - no third-party SDKs in node_modules tree (audit the lockfile)

bd close bd-plat.5 --reason "Privacy defaults wired. Audit log shows no telemetry calls. Permission UX uses Ink explainers."
git commit -am "Privacy defaults + permission UX (bd-plat.5)" && git push
```

---

## Phase 5: native wrappers (`bd-plat.3`)

This can lag the others; PWA is enough for early development. Pick this up when you need to test on real devices outside the browser.

```bash
bd update bd-plat.3 --claim

npm install @capacitor/core @capacitor/cli
npm install @capacitor/camera @capacitor/geolocation @capacitor/filesystem
npx cap init biotope com.lightsoutgames.biotope
```

iOS (`npx cap add ios`):
- Open `ios/App/App.xcworkspace`
- Set Info.plist privacy strings: `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`
- Configure as Kids-Category-eligible in capabilities
- Set deployment target ≥ iOS 15

Android (`npx cap add android`):
- Open `android/` in Android Studio
- Add Designed for Families metadata
- Permissions in `AndroidManifest.xml`: CAMERA, ACCESS_FINE_LOCATION, READ_EXTERNAL_STORAGE
- minSdkVersion 24 (~94% device coverage as of 2026)

```bash
# Verify
npx cap run ios       # iOS Simulator
npx cap run android   # Android emulator or device

# Acceptance:
#   - iOS build runs on Simulator
#   - Android build runs on emulator
#   - camera and GPS permissions work via native dialog

bd close bd-plat.3 --reason "Capacitor wrappers configured. iOS and Android builds run with native permission dialogs."
git commit -am "Capacitor iOS + Android wrappers (bd-plat.3)" && git push
```

---

## Phase 6: engine basics (`bd-engn.1, .3, .4`)

Three R3F-flavored issues that complete the engine layer.

### `bd-engn.1` — Three.js + R3F

```bash
bd update bd-engn.1 --claim

npm install three @react-three/fiber @react-three/drei
npm install @react-three/xr        # XR is deferred but configure for later
npm install -D @types/three
```

Set up KTX2 + Draco loaders at app initialization (not per-scene):

```tsx
// app/Engine.tsx
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

const ktx2 = new KTX2Loader().setTranscoderPath('/basis/');
const draco = new DRACOLoader().setDecoderPath('/draco/');
```

Test scene: a Draco-compressed glTF cube on a plane, KTX2 texture, animated rotation. Verify 60fps on iPad 9th gen.

### `bd-engn.3` — asset pipeline

A `ScenarioBundleLoader` in `engine/assets/` that:
1. Reads a bundle manifest (paths + sizes + sha256 hashes).
2. For each entry: try OPFS first, network second, write to OPFS on miss.
3. Verifies hashes in a worker.
4. Reports progress via events.

### `bd-engn.4` — audio

Howler.js or a hand-rolled Web Audio wrapper with three buses (voice, SFX, ambient). Voice ducks ambient. iOS silent-mode handled correctly.

```bash
# After all three:
bd close bd-engn.1 --reason "..."
bd close bd-engn.3 --reason "..."
bd close bd-engn.4 --reason "..."
git push
```

---

## Phase 7: ready for the runtime

At this point `bd ready --json` should surface `bd-rntm.1` (manifest schema). That's the next workflow — see `new-scenario.md` for adding a scenario, which depends on the runtime being functional.

Quick checklist before moving on:

- [ ] App boots, installs, runs offline (`bd-plat.1, .2`)
- [ ] Storage works: state + blobs + species (`bd-plat.4`)
- [ ] Privacy defaults wired, no permissions at launch (`bd-plat.5`)
- [ ] Capacitor wrappers build for iOS + Android (`bd-plat.3`)
- [ ] R3F renders a Draco+KTX2 scene at 60fps (`bd-engn.1`)
- [ ] Asset bundle loader works with OPFS round-trip (`bd-engn.3`)
- [ ] Audio plays, ducks correctly (`bd-engn.4`)

When all checked, you're ready for the runtime layer (`bd-rntm.*`) and then the first scenario (`bd-scen.1`).
