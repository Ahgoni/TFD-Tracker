# TFD Tracker — handoff / session memory

**Last updated:** 2026-03-23 (project map + FarmingTab hardening)

At the **start** of a new chat or agent swap: read this file first, then **`docs/PROJECT_MAP.md`** for architecture.
At the **end** of a session or after a major feature: overwrite this file with what changed, decisions, and next steps.

---

## Deep-dive orientation

| Doc | Purpose |
|-----|---------|
| **`docs/PROJECT_MAP.md`** | AppState vs Prisma tables, routes, Nexon pipeline, key files by feature, conventions |
| **`docs/ARCHITECTURE_ROADMAP.md`** | Product vision, live catalog API, future patch tagging |
| **`public/data/README.md`** | Nexon URLs, `fetch:data` / `fetch:stats`, static fallback behavior |

---

## Canonical game data (Nexon)

**Source of truth for copy, names, and mechanics:** Nexon’s official library, e.g. **https://tfd.nexon.com/en/library/descendants** (and `/weapons`, `/modules`). Repo scripts pull the matching machine-readable JSON from `https://open.api.nexon.com/static/tfd/meta/en/` — see `public/data/README.md`, `npm run fetch:data`, `npm run fetch:stats`.

## Product

**TFD Tracker** (`tfdtracker.gg`) — Next.js app for *The First Descendant* inventory/tracker, builds, reactors, etc.

**Stack:** Next.js 16 App Router, TypeScript, React 19, Prisma + PostgreSQL, NextAuth (Discord), @dnd-kit for build planner.

---

## What was done in this session (2026-03-20)

### Overframe-style build planner overhaul

Complete rebuild of the build planner to match Overframe's layout and functionality:

#### New files

| File | Purpose |
|------|---------|
| `scripts/fetch-game-stats.js` | Fetches descendant/weapon/stat data from Nexon Open API, outputs `descendant-stats.json` + `weapon-stats.json` |
| `public/data/descendant-stats.json` | Per-level stats for 33 descendants (HP, Shield, DEF, MP, recovery, etc.) |
| `public/data/weapon-stats.json` | Base stats + firearm ATK per level for 93 weapons |
| `src/lib/tfd-stat-map.ts` | Stat ID → name mapping, display groups (Survivability/Offense/Utility/Handling), short names |
| `src/lib/tfd-stat-engine.ts` | Core stat calculation engine: base stats + module modifiers + reactor contribution → final stats |

#### Modified files

| File | Changes |
|------|---------|
| `package.json` | Added `fetch:stats` script |
| `src/app/tracker/tracker-client.tsx` | Added `customPreview` to `PlacedModule`, new `BuildReactor` interface, added `reactor` + `targetLevel` to `BuildEntry` |
| `src/app/tracker/components/BuildPlannerPanel.tsx` | **Full rewrite**: Overframe layout with faded portrait BG, 3-column layout (stat sheet / module grid+reactor / library), live stat calculations, ancestor module editor, reactor integration (import from inventory or create inline), expand-mods toggle, fixed DnD (removed `snapCenterToCursor`) |
| `src/app/tracker/components/BuildsTab.tsx` | Wired `reactor` + `targetLevel` into form state, passes them to `BuildPlannerPanel`, saves on `BuildEntry`, shows reactor info on build cards |
| `src/app/globals.css` | New CSS: `.builder-portrait-bg`, `.builder-skills-row`, `.builder-stat-sheet`, `.builder-stat-row`, `.builder-reactor-section`, `.builder-reactor-form`, `.builder-ancestor-editor`, `.builder-slot-edit`, `.mod-lib-expanded`, `.mod-lib-preview-full`, `.builder-expand-toggle`, `.builder-center-col`, `.builder-level-*`, `.btn-sm`, plus light mode overrides for all |

#### Key features

