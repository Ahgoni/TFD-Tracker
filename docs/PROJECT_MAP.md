# TFD Tracker — project map (deep dive)

Use this file to orient before large changes. **AI continuity:** `docs/AI_HANDOFF.md` · **Nexon data rules:** `.cursor/rules/tfd-nexon-data.mdc` · **Stack:** `.cursor/rules/tfd-stack.mdc`

---

## 1. What this app is

- **Next.js 16** App Router, **React 19**, **TypeScript**
- **Auth:** NextAuth with **Discord** (`src/lib/auth.ts`, `src/app/api/auth/[...nextauth]`)
- **Persistence:** **PostgreSQL** + **Prisma** — primary user data lives in **`AppState.data` (JSON)**, not only in normalized tables
- **Tracker UI:** `src/app/tracker/tracker-client.tsx` — tab shell, debounced save to **`/api/state`**
- **Game data:** Nexon Open API → transforms in `src/lib/nexon-catalog-transform.ts`; runtime **`/api/nexon/catalog/*`** with fallback to `public/data/*.json`

---

## 2. Directory layout (high signal)

| Path | Role |
|------|------|
| `src/app/` | Routes: `/`, **`/tier-list`** (community tier list), `/tracker`, `/u/[username]`, **`/u/[username]/b/[buildId]`** (single shared build), `/share/[token]`, `/share/user/[userId]` |
| `src/app/api/` | REST: **`state`** (main blob), **`share`**, **`profile`**, **`friends`**, **`tier-list`** (+ **`vote`**, **`public-builds`**, **`mod/*`** Discord-ID–gated overlay + voter tools), domain CRUD (**`weapons`**, **`descendants`**, **`reactors`**, **`goals`**), **`nexon/catalog/[kind]`** |
| `src/app/tracker/components/` | Tab UIs: `BuildsTab`, `BuildPlannerPanel`, `DescendantsTab`, `WeaponsTab`, … |
| `src/lib/` | **Business logic:** `tfd-modules.ts`, `tfd-stat-engine.ts`, `build-planner-stats.ts`, `nexon-catalog-transform.ts`, `fetch-game-catalog.ts`, `tracker-data.ts`, `tracker-default-state.ts`, Prisma helpers |
| `src/contexts/i18n-context.tsx`, `src/lib/i18n/config.ts`, `src/messages/*.json` | **i18n:** client `I18nProvider` in `app/providers.tsx`; locale in **`localStorage`** + **`tfd-locale`** cookie; `lang` set on `<html>` (layout inline script + provider) |
| **Auth** | **Discord** via NextAuth (`src/lib/auth.ts`). **`createPrismaAuthAdapter`** (`src/lib/prisma-auth-adapter.ts`) whitelists user fields on sign-up; Discord uses **`allowDangerousEmailAccountLinking`** for single-provider recovery. **`redirectToDiscordOAuth`** / **`DiscordSignInButton`** / **`SignInWithDiscordLink`**; **`callbacks.redirect`**. Optional **`User.nexonIngameName`**. |
| `public/data/` | Committed Nexon-derived JSON + hand-curated (`external-components.json`, `ancestor-modules.json`, …) — see `public/data/README.md` |
| `scripts/` | `fetch-game-data.ts`, `fetch-game-stats.js`, `download-assets.mjs`, `link-public.js`, `postinstall-run.js` |
| `prisma/schema.prisma` | `User`, **`AppState`** (JSON), `ShareToken`, `SavedFriend`, plus **optional** normalized `WeaponEntry`, `DescendantEntry`, … |

---

## 3. Data model — two layers (important)

### A. Source of truth for the tracker UI: **`AppState` JSON**

- **GET/PUT `/api/state`** reads/writes `prisma.appState.data` for the logged-in user.
- The full **`TrackerState`** shape lives here: `weapons`, `descendants`, `reactors`, `builds`, `goals`, `activities`, filters, `notesTabs`, `sharePrivacy`, etc.
- **Debounced save** (~600ms) on every state change after initial load (`tracker-client.tsx`).

