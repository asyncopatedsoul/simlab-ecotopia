# AGENT_INSTRUCTIONS.md — Detailed Operational Instructions

For project orientation, read [`AGENTS.md`](AGENTS.md) first. This document is the deeper reference: workflow conventions, gotchas, decision frameworks, and a roadmap of which docs to consult when.

---

## 1. Operating principles

1. **The graph is the plan.** Beads (`bd`) is the source of truth for what work exists, what's blocked on what, and who's doing what. Markdown checklists in PRs, code comments saying "TODO later," and undocumented promises do not exist as far as the project is concerned.

2. **The reference docs are the contract.** `docs/biotope-design.md` and `docs/biotope-mvp-planning.md` describe what we're building. If you find them ambiguous, pause and ask — don't invent. If you find them wrong, propose an edit with rationale.

3. **Scope discipline is the founder's biggest risk.** This is a solo-developer MVP. Every "while I'm here, I'll just add..." is a serious cost. The MVP doc has a long *deliberately-out* list. Treat it as binding.

4. **Privacy defaults are non-negotiable** because of the audience. Kids' app. Default-private architecture. No third-party analytics in MVP. Just-in-time permission prompts only.

5. **Acceptance criteria are gates, not suggestions.** Don't close an issue until the `acceptance` field is demonstrably met. If it can't be, edit the field with rationale and link the change in the issue's notes.

---

## 2. Day-to-day agent workflow

### Picking work

```bash
# Show ready (unblocked) tasks, sorted by priority
bd ready --json | jq '.[] | select(.priority == 0)'

# If nothing P0 is ready, drop to P1
bd ready --json | jq '.[] | select(.priority <= 1)'

# Read the issue + its design + acceptance + referenced docs
bd show <id>
```

The seed graph naturally surfaces `bd-plat.1` and `bd-priv.1` as the first two ready tasks. Both are P0 with no blockers.

### Starting work

```bash
# Atomic claim: sets status=in_progress and assigns to you
bd update <id> --claim
```

Read the issue's `_refs` field — it points at the relevant section of the docs. **Read those sections before writing code**, not after.

If the issue description is too thin, augment it before starting:
```bash
bd update <id> --description "..."
bd update <id> --design "..."
```

### During work

Work on one issue at a time when possible. If you discover a blocker that wasn't in the original issue:

```bash
# File the blocker
bd create "Blocker title" -p 1 -t task --description "..." --json

# Add the dependency edge
bd dep add <existing-id> <new-id> --type blocks
```

If you discover that what you thought was one issue is actually two:

```bash
# File the second issue
bd create "Split-out title" -p 1 -t task --json

# Update the original to clarify scope
bd update <original-id> --description "Updated scope: only does X. Y is now bd-yyy."

# Optionally relate them
bd dep add bd-yyy <original-id> --type related
```

### Closing work

Acceptance must be met. Don't close an issue and call it done if a checkbox in `acceptance` is unverified.

```bash
# Close with a real reason — this becomes the audit trail
bd close <id> --reason "Acceptance verified. <one-line of what shipped, where>."
```

### Commit + push

```bash
# Commit with the issue ID at the end
git commit -m "Short title (bd-xxx)"

# Push immediately — don't accumulate local commits across issues
git push
```

`bd doctor` cross-references open issues with git history; orphan detection depends on the parens convention.

---

## 3. The reference doc map

Which doc to read when you have which question:

| You're working on... | Primary doc(s) |
|---|---|
| Anything in the runtime, scenario format, or storage layer | `docs/biotope-mvp-planning.md` (especially § 2 — the manifest template) |
| Something where the tech choice is uncertain | `docs/biotope-design.md` § 7 (Component Matrix) and § 8 (Stack Variations) |
| Architecture-level "how do these layers relate" | `docs/biotope-design.md` § 5 (System Architecture) |
| Any kids/parents/audience question | `docs/biotope-design.md` § 2 (Player Modes & Group Dynamics) |
| Scenarios for older audiences (13+, 18+) | Out of MVP scope. Read `docs/biotope-design.md` § 3 only if relevant context is needed. |
| Anything store / pricing / monetization | `docs/biotope-gtm.md` |
| Anything launch-timing / phase / soft-launch geo | `docs/biotope-gtm-mvp.md` |
| A new scenario | `.agent/workflows/new-scenario.md` |
| Asset pipeline (3D, audio, image compression) | `.agent/workflows/asset-pipeline.md` |
| Initial project bootstrap | `.agent/workflows/platform-setup.md` |