- **Portrait background**: Faded descendant/weapon art (opacity 0.12, blur) behind the hero header
- **Skill icons**: Row of 4 descendant skill icons in the hero (fetched from Nexon data)
- **Live stat sheet**: Left column shows base → final stats grouped by category, color-coded deltas (green=buff, red=debuff), updates live as modules are added/removed
- **Level selector**: Choose target level (1-40 descendant, 1-100 weapon) for stat calculations
- **Reactor integration**: Import from saved inventory or create an inline reactor; element/skill type chips, level, enhancement, 2 substats
- **Ancestor module editing**: Pencil button on ancestor modules opens inline editor for % values
- **Expanded module cards**: Toggle in library to show full effect text
- **Fixed drag-and-drop**: Removed `snapCenterToCursor` modifier entirely — DragOverlay now follows grab point correctly

### Full codebase audit + cleanup (earlier in session)

Ran a thorough audit of every key source file. Found and fixed **17 issues** left by previous AI agents:

#### Code fixes

| File | Fix |
|------|-----|
| `src/lib/tracker-data.ts` | **Removed dead `portraitPath`** function (unused, pointed at `/Images/Descendants/` which violates lowercase-path policy). Icon paths use `/game-icons/*.svg` and `/game-ammo/*.svg`. |
| `src/app/api/friends/route.ts` | **Normalized username tokens to lowercase** (`token.slice(9).toLowerCase()`) in both `resolveFriendUserId` and POST — prevents case-mismatch misses. |
| `src/app/tracker/tracker-client.tsx` | **Added `fetchAndMergeDescendantsCatalog`** to `importFromLocalStorage` — import path was missing descendant catalog merge. **Removed dead `descFilter` field** from `TrackerState` type and default. |
| `src/lib/tracker-default-state.ts` | Removed `descFilter: "all"` (unused legacy field). |
| `src/app/tracker/components/DescendantsTab.tsx` | Renamed `weapon-filters` class to `tracker-filters` (was a copy-paste naming error). |
| `src/app/tracker/components/BuildPlannerPanel.tsx` | Renamed `hero-badge` classes to `builder-hero-badge` to avoid collision with landing page `.hero-badge`. |
| `scripts/link-public.js` | Updated fallback message to reference `public/game-icons/` and `public/game-ammo/`. |

#### CSS fixes (`src/app/globals.css`)

