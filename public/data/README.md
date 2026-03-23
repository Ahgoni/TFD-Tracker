# Game data (`public/data/`)

## Canonical source: Nexon (official)

**Human-readable (verify names, skills, and UI against this):**

| Content | Official Nexon library URL |
|--------|----------------------------|
| Descendants | https://tfd.nexon.com/en/library/descendants |
| Weapons | https://tfd.nexon.com/en/library/weapons |
| Modules | https://tfd.nexon.com/en/library/modules |

**Machine-readable (what this repo downloads — same underlying game data):**

- Base URL: `https://open.api.nexon.com/static/tfd/meta/en/`
- Examples: `descendant.json`, `weapon.json`, `module.json`, `stat.json`

**At runtime (no redeploy required for catalog refresh):** the app tries **`GET /api/nexon/catalog/{descendants|weapons|modules}`** first (server pulls Nexon, same transforms as below), then falls back to these static files if the API is unreachable.

When in doubt, **match Nexon’s library pages**. If something looks wrong after a patch, re-run the fetch scripts and diff against the site.

**Descendant groups:** Nexon ties some modules (often Transcendent) to a specific `descendant_id` (e.g. Ultimate form). The tracker treats everyone with the same `descendant_group_id` as **peers** so base and Ultimate builds share the same character-specific module list.

## Regenerate from Nexon

```bash
npm run fetch:data    # descendants.json, weapons.json, modules.json (uses src/lib/nexon-catalog-transform.ts)
npm run fetch:stats   # descendant-stats.json, weapon-stats.json
npm run download:assets   # optional: images into /public/assets
# or all in one:
npm run refresh
```

Do **not** hand-edit large JSON blobs unless you are fixing a one-off bug; prefer `fetch:data` / `fetch:stats` so data stays aligned with Nexon.