---

## 4. Privacy and safeguarding rules

These are project-wide rules. They are not negotiable per-task; they apply everywhere.

### Data flow

- **Photos:** captured, EXIF-stripped, stored to OPFS, never uploaded without explicit per-photo parent consent.
- **Location:** read at the precision needed for the activity, immediately rounded to the nearest 100m before any storage.
- **Voice input:** off by default. Voice *output* (TTS narration) is fine and on by default for `pre_reader` UI mode.
- **Account creation:** deferred to first save. The first scenario must complete with no account.
- **Telemetry:** none in MVP. Crash reporting is opt-in only and aggregated.

### SDK policy

- **No third-party advertising SDKs**, ever, in any tier.
- **No third-party analytics** in MVP. (Post-MVP, mParticle / AppsFlyer wiring becomes relevant for the GTM-MVP Phase 2 launch — but that's a deliberate, gated decision, not a default.)
- **First-party packages only** for anything touching user data. If a node_modules install fetches an analytics-tied transitive dep, audit and replace.

### Permission UX

Every permission prompt is wrapped in a kid-friendly explainer overlay BEFORE the OS-level prompt. The overlay has:

- An illustration of what's being requested (camera = phone-aimed-at-tree).
- One sentence explaining why, in age-appropriate language.
- Voice-over read-aloud for `pre_reader` and `early_reader` rungs.
- A "not now" option that's the same visual size as "yes".

### When in doubt

Ask. If a task seems to require relaxing any of the above, that's a stop-and-ask moment, not a judgment call.

---

## 5. Decision frameworks

### When two implementations both work

1. Pick the one matching the **Default** column in `docs/biotope-design.md` § 7 (Component Matrix).
2. If neither matches Default, pick the one matching Variation B in § 8.
3. If still neither, prefer the simpler one — but flag the choice in the issue's notes.

### When a task seems ambiguous

1. Re-read the issue's `_refs` doc sections.
2. Re-read the issue's `design` field.
3. If still ambiguous, write your interpretation as a comment in the issue and **wait for confirmation** before writing significant code:
   ```bash
   bd update <id> --notes "Interpretation: I'm reading this as <X>. The alternative reading is <Y>. Picking <X> because <reason>. Will proceed unless told otherwise."
   ```

### When you find a doc bug

If the docs say one thing and reality requires another:

1. Don't silently work around. Flag it.
2. Edit the doc with rationale (in a separate commit if convenient).
3. If the change is significant (manifest format, stack, audience model, monetization), pause and ask the user. The docs are versioned for a reason.

### When you discover scope expansion

If completing the assigned issue genuinely requires expanding into adjacent territory:

1. **Don't** quietly expand the work.
2. **Do** file the adjacent work as new issues with dependencies.
3. **Do** update the original issue's description to clarify what's in vs out.
4. **Do** decide which sequence makes sense — you may need to close the original (with a "rescoped to bd-xxx, bd-yyy") and pick up the new sequence.

---

## 6. Specific gotchas

### Beads gotchas

- **Never use `bd edit`** — it opens an interactive editor. Use `bd update --description`, `--design`, `--acceptance`, `--notes`, `--title` instead.
- **`bd update --claim`** is atomic. Don't separately set status and assignee.
- **`bd ready` only shows tasks with no open blockers.** If you think a task should be ready but isn't, run `bd dep tree <id>` to see what's blocking it.
- **Hash IDs prevent merge conflicts** in multi-agent workflows. Use them as-is; don't rename.
- **Quote special characters in descriptions.** Backticks, `$`, `!`, nested quotes break shell parsing. Use stdin: `echo 'Description with `backticks`' | bd update <id> --description=-`

### Storage gotchas

- **`navigator.storage.persist()`** is requested at first scenario load, not at app launch. Browsers grant it more readily after user interaction.
- **OPFS is per-origin**, like all other storage. If we ever move to multiple subdomains, storage doesn't carry over.
- **Quota varies wildly** — Chrome ~60% of disk, Safari ~1GB, Firefox ~10% of disk. Plan for the floor.
- **iOS Safari evicts aggressively** when the user is low on storage. Persist requests help; nothing fully prevents eviction.

### R3F + Three.js gotchas

- **Lazy-load KTX2 and Draco loaders.** They're 800KB+ together; load them in the same Suspense boundary as the first scene that needs them, not at app start.
- **`useGLTF` caches by URL.** Cache-bust by appending `?v=hash` when content updates.
- **WebGL context loss** happens on iOS Safari when the tab backgrounds for >30s. Listen for `webglcontextlost` and rebuild the scene.

### iOS / Safari gotchas

- **Web Speech API is partly broken on iOS.** TTS works; recognition is unreliable. Use Moonshine WASM for offline STT.
- **`getUserMedia` requires HTTPS** even in development; use `localhost` or a tunneled HTTPS dev server.
- **Service workers don't update until the next page load.** During development this causes confusion; add a hard-refresh button to your dev menu.

### Capacitor gotchas

- **Camera plugin v6 changed photo paths** — file URIs now need `Capacitor.convertFileSrc()` before being usable in `<img src=...>`.
- **iOS background suspension** kills service worker timers. Don't rely on long-running JS for anything time-critical.
- **The Android emulator's GPS is fake** — for GPS bounding tests, use a real device or carefully scripted location mocks.

---

## 7. Quality gates

Before closing any issue with code changes:

```bash
# Type-check
npm run typecheck

# Lint
npm run lint

# Tests
npm test

# Asset budget check (for scenario-related tasks)
npx biotope-validate ./content/scenarios/<slug>
```

If any of these break and you can't easily fix them, file a P0 issue and link it to the in-flight issue. Don't close on red.

For scenario tasks, also run the per-rung playthrough harness (`bd-auth.4`):

```bash
npm run test:scenarios -- --scenario=<slug>
```

This catches age-rung-specific regressions that are otherwise invisible.

---

## 8. Communicating with the user

The user (founder) is an experienced operator. Default to:

- **Specific recommendations** over option menus.
- **Surfaced real risks** over hypothetical generic ones.
- **Brevity** over completeness; ship a draft, iterate.
- **The actual reasoning** behind a decision, not "best practices" hand-waving.

Don't paraphrase the docs at the user. If a question maps to a doc section, point at it.

When you find architectural decisions that will be expensive to undo, surface them early and clearly:

> "Choosing X commits us to Y at scenario count > 50. We can revisit when we're at ~30 scenarios. Filing bd-xxx as a watch item."

---

## 9. The land-the-plane workflow

When the user says "land the plane" or signals the session is wrapping:

1. **File new issues** for any work the session uncovered.
2. **Run quality gates** (typecheck, lint, tests, validators).
3. **Close finished issues** with rationale.
4. **Commit + push.** Repeat: the plane has not landed until `git push` succeeds.
5. **Verify clean state:** `git status` shows clean; `bd ready` shows what's queued for next session.
6. **Hand off** with a short summary:
   - What shipped this session
   - What's filed for follow-up
   - Status of quality gates
   - Recommended first task next session

Do not end with "ready when you are." You push, not the user.

---

## 10. Appendix: file index

```
biotope-mvp-package/
├── README.md                     ← orientation; entry point
├── AGENTS.md                     ← 5-min agent quickstart
├── CLAUDE.md                     ← Claude Code specifics
├── AGENT_INSTRUCTIONS.md         ← this file
├── bootstrap.sh                  ← bd init + import + apply deps
├── issues.jsonl                  ← seed work items (54 issues)
├── docs/
│   ├── biotope-design.md         ← v3 system design
│   ├── biotope-mvp-planning.md   ← v2 product MVP scope (the contract)
│   ├── biotope-gtm.md            ← go-to-market design
│   └── biotope-gtm-mvp.md        ← phased GTM operational plan
└── .agent/
    └── workflows/
        ├── platform-setup.md     ← initial project bootstrap
        ├── new-scenario.md       ← adding a new scenario end-to-end
        └── asset-pipeline.md     ← compress and ship assets
```

When in doubt about which doc applies, this file's § 3 maps task → doc.
