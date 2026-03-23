/**
 * Writes public/data/{descendants,weapons,modules}.json from Nexon Open API.
 * Same transforms as GET /api/nexon/catalog/* (see src/lib/nexon-catalog-transform.ts).
 *
 *   npm run fetch:data
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  NEXON_DESCENDANT_JSON,
  NEXON_MODULE_JSON,
  NEXON_WEAPON_JSON,
  transformDescendantsFromNexon,
  transformModulesFromNexon,
  transformWeaponsFromNexon,
} from "@/lib/nexon-catalog-transform";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/data");

async function main() {
  mkdirSync(OUT, { recursive: true });

  console.log("Fetching descendants, weapons, modules from Nexon…");
  const [descRes, weapRes, modRes] = await Promise.all([
    fetch(NEXON_DESCENDANT_JSON),
    fetch(NEXON_WEAPON_JSON),
    fetch(NEXON_MODULE_JSON),
  ]);
  if (!descRes.ok) throw new Error(`descendant.json → ${descRes.status}`);
  if (!weapRes.ok) throw new Error(`weapon.json → ${weapRes.status}`);
  if (!modRes.ok) throw new Error(`module.json → ${modRes.status}`);

  const [descRaw, weapRaw, modRaw] = await Promise.all([descRes.json(), weapRes.json(), modRes.json()]);

  const descendants = transformDescendantsFromNexon(descRaw);
  const weapons = transformWeaponsFromNexon(weapRaw);
  const modules = transformModulesFromNexon(modRaw);

  writeFileSync(resolve(OUT, "descendants.json"), JSON.stringify(descendants, null, 2));
  console.log(`  Wrote ${descendants.length} descendants`);

  writeFileSync(resolve(OUT, "weapons.json"), JSON.stringify(weapons, null, 2));
  console.log(`  Wrote ${weapons.length} weapons`);

  writeFileSync(resolve(OUT, "modules.json"), JSON.stringify(modules, null, 2));
  console.log(`  Wrote ${modules.length} modules`);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
