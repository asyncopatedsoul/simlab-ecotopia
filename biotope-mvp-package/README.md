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
