/**
 * Fetches game data from Nexon's public TFD API and writes compact JSON
 * to public/data/ for use by the tracker.
 *
 * Run:  node scripts/fetch-game-data.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data");

const DESCENDANT_URL = "https://open.api.nexon.com/static/tfd/meta/en/descendant.json";
const WEAPON_URL = "https://open.api.nexon.com/static/tfd/meta/en/weapon.json";

const ELEMENT_MAP = {
  "Chill": "chill",
  "Electric": "electric",
  "Fire": "fire",
  "Non-Attribute": "nonattribute",
  "Toxic": "toxic",
};

const SKILL_TYPE_MAP = {
  "Dimension": "dimension",
  "Fusion": "fusion",
  "Singular": "singular",
  "Tech": "tech",
};

function inferElement(skills) {
  const elements = skills
    .map((s) => ELEMENT_MAP[s.element_type])
    .filter(Boolean);
  return elements[0] ?? "nonattribute";
}

function inferSkillTypes(skills) {
  const types = new Set();
  for (const s of skills) {
    if (s.skill_type === "Passive Skill") continue;
    const mapped = SKILL_TYPE_MAP[s.arche_type];
    if (mapped) types.add(mapped);
  }
  return [...types];
}

function tierFromId(tierId) {
  if (tierId === "Tier3") return "Ultimate";
  if (tierId === "Tier2") return "Rare";
  return "Normal";
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  console.log("Fetching descendants...");
  const descRaw = await fetch(DESCENDANT_URL).then((r) => r.json());

  const descendants = descRaw.map((d) => ({
    id: d.descendant_id,
    name: d.descendant_name,
    groupId: d.descendant_group_id,
    element: inferElement(d.descendant_skill ?? []),
    skillTypes: inferSkillTypes(d.descendant_skill ?? []),
    image: d.descendant_image_url,
    skills: (d.descendant_skill ?? []).map((s) => ({
      name: s.skill_name,
      type: s.skill_type,
      element: s.element_type,
      image: s.skill_image_url,
      arche: s.arche_type ?? null,
    })),
  }));

  writeFileSync(resolve(OUT, "descendants.json"), JSON.stringify(descendants, null, 2));
  console.log(`  Wrote ${descendants.length} descendants`);

  console.log("Fetching weapons...");
  const weapRaw = await fetch(WEAPON_URL).then((r) => r.json());

  const weapons = weapRaw.map((w) => ({
    id: w.weapon_id,
    name: w.weapon_name,
    image: w.image_url,
    type: w.weapon_type,
    rarity: tierFromId(w.weapon_tier_id),
    roundsType: w.weapon_rounds_type,
  }));

  writeFileSync(resolve(OUT, "weapons.json"), JSON.stringify(weapons, null, 2));
  console.log(`  Wrote ${weapons.length} weapons`);

  console.log("Done.");
}

main().catch(console.error);
