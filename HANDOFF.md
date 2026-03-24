# TFD Tracker — handoff / session memory

**Last updated:** 2026-03-24 (tier list mod panel + synthetic overlay)

**Latest (2026-03-24):** **Tier list mod (owner-only):** env **`TIER_LIST_MOD_DISCORD_IDS`** (comma-separated snowflakes) gates **`/api/tier-list/mod/*`**. Matching Discord sign-in sees collapsible **`TierListModPanel`** on the tier list; others see nothing. **Synthetic overlay** (`TierListModOverlay`) adjusts per-tier counts on read (real `TierVote` rows unchanged unless mod deletes them). Run **`prisma migrate deploy`** for new table.

**Earlier (2026-03-24):** **Community tier list:** votes aggregate with **weights S=5 … D=1**. **Row placement** uses **rounded weighted mean** (not raw plurality). **Score %** = `(mean − 1) / 4 × 100` (D→0%, S→100%). **Bar** = vote share by tier; **letter in bar** = **plurality** (ties S→D). API: `votesByTier`, `scorePercent`, `consensusTier`. UI: `community-tier-list` list rows + modal blurb. Lib: `tier-list-aggregate.ts`.

**Earlier (2026-03-24):** **`error=OAuthCallback`:** token/userinfo step with Discord failed (not Prisma). **`authOptions.secret`** from `NEXTAUTH_SECRET` or `AUTH_SECRET`; **`logger.error`** → server console. **`DEPLOY_UBUNTU.md` §10:** nginx **`X-Forwarded-Proto $scheme`** (was missing); §11 troubleshooting (WAF, ad-block, env).

**Earlier (2026-03-24):** **NextAuth `error=Callback` / sign-in failure:** wrapped Prisma adapter **`createPrismaAuthAdapter`** only writes `name`/`email`/`emailVerified`/`image` (avoids Prisma rejects from extra profile keys). Discord **`allowDangerousEmailAccountLinking: true`** links an existing `User` with the same email when the `Account` row is missing (single-provider app).

**Earlier (2026-03-24):** **`redirectToDiscordOAuth`** (`src/lib/discord-oauth-redirect.ts`) POSTs to `/api/auth/signin/discord` without calling **`/api/auth/providers`** first (when that fetch failed, NextAuth used to send users to the built-in **`/api/auth/signin`** page). **`callbacks.redirect`** normalizes relative `callbackUrl`s (reduces `error=Callback`). **Language:** globe + `<select>` in one bordered **`language-select-inner`** chip for alignment.

**Earlier (2026-03-24):** **Auth / profile:** **`User.nexonIngameName`** (optional, self-attested); Nexon does not offer public OAuth for arbitrary sites — **`src/lib/auth.ts`**.

**Earlier (2026-03-24):** **Nav + i18n:** **Overframe-style** top bar: **Home**, **Tier List**, **Tracker** (when signed in), plus **language** (`LanguageSelect`), theme, auth. **`/tier-list`** route hosts **`CommunityTierList`**; landing links there via hero strip. **`I18nProvider`** wraps the app (`localStorage` + **`tfd-locale`** cookie, **`document.documentElement.lang`** + inline script in `layout.tsx`). Messages: **`src/messages/{en,ko,ja,…}.json`**. **`SiteTopNav`**, **`LanguageSelect`**, **`HomeLandingContent`**, tracker top bar **Home / Tier List** links.

**Earlier (2026-03-24):** **NextAuth:** removed **`pages.signIn: "/"`** — custom sign-in on the landing page broke Discord OAuth (users landed on `/?callbackUrl=…` with no provider flow). Default **`/api/auth/signin`** is used again. **Shared builds:** tier hub + Copy link use **`/u/{username}/b/{buildId}`** (single-build read-only page). Old **`#build-`** profile URLs **redirect** to `/b/`. **`PublicBuildCard`** extracted for reuse.

**Earlier (2026-03-24):** **`npm run build`** runs **`prisma generate && next build`** so VPS builds never use a stale Prisma client. Tier list enums use **`src/lib/tier-list-category.ts`** (not importing `TierListCategory` from `@prisma/client` in API routes).

