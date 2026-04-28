# Biotope — Project Design Document (v3)

*Working title; replace as desired.*

A learning system for local ecosystems built around an alternating loop of **rich scenario simulation** in software and **real-world activity** in the field. v3 extends v2 with **embedded-systems / RC-research-vehicle scenarios** in the simulation layer and **three distribution sub-variations** of the React + Three.js stack (Steam-first + Steam Deck, Steam-first + Switch, mobile-first).

---

## 1. Project Summary

### Vision

Biotope is a place-based ecological and engineering-literacy platform. A learner alternates between immersive simulated episodes (a 3D pond at 2 a.m., a XR walk-through of a leaf's vascular tissue, a 2D phenology timeline) and structured real-world activities (a 20-minute observation walk, a soil-pH check, a photo-and-note of a single tree across seasons). Each side feeds the other: simulation primes the senses for what to notice in the field; field observations get re-encoded into the simulation, sometimes literally as user-contributed data.

The system is built for **lifelong learning across roughly five decades of life** — a 5-year-old playing alongside a parent, two 6-year-old friends running parallel solo activities, a high-schooler on a class assignment, three 30-year-olds on a private server simulating a multi-month wildlife research expedition. The simulation depth and skill demands scale with the player; the underlying engine, content format, and runtime are the same.

### Core experience loop

1. **Brief** — a short narrative scene introduces a question, hypothesis, or mission tied to the learner's locality (or, for adult scenarios, a target biome anywhere in the world).
2. **Sim episode** — an interactive 2D, 3D, or XR scenario that lets the learner manipulate variables, design systems, see hidden processes, and form predictions.
3. **Field activity** — a generated or curated outdoor task: observe, photograph, measure, build, sketch. Works offline. May be solo or co-located group.
4. **Re-encoding** — back in the app, the learner integrates field findings into the simulation (annotations, photos, species IDs, measurements, sensor data). The simulation responds.
5. **Reflection / quiz / story beat** — a short narrative resolution; new questions seed the next episode.

The loop is the same shape for every age and every group configuration, but pacing, complexity, and group orchestration differ — see Section 2.

### Target users (lifelong-learning audience model)

| Age cohort | Mode of engagement | Session length | Notes |
|---|---|---|---|
| **5–8 (early childhood)** | Parent/guardian-led; voice + large-touch UI; reading-optional | 5–15 min | Field activities require co-located adult |
| **9–12 (tweens)** | Solo or peers; family or school setting | 15–30 min | First independent field activities; simple cause-effect systems |
| **13–17 (teens)** | School curriculum + self-directed; emerging peer-server play | 30–60 min | Multi-variable systems; hypothesis testing; mod authoring begins |
| **18–30 (young adults)** | Self-directed; remote co-op friend groups; ambitious scenarios | 30–90 min, multi-session | Hard-engineering scenarios; persistent dedicated servers |
| **30–50 (adult learners)** | Continuing ed; family co-play with children; professional development | Variable | Both mentor and learner roles; teaches the next generation |

Plus authoring/operator roles:

- **Educators and curriculum authors** (teachers, museum/park interpreters, naturalists).
- **Modders and citizen-science groups** extending with regional content packs.
- **Server operators** running classroom or hobby dedicated servers.

### Differentiators

- **Place-based by design.** Content is parameterized by location, season, and time of day.
- **Alternation, not just gamification.** Sim and field interleave; one is required to unlock the other.
- **Lifelong span on one engine.** A 5-year-old's "spot the bird" episode and a 30-year-old's "design a solar microgrid for a research station" episode share the same scenario format, the same runtime, and (where appropriate) the same world.
- **Hard skills, not just soft skills.** Beyond identification and observation, the platform supports practical engineering scenarios — electrical, civil, chemistry, biology — with simulated solvers, not just multiple-choice quizzes.
- **Group play is first-class.** Parent-and-child mentorship, peer co-op, and remote-friends-on-a-dedicated-server are all native player configurations, not afterthoughts.
- **Offline-complete and self-hostable.** Single player works on a phone in airplane mode in the woods. Group play works on a teacher's laptop on a closed school network. Public servers are optional.
- **Modular content from day one.** Episodes, species packs, biomes, and field-activity templates are data, not code.

---

## 2. Player Modes & Group Dynamics

Group play and solo play are two ends of an axis, not separate products. Every scenario can in principle support multiple group configurations; the runtime adapts the UI and networking based on the configuration.

### Three orthogonal axes

1. **Solo ↔ Co-located group ↔ Remote group**
2. **Simulation half ↔ Field half** of the loop
3. **Synchronous ↔ Asynchronous** participation

A "session configuration" is a point in this 3D space. Common configurations get named presets.

### Group composition patterns

- **Mentor + apprentice** — large age gap; one player guides while the other explores. UI is differentiated per seat.
- **Peer co-op (co-located)** — same place, same age cohort. Either shared screen or device-per-player on the same Wi-Fi.
- **Peer co-op (remote)** — different places, real-time over the internet, on a self-hosted or rented dedicated server.
- **Classroom** — 1 instructor + many students, with the instructor able to pause/observe/intervene in any student's session.
- **Asynchronous chain** — Player A's field-activity output (a photo, a measurement, a journal entry) becomes Player B's brief, even if they never play at the same time.

### Three named example scenarios

The three configurations the requirements call out, fleshed out:

#### A. **Home Naturalist** — parent (25–35) + child (5), at home

- **Loop pacing.** Short, ~15-min total. Brief and sim happen on a tablet on the couch. Field activity happens in the backyard or on the next walk to the park. Re-encoding happens back on the couch.
- **UI mode.** Two-seat: child's view is touch-first, voice-narrated, with mostly icons; parent's view (same device or second device on the same Wi-Fi) overlays guidance, suggestions, and an "explain it for them" button.
- **Simulation scope.** Tightly scoped: identify three local birds; learn what they eat; spot one in the yard.
- **Networking.** None required. Two-seat-on-one-device or local-Wi-Fi peer connection between tablet and phone.
- **Field activity.** Adult-supervised: parent prompts, child observes. Photo capture is gated by the parent's confirmation.

#### B. **Backyard Buddies** — two 6-year-old friends, sim co-located then field solo

- **Loop pacing.** ~30 min, with a transition. Sim is co-located co-op (on one tablet, two-finger or split-screen, or on two tablets on the same Wi-Fi). Field is solo for each child, in their own backyard, asynchronously, with parental supervision in the background.
- **UI mode.** Game-like, big icons, very few words. Field-activity prompts are read aloud.
- **Simulation scope.** "Build a beetle hotel" (sim and real). Players see each other's avatars in the sim; field photos sync back when each child's device next finds Wi-Fi.
- **Networking.** LAN peer-to-peer for the sim portion (no internet required); deferred sync for field portion (queues until reconnected).
- **Field activity.** Each child completes solo and uploads a photo of their beetle hotel; the next sim session shows both hotels side-by-side and asks each child to predict whose attracted more visitors.

#### C. **Research Station** — three 25–35yo friends, remote, dedicated server, multi-month tropical island survival

- **Loop pacing.** Long-running. Real-time during play sessions; **time-compressed simulation continues on the dedicated server** between sessions (e.g., 1 in-game day per real-world hour while logged out, configurable). Sessions are 60–120 min, multiple per week, over weeks-to-months of real time.
- **UI mode.** Full desktop / large-tablet UI. Detailed instrumentation: power dashboards, water-balance gauges, weather forecasts, journal. Optional XR for site-walks of the constructed station.
- **Simulation scope.** Procedurally-generated tropical island. Players cooperatively design and operate a small wildlife-research station: solar/wind power, rainwater catchment + filtration, shelter, cold storage, basic chemistry lab, biology field protocols. Failures cascade (storm damages roof → water ingress → electronics fail → cold chain breaks → samples spoil).
- **Networking.** Authoritative dedicated server (Colyseus or equivalent), self-hosted on a small VPS or one player's home server. Server runs the world clock continuously.
- **Field activity.** Each player's *real* local environment supplies inputs: photographing local fauna seeds in-game biology samples; measuring real rainfall/sunlight tunes the sim's parameters that week. The remote dedicated server gives a shared world that none of the three players physically inhabits.

### What changes per configuration

| Concern | Solo | Co-located group | Remote group |
|---|---|---|---|
| Authoritative state | Local device | One device acts as host | Dedicated server |
| Network requirement | None | LAN | Internet to server |
| Voice / chat | N/A | Same room | Voice channel needed |
| Field activity model | Solo, deferred sync | Solo or paired, deferred sync | Each player's own location |
| Sim time progression | Pause when closed | Pause when closed | Compressed real-time on server |
| Save / persistence | Device | Device of host | Server |

---

## 3. Skills & Curriculum Domains

Biotope spans **soft skills** (observation, identification, systems thinking) at one end and **hard engineering skills** (electrical, civil, chemistry, biology, physics) at the other. The same simulation engine supports both because both reduce to *parameterized systems with rules and observable outputs*.

### Skill domains

- **Ecology / natural history** — identification, phenology, ecosystem dynamics.
- **Biology** — anatomy, microbiology, agriculture, disease ecology.
- **Chemistry** — water purification, basic reactions, food preservation, simple medicine.
- **Physics** — mechanics, optics, thermodynamics (informally where appropriate).
- **Electrical engineering** — circuits, solar/wind generation, batteries, load management.
- **Civil engineering** — shelter, drainage, water systems, structural basics.
- **Systems and operations** — planning, prioritization, risk, collaboration, ethics.

Each scenario draws from one or more domains. The platform ships with reusable **simulation primitives** per domain (a circuit-graph solver, a fluid/water-balance solver, a basic reaction system, a population/ecology model) so that scenario authors compose rather than rebuild.

### Age scaffolding within a domain

The same domain (say, electrical engineering) appears at every age — but at different rungs:

| Age | Electrical-engineering rung | Example task |
|---|---|---|
| 5–8 | Cause and effect | "Connect the lamp to the battery to make it light up" |
| 9–12 | Simple series/parallel; budget | "Run two lamps off one battery; what changes?" |
| 13–17 | Component-level circuits; Ohm's law | "Size a resistor for an LED" |
| 18+ | System design under constraint | "Design a 24-hour solar+battery system for a 200 W base load on a tropical island" |

Same simulation, same content format, different difficulty configuration in the scenario manifest.

### Anchor scenario: Wildlife Research Station

The "survive X months in a remote wildlife research station" scenario is the flagship adult/co-op vehicle. It exercises every domain at once:

- **Electrical** — sizing and operating a solar+battery+wind system with real diurnal/seasonal generation curves; load management; failure modes when storms hit.
- **Civil** — shelter siting (slope, wind, sun), roof drainage, freshwater catchment volume, greywater, septic siting away from catchment.
- **Chemistry** — water filtration choices (sand, ceramic, UV, boil), preservation of biological samples, fuel handling, basic first-aid pharmacology.
- **Biology / ecology** — surveying local species, tagging protocols, ethics, disease vectors, agricultural plot planning.
- **Operations** — three players have to plan the next two weeks; one storm forces re-prioritization; consequences propagate.
- **Embedded systems** — players design and program small RC research vehicles (a soil-sampling rover, a canopy-survey quadcopter, a tethered weather buoy) for the station's work; firmware authored in-app, simulated end-to-end, optionally flashable to real Arduino / Raspberry Pi Pico / ESP32 hardware.

The server runs the world clock continuously, so consequences of choices unfold even when nobody's logged in. Field activities in players' real-world locations feed parameters back: that week's sunlight, rainfall, observed local species inform the in-sim parameters. The scenario is procedurally configurable — different islands, different climates, different seasons.

### Embedded systems & RC research vehicles

A native domain alongside the others: each player can design, program, and pilot a small **remote-control research vehicle** — a ground rover, a quadcopter drone, a buoyant skiff, an underwater glider, a tethered weather balloon. Each vehicle is a simulated **embedded system**: a microcontroller running player-authored firmware, attached to simulated sensors (cameras, IMUs, GPS, gas, distance, current) and actuators (motors, servos, lights). Multiple vehicles cooperate in a single scenario — three players doing a wildlife transect with one rover and two drones.

The same firmware can in principle drive a real vehicle. The bridge to physical hardware runs over **Web Serial / WebUSB / Web Bluetooth** on supported browsers — players prototype in sim, then upload their tested firmware to a real Arduino, Raspberry Pi Pico, or ESP32 on a real RC chassis.

**Programming ladder by age:**

| Age | Programming surface | Example task |
|---|---|---|
| 5–8 | Direct tap-to-drive; no programming | "Drive the rover to the red flower" |
| 9–12 | Block-based (Blockly / MakeCode) | "When the bug sensor sees movement, beep" |
| 13–17 | JavaScript or MakeCode JS | "Program the drone to follow the river using its camera" |
| 18+ | C/C++ Arduino-style firmware; real hardware | "Tune the PID loop on the underwater glider's depth controller" |

**Multi-vehicle, multi-player scenarios:**

- A research station with one rover (player A), one drone (player B), and a fixed sensor pod (player C) running a coordinated 24-hour wildlife survey.
- A field-trip protocol where each child's "rover" is sim-only but observes virtual analogues of the bugs they'll find outside that afternoon.

**The simulation lives at two layers:**

1. **MCU runtime** — runs the firmware (AVR8js / rp2040js for hardware-faithful, or QuickJS-WASM for higher-level player JavaScript). Steps in lockstep with the world clock.
2. **Sensor / actuator coupling** — sensors are computed each tick from the world (raycasts for distance, virtual GPS from entity position, IMU from physics velocities, simulated camera as a render target). Actuator commands feed the rigid-body physics (Rapier).

This pattern has working precedent: Wokwi's AVR8js is regularly combined with matter-js (2D) or three.js (3D) for educational virtual robotics, including in published Arduino-with-physics curricula.

### Other scenario archetypes

- **Backyard / patch ecology** — short, local, low-stakes. Primary 5–17 vehicle.
- **Watershed citizen-science** — multi-week, group-asynchronous, real measurements feeding shared data.
- **Restoration project** — multi-season, cause-and-effect across long timescales.
- **Urban ecology** — for learners without easy wilderness access; pigeons, weeds, microclimates, human/wildlife interfaces.
- **Indoor microbiome** — when the field can't be outdoor; soil jars, kitchen ferments, houseplant pests.

---

## 4. Design Principles & Guidelines

### Platform

- **Web app stack** (PWA) as the primary delivery surface; install-to-homescreen; optional Tauri/Capacitor wrappers.
- **Cross-platform**: desktop, mobile, tablet, XR headset.
- **Responsive interaction paradigm**: scenarios degrade gracefully from XR → 3D-on-screen → 2D-diagrammatic.
- **Full offline mode for solo and co-located play**: a region pack is runnable cold.
- **Self-hostable dedicated server for remote group play**: a single Docker image runs on a small VPS or a player's home box. No mandatory cloud dependency.
- **Local-network LAN multiplayer**: a teacher's laptop on a closed school Wi-Fi must work as a server.

### Content & pedagogy

- **Narrative-driven progression** with branching authored as data.
- **Constructivist scaffolding**: predict → observe → reconcile.
- **Field activities are gating, not optional**.
- **Locality > realism**.
- **Age-adaptive density**: same content in age-appropriate UI density; the manifest declares which rungs apply.
- **Multi-modal input**: touch + voice for early-childhood; full input for older players.
- **Group orchestration is part of the content**: a scenario manifest can declare "this works as solo, mentor+apprentice, or 3-player co-op" with per-mode tweaks.

### Engineering

- **Offline-first storage** (Cache API, IndexedDB/OPFS, optional SQLite-WASM).
- **Authoritative server for shared state** when in remote-group mode; CRDT (Yjs) for collaborative authoring; local for solo.
- **Simulation separated from rendering**: skill-domain solvers (circuits, fluids, reactions) live above the 3D/2D layer and can run headless on the server.
- **Deterministic where possible**: shared sims use seeded RNG so all clients agree on outcomes.
- **Sandboxed scripting** for UGC (QuickJS-WASM); no DOM, no network, scoped storage.
- **Open formats** (glTF, PMTiles, GeoJSON, Darwin Core).
- **Asset budget per region pack**: target ≤ 500 MB default, configurable.

### Privacy, ethics, and safeguarding

- **Sensitive species locations** auto-obscured per upstream conventions.
- **Children's data**: local-only by default; sync requires explicit guardian setup; voice chat for under-13 is disabled by default and gated behind verified guardian opt-in.
- **No silent telemetry**; opt-in analytics only.
- **Camera/GPS** only when an activity requires them.
- **Server moderation tools**: dedicated-server operators get block/mute/eject; classroom servers default to text-only chat with profanity filter.

---

## 5. System Architecture (layers)

```
┌──────────────────────────────────────────────────────────────────┐
│  Authoring tools (in-app editor + external CLI)                  │
├──────────────────────────────────────────────────────────────────┤
│  Session orchestrator (mode, seats, age profile, group config)   │
├──────────────────────────────────────────────────────────────────┤
│  Scenario / narrative engine  │  Field-activity engine            │
├───────────────────────────────┼───────────────────────────────────┤
│  Skill-domain simulations:    │  Map / geospatial runtime         │
│   circuits, fluids,           │                                   │
│   reactions, populations      │                                   │
├───────────────────────────────┴───────────────────────────────────┤
│  3D + XR runtime  │  2D scene  │  Physics engine (Rapier-WASM)    │
├───────────────────┴────────────┴──────────────────────────────────┤
│  UGC scripting sandbox (QuickJS-WASM)                             │
├───────────────────────────────────────────────────────────────────┤
│  Multiplayer / dedicated server (Colyseus authoritative)          │
│  + voice chat (LiveKit / WebRTC)                                  │
├───────────────────────────────────────────────────────────────────┤
│  Asset pipeline (glTF, KTX2, audio, PMTiles, JSON/YAML packs)     │
├───────────────────────────────────────────────────────────────────┤
│  Storage (Cache API + IndexedDB/OPFS + SQLite-WASM)               │
├───────────────────────────────────────────────────────────────────┤
│  Sync layer (RxDB / Yjs)                                          │
├───────────────────────────────────────────────────────────────────┤
│  PWA shell + service worker  │  Web sensors (cam, GPS, IMU, mic)  │
├───────────────────────────────────────────────────────────────────┤
│  External data adapters: iNaturalist, GBIF, OSM, weather APIs    │
└──────────────────────────────────────────────────────────────────┘
```

Three new layers vs v1:

- **Session orchestrator** — knows whether this is solo, mentor+apprentice, or 3-way co-op; configures UI density, seat assignments, and which players see which prompts.
- **Skill-domain simulations** — domain-specific solvers (circuits, fluids, reactions, populations) that live above the rendering layer and can run headless on a server. This is what lets a multi-player session continue ticking when nobody is logged in.
- **Multiplayer / dedicated server** — authoritative server for remote group play; self-hostable Docker image; voice chat as a separable service.

The dashed boundary above the asset pipeline remains the *content boundary*.

---

## 6. Technology Research Notes

### 3D / XR engines (web)

Same conclusion as v1: **Babylon.js** (best WebXR), **Three.js** (largest ecosystem, smallest core), **PlayCanvas** (best mobile, editor-driven). For Biotope, Babylon.js or Three.js+R3F are the two real candidates; PlayCanvas is the editor-driven alternative.

### Narrative engines

**Ink + `inkjs`** remains the path of least resistance (the only one with a first-class JS runtime). **Yarn Spinner** has a Rust port and an engine-agnostic core compiler but no first-class JS runtime as of early 2026.

### Multiplayer & dedicated server

The viable web-multiplayer landscape:

- **Colyseus** — open-source, self-hostable, Node.js, authoritative, room-based, scales horizontally with Redis. SDKs for browser/Unity/Godot/etc. Version 0.17 (Apr 2026) added unified TS builds and HMR. **Strong default for Biotope** because it's self-hostable, Docker-deployable, and works inside a school LAN as easily as on a public VPS.
- **PartyKit** — TypeScript multiplayer on Cloudflare Durable Objects. Excellent DX. **Cannot be self-hosted** — managed-only. Doesn't fit Biotope's offline/self-host requirement.
- **Hathora** — shut down March 2026; not an option.
- **Edgegap** — managed orchestration platform; not a fit for self-host.
- **Geckos.io** — WebRTC datachannel for UDP-style messaging; lightweight, peer-friendly, useful for fast-paced sims but overkill for Biotope's pacing.
- **Yjs / Automerge** — CRDTs; the right shape for collaborative authoring, optionally for asynchronous group state, not for authoritative game state.

For voice chat:

- **LiveKit** — open-source SFU, self-hostable, WebRTC; the open analogue to Twilio/Agora. Recommended.
- **Mediasoup** — lower-level SFU; more flexible, more work.
- **Pure peer-to-peer WebRTC** — viable for ≤4 players without a media server.

### Physics (for engineering simulation)

- **Rapier** (Rust→WASM, `@dimforge/rapier3d` / `@dimforge/rapier3d-simd`) — current best-in-class for web. 2–5× faster than its 2024 baseline. SIMD variant for modern browsers. 2D and 3D supported. **Default choice.**
- **Cannon-es** — pure JS, maintained fork of Cannon.js. Easier to debug, slower; fine for prototypes and lightweight scenarios.
- **Ammo.js / Oimo.js** — older, less maintained.
- **Babylon.js** ships its own Havok WASM integration as well, which is excellent if Babylon is the renderer.

For *engineering-domain* simulations specifically (circuits, fluids, reactions), generic rigid-body physics is the wrong tool. Those need domain-specific solvers — usually written from scratch as small graph + numerical solvers. We'd ship reusable primitives:

- **Circuit graph + nodal-analysis solver** for electrical scenarios. Inspirable by `falstad/circuitjs` (open-source, GWT-based).
- **Pipe / fluid network solver** for water systems.
- **Reaction system** for chemistry (a small ODE solver is sufficient for reactions at the abstraction level we want).
- **Population / Lotka–Volterra-style ecology solver** for biology scenarios.

These are all small (hundreds-of-lines) and can be written once and reused across content. They run client-side in solo mode and server-side in group mode.

### Procedural biome generation

For the tropical-island scenario and similar:

- **Noise libraries** — `simplex-noise`, `fast-simplex-noise` for terrain heightmaps, climate fields, vegetation distribution.
- **Wave Function Collapse** (`wfc-js`, `fast-wfc`) for tile-based layouts (e.g., research-station floor plans).
- **L-systems** for vegetation procedural growth.
- **Custom climate model** — daily/seasonal temperature, rainfall, sunlight curves parameterized by biome and latitude. Coupled to the world clock so the dedicated server can advance climate over weeks while logged out.

### Embedded systems simulation & hardware bridging

For the RC-research-vehicle scenarios, three layers are needed.

**Microcontroller emulation in the browser.** All three options below come from the Wokwi project, all MIT-licensed, all native TypeScript:

- **AVR8js** — ATmega328p (Arduino Uno), ATmega2560 (Mega), ATtiny family. Mature; drives Wokwi's online Arduino simulator. Pairs naturally with `wokwi-elements` (web components for LEDs, servos, displays, sensors).
- **rp2040js** — Raspberry Pi Pico emulator in TypeScript. Same project family, same shape of API.
- **RiscVCore.ts** — RISC-V core, used in derivatives that target ESP32-C3 / -C6 / -H2.

For higher-level player code that doesn't need real-hardware fidelity, **QuickJS-WASM** can simply run the player's JavaScript firmware directly with a sensors/actuators API exposed by the host. This is the right default for the 13–17 tier; AVR8js / rp2040js are the right choice when fidelity to specific real hardware is the point of the exercise.

**Visual programming for younger players:**

- **Microsoft MakeCode** — open-source, in-browser, blocks + JavaScript + Python; targets micro:bit, Arduino, Maker boards. Excellent fit for 9–12 / 13–17.
- **Blockly** — Google's library for building block-based editors; lower-level than MakeCode but more flexible.
- **Scratch / Snap!** — broadly for 5–10, less natural for embedded specifically.

**Bridging to real hardware:**

- **Web Serial API** — USB serial on Chrome/Edge desktop. Standard route for flashing Arduino/Pico from the browser. Not on iOS Safari, not on Firefox.
- **WebUSB** — raw USB on Chrome/Edge. For non-serial peripherals.
- **Web Bluetooth** — BLE on Chrome/Edge/some mobile. Wireless connection to BLE-enabled vehicles.
- **WebHID** — for gamepad-style controllers.

The implication: as of early 2026, the "real hardware" bridge is **desktop Chromium-only**. Mobile players prototype in sim only; desktop players can flash real hardware when relevant. iOS in particular cannot bridge to USB hardware from the browser.

**Robotics-flavored sensor & actuator simulation:**

- No need for a heavyweight robotics engine (Gazebo, Webots, Isaac); **Rapier physics + custom raycast / sensor coupling** is sufficient at our fidelity.
- Models for the most common sensors (ultrasonic distance, 1D-lidar, camera-as-rendertarget, IMU from physics velocities, simulated GPS noise) form a small reusable library — author once, reuse across vehicles.

### Offline storage & sync

Unchanged from v1. **Cache API** for static assets, **IndexedDB** (Dexie) for app state, **OPFS** for large binary blobs, **SQLite-WASM** (`sqlocal`/`wa-sqlite`) for queryable bio data, **RxDB** for sync between client and dedicated server.

### Geospatial, species data, UGC scripting

Unchanged from v1. **MapLibre GL JS + PMTiles**; **iNaturalist + GBIF** with offline region packs precomputed at pack-build time; **QuickJS-WASM** for sandboxed UGC scripts.

### Adaptive UX

Less of a "library landscape," more of a design-pattern question. A few concrete pieces:

- **Reading-level switching** — content text can ship multiple variants per node; the runtime picks based on the active player's age profile.
- **Voice synthesis** — Web Speech API for free, offline-capable read-aloud (quality varies); on-device TTS via Coqui or Piper as a higher-quality offline option.
- **Voice recognition** — Web Speech API (online), or `whisper.cpp` / Moonshine in WASM for offline.
- **Large-touch / gesture input** — design system convention, not a library.

---

## 7. Component Matrix

| # | Component | Option A | Option B | Option C | Default |
|---|-----------|----------|----------|----------|---------|
| 1 | **3D + XR engine** | Babylon.js | Three.js + R3F | PlayCanvas | **Babylon.js** |
| 2 | **2D scene / overlay** | PixiJS | Konva | HTML/CSS/SVG | **PixiJS** for game-like; HTML for chrome |
| 3 | **Physics (rigid body)** | Rapier (Rust→WASM) | Cannon-es (pure JS) | Havok WASM (Babylon) | **Rapier** |
| 4 | **Domain sim — circuits** | Custom nodal-analysis solver | Port falstad/circuitjs | None (rules-only mock) | **Custom solver** |
| 5 | **Domain sim — fluids** | Custom pipe-network solver | OpenFOAM-WASM (overkill) | None | **Custom pipe solver** |
| 6 | **Domain sim — reactions** | Custom ODE-stepped reaction system | OpenChemLib subset | None | **Custom system** |
| 7 | **Domain sim — ecology** | Custom population/Lotka–Volterra | Agent-based (Mason port) | None | **Custom + ABM where needed** |
| 8 | **Procedural generation** | simplex-noise + custom climate | WFC-js for layouts | Hand-authored only | **Hybrid: noise terrain, WFC for structures** |
| 9 | **Narrative engine** | Ink + `inkjs` | Yarn Spinner core (no JS rt) | Custom XState storylet | **Ink + inkjs** |
| 10 | **Session orchestrator** | XState statechart | Custom React state | None (manual) | **XState statechart** |
| 11 | **Multiplayer framework** | Colyseus (self-host) | PartyKit (managed) | Geckos.io (peer-UDP) | **Colyseus** |
| 12 | **Dedicated server deploy** | Docker on VPS / home box | Kubernetes (Agones) | Managed (Edgegap) | **Docker on VPS / home** |
| 13 | **Voice chat** | LiveKit (self-host SFU) | Mediasoup | Peer WebRTC (≤4) | **LiveKit** for 5+, P2P for ≤4 |
| 14 | **Collaborative state (CRDT)** | Yjs | Automerge | None | **Yjs** (for authoring + soft state) |
| 15 | **App framework** | React + Vite | SvelteKit | SolidJS + Vite | **React + Vite** |
| 16 | **PWA / SW** | Workbox via vite-plugin-pwa | Hand-rolled | Next.js PWA plugin | **Workbox + vite-plugin-pwa** |
| 17 | **Structured storage** | Dexie (IndexedDB) | RxDB | SQLite-WASM | **Dexie + SQLite-WASM** |
| 18 | **Large blob storage** | OPFS | IDB blobs | Cache API | **OPFS** for ≥10 MB |
| 19 | **Sync** | RxDB ↔ server | PouchDB ↔ CouchDB | Yjs (collab only) | **RxDB** for app data |
| 20 | **Map renderer** | MapLibre GL JS | Leaflet | Cesium | **MapLibre GL JS** |
| 21 | **Map tiles** | PMTiles | MBTiles via server | Hosted (Mapbox) | **PMTiles** |
| 22 | **3D asset format** | glTF 2.0 + KTX2 | USDZ | FBX | **glTF 2.0** |
| 23 | **Species data (online)** | iNaturalist + GBIF | eBird (birds) | PlantNet | **iNat + GBIF**; eBird if birds-heavy |
| 24 | **Species data (offline)** | SQLite-WASM region pack | JSON + images | DwC-A bundle | **SQLite-WASM** |
| 25 | **AR / camera overlay** | WebXR `immersive-ar` | MindAR (markers) | `getUserMedia` + canvas | **WebXR where supported, getUserMedia fallback** |
| 26 | **UGC scripting** | QuickJS-WASM | Sandbox iframe + Worker | Lua-WASM | **QuickJS-WASM** |
| 27 | **State management** | Zustand | XState | Redux Toolkit | **Zustand** for UI, **XState** for episode + session |
| 28 | **Sensor APIs** | Web APIs (Geo, DeviceOrientation, getUserMedia) | Generic Sensor API | Capacitor native | **Web APIs first**, Capacitor fallback |
| 29 | **TTS (read-aloud)** | Web Speech API | Piper (WASM, offline) | Coqui (WASM, offline) | **Web Speech**, **Piper** as offline upgrade |
| 30 | **STT (voice input)** | Web Speech API | Moonshine WASM | whisper.cpp WASM | **Web Speech**, **Moonshine** offline |
| 31 | **Desktop wrapper** | Tauri | Electron | None (PWA only) | **Tauri** |
| 32 | **Mobile wrapper** | Capacitor | PWA-only | React Native (rewrite) | **PWA-first**, Capacitor for store presence |
| 33 | **Build & dist** | Vite + static host | Vercel | Self-hosted | **Vite + static host** |
| 34 | **MCU emulation (faithful)** | AVR8js (Arduino) | rp2040js (RPi Pico) | RiscVCore.ts (ESP32-RV) | **AVR8js + rp2040js**, RV optional |
| 35 | **MCU runtime (high-level)** | QuickJS-WASM running player JS | Pyodide (Python) | Lua-WASM | **QuickJS-WASM** |
| 36 | **Visual programming env** | Microsoft MakeCode | Blockly (custom blocks) | Scratch / Snap! | **MakeCode** for embedded; **Blockly** for general |
| 37 | **Hardware bridge (USB)** | Web Serial API | WebUSB | Capacitor native plugin | **Web Serial** (Chrome/Edge desktop) |
| 38 | **Hardware bridge (wireless)** | Web Bluetooth | WebHID | Capacitor BLE plugin | **Web Bluetooth** |
| 39 | **Robotics sensor sim** | Custom raycast/IMU/GPS lib | Webots-web (heavy) | None | **Custom small library** |
| 40 | **HW component visuals** | wokwi-elements (web components) | Custom SVG/3D | None | **wokwi-elements** for 2D dashboards |
| 41 | **Steam (PC) wrapper** | Electron + Greenworks | NW.js + steamworks-nodejs | Tauri (limited Steam SDK) | **Electron + Greenworks** for Steam |
| 42 | **Steam Deck specifics** | Native Linux Electron build | Proton-compatible Windows build | Web (Steam browser) | **Native Linux Electron** + gamepad UX |
| 43 | **Switch port path** | Godot RAWRLAB port (Nintendo NDA) | Unity (commercial) | Porting house (Lone Wolf, etc.) | **Godot port** if team has Nintendo dev access; else **porting house** |
| 44 | **Console-shared logic** | TypeScript core, parallel renderers | Rust core via WASM/native | Hand-port per platform | **TypeScript core**, native renderer per console |

---

## 8. Tech Stack Variations

Each variation now includes the multiplayer/physics stack. The three variations differ mainly in the rendering engine and surrounding ecosystem.

### Variation A — XR-first, Babylon-centric (recommended default)

- **Engine:** Babylon.js (3D + XR), PixiJS (2D overlay)
- **Physics:** Babylon's Havok integration (or Rapier if engine-portable physics matters for headless server use)
- **Domain sims:** Custom solvers (TypeScript) — circuits, fluids, reactions, populations
- **Narrative:** Ink + `inkjs`
- **Session orchestration:** XState statechart, runs identically client- and server-side
- **Multiplayer:** Colyseus, self-hosted Docker
- **Voice:** LiveKit self-hosted (≥5 players); P2P WebRTC for ≤4
- **App:** React + Vite + Workbox
- **State:** Zustand (UI) + XState (episode + session)
- **Storage:** Dexie + OPFS + SQLite-WASM
- **Sync:** RxDB
- **Maps:** MapLibre + PMTiles
- **UGC:** QuickJS-WASM
- **Wrappers:** Tauri (desktop), Capacitor (mobile), PWA primary

**Strengths:** Best XR; integrated physics/audio/GUI; TypeScript end-to-end.
**Weaknesses:** Smaller community than Three.js; heavier initial JS payload.

### Variation B — React + Three.js ecosystem

- **Engine:** Three.js + React Three Fiber + `@react-three/xr` + drei
- **Physics:** Rapier via `@react-three/rapier`
- **Everything else:** identical to Variation A (domain sims, Ink, XState, Colyseus, LiveKit, Vite, etc.)

**Strengths:** Largest ecosystem; declarative scenes; best fit for React-trained teams; easiest path for external mod contributors.
**Weaknesses:** XR/AR more glue work; physics/audio assembled rather than bundled.

Variation B is the most flexible base for *distribution targets* — three sub-variations differ in primary platform and what cross-play looks like. The engine, simulation, and content layers stay identical across B-1 / B-2 / B-3; only the wrappers, store presence, and input/UX scaling differ.

#### B-1 — Steam-first PC + cross-play with mobile + Steam Deck

- **Primary distribution.** Steam (Windows / macOS / Linux). The same Linux build runs on Steam Deck; target the "Steam Deck Verified" UX standard (gamepad-friendly controls throughout, on-screen keyboard, 1280×800 minimum readable layout).
- **Wrapper.** **Electron + Greenworks** for Steam SDK integration (achievements, friends, cloud saves, overlay). Tauri lacks first-class Steamworks bindings and has had Steam Overlay hooking issues; Electron + Greenworks is the well-trodden indie path despite the size cost.
- **Cross-play.** Same Colyseus protocol on PC and mobile. Mobile users join via PWA / Capacitor wrappers. Save sync via Steam Cloud on PC, server-side for cross-device continuity.
- **Input.** Keyboard+mouse primary; **gamepad as a first-class input** (XInput / SteamInput) for Steam Deck; touch on mobile. UI must scale across all three at runtime.
- **What's strong here.** Adult and teen scenarios — Research Station, multi-month engineering — shine on a real PC or a portable Deck. Cross-play with kids' tablets enables family/classroom modes without forcing the adults onto a phone.
- **Caveats.** Electron in Steam Deck Game Mode has had compositing bugs (`WEBKIT_DISABLE_COMPOSITING_MODE=1` is a documented workaround); test early and continuously. Two simultaneous Electron apps on Deck can interact badly with the Game Mode session manager.

#### B-2 — Steam-first PC + cross-play with mobile + Nintendo Switch

- **Primary distribution.** Steam (PC) + Nintendo Switch eShop + iOS / Android stores.
- **Wrapper (PC).** Electron + Greenworks, as B-1.
- **Switch port.** Switch is a closed platform — **no web / Electron / Tauri runtime is available**. Realistic options:
  - **Godot RAWRLAB free port** — open-source, MIT-licensed, distributed only inside the Nintendo Developer Portal. Requires authorized Nintendo developer status and NDAs. GDScript only (no C# / GDExtension). Adequate for small/mid projects, not highly optimized.
  - **Commercial porting house** (Lone Wolf Technology, Pineapple Works, W4 Games consoles at ~$800/year/console floor). Common for indie titles without in-house console expertise.
  - **Unity rewrite** of the client (largest commitment; not recommended for a small team).
- **Codebase strategy.** Decouple the **engine-portable core** (TypeScript) — narrative state, session orchestrator, skill-domain solvers, scenario manifest reader, server protocol — from the **renderer**. The Switch client reimplements only the renderer (Godot or Unity) but speaks the same Colyseus protocol over WebSocket and reads the same scenario manifest format. This is a sustained engineering tax across every feature, not a one-off.
- **Cross-play.** Colyseus is engine-agnostic over WebSocket; Switch native client connects to the same servers as PC and mobile. Input parity needs careful design (keyboard+mouse on PC vs Joy-Con vs touch).
- **Caveats.** Switch certification adds 6–12 months to the first-release timeline; porting-house cost is typically $15–60K for indie titles. Switch-exclusive features (HD rumble, IR, gyro, screen capture) need bespoke work. Voice chat between Switch and other platforms is constrained by Nintendo's policies.
- **When to pick this over B-1.** Only if Switch reach is a strategic requirement — a partnership, a distribution deal, or audience overlap that justifies the second client. Otherwise B-1 is dramatically cheaper to ship and maintain.

#### B-3 — Mobile-first; sync group play with optional desktop/laptop

- **Primary distribution.** iOS App Store + Google Play. The PWA at the same URL is the desktop / laptop fallback. Desktop is treated as a **secondary surface** — supported well enough for a parent on a laptop joining a child on a tablet, or for a teacher on a Chromebook joining a classroom of phones, but not the primary path.
- **Wrapper (mobile).** Capacitor (PWA install-to-homescreen as the web variant).
- **Wrapper (desktop, secondary).** PWA only, or a lightweight Tauri wrapper later if desktop becomes a meaningful share. **No Steam target** unless promoted to B-1 in a later wave.
- **Performance budget.** Must run smoothly on mid-range Android tablets and 3-year-old iPads. Asset budget per region pack drops to ≤ 250 MB; XR is supported but optional, not assumed.
- **Cross-device synchronous group play.** Co-located scenarios (Home Naturalist, Backyard Buddies) run over LAN peer-to-peer. Desktop joiners connect via the same LAN or via a small home dedicated server. The Research Station scenario still works but is best on tablet+desktop, not phones-only.
- **Input.** Touch primary (large targets, voice prompts, read-aloud); keyboard+mouse for desktop joiners; gamepad optional. Reading-level switching is tied to the active player's age profile, not the device.
- **Store policies (especially for kids).** Apple App Store has explicit Kids Category requirements (parental gates for any purchase, no third-party analytics, COPPA compliance); Google Play has Designed for Families. Voice chat for under-13 must default off and require verifiable guardian opt-in.
- **What's strong here.** Best fit for the 5–17 audience and the family / classroom modes; phones and tablets are where children actually have devices, and a school's iPad cart is the realistic deployment path.
- **What it sacrifices.** No Steam discoverability for adult audiences; the heaviest adult scenarios (multi-month Research Station with detailed instrumentation) work but feel cramped on a phone.

#### Selecting between B-1 / B-2 / B-3

| Factor | B-1 (Steam + Deck) | B-2 (Steam + Switch) | B-3 (Mobile-first) |
|---|---|---|---|
| Primary audience | Adult / teen | Adult / teen + family | Family / school |
| Reach | PC gamers + handheld | PC + console + mobile | Mobile-native users |
| Engineering cost | Moderate | High (Switch port) | Low–moderate |
| Time-to-first-distribution | ~3 mo (Steam) | 6–12 mo (Switch cert.) | ~1 mo (store review) |
| Cross-play complexity | One web protocol | Native client + protocol | One web protocol |
| MVP candidate | Yes | No (defer) | Yes |

**Default recommendation:** start with **B-3** for the MVP (broadest reach for the family/school cohorts that most need the platform, cheapest distribution path), then add **B-1** as a second wave once adult Research Station scenarios are proven (Steam Deck makes those scenarios genuinely portable). **B-2** is a third-wave consideration only if Switch reach becomes a strategic requirement.

### Variation C — Mobile-first / editor-driven (PlayCanvas)

- **Engine:** PlayCanvas + PlayCanvas Editor for scene authoring
- **Physics:** PlayCanvas's built-in (Ammo) or Rapier
- **Everything else:** mostly identical, but the editor changes who can author.

**Strengths:** Best mobile perf; editor enables non-coder authoring; ECS scales.
**Weaknesses:** Smaller WebXR feature set; tighter coupling to PlayCanvas conventions.

### Selection criteria summary

| Concern | A (Babylon) | B (Three+R3F) | C (PlayCanvas) |
|---|---|---|---|
| WebXR completeness | ★★★ | ★★ | ★★ |
| Mobile performance | ★★ | ★★ | ★★★ |
| Ecosystem / hiring | ★★ | ★★★ | ★ |
| Non-coder authoring | ★ | ★ | ★★★ |
| Offline robustness | ★★★ | ★★★ | ★★★ |
| Multiplayer (Colyseus) | ★★★ | ★★★ | ★★★ |
| Physics (Rapier) | ★★★ | ★★★ | ★★ |
| Initial bundle size | ★ | ★★★ | ★★ |
| Modding velocity | ★★ | ★★★ | ★★ |

---

## 9. Open Questions / Next Steps

1. **Pedagogical model commit.** Strict alternation, weighted, or open?
2. **Region-pack format spec.** Manifest shape, taxa subset, biome parameters, age-rung declarations.
3. **Author audience.** First third-party author?
4. **Offline AR plan.** WebXR-AR is unavailable on Vision Pro; fallback on Safari is `getUserMedia` + canvas overlay.
5. **Sensitive species policy.** Inheritance from upstream + enforcement for user contributions.
6. **Stack pick.** A / B / C / hybrid.
7. **First vertical slice.** One biotope, end-to-end.
8. **Sim-time compression model.** What's the default ratio for the dedicated-server world clock when nobody is logged in? Per scenario or global? Configurable per group?
9. **Cross-device group sessions.** A parent on a phone, a child on a tablet, optionally a grandparent on an XR headset — does the same session render acceptably across all three at once?
10. **Voice chat for minors.** Default policy? Verifiable parental opt-in flow? Push-to-talk-only? Text-only fallback for under-13 servers?
11. **Server moderation.** What tools does a dedicated-server operator actually need on day one? Block, mute, eject; what else?
12. **Skill-tree progression scope.** Per-region, per-account, or per-character? Does a player who built electrical fluency on the tropical island carry that into a temperate-forest scenario?
13. **Cheating / determinism.** Authoritative server protects against this for shared sims; what's the policy for solo offline progress that later syncs?
14. **Long-running sim semantics.** If the server runs continuously and the three players are in different timezones, who gets notified about the storm?
15. **Real-world data calibration.** When a player reports "we got 12 mm of rain today," is that trusted, or is it cross-checked against a weather-API? What's the trust model for player-supplied environmental data?
16. **Distribution sequencing.** B-3 (mobile-first) before B-1 (Steam + Deck), or the other way? Which audience cohort is the MVP actually serving — families/schools, or adult engineering co-op?
17. **Switch realism.** Is Switch a genuine target or aspirational? If genuine, the team needs Nintendo developer access (or a porting partner) and a budget specifically for the parallel native client.
18. **MCU fidelity tier per scenario.** When does AVR8js / rp2040js's hardware-faithful path matter, and when is QuickJS-with-sensor-API enough? Default proposal: faithful MCU emulation only at the 18+ tier when the player intends to flash real hardware; QuickJS for everyone else.
19. **Real-hardware policy for minors.** Flashing a real Arduino from the browser requires Web Serial (desktop Chromium). Should under-13s be allowed to bridge to physical hardware? Default proposal: simulation only under 13; real-hardware bridging unlocks at 13+ with verified guardian opt-in.
20. **Cross-vehicle communication semantics.** When three players run different vehicles in the same scenario, do they share a *virtual radio bus* (messages between vehicles are observable, jammable, lossy with distance) — or is communication abstracted to a clean RPC? The first is significantly more educational; the second is significantly simpler. Probably abstract for 5–12 tiers, virtual-radio for 13+.
21. **Engine-portable core boundary.** If B-2 (Switch) is on the roadmap, the boundary between "TypeScript portable core" and "renderer-specific code" needs to be drawn early — retrofitting is painful. What exactly belongs in the core?

---

*Recommendation, unchanged from v1:* start with **Variation A (Babylon.js)** unless the team is strongly React-flavored, in which case **Variation B** is near-equivalent. Defer **Variation C** unless non-technical authoring is a hard requirement. The multiplayer, physics, and skill-domain simulation choices are the same across all three variations — the differences are only in the rendering layer and its immediate ecosystem.
