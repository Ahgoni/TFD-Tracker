# Agent instructions (TFD Tracker)

**Continuity across AI sessions (required):**  
1) Start: **`HANDOFF.md`** → **`docs/PROJECT_MAP.md`** → **`docs/AI_HANDOFF.md`** (process + VPS git pitfalls).  
2) End: **Update `HANDOFF.md`** (+ session log); update **`PROJECT_MAP` / `DEPLOY_UBUNTU.md` / `public/data/README.md`** when relevant; **commit + push** unless the user opts out.

**Session memory:** **`CURSOR_MEMORY.md`** points to the same docs.

**Primary rules for Cursor:** see `.cursor/rules/*.mdc` (`memory-handoff.mdc`, `tfd-stack.mdc`, `tfd-api-state.mdc`, **`tfd-nexon-data.mdc`**, **`design-system.mdc`** — Overframe-style hierarchy, tier tokens, chipset UI), **`git-commit-push.mdc`** — commit + push after changes unless user opts out). Root **`.cursorrules`** duplicates the memory reminder for tools that only read the repo root.

**Strategic roadmap:** `docs/ARCHITECTURE_ROADMAP.md` (UX, math engine, patch lifecycle).

**Game data:** Nexon’s official site (e.g. https://tfd.nexon.com/en/library/descendants) + `open.api.nexon.com/static/tfd/meta/en/` — see `public/data/README.md`.

## Next.js version

This repo may use newer Next.js than generic training data. Prefer project files and `node_modules/next` docs over assumptions.

## Human setup (optional)

- **Cursor:** Settings → Indexing & Docs — add Next.js, Prisma, and Auth.js/NextAuth documentation URLs.
- **Database:** Postgres may run via Docker Compose; debugging may require container logs or restarts.