**Earlier (2026-03-24):** **Landing** — community **tier list** (Descendants / Weapons tabs): Discord sign-in, merged **base + Ultimate** descendants by `descendant_group_id`. (Ranking now **weighted mean** + distribution UI — see **Latest**.) **`BuildEntry.communityPublic`** + **`PublicBuildListing`** (synced on **`/api/state`** when **`sharePrivacy === "open"`**) powers “public builds” links from tier rows → **`/u/{username}/b/{buildId}`**. Prisma: **`TierVote`**, **`PublicBuildListing`**, migration **`0007_tier_list_community`**. Weapon keys use **`public/weapons-catalog.json`** slugs (matches build `targetKey`).

**Earlier (2026-03-24):** **Player Lookup** — **Dia Modules** trigger slot: show only **icon, module name, and “Trigger”** (tier border preserved). Removed capacity corner badge, inline roll/catalog lines, and hover detail panel — API does not reliably expose the player’s real trigger rolls in this view.

**Earlier (2026-03-24):** **Materials** tracking removed app-wide (tab, Welcome stats/cards, share/public pages, landing copy). State migration strips legacy `materials` and `Materials` tab from saved JSON. Prisma: `MaterialEntry` dropped (migration `0006_remove_material_entry`). `/api/materials` deleted. If `next build` fails on stale `.next` route validator after deleting an API route, delete `.next` and rebuild.

**Earlier (2026-03-24):** **Reactors** tab: removed Descendant field/column; enhancement is only `0`–`5` (max = 5); `normalizeReactorEntry` maps legacy `Max` → `5` on load. **Player Lookup** header: `Level: n, Arche Level: n` when Nexon sends arche fields; Chill uses icy-blue text + element icon.

**Earlier (2026-03-24):** Player Lookup — **Trigger** column: shows Nexon **roll** rows when present on equipped module `raw` (`extractModuleRollRows`), plus catalog **preview** (fixed `previewFromStats` to skip stub line `Basic Info` so Trigger modules get full `module_stat` text like Power Beyond). Inline list under card + hover/focus panel; `npm run fetch:data` refreshes `modules.json` previews. Files: `nexonPlayerPayload.ts`, `PlayerLookupProfile.tsx` + CSS, `nexon-catalog-transform.ts`, `public/data/*.json`.

**Earlier (2026-03-24):** Player Lookup — reactor substats use `inferTierFromReactorSubstat` (tfdtools reactor bands; fixes decimal % rolls e.g. crit damage). External substats use `inferTierFromExternalSubstat` only. Core augments use `inferTierFromCoreAugment` (grantable %/DEF bands) with per-roll tier colors. **Ultimate** rarity chip moved next to set name (item rarity), not on the Core heading. `ReactorsTab` / build planner reactor save use reactor-only tiering. Files: `src/lib/tracker-data.ts`, `PlayerLookupProfile.tsx` + `.module.css`.

At the **start** of a new chat or agent swap: **`HANDOFF.md`** → **`docs/PROJECT_MAP.md`** → **`docs/AI_HANDOFF.md`** (process + VPS git).
At the **end** of a session or after a major feature: update this file + session log; update other docs per **`docs/AI_HANDOFF.md`**.

---

## Deep-dive orientation

| Doc | Purpose |
|-----|---------|
| **`docs/AI_HANDOFF.md`** | **Process for switching AI:** what to read/update, doc map, `git pull` + `public/data` on VPS |
| **`docs/PROJECT_MAP.md`** | AppState vs Prisma tables, routes, Nexon pipeline, key files by feature, conventions |
| **`docs/ARCHITECTURE_ROADMAP.md`** | Product vision, live catalog API, future patch tagging |
| **`public/data/README.md`** | Nexon URLs, `fetch:data` / `fetch:stats`, static fallback behavior |
| **`DEPLOY_UBUNTU.md`** | Ubuntu install, PM2, nginx, **§12d** local `public/data` blocking `git pull` |

---

## Chat session summary (2026-03-23) — read this for full context

Single place for **everything shipped in the long Cursor thread** (build logic, Nexon pipeline, docs, deploy). The next AI should skim this section first.

### Game / build planner

