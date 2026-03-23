# Agent instructions (TFD Tracker)

**Session memory:** read **`HANDOFF.md`** at the start of substantive work; update it when the user asks for a handoff or after major changes. **`CURSOR_MEMORY.md`** points to the same workflow.

**Primary rules for Cursor:** see `.cursor/rules/*.mdc` (`memory-handoff.mdc`, `tfd-stack.mdc`, `tfd-api-state.mdc`). Root **`.cursorrules`** duplicates the memory reminder for tools that only read the repo root.

## Next.js version

This repo may use newer Next.js than generic training data. Prefer project files and `node_modules/next` docs over assumptions.

## Human setup (optional)

- **Cursor:** Settings → Indexing & Docs — add Next.js, Prisma, and Auth.js/NextAuth documentation URLs.
- **Database:** Postgres may run via Docker Compose; debugging may require container logs or restarts.
