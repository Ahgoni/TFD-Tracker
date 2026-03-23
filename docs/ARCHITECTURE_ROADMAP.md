# Architecture roadmap (strategic)

This document captures the **vision** for TFD Tracker as a **premier, Overframe-tier** community tool: modern stack, Nexon-accurate mechanics, and a UI that prioritizes **discovery and patch relevance**.

## 1. UX hierarchy (Overframe-aligned)

| Goal | Direction |
|------|-----------|
| Persistent navigation | Top-level app shell: tracker sections remain one click away; avoid deep dead-ends. |
| Categorized tabs | Descendants / Weapons / Builds / Reactors / etc. — consistent tab language and filters. |
| Build cards | Dense: name, target, type, key modules, reactor line, external set summary, updated date — filterable by patch/meta when available. |
| Patch relevance | Filters and labels should eventually tie to **game version** (see §4). |

**Status:** Build planner and cards are evolving toward this; continue tightening card density and global nav consistency.

## 2. TFD visual language

- **Tier ladder:** Normal → Rare → Ultimate → Transcendent (Nexon Tier1–Tier4). See `.cursor/rules/design-system.mdc`
- **Chipset aesthetic:** Modules as bordered chips with capacity, socket, tier — already reflected in `BuildPlannerPanel` / `globals.css`.
- **Explicit tokens:** Prefer CSS variables (`--tier-*`, `--accent`, `--line`) over ad-hoc colors in new UI.

## 3. Build calculator as a math engine

- **Today:** Capacity, effective max, descendant group peers, reactor + stat engine — centralized in `src/lib/tfd-modules.ts`, `tfd-stat-engine.ts`, etc.
- **Future:** Catalyst rules, auto-socketing, richer socket constraints — implement in **libraries**, surface results in UI; keep Nexon JSON as source of truth.

## 4. Live service & patches

- **Today:** User state lives in `AppState` JSON + Prisma; builds do not yet store a **game patch version** string.
- **Future:** Tag builds (and optionally catalog snapshots) with `game_version` or `season_id` so lists can filter “current patch” vs archived; coordinate with `npm run fetch:data` / `fetch:stats` after Nexon updates.

## 5. Development workflow

- **Cursor rules:** `design-system.mdc`, `tfd-nexon-data.mdc`, `git-commit-push.mdc`, `memory-handoff.mdc` — keep them updated when conventions change.
- **Zoom-in method:** Large features → thin vertical slices → merge; avoid huge unreviewable diffs.

## 6. References

- Canonical data: [Nexon library](https://tfd.nexon.com/en/library/descendants) + `open.api.nexon.com/static/tfd/meta/en/`
- Repo: `README.md`, `HANDOFF.md`, `public/data/README.md`
