# Biotope MVP — Reference Package for Claude Code Agents

This is a self-contained reference package for AI agents (Claude Code primarily, but format-agnostic) to build the **Biotope** MVP — a parent-and-child ecological learning app shipping first as Variation B-3 (mobile-first PWA + iOS + Android).

## What's in the box

```
biotope-mvp-package/
├── README.md                     ← you are here
├── AGENTS.md                     ← quick start for any coding agent
├── CLAUDE.md                     ← Claude Code specific guidance
├── AGENT_INSTRUCTIONS.md         ← detailed operational instructions
├── bootstrap.sh                  ← initialize beads + import issues + apply deps
├── issues.jsonl                  ← 54 work items (10 epics, 44 tasks) with deps
├── docs/                         ← reference design documents
│   ├── biotope-design.md         ← full system design (v3)
│   ├── biotope-mvp-planning.md   ← B-3 product MVP scope + scenario template
│   ├── biotope-gtm.md            ← go-to-market design
│   └── biotope-gtm-mvp.md        ← phased GTM operational plan
└── .agent/
    └── workflows/                ← task-specific agent playbooks
        ├── platform-setup.md
        ├── new-scenario.md
        └── asset-pipeline.md
```

## Format inspiration

The package layout mirrors the [beads](https://github.com/gastownhall/beads) project's pattern of `AGENTS.md` + `CLAUDE.md` + `AGENT_INSTRUCTIONS.md` + `issues.jsonl` + `.agent/workflows/`. Beads (`bd`) is the recommended task tracker — it's a graph-based issue tracker designed for AI agents with dependency-aware task selection (`bd ready`).

## Getting started

### 1. Read the docs (or have your agent read them)

```bash
# At minimum, read these before starting:
docs/biotope-mvp-planning.md     # product scope and the scenario manifest template
AGENT_INSTRUCTIONS.md            # what to do, in what order, with what gotchas
```

### 2. Install beads and bootstrap

```bash
# Install bd (the beads CLI)
brew install beads
# or: curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash

# Initialize and import the seed issues
./bootstrap.sh
```

### 3. Pick the first work item

```bash
bd ready --json | head -5     # see unblocked tasks at the top of the queue
bd show bd-plat.1             # read the first task in detail
bd update bd-plat.1 --claim   # claim it (sets status=in_progress, assigns to you)
```

The seed graph naturally surfaces `bd-plat.1` (Vite + React + TS scaffold) and `bd-priv.1` (privacy policy) as the first ready tasks — both are P0 with no blockers.

## Developer setup

Once `bd-plat.1` is in (it is — Vite + React + TS scaffold lives at the repo root), here's how to run, build, and deploy.

### Prerequisites

- Node.js **≥ 20.19** (tested on 22.15)
- npm **≥ 10**

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev          # Vite dev server on http://localhost:5173 (cold boot ~120ms)
```

Hot-module reload is on. Vite serves TS/TSX directly — no build step in dev.

### Quality gates

```bash
npm run typecheck    # tsc -b --noEmit; strict mode, must be zero errors
npm run lint         # ESLint flat config (typescript-eslint + react-hooks)
npm run format       # Prettier write
npm run format:check # Prettier check (CI-friendly)
```

Run all four before closing any code-touching issue. They're cheap and catch the obvious stuff.

### Build

```bash
npm run build        # tsc -b && vite build → dist/
npm run preview      # serve dist/ on http://localhost:4173 to smoke-test the bundle
```

Output is a static SPA in `dist/` — `index.html` plus hashed `assets/`. Nothing else needs to run; no backend.

### Path aliases

The workspace dirs are wired through `tsconfig.app.json` + `vite-tsconfig-paths`:

| Alias | Path | Use |
|---|---|---|
| `@app/*` | `app/*` | UI / React components / screens |
| `@engine/*` | `engine/*` | Rendering, runtime, asset loader |
| `@content/*` | `content/*` | Scenario manifests + content data |
| `@tools/*` | `tools/*` | CLI authoring tools (Node, not bundled) |

Import like `import { greet } from '@engine/hello'`, not relative paths across workspaces.

### Deploy

**Today (scaffold state):** `npm run build` produces a static SPA. Any static host works — Cloudflare Pages, Netlify, Vercel, S3+CloudFront, GitHub Pages. SPA fallback (rewrite all unknown paths to `/index.html`) is required.

Quick local-equivalent deploys:

```bash
# Cloudflare Pages (one-shot direct upload, no Git wiring)
npx wrangler pages deploy dist --project-name biotope

# Netlify (one-shot)
npx netlify deploy --dir=dist --prod
```

**MVP target:** Cloudflare Pages or Netlify fronting `biotope.app`, with the PWA installable on iOS Safari and Android Chrome. That work is tracked separately:

- `bd-plat.2` — PWA manifest + service worker (offline-first, asset precache)
- `bd-dist.3` — host wiring at biotope.app, Lighthouse PWA score >90
- `bd-plat.3` — Capacitor wrappers for iOS/Android store distribution
- `bd-dist.1` / `bd-dist.2` — App Store (Kids Category) + Play (Designed for Families) submissions

Don't add SW / Capacitor / store config ad-hoc — pick up the corresponding `bd` issue and follow its acceptance criteria.

### Privacy posture (non-negotiable)

Per `CLAUDE.md` and `AGENTS.md`: no third-party analytics, no telemetry by default, no data leaves device unless explicitly required. If a deploy-side change (CDN logs, edge analytics, error reporting SaaS) would touch user data, stop and file an issue before wiring it.

## Project at a glance

- **Audience:** parent + child, ages 5-12. Lifelong-learning vision extends to age 50, but MVP is focused.
- **Tech stack (B-3):** React + Vite + Three.js + R3F + R3F-Rapier + PixiJS + Ink + XState + Dexie + OPFS + sqlocal + MapLibre + PMTiles + Capacitor.
- **Distribution:** App Store (Kids Category), Play (Designed for Families), PWA at biotope.app. **Soft-launch geography: Canada.**
- **Monetization (post-MVP):** free tier always free; Digital Subscription $9.99/mo; Hybrid Subscription $24.99/mo with quarterly reusable kit.
- **Founder:** solo developer. Asset production: 100% dev assets self-produced; >75% of production assets self-produced; the remaining ~25% (rigged 3D characters, final VO, anchor music) is contracted from a curated network.
- **MVP scenario set:** five scenarios — *Window Watch*, *Backyard Bird Hour*, *Whose Tracks?*, *Leaf Detective*, *Pond Window* — chained by a linear unlock graph.

## Reading order for new agents

1. **`AGENTS.md`** — five-minute orientation. The only mandatory read for any agent.
2. **`docs/biotope-mvp-planning.md`** — what we're actually building. Section 2 is the scenario manifest template; everything else flows from it.
3. **`AGENT_INSTRUCTIONS.md`** — workflow conventions, gotchas, decision gates.
4. **`CLAUDE.md`** *(if you are Claude Code)* — Claude-specific tooling notes.
5. **`docs/biotope-design.md`** — full system context. Reference, not start-to-finish.
6. **`docs/biotope-gtm.md`** and **`docs/biotope-gtm-mvp.md`** — read when product decisions touch GTM (most don't).

## Conventions in this package

- **All work flows through `bd`.** No private TODO lists, no markdown checklists, no "I'll remember." If it's not in beads, it doesn't exist.
- **One commit per significant change**, with the issue ID in parentheses: `git commit -m "Set up Vite + React scaffold (bd-plat.1)"`.
- **Issue claim before work.** `bd update <id> --claim` before any code is written for that issue.
- **Acceptance criteria are gates.** An issue's `acceptance` field describes the bar for closing it. Don't close until verified.
- **Dependencies are a graph, not a wishlist.** If you find new blocking work, file a new issue and add the dependency edge: `bd dep add <new-id> <existing-id> --type blocks`.

## License

The reference docs are authored for Lights Out Games' Biotope project and provided as project-internal materials. Treat the package as confidential to the project.

---

*Working title: Biotope. Replace as desired.*
