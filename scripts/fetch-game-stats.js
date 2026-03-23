#!/usr/bin/env node
/**
 * Fetch game stats from Nexon TFD Open API and write compact JSON files
 * for the build planner stat engine.
 *
 * Usage:  node scripts/fetch-game-stats.js
 * Or:     npm run fetch:stats
 *
 * Re-run when Nexon updates data (~monthly).
 */
const fs = require("fs");
const path = require("path");

const NEXON_BASE = "https://open.api.nexon.com/static/tfd/meta/en";
const OUT_DIR = path.resolve(__dirname, "..", "public", "data");

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Fetching stat ID map…");
  const statRaw = await fetchJSON(`${NEXON_BASE}/stat.json`);
  const statMap = {};
  for (const s of statRaw) statMap[s.stat_id] = s.stat_name;

  console.log(`  ${Object.keys(statMap).length} stat IDs loaded`);

  // ── Descendants ──────────────────────────────────────────────
  console.log("Fetching descendant metadata…");
  const descRaw = await fetchJSON(`${NEXON_BASE}/descendant.json`);
  const descendants = {};

  for (const d of descRaw) {
    const stats = {};
    for (const levelEntry of d.descendant_stat ?? []) {
      const lv = levelEntry.level;
      for (const sd of levelEntry.stat_detail ?? []) {
        const name = statMap[sd.stat_id] ?? sd.stat_id;
        if (!stats[name]) stats[name] = {};
        stats[name][lv] = sd.stat_value;
      }
    }

    const skills = (d.descendant_skill ?? []).map((sk) => ({
      name: sk.skill_name,
      type: sk.skill_type,
      element: sk.element_type,
      image: sk.skill_image_url,
      arche: sk.arche_type ?? null,
    }));

    descendants[d.descendant_id] = {
      name: d.descendant_name,
      groupId: d.descendant_group_id ?? null,
      image: d.descendant_image_url,
      stats,
      skills,
    };
  }

  const descPath = path.join(OUT_DIR, "descendant-stats.json");
  fs.writeFileSync(descPath, JSON.stringify(descendants));
  console.log(`  ${Object.keys(descendants).length} descendants → ${descPath}`);

  // ── Weapons ──────────────────────────────────────────────────
  console.log("Fetching weapon metadata…");
  const weapRaw = await fetchJSON(`${NEXON_BASE}/weapon.json`);
  const weapons = {};

  for (const w of weapRaw) {
    const baseStats = {};
    for (const bs of w.base_stat ?? []) {
      const name = statMap[bs.stat_id] ?? bs.stat_id;
      baseStats[name] = bs.stat_value;
    }

    const firearmAtk = {};
    for (const fa of w.firearm_atk ?? []) {
      for (const f of fa.firearm ?? []) {
        const atkName = statMap[f.firearm_atk_type] ?? f.firearm_atk_type;
        if (!firearmAtk[atkName]) firearmAtk[atkName] = {};
        firearmAtk[atkName][fa.level] = f.firearm_atk_value;
      }
    }

    weapons[w.weapon_id] = {
      name: w.weapon_name,
      image: w.image_url,
      type: w.weapon_type,
      tier: w.weapon_tier_id,
      roundsType: w.weapon_rounds_type,
      baseStats,
      firearmAtk,
    };
  }

  const weapPath = path.join(OUT_DIR, "weapon-stats.json");
  fs.writeFileSync(weapPath, JSON.stringify(weapons));
  console.log(`  ${Object.keys(weapons).length} weapons → ${weapPath}`);

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