- **Descendant capacity:** `effectiveMaxCapacity` = `min(85, 75 + melee bonus)` — base **75**, max **85** only with leveled **Charged Sub Attack** modules (Nexon preview **exactly** `"Modifies the Charged Sub Attack."`). Other Malachite subs (e.g. grappling / Mid-Air Maneuvering) **do not** add that cap bonus. See `src/lib/tfd-modules.ts`.
- **Transcendent / character-specific modules:** Nexon lists modules under one **descendant_id** (e.g. Ultimate Ajax `101000007`). **Base + Ultimate share `descendant_group_id`.** `filterModuleLibrary` now matches if **`available_descendant_id` hits any peer in the same group** (`descendantPeerIds` from `BuildsTab`). Fixes missing mods like **Mobile Fortress** when the build targets **Ajax** instead of **Ultimate Ajax**. `DescendantEntry` stores optional **`groupId`** from catalog merge (`tracker-client.tsx`).
- **UI:** External components grid min-width / set bonus line-splitting; capacity tooltip; copy feedback for profile/build links.
- **Clipboard:** `src/lib/copy-to-clipboard.ts`; share token failure shows alert; Friends tab uses same helper.

### Nexon data pipeline (canonical = library site + Open API)

- **Transforms:** `src/lib/nexon-catalog-transform.ts` — single source for compact JSON shapes.
- **Runtime:** `GET /api/nexon/catalog/{descendants|weapons|modules}` pulls Nexon server-side, cached; **`src/lib/fetch-game-catalog.ts`** tries API first, then **`/public/data/*.json`** fallback.
- **Committed JSON:** `npm run fetch:data` runs **`tsx scripts/fetch-game-data.ts`** (replaced old **`fetch-game-data.mjs`**); **`tsx`** is a devDependency.
- **Stats (per-level):** still `npm run fetch:stats` → `fetch-game-stats.js` (unchanged architecture).

### Documentation & AI continuity

- **`docs/PROJECT_MAP.md`** — AppState-centric tracker vs unused Prisma row APIs, routes, Nexon flow, conventions.
- **`docs/AI_HANDOFF.md`** — start/end checklist for Cursor; **VPS `git pull` blocked by `public/data/*.json`** → `git restore public/data/` (documented in **`DEPLOY_UBUNTU.md` §12d**).
- **`docs/ARCHITECTURE_ROADMAP.md`**, **`.cursor/rules/design-system.mdc`**, **`public/data/README.md`**, **`README.md`**, **`AGENTS.md`**, **`CURSOR_MEMORY.md`**, **`.cursorrules`**, **`.cursor/rules/memory-handoff.mdc`**, **`.cursor/rules/tfd-nexon-data.mdc`**, **`.cursor/rules/git-commit-push.mdc`** — linked and kept in sync.
- **Rule:** After substantive work, **update this `HANDOFF.md`** + session log; **commit + push** unless user opts out.

### Other code

- **`FarmingTab`:** safe defaults if `goals` / `goalsFilters` missing from saved state.

### Deploy note (VPS)

If **`git pull`** errors on **`public/data/modules.json`**, server had local `fetch:data` or edits — **`git restore public/data/`** then pull/build/restart (see **`DEPLOY_UBUNTU.md` §12d**).

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
- **`.cursor/rules/tfd-nexon-data.mdc`** — Nexon library + Open API + transforms
- **`.cursor/rules/design-system.mdc`** — Overframe-tier UX, tier tokens, chipset UI
- **`.cursor/rules/git-commit-push.mdc`** — commit + push after changes
- **`.cursor/rules/memory-handoff.mdc`** — read/update HANDOFF + docs (always apply)
- **`.cursorrules`** — root pointer + handoff doc list

---

## Session log

