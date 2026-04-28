# AGENTS.md — Five-minute orientation

You're an AI coding agent helping build **Biotope**, a parent-and-child ecological learning app. Your work is tracked in [beads](https://github.com/gastownhall/beads) (`bd`). This is the only doc you need to read first.

## What Biotope is

A mobile-first PWA for parents and kids ages 5-12. Loop: **brief → simulated 3D scene → real-world outdoor field activity → re-encoding the field result back into the sim → reflection**. Repeat. The alternation of screen and outdoors is the product's spine.

The full design lives in `docs/`. The MVP scope is narrowed in `docs/biotope-mvp-planning.md`. Read that before doing real work.

## What you do

Pick a ready task, claim it, do it, close it, push.

```bash
# 1. Pick a task with no blockers
bd ready --json | head -5

# 2. Read it
bd show bd-plat.1

# 3. Claim it (atomic: sets status=in_progress + assigns to you)
bd update bd-plat.1 --claim

# 4. Do the work. Honor the issue's `design` and `acceptance` fields.
#    File new issues for follow-up work as you discover it:
bd create "Add retry logic for OPFS write failures" -p 1 -t task

# 5. Close when acceptance criteria are met
bd close bd-plat.1 --reason "Done. Vite scaffold passes build, dev boots in 1.4s."

# 6. Commit with the issue ID in parens
git commit -m "Vite + React + TS scaffold (bd-plat.1)"
git push
```

## Five rules

1. **Read `docs/biotope-mvp-planning.md`** before any work that touches scenarios, the runtime, or the manifest format. It's the contract.
2. **Honor acceptance criteria.** Don't close an issue until its `acceptance` is demonstrably met. If the criteria are wrong, edit the issue (`bd update <id> --acceptance "..."`) and explain why in the description; don't quietly skip them.
3. **File issues for newly-discovered work.** Don't accumulate undocumented TODOs. If you notice something, `bd create` it.
4. **One commit per logical change**, message format: `<short title> (bd-id)`. The issue ID enables `bd doctor` to detect orphaned work.
5. **Honor the privacy posture.** This is a kids' app. No third-party analytics. No telemetry by default. Photos local-only by default. GPS coords obscured to 100m. If you're unsure, default-private.

## Where to look for what

| Question | Read |
|---|---|
| What does this scenario need to look like? | `docs/biotope-mvp-planning.md` |
| What's the right tech for component X? | `docs/biotope-design.md` § 7 (Component Matrix) |
| Why this stack and not another? | `docs/biotope-design.md` § 8 (Stack Variations) |
| How should I add a new scenario? | `.agent/workflows/new-scenario.md` |
| How does the asset pipeline work? | `.agent/workflows/asset-pipeline.md` |
| Is this monetization-policy-relevant? | `docs/biotope-gtm.md` |
| What's our soft-launch geography and timeline? | `docs/biotope-gtm-mvp.md` |
| Detailed agent workflow rules | `AGENT_INSTRUCTIONS.md` |
| Claude Code specific tooling | `CLAUDE.md` |

## Beads cheat sheet

```bash
bd ready                      # tasks with no open blockers (start here)
bd ready --json               # ditto, machine-readable
bd show <id>                  # full task detail
bd show <id> --json           # ditto, machine-readable
bd list --status open         # all open
bd list --priority 0          # all P0
bd update <id> --claim        # claim atomically
bd update <id> --description "..."   # update fields (NEVER use bd edit — it's interactive)
bd close <id> --reason "..."  # close with rationale
bd create "Title" -p 1 -t task --json  # new task
bd dep add <child> <parent>   # add a blocking edge
bd dep tree <id>              # see all blockers / blockees
```

**Never use `bd edit`** — it opens an interactive editor you can't drive. Use `bd update --description`, `--acceptance`, `--design`, `--notes`, `--title` instead.

## Critical-path overview

P0 work clusters into three waves:

**Wave 1 (foundation):** `bd-plat.1, .2, .4, .5` — scaffold, PWA, storage, privacy defaults.

**Wave 2 (engine + runtime):** `bd-engn.1, .3, .4` and `bd-rntm.1, .2, .5` — Three.js, asset loader, audio, manifest schema, loop statechart, Ink integration.

**Wave 3 (first scenario playable):** `bd-flda.1, .3, .5`, `bd-spec.1, .2`, `bd-auth.1, .2`, `bd-scen.1` — camera, parent gate, re-encoding, region pack, scaffolder, validator, Window Watch.

After Wave 3 you have a playable end-to-end Window Watch scenario. That's the first hard milestone. After that, the remaining MVP scenarios (`bd-scen.2..5`) and distribution (`bd-dist.*`) can parallelize.

## Decision gates worth knowing

From `docs/biotope-gtm-mvp.md`:

- **G1 (alpha retention):** before any soft launch, 75%+ of alpha households return for a 7-day repeat session.
- **G2 (organic + product retention):** before turning on monetization, 15%+ 30-day retention with organic acquisition only.
- **G3 (conversion economics):** before pursuing the hybrid pilot, 3%+ Free→Digital conversion within 30 days.

You won't hit these directly as a coding agent, but product decisions in code (paywall placement, prompt timing, etc.) should be aware.

## What "done" means for the MVP

Five scenarios published to App Store + Play in Canada with the free tier and digital subscription, hitting the GTM-MVP Phase 1 retention bar. Hybrid pilot is Phase 3, not MVP.

That's it. Now go read `docs/biotope-mvp-planning.md` and `bd ready`.

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
