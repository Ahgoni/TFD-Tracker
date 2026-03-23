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

When in doubt, **match Nexon’s library pages**. If something looks wrong after a patch, re-run the fetch scripts and diff against the site.

## Regenerate from Nexon

```bash
npm run fetch:data    # descendants.json, weapons.json, modules.json
npm run fetch:stats   # descendant-stats.json, weapon-stats.json
npm run download:assets   # optional: images into /public/assets
# or all in one:
npm run refresh
```

Do **not** hand-edit large JSON blobs unless you are fixing a one-off bug; prefer `fetch:data` / `fetch:stats` so data stays aligned with Nexon.