| Issue | Fix |
|-------|-----|
| **`.hero-badge` name collision** — landing page vs build planner | Builder now uses `.builder-hero-badge`, `.builder-hero-badge-accent`, `.builder-hero-badge-warn`. |
| **Duplicate `.tier-pill`** — global rule overridden by builder rule | Builder rule scoped: `.builder-tier-mix .tier-pill`. |
| **Duplicate `[data-theme="light"] .filter-chip`** (lines 2072 vs 2682) | Removed earlier block; kept comprehensive one with `!important`. |
| **Duplicate `[data-theme="light"] .panel::before`** (lines 2059 vs 2789) | Removed second. |
| **Duplicate `[data-theme="light"] .hero-bg::before`** (lines 2181 vs 2281) | Removed second. |
| **Duplicate `[data-theme="light"] .btn-ghost`** (lines 2218 vs 2727) | Removed earlier; kept comprehensive block. |
| **Duplicate `input:focus-visible`** (lines 64 vs 600) | Merged: `button:focus-visible` at top, `input/select` in form section, both use `var(--accent)`. |
| **`.mini-btn` light mode styled as danger (red)** | Fixed to neutral light-mode styling (eef2fc + accent on hover). |
| **`img[src*="general.webp"]` obsolete** | Updated to `general.svg`. |
| **`--card-bg` undefined** | Added to both `:root` (#111e33) and `[data-theme="light"]` (#f5f8ff). |
| **`.tier-norm` missing light-mode override** | Added `[data-theme="light"] .tier-norm`. |
| **`.tracker-filters` class** | Added alongside `.weapon-filters`. |
| **`[data-theme="light"] .tab-nav button.active`** | Removed duplicate early block (kept comprehensive one at ~2661). |

### Previous session fixes (still in effect)

- **Icons:** `/game-icons/*.svg` and `/game-ammo/*.svg` under `public/` (lowercase, case-sensitive safe).
- **DnD:** `snapCenterToCursor` only on `DragOverlay`, not on `DndContext`.
- **Reactor form:** Notes full-width (`.form-grid-notes`), Add Reactor in `.form-actions-row`.
- **`.builder-slot-x`:** flex centering + optical tweak for × glyph.
- **`.chip-field-row`:** `align-items: center`.
- **Prisma routes:** `findFirst` for username lookups where generated types don't expose `username` on `UserWhereUniqueInput`.

---

## Architecture decisions (do not regress)

1. **Lowercase static paths** — all UI icons served from `/game-icons/` and `/game-ammo/` (not `/Images/`). Weapon/descendant art still uses `/Images/` via symlink (link-public.js).
2. **Builder CSS namespace** — builder-specific badges use `builder-hero-badge-*` (not `hero-badge`).
3. **CSS variables** — `--card-bg` now defined on both themes; used by mastery, builder, friend panels.
4. **Username normalization** — all `username:` friend tokens lowercased before DB lookup.
5. **Stat data** — `descendant-stats.json` and `weapon-stats.json` generated by `scripts/fetch-game-stats.js` from Nexon Open API; re-run after game patches.
6. **Build planner layout** — 3-column Overframe-style: stat sheet (left) / module grid + reactor (center) / module library (right). Portrait background with faded art.
7. **DragOverlay** — no modifiers; follows native grab point. Do not re-add `snapCenterToCursor`.
8. **BuildReactor** — stored on `BuildEntry` (not separate from builds); can import from inventory or create inline.

---

## Known issues / what's left

- [ ] **Confirm production** shows icons correctly after deploy (hard refresh to bypass stale cache).
- [x] **Build planner drag preview** — fixed: removed `snapCenterToCursor` entirely, DragOverlay follows grab point natively.
- [ ] **Weapon/descendant art** still relies on `/Images/` symlink for portrait images and weapon icons. Long-term: commit or migrate to lowercase paths.
- [x] **`FarmingTab`** — hardened: `goals` / `goalsFilters` default safely when missing from saved state (2026-03-23).
- [ ] **Light mode: `.portrait-initials`** class referenced in DescendantsTab but not styled.
- [ ] Optional: use `findUnique` instead of `findFirst` for `@unique` username fields (cleaner, same behavior).
- [ ] **Re-run `npm run fetch:stats`** periodically (after Nexon patches) to update descendant/weapon data.
- [ ] **Weapon ID resolution** — weapon stat lookup in `computeWeaponStats` matches by slugified name; may miss weapons with unusual naming. Consider storing the Nexon weapon ID on `WeaponEntry`.
- [ ] **Transcendent tier substats** — the ancestor editor allows editing % values but doesn't yet have a formal tier selector per substat line.

---

## Deploy (typical)

Server: `~/apps/TFD/tfd-web` on Ubuntu.

1. `git pull`
2. `npm install` (if deps changed)
3. `npx prisma generate` / `prisma migrate deploy` (if schema changed)
4. `npm run build`
5. `pm2 restart`

After deploy: **hard refresh** to clear stale asset caches.

---

## Cursor project rules

- **`.cursor/rules/tfd-stack.mdc`** — stack conventions (always apply)
- **`.cursor/rules/tfd-api-state.mdc`** — API validation (`src/app/api/**`)
- **`.cursor/rules/memory-handoff.mdc`** — read/update HANDOFF.md (always apply)
- **`.cursorrules`** — root pointer for tools that only check root

---

## Session log

| Date       | Summary |
|-----------|---------|
| 2026-03-23 | Added **`docs/PROJECT_MAP.md`** (AppState-centric data flow, dual Prisma tables, Nexon pipeline, file map). Hardened **`FarmingTab`** for missing `goals` / `goalsFilters`. Updated **AGENTS.md**, **CURSOR_MEMORY.md**, Cursor rules list in handoff. |
| 2026-03-20 | Full audit + cleanup: fixed 17 issues (CSS duplication, dead code, hero-badge collision, mini-btn light mode, --card-bg, tier-norm, username normalization, import catalog merge, descFilter removal). Build passes clean. |
| 2026-03-20 | **Overframe build planner overhaul**: Nexon stat data fetch script, stat engine, stat map, full panel rewrite (portrait BG, live stats, reactor integration, ancestor editor, expanded cards, fixed DnD). Data model expanded with `BuildReactor`, `customPreview`, `targetLevel`. Build passes clean. |
