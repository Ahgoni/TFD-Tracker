# TFD Tracker — handoff / session memory

**Last updated:** 2026-03-20 (post-cleanup audit)

At the **start** of a new chat or agent swap: read this file first.
At the **end** of a session or after a major feature: overwrite this file with what changed, decisions, and next steps.

---

## Product

**TFD Tracker** (`tfdtracker.gg`) — Next.js app for *The First Descendant* inventory/tracker, builds, reactors, etc.

**Stack:** Next.js 16 App Router, TypeScript, React 19, Prisma + PostgreSQL, NextAuth (Discord), @dnd-kit for build planner.

---

## What was done in this session (2026-03-20)

### Full codebase audit + cleanup

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

---

## Known issues / what's left

- [ ] **Confirm production** shows icons correctly after deploy (hard refresh to bypass stale cache).
- [ ] **Build planner drag preview** — verify `snapCenterToCursor` positions correctly; if still offset, try removing modifiers entirely.
- [ ] **Weapon/descendant art** still relies on `/Images/` symlink for portrait images and weapon icons. Long-term: commit or migrate to lowercase paths.
- [ ] **`FarmingTab`** — `state.goals.filter(...)` could throw if `goals` is ever `undefined` from malformed saved state; safer: `(state.goals ?? []).filter(...)`.
- [ ] **Light mode: `.portrait-initials`** class referenced in DescendantsTab but not styled.
- [ ] Optional: use `findUnique` instead of `findFirst` for `@unique` username fields (cleaner, same behavior).

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
| 2026-03-20 | Full audit + cleanup: fixed 17 issues (CSS duplication, dead code, hero-badge collision, mini-btn light mode, --card-bg, tier-norm, username normalization, import catalog merge, descFilter removal). Build passes clean. |
