# TFD Web (Discord Auth)

This app adds Discord login and private per-user cloud state for The First Descendant tracker.

## Quick start
1. Copy `.env.example` to `.env` and fill values. (Optional: **`TIER_LIST_MOD_DISCORD_IDS`** — your Discord snowflake — enables private tier-list mod tools on `/tier-list` after deploy.)
2. Start Postgres (`docker compose up -d db`).
3. Install and run migrations:
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
4. Start app: `npm run dev`

## Architecture & UX vision

- **Project map (read this first for a deep dive):** **`docs/PROJECT_MAP.md`** — how data flows, which APIs matter, Nexon pipeline.
- **Switching AI in Cursor:** **`docs/AI_HANDOFF.md`** — what to read at session start, what to update before end, VPS `git pull` / `public/data` conflicts, full doc index.
- Product direction (Overframe-tier discovery, TFD tier tokens, patch-aware roadmap): **`docs/ARCHITECTURE_ROADMAP.md`**. Cursor agents follow **`.cursor/rules/design-system.mdc`** for UI consistency.

## Game data (canonical: Nexon)

Names, skills, modules, and stats should match **Nexon’s official library**, e.g. [Descendants](https://tfd.nexon.com/en/library/descendants). The app uses the same Open API (`open.api.nexon.com/static/tfd/meta/en/…`) via **`/api/nexon/catalog/*`** at runtime (with static `/public/data` fallback) and via `npm run fetch:data` for committed JSON — see `public/data/README.md` and `src/lib/nexon-catalog-transform.ts`.

## Current routes
- `/` sign-in landing page
- `/tracker` authenticated tracker state editor/importer
- `/api/state` GET/PUT per-user state JSON
- `/api/state/import` POST one-time localStorage import
- `/api/weapons`, `/api/reactors`, `/api/descendants`, `/api/goals` domain routes

See `DEPLOY_UBUNTU.md` for production setup.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
