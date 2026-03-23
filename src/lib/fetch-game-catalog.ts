/**
 * Client-side: prefer live Nexon-backed catalog API, fall back to committed /public/data/*.json.
 * Same underlying data as https://tfd.nexon.com/en/library/descendants (via open.api.nexon.com).
 */

import type {
  DescendantCatalogRow,
  ExternalComponentCatalogRow,
  WeaponCatalogRow,
} from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";

async function tryJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as unknown;
    return j as T;
  } catch {
    return null;
  }
}

/** Descendants catalog (merge shape used by tracker-client). */
export async function fetchDescendantsCatalogRows(): Promise<DescendantCatalogRow[] | null> {
  const live = await tryJson<unknown[]>("/api/nexon/catalog/descendants");
  if (Array.isArray(live) && live.length > 0) return live as DescendantCatalogRow[];
  const stat = await tryJson<unknown[]>("/data/descendants.json");
  if (Array.isArray(stat) && stat.length > 0) return stat as DescendantCatalogRow[];
  return null;
}

export async function fetchModulesCatalog(): Promise<ModuleRecord[] | null> {
  const live = await tryJson<ModuleRecord[]>("/api/nexon/catalog/modules");
  if (Array.isArray(live) && live.length > 0) return live;
  const stat = await tryJson<ModuleRecord[]>("/data/modules.json");
  if (Array.isArray(stat) && stat.length > 0) return stat;
  return null;
}

export async function fetchWeaponsCatalogRows(): Promise<WeaponCatalogRow[] | null> {
  const live = await tryJson<WeaponCatalogRow[]>("/api/nexon/catalog/weapons");
  if (Array.isArray(live) && live.length > 0) return live;
  const stat = await tryJson<WeaponCatalogRow[]>("/data/weapons.json");
  if (Array.isArray(stat) && stat.length > 0) return stat;
  return null;
}

/** External components (icons + set metadata) — Nexon static JSON only. */
export async function fetchExternalComponentCatalogRows(): Promise<ExternalComponentCatalogRow[] | null> {
  const live = await tryJson<ExternalComponentCatalogRow[]>("/api/nexon/catalog/external-components");
  if (Array.isArray(live) && live.length > 0) return live;
  return null;
}
