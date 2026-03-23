# Nexon math & sources (tracker accuracy)

**Canonical human UI:** [Nexon TFD library](https://tfd.nexon.com/en/library/descendants) — same mechanics as in-game; use it to **verify** wording, tiers, and caps.

**Machine-readable (this repo):**

| Area | Source | Notes |
|------|--------|--------|
| Descendant / weapon / weapon **catalog** rows | `open.api.nexon.com/static/tfd/meta/en/{descendant,weapon,module}.json` | Transformed in `src/lib/nexon-catalog-transform.ts` |
| Per-level stats | `fetch-game-stats.js` → `descendant-stats.json`, `weapon-stats.json` | Build planner base stats |
| **Live** catalog | `GET /api/nexon/catalog/*` | Same transforms; falls back to `public/data/*.json` |
| External components (builder) | `public/data/external-components.json` | Hand-curated; align sets/substats with [components](https://tfd.nexon.com/en/library/components) when updating |
| **Player** (in-game profile) | Authenticated **game** API: `/tfd/v1/id`, `/tfd/v1/user/*` | `NEXON_OPEN_API_KEY` — see `src/lib/nexon-game-api.ts` |

**Library sections (reference):**  
[Descendants](https://tfd.nexon.com/en/library/descendants) · [Weapons](https://tfd.nexon.com/en/library/weapons) · [Modules](https://tfd.nexon.com/en/library/modules) · [Components](https://tfd.nexon.com/en/library/components) · [Enhancements](https://tfd.nexon.com/en/library/enhancements) · [Consumable](https://tfd.nexon.com/en/library/consumable)

---

## Build planner — capacity (descendants)

- Base **75** module budget; **+0…+10** from **Charged Sub Attack** (Malachite) preview text **exactly** `"Modifies the Charged Sub Attack."` — see `src/lib/tfd-modules.ts` (`effectiveMaxCapacity`, `isChargedSubAttackModule`).
- **Max displayed cap** = `min(85, 75 + bonus)` — **not** 85 + bonus.
- **Sibling variants** (same `descendant_group_id`): base + Ultimate share Transcendent modules — `filterModuleLibrary` + `descendantPeerIds` in `BuildsTab`.

## Weapon modules

- Max **80** capacity for weapons (`MAX_WEAPON_CAPACITY`).
- `WEAPON_TYPE_TO_NEXON` maps UI names to Nexon `available_weapon_type` strings.

## Module preview / positives / negatives

- **Previews** come from Nexon `module_stat` level 0 `value` (Transcendent = full string; others truncated in transform).
- **Ancestor** modules: structured editor uses `ancestor-modules.json`; **%** display is user-editable; **tier quality** is derived from roll ranges in that file — not re-simulated from Nexon combat.

## External components

- Slot costs / set bonuses in UI follow `external-components.json`; **validate** against the library [components](https://tfd.nexon.com/en/library/components) when changing data.

## Compliance (Nexon terms)

- **NOTICE:** Update data pulled from the Open API **at least every 30 days** — see [openapi.nexon.com](https://openapi.nexon.com).
- Repo tracks pulls in **`public/data/nexon-compliance.json`** (updated by `npm run fetch:data` and `npm run fetch:stats`).
- **`GET /api/nexon/compliance`** exposes age flags (no secrets).

---

*When in doubt, trust the library + Nexon JSON; then fix transforms in `nexon-catalog-transform.ts` or `tfd-modules.ts`, not ad-hoc numbers in components.*
