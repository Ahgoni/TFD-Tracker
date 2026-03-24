import fs from "fs";
import path from "path";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";

export type TierListEntity = {
  entityKey: string;
  displayName: string;
  image: string;
};

const DESC_PATH = path.join(process.cwd(), "public/data/descendants.json");
/** Same slugs as tracker builds (`WeaponEntry.slug`), not raw Nexon numeric ids. */
const WEAPON_CATALOG_PATH = path.join(process.cwd(), "public/weapons-catalog.json");

function readDescendants(): DescendantCatalogRow[] {
  try {
    const raw = fs.readFileSync(DESC_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as DescendantCatalogRow[]) : [];
  } catch {
    return [];
  }
}

type WeaponSlugRow = { slug: string; name: string; icon?: string };

function readWeaponsBySlug(): WeaponSlugRow[] {
  try {
    const raw = fs.readFileSync(WEAPON_CATALOG_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as WeaponSlugRow[]) : [];
  } catch {
    return [];
  }
}

/** One row per Nexon `descendant_group_id` (base + Ultimate merged). */
export function getTierListDescendants(): TierListEntity[] {
  const rows = readDescendants();
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
  return out;
}

function pickDescendantDisplayName(rows: DescendantCatalogRow[]): string {
  const nonUlt = rows.find((r) => !/^ultimate\s+/i.test(r.name.trim()));
  if (nonUlt) return nonUlt.name.trim();
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return sorted[0]?.name.trim() ?? "Unknown";
}

export function getTierListWeapons(): TierListEntity[] {
  const rows = readWeaponsBySlug();
  const out: TierListEntity[] = rows.map((w) => ({
    entityKey: w.slug,
    displayName: w.name,
    image: (w.icon ?? "").replace(/^\.\//, "/"),
  }));
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}

/** Map exact roster/catalog descendant name → Nexon group id. */
export function descendantNameToGroupId(): Map<string, string> {
  const rows = readDescendants();
  const m = new Map<string, string>();
  for (const r of rows) {
    if (r.name && r.groupId) m.set(r.name.trim(), r.groupId);
  }
  return m;
}

/** Validate weapon id exists in catalog. */
export function weaponSlugSet(): Set<string> {
  return new Set(readWeaponsBySlug().map((w) => w.slug));
}