| Date       | Summary |
|-----------|---------|
| 2026-03-24 | **Tier list mod:** `TIER_LIST_MOD_DISCORD_IDS` + `tier-list-mod.ts`; Prisma `TierListModOverlay`; APIs `mod/session`, `overview`, `voters`, `overlay`, `overlay/reset`, `vote` DELETE; `TierListModPanel`; public `GET /api/tier-list` merges overlay. |
| 2026-03-24 | **Tier list:** weighted mean (S=5…D=1) for row + score %; plurality label on bar; `tier-list-aggregate.ts`, `GET /api/tier-list` fields, `CommunityTierList` + CSS + i18n (en/ko/ja). |
| 2026-03-24 | **Auth:** `createPrismaAuthAdapter` + Discord `allowDangerousEmailAccountLinking` (fix `error=Callback` / Prisma create / orphaned users). |
| 2026-03-24 | **`redirectToDiscordOAuth`** (skip failing `getProviders` → no NextAuth HTML); **`callbacks.redirect`**; language chip CSS. |
| 2026-03-24 | **Discord sign-in:** `SignInWithDiscordLink` + `signIn("discord")` (no GET `/api/auth/signin`); **`User.nexonIngameName`** + profile API + Friends tab + public profile line (self-attested; not Nexon OAuth). |
| 2026-03-24 | **Nav + i18n:** `SiteTopNav` (Home / Tier List / Tracker), `/tier-list`, `I18nProvider` + cookie/storage + `html[lang]`, `LanguageSelect`, `HomeLandingContent`, tracker links; `community-tier-list` + messages (en/ko/ja + empty locale fallbacks). |
| 2026-03-24 | **Auth + share links:** Removed `pages.signIn: "/"`; shared build route `/u/…/b/…`; `BuildHashRedirect`; tier hub `href` + BuildsTab `copyBuildLink`. |
| 2026-03-24 | **Deploy fix:** `package.json` `build` = `prisma generate && next build`; `TierListCategory` from `src/lib/tier-list-category.ts`; `DEPLOY_UBUNTU.md` note. Fixes VPS `Module '@prisma/client' has no exported member 'TierListCategory'`. |
| 2026-03-24 | **Community tier list** on `/`: voting APIs, `TierVote` + `PublicBuildListing`, build flag `communityPublic`, landing `CommunityTierList` modal (votes + public build links). Migration `0007_tier_list_community`. |
| 2026-03-24 | **Player Lookup** Dia Modules trigger: card shows name + tag only; removed cost badge, rolls, blurb, hover panel (`PlayerLookupProfile` + CSS). |
| 2026-03-24 | **Materials removed**: tab/API/Prisma `MaterialEntry`; Welcome + share pages + landing/meta; `migrateStateNoMaterials` + `tracker-default-state`; docs/README/PROJECT_MAP. Run `prisma migrate deploy` on servers with DB. |
| 2026-03-24 | **Reactors tab**: no Descendant column; enh. 0–5 only; migrate `Max`→`5`. **Player Lookup**: arche level line, Chill styling + icon, cleaner trigger preview. |
| 2026-03-24 | **Player Lookup Trigger**: preserve module `raw` from Nexon; `extractModuleRollRows` + hover/inline UI; `previewFromStats` skips `Basic Info` stub so Trigger catalog text matches game; `fetch:data` modules.json. |
| 2026-03-24 | **Tier inference**: reactor vs external vs core augment ranges; decimal % normalization; Ultimate chip by set (item rarity). `tracker-data` helpers; ReactorsTab/BuildPlanner use reactor-only tiers. |
| 2026-03-24 | **Player Lookup**: ext **Core** = augmentation **Ultimate** pool (gold values + pill + gold accent); **Substats** = grantable pool (blue values); reactor chip colors; 4-slot grid. |
| 2026-03-23 | **`HANDOFF.md`**: added **“Chat session summary (2026-03-23)”** — full digest of thread (capacity, group peers, Nexon API, docs, deploy). Cursor rules list completed. |
| 2026-03-23 | **`docs/PROJECT_MAP.md`**, **`docs/AI_HANDOFF.md`** (AI continuity + VPS `git pull`/`public/data`). **`DEPLOY_UBUNTU.md`** §12d. **`FarmingTab`** hardened. Updated **AGENTS**, **CURSOR_MEMORY**, **`.cursorrules`**, **`memory-handoff.mdc`**, **README**. |
| 2026-03-20 | Full audit + cleanup: fixed 17 issues (CSS duplication, dead code, hero-badge collision, mini-btn light mode, --card-bg, tier-norm, username normalization, import catalog merge, descFilter removal). Build passes clean. |
| 2026-03-20 | **Overframe build planner overhaul**: Nexon stat data fetch script, stat engine, stat map, full panel rewrite (portrait BG, live stats, reactor integration, ancestor editor, expanded cards, fixed DnD). Data model expanded with `BuildReactor`, `customPreview`, `targetLevel`. Build passes clean. |
