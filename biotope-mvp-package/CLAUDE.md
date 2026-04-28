# CLAUDE.md — Claude Code specific guidance

This file augments `AGENTS.md` with notes for Claude Code in particular. If you're a different agent, you can mostly ignore this; everything important lives in `AGENTS.md` and `AGENT_INSTRUCTIONS.md`.

## Read this first

If you're starting a Claude Code session on this project, read in this order:

1. `AGENTS.md` (5 min) — orientation.
2. `docs/biotope-mvp-planning.md` (15 min) — what we're actually building. The scenario manifest in section 2 is the contract.
3. `AGENT_INSTRUCTIONS.md` (10 min) — workflow conventions.
4. Then `bd ready` and pick a task.

Skim, don't deep-read, the other docs in `docs/` until you need them.

## Plan mode is your friend

Before any non-trivial issue (anything beyond a single-file edit), use plan mode to write out the approach, get user confirmation, and then execute. The issue's `design` field is the input; your plan elaborates it.

For trivial work (a typo fix, a comment update), just do it.

## Tooling expectations

| Tool | Use |
|---|---|
| `Bash` | All `bd` commands; all builds, tests, asset pipeline runs |
| `Read` / `Grep` | Source navigation. **Read the issue's `_refs` doc sections before starting** |
| `Edit` / `Write` | Source edits |
| `WebSearch` / `WebFetch` | Researching unfamiliar libraries (R3F gotchas, MapLibre PMTiles plugin status) |
| `Task` | Spawn subagents for **parallel exploration only** — e.g., "go find every file that imports the old asset loader" while you continue planning. Don't spawn subagents to do the work itself. |

## Project-specific Claude conventions

### Don't paraphrase the docs at the user

The reference docs in `docs/` are authored carefully. When the user asks "what should the manifest look like?" — point them at `docs/biotope-mvp-planning.md` § 2, don't re-summarize. Save context budget.

### When in doubt about scope, ask

The MVP doc has a *long* "deliberately out" list (XR, dedicated server, embedded systems, voice chat, hard-engineering domain solvers, Steam, Switch, sync, UGC). If a task seems to drift toward any of these, stop and confirm with the user before expanding scope. Scope creep is the #1 risk for a solo founder MVP.

### Privacy posture is non-negotiable

When making any decision about data collection, telemetry, third-party SDKs, or anything that could leave the device:

- **Default-private** unless explicitly asked otherwise.
- **No third-party analytics** in MVP, period. (mParticle / AppsFlyer wiring is post-MVP per the GTM doc.)
- **Camera/GPS:** just-in-time prompts, never at app launch, always wrapped in the kid-friendly explainer overlay (`bd-plat.5`).
- **EXIF stripped on photo capture** (`bd-flda.1`).
- **GPS coords obscured to 100m** before any storage (`bd-flda.2`).

If a task seems to require relaxing any of these, that's a flag to stop and ask the user.

### Founder context

The founder (Mike Garrido) is a working solutions architect at 6sense (current day-job) with deep relevant background — toy-to-life founder (Prizm Labs), DIY electronics shipping (Olaunch), shipped F2P (Scopely), MarTech specialist (mParticle/AppsFlyer/TestBox), permaculture practitioner. He's an experienced operator, not a beginner.

What this means for how you respond:

- **Don't over-explain familiar tooling.** He knows what Vite, React, Capacitor, App Store Connect, COPPA, and IndexedDB are. Skip the tutorials.
- **Default to recommendations, not menus.** If asked "what library?" answer with a specific choice and your reasoning, not five options for him to pick from.
- **Surface real risks, not hypothetical ones.** He doesn't need warnings about generic startup risks; he needs you to flag specific architectural decisions that will be expensive to undo.

## Tools that are NOT in scope

Don't reach for these unless the user explicitly requests:

- **Heavy frontend frameworks** beyond React (Next.js for SSR — irrelevant for offline-first; Remix; etc.). The MVP is React + Vite. That's the decision.
- **Complex state management** beyond Zustand + XState. No Redux, no MobX, no Jotai. The choice is made.
- **Custom build tools** beyond Vite. No Webpack, no Rollup direct config, no esbuild scripts. Vite plugins are fine; replacing Vite is not.
- **Backend services** beyond what the MVP doc describes. No Firebase, no Supabase, no AWS. The MVP is offline-first, no backend at all. The dedicated server (Colyseus) is post-MVP per the design doc.
- **Generative AI for shipped content.** AI is in the *development asset* pipeline (placeholder art, scratch VO) per the GTM doc; never for shipped creative. The 75% self-produced target is real human labor.

## Useful commands you'll run a lot

```bash
# Find a task to work on
bd ready --json | jq '.[] | {id, title, priority}'

# Read all P0s in dependency order
bd list --priority 0 --json | jq '.[] | {id, title, status}'

# What blocks me from starting bd-scen.1?
bd dep tree bd-scen.1

# When you discover something requires more work than the issue described,
# split it: file new sub-issues and add deps to the original
bd create "Sub-issue title" -p 1 -t task --json
bd dep add <new-id> bd-scen.1 --type blocks
```

## Land-the-plane checklist (Claude Code)

When the user says "let's land the plane" or "wrap up this session":

1. Run `bd ready --json` to confirm what's queued for next session.
2. Run lints and tests:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
3. **File any new issues** discovered during the session.
4. **Close finished issues** with a real reason: `bd close bd-xxx --reason "Acceptance met. <one-line of what shipped>."`
5. **Commit and push.** The plane has not landed until `git push` succeeds.
6. Hand off with: a one-paragraph summary of what shipped, what was filed for follow-up, and a recommended first task for the next session.

Don't end the session by saying "ready when you are" — push, then summarize. The user is coordinating other work; unpushed code is invisible to them.

## When the docs and reality disagree

The reference docs in `docs/` are deliberate but not infallible. If a doc claims X and the actual constraint is Y:

1. Don't silently work around it. Flag it.
2. Propose an explicit edit to the doc with rationale.
3. If it's significant (changes the manifest format, the stack, the audience model), pause and ask the user.

The docs are versioned (v3 on the design doc, v2 on the planning doc). Edits should be versioned likewise. **A scenario manifest schema change is a major version bump on `biotope-mvp-planning.md`, with a migration plan for existing scenarios.**


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