### B. Normalized Prisma tables (`WeaponEntry`, `DescendantEntry`, …)

- **GET/PUT `/api/weapons`**, **`/api/descendants`**, **`/api/reactors`**, **`/api/goals`** exist and sync **row** tables.
- The **React tracker does not call these routes** in the current codebase (grep shows no client usage). They are available for **other clients**, **future refactors**, or **ops**.
- **Do not assume** the UI reads from both places — **AppState is what the tracker uses**.

### Sharing & public profile

- **`/api/share/[token]`** — loads **`AppState`** for a share token.
- **`/api/share/u/[username]`** — public profile: reads **`AppState`** if `sharePrivacy === "open"`; **`link_only`** returns 403 (use direct share link).
- **`/u/[username]`** — server page that fetches share API and renders **`PublicBuildsSection`**, etc.

---

## 4. Game / Nexon pipeline

| Step | What |
|------|------|
| Authoritative site | [Nexon library](https://tfd.nexon.com/en/library/descendants) (human) |
| Machine API | `https://open.api.nexon.com/static/tfd/meta/en/*.json` |
| Transforms | `src/lib/nexon-catalog-transform.ts` |
| Committed files | `npm run fetch:data` → `public/data/{descendants,weapons,modules}.json` |
| Live + fallback | `src/lib/fetch-game-catalog.ts` → `/api/nexon/catalog/*` then `/data/*.json` |
| Stats (per-level) | `npm run fetch:stats` → `descendant-stats.json`, `weapon-stats.json` (separate script) |

**Build planner math:** `tfd-modules.ts` (capacity, descendant group peers), `tfd-stat-engine.ts`, `build-planner-stats.ts`.

---

## 5. Key files by feature

| Feature | Files |
|---------|--------|
| Build planner + DnD | `BuildPlannerPanel.tsx`, `tfd-modules.ts`, `globals.css` (`.builder-*`) |
| Builds list / form | `BuildsTab.tsx` |
| Descendant roster | `DescendantsTab.tsx`, catalog merge in `tracker-client.tsx` |
| Weapons | `WeaponsTab.tsx`, `weapons-catalog.json` / merge in `fetchAndMergeWeaponsCatalog` |
| Tracker shell | `tracker-client.tsx`, `tracker-default-state.ts` |
| Public build stats | `public-build-stats-client.tsx`, `public-build-types.ts` |
| Friends | `FriendsTab.tsx`, `api/friends/*` |
| Community tier list | `community-tier-list.tsx`, `tier-list-mod-panel.tsx`, `api/tier-list/*` (including **`mod/*`**), `tier-list-aggregate.ts`, `tier-list-mod.ts`, Prisma **`TierVote`**, **`PublicBuildListing`**, **`TierListModOverlay`** (synthetic per-tier deltas; env **`TIER_LIST_MOD_DISCORD_IDS`**) |
| Theme | `theme-toggle.tsx`, `globals.css` `:root` / `[data-theme="light"]` |

---

## 6. Environment & deploy

- **`.env`** — `DATABASE_URL`, NextAuth secrets, `NEXTAUTH_URL`, Discord OAuth — see `README.md`, `DEPLOY_UBUNTU.md`
- **Deploy:** `npm run build`, process manager (e.g. PM2), run Prisma migrate as needed

---

## 7. Conventions (do not regress)

- **Lowercase asset URLs** for UI icons: `/game-icons/`, `/game-ammo/` (case-sensitive servers).
- **Builder CSS** prefixed: `builder-hero-badge-*`, not `hero-badge` on planner.
- **DnD:** no `snapCenterToCursor` on overlay (see HANDOFF).
- **Git:** after substantive edits, commit + push (`.cursor/rules/git-commit-push.mdc`).

---

## 8. Gaps / follow-ups (from audits)

- Optional: unify **AppState-only** vs **normalized API** tables or document deprecation.
- **`fetch:stats`** still separate from `nexon-catalog-transform` — could share more code later.
- Weapon stat lookup by slugified name — consider storing Nexon `weapon_id` on builds if needed.

---

*Last updated as part of project orientation pass.*
