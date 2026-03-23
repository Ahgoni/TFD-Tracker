/**
 * Download all Nexon CDN game images to local public/assets/ directories.
 *
 * Usage:  node scripts/download-assets.mjs
 *
 * Reads the JSON data files to collect every unique Nexon CDN image URL,
 * then downloads them into categorized folders. Skips files that already exist.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, "../public/data");
const ASSETS = resolve(__dirname, "../public/assets");
const CATALOG = resolve(__dirname, "../public/weapons-catalog.json");

const CONCURRENCY = 10;

function hashFromUrl(url) {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

function loadJSON(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function downloadBatch(items) {
  let done = 0;
  const total = items.length;

  async function worker(queue) {
    while (queue.length > 0) {
      const { url, dest, label } = queue.shift();
      if (existsSync(dest)) {
        done++;
        continue;
      }
      try {
        await downloadFile(url, dest);
        done++;
        if (done % 50 === 0 || done === total) {
          console.log(`  ${done}/${total} downloaded`);
        }
      } catch (e) {
        console.error(`  FAILED: ${label} - ${e.message}`);
        done++;
      }
    }
  }

  const queue = [...items];
  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
  await Promise.all(workers);
}

async function main() {
  const dirs = ["modules", "descendants", "skills", "weapons"];
  for (const d of dirs) mkdirSync(resolve(ASSETS, d), { recursive: true });

  const urlMap = new Map();

  // Modules
  console.log("Collecting module image URLs...");
  const modules = loadJSON(resolve(DATA, "modules.json"));
  for (const m of modules) {
    if (m.image?.startsWith("https://")) {
      const h = hashFromUrl(m.image);
      urlMap.set(m.image, { dest: resolve(ASSETS, "modules", `${h}.png`), label: `mod:${m.name}` });
    }
  }
  console.log(`  ${urlMap.size} module images`);

  // Descendants + Skills from descendants.json
  console.log("Collecting descendant & skill image URLs...");
  const descendants = loadJSON(resolve(DATA, "descendants.json"));
  let skillCount = 0;
  let descCount = 0;
  for (const d of descendants) {
    if (d.image?.startsWith("https://")) {
      const h = hashFromUrl(d.image);
      urlMap.set(d.image, { dest: resolve(ASSETS, "descendants", `${h}.png`), label: `desc:${d.name}` });
      descCount++;
    }
    for (const sk of d.skills ?? []) {
      if (sk.image?.startsWith("https://")) {
        const h = hashFromUrl(sk.image);
        urlMap.set(sk.image, { dest: resolve(ASSETS, "skills", `${h}.png`), label: `skill:${sk.name}` });
        skillCount++;
      }
    }
  }
  console.log(`  ${descCount} descendant portraits, ${skillCount} skill icons`);

  // Also collect skills from descendant-stats.json (may have extra skills not in descendants.json)
  try {
    const descStats = loadJSON(resolve(DATA, "descendant-stats.json"));
    for (const [, entry] of Object.entries(descStats)) {
      if (entry.image?.startsWith("https://")) {
        const h = hashFromUrl(entry.image);
        urlMap.set(entry.image, { dest: resolve(ASSETS, "descendants", `${h}.png`), label: `desc-stat:${entry.name}` });
      }
      for (const sk of entry.skills ?? []) {
        if (sk.image?.startsWith("https://")) {
          const h = hashFromUrl(sk.image);
          urlMap.set(sk.image, { dest: resolve(ASSETS, "skills", `${h}.png`), label: `skill-stat:${sk.name}` });
        }
      }
    }
  } catch { /* descendant-stats.json might not exist yet */ }

  // Weapons
  console.log("Collecting weapon image URLs...");
  const weapons = loadJSON(resolve(DATA, "weapons.json"));
  let weapCount = 0;
  for (const w of weapons) {
    if (w.image?.startsWith("https://")) {
      const h = hashFromUrl(w.image);
      urlMap.set(w.image, { dest: resolve(ASSETS, "weapons", `${h}.png`), label: `weap:${w.name}` });
      weapCount++;
    }
  }

  // Also from weapon-stats.json
  try {
    const weapStats = loadJSON(resolve(DATA, "weapon-stats.json"));
    for (const [, entry] of Object.entries(weapStats)) {
      if (entry.image?.startsWith("https://")) {
        const h = hashFromUrl(entry.image);
        urlMap.set(entry.image, { dest: resolve(ASSETS, "weapons", `${h}.png`), label: `weap-stat:${entry.name}` });
      }
    }
  } catch { /* weapon-stats.json might not exist yet */ }

  // weapons-catalog.json
  try {
    const catalog = loadJSON(CATALOG);
    for (const c of catalog) {
      if (c.icon?.startsWith("https://")) {
        const h = hashFromUrl(c.icon);
        urlMap.set(c.icon, { dest: resolve(ASSETS, "weapons", `${h}.png`), label: `catalog:${c.name}` });
      }
    }
  } catch { /* catalog might not exist */ }

  console.log(`  ${weapCount} weapon images`);
  console.log(`\nTotal unique images to download: ${urlMap.size}`);

  const alreadyLocal = [...urlMap.values()].filter((v) => existsSync(v.dest)).length;
  console.log(`Already downloaded: ${alreadyLocal}, remaining: ${urlMap.size - alreadyLocal}\n`);

  const items = [...urlMap.entries()].map(([url, { dest, label }]) => ({ url, dest, label }));
  await downloadBatch(items);

  console.log("\nDone! All assets saved to public/assets/");
}

main().catch(console.error);
