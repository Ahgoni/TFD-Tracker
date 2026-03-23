# AI / Cursor handoff — read this when switching models or sessions

This repo is **optimized for continuity** across Cursor chats. Follow this so the **next** assistant (or you, later) is not lost.

---

## 1) At the **start** of every substantive task

Read in this order (skim is OK if time-boxed):

| Priority | File | Why |
|----------|------|-----|
| 1 | **`HANDOFF.md`** (repo root) | Latest decisions, session log, known issues, deploy notes |
| 2 | **`docs/PROJECT_MAP.md`** | AppState vs DB, routes, Nexon pipeline, key folders |
| 3 | **`.cursor/rules/*.mdc`** (always-applied) | Stack, API, Nexon data, design system, git push, memory |

Optional: **`docs/ARCHITECTURE_ROADMAP.md`**, **`public/data/README.md`**, **`DEPLOY_UBUNTU.md`** (if deploy/VPS).

---

## 2) At the **end** of work (or when the user says “hand off”)

**Always** do these when you changed behavior, data flow, deploy steps, or conventions:

1. **`HANDOFF.md`** — Update “Last updated” date, add a **Session log** row, refresh **Known issues** / **Architecture decisions** if relevant.
2. If you touched **architecture or data flow** — adjust **`docs/PROJECT_MAP.md`**.
3. If you changed **VPS / git / env / PM2** — adjust **`DEPLOY_UBUNTU.md`**.
4. If you changed **Nexon fetch or `public/data`** — adjust **`public/data/README.md`** and/or **`.cursor/rules/tfd-nexon-data.mdc`**.
5. **Commit and push** (see **`.cursor/rules/git-commit-push.mdc`**) unless the user opted out.

---

## 3) Document map (single index)

| Doc | Role |
|-----|------|
| `HANDOFF.md` | **Living** session memory — most important for the next AI |
| `docs/PROJECT_MAP.md` | Architecture & file map |
| `docs/AI_HANDOFF.md` | **This file** — process for AI continuity |
| `docs/ARCHITECTURE_ROADMAP.md` | Product / long-term vision |
| `AGENTS.md` | Short agent instructions + pointers |
| `CURSOR_MEMORY.md` | Alias → HANDOFF + PROJECT_MAP |
| `public/data/README.md` | Nexon URLs, `fetch:data`, runtime API fallback |
| `DEPLOY_UBUNTU.md` | Ubuntu VPS: install, PM2, nginx, **git pull failures** |
| `.cursor/rules/*.mdc` | Enforced Cursor behavior |

---

## 4) VPS deploy: `git pull` fails (local changes)

**Symptom:**  
`error: Your local changes to the following files would be overwritten by merge: public/data/modules.json`  
(and `git pull` aborts before `npm run build` / `pm2 restart`).

**Cause:** Someone ran **`npm run fetch:data`** / **`refresh`** on the server, or edited **`public/data/*.json`** without committing — Git refuses to overwrite.

**Fix if server copies should match the repo (normal):**

```bash
cd ~/apps/TFD/tfd-web   # or ~/apps/TFD — use the folder that contains package.json
git restore public/data/modules.json
# if other data files were touched too:
# git restore public/data/
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart tfd-web
```

**Fix if you must keep server-only edits:** `git stash` (see **`DEPLOY_UBUNTU.md`** §12d).

**Prevention:** Do **not** run `fetch:data` on production unless you intend to diverge from git; prefer deploying **committed** JSON from CI/local, or rely on **`/api/nexon/catalog/*`** at runtime.

---

## 5) User expectation

The owner wants **documentation updated as part of the work**, not as an afterthought — so **another AI** can pick up without re-discovering the repo.

---

*Keep this file accurate when the handoff process itself changes.*
