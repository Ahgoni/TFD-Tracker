import fs from "fs";
import path from "path";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";
import { weaponNameToSlug as weaponNameToSlugFromLib } from "@/lib/weapon-slug";
import {
  NEXON_DESCENDANT_JSON,
  NEXON_WEAPON_JSON,
  transformDescendantsFromNexon,
  transformWeaponsFromNexon,
} from "@/lib/nexon-catalog-transform";

export type TierListEntity = {
  entityKey: string;
  displayName: string;
  image: string;
};

const DESC_PATH = path.join(process.cwd(), "public/data/descendants.json");
/** Same slugs as tracker builds (`WeaponEntry.slug`), not raw Nexon numeric ids. */
const WEAPON_CATALOG_PATH = path.join(process.cwd(), "public/weapons-catalog.json");

/** Re-export for server/catalog code; implementation is client-safe in `weapon-slug.ts`. */
export const weaponNameToSlug = weaponNameToSlugFromLib;

type WeaponSlugRow = { slug: string; name: string; icon?: string; rarity?: string };

function readDescendants(): DescendantCatalogRow[] {
  try {
    const raw = fs.readFileSync(DESC_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as DescendantCatalogRow[]) : [];
  } catch {
    return [];
  }
}

function readWeaponsBySlug(): WeaponSlugRow[] {
  try {
    const raw = fs.readFileSync(WEAPON_CATALOG_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as WeaponSlugRow[]) : [];
  } catch {
    return [];
  }
}

async function fetchNexonJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadDescendantRows(): Promise<DescendantCatalogRow[]> {
  const raw = await fetchNexonJson(NEXON_DESCENDANT_JSON);
  const live = raw ? transformDescendantsFromNexon(raw) : [];
  if (live.length > 0) return live;
  return readDescendants();
}

/** One row per Nexon `descendant_group_id` (base + Ultimate merged). */
function buildTierListDescendantsFromRows(rows: DescendantCatalogRow[]): TierListEntity[] {
  const byGroup = new Map<string, DescendantCatalogRow[]>();
  for (const r of rows) {
    const g = r.groupId?.trim();
    if (!g) continue;
    const list = byGroup.get(g) ?? [];
    list.push(r);
    byGroup.set(g, list);
  }
  const out: TierListEntity[] = [];
  for (const [groupId, groupRows] of byGroup) {
    const displayName = pickDescendantDisplayName(groupRows);
    const pick = groupRows.find((r) => r.name === displayName) ?? groupRows[0];
    out.push({
      entityKey: groupId,
      displayName,
      image: pick.image ?? "",
    });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out.filter((e) => e.entityKey);
}

export async function getTierListDescendants(): Promise<TierListEntity[]> {
  const rows = await loadDescendantRows();
  return buildTierListDescendantsFromRows(rows);
}

function pickDescendantDisplayName(rows: DescendantCatalogRow[]): string {
  const nonUlt = rows.find((r) => !/^ultimate\s+/i.test(r.name.trim()));
  if (nonUlt) return nonUlt.name.trim();
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return sorted[0]?.name.trim() ?? "Unknown";
}

function getTierListWeaponsFromFiles(): TierListEntity[] {
  const rows = readWeaponsBySlug().filter((w) => w.rarity === "Ultimate");
  const out: TierListEntity[] = rows.map((w) => ({
    entityKey: w.slug,
    displayName: w.name,
    image: (w.icon ?? "").replace(/^\.\//, "/"),
  }));
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}

async function loadWeaponEntitiesFromNexon(): Promise<TierListEntity[] | null> {
  const raw = await fetchNexonJson(NEXON_WEAPON_JSON);
  if (!raw) return null;
  const rows = transformWeaponsFromNexon(raw).filter((w) => w.rarity === "Ultimate");
  if (rows.length === 0) return null;
  return rows
    .map((w) => ({
      entityKey: weaponNameToSlug(w.name),
      displayName: w.name,
      image: w.image,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Tier list weapons: **Ultimate** only (matches `rarity` in `weapons-catalog.json` / Nexon tier).
 * Prefers live Nexon `weapon.json`, falls back to `public/weapons-catalog.json`.
 */
export async function getTierListWeapons(): Promise<TierListEntity[]> {
  const live = await loadWeaponEntitiesFromNexon();
  if (live && live.length > 0) return live;
  return getTierListWeaponsFromFiles();
}

export async function weaponSlugSet(): Promise<Set<string>> {
  return new Set((await getTierListWeapons()).map((w) => w.entityKey));
}

/** Map exact roster/catalog descendant name → Nexon group id. */
export async function descendantNameToGroupId(): Promise<Map<string, string>> {
  const rows = await loadDescendantRows();
  const m = new Map<string, string>();
  for (const r of rows) {
    if (r.name && r.groupId) m.set(r.name.trim(), r.groupId.trim());
  }
  return m;
}
