/**
 * Transforms Nexon Open API `en` meta JSON into the compact shapes stored in
 * public/data (same as https://tfd.nexon.com/en/library/*).
 *
 * Used by: API routes (live pull) and fetch-game-data script (committed JSON).
 */

export const NEXON_META_EN_BASE = "https://open.api.nexon.com/static/tfd/meta/en";

export const NEXON_DESCENDANT_JSON = `${NEXON_META_EN_BASE}/descendant.json`;
export const NEXON_WEAPON_JSON = `${NEXON_META_EN_BASE}/weapon.json`;
export const NEXON_MODULE_JSON = `${NEXON_META_EN_BASE}/module.json`;
export const NEXON_EXTERNAL_COMPONENT_JSON = `${NEXON_META_EN_BASE}/external-component.json`;
export const NEXON_REACTOR_JSON = `${NEXON_META_EN_BASE}/reactor.json`;

const ELEMENT_MAP: Record<string, string> = {
  Chill: "chill",
  Electric: "electric",
  Fire: "fire",
  "Non-Attribute": "nonattribute",
  Toxic: "toxic",
};

const SKILL_TYPE_MAP: Record<string, string> = {
  Dimension: "dimension",
  Fusion: "fusion",
  Singular: "singular",
  Tech: "tech",
};

export function localImage(url: string | undefined, category: string): string {
  if (typeof url !== "string" || !url.startsWith("https://")) return url ?? "";
  const hash = url.split("/").pop();
  return `/assets/${category}/${hash}.png`;
}

function inferElement(skills: Array<{ element_type?: string }> | undefined): string {
  const elements = (skills ?? [])
    .map((s) => ELEMENT_MAP[s.element_type ?? ""])
    .filter(Boolean);
  return elements[0] ?? "nonattribute";
}

function inferSkillTypes(skills: Array<{ skill_type?: string; arche_type?: string | null }> | undefined): string[] {
  const types = new Set<string>();
  for (const s of skills ?? []) {
    if (s.skill_type === "Passive Skill") continue;
    const mapped = SKILL_TYPE_MAP[s.arche_type ?? ""];
    if (mapped) types.add(mapped);
  }
  return [...types];
}

function tierFromId(tierId: string | undefined): string {
  if (tierId === "Tier4") return "Transcendent";
  if (tierId === "Tier3") return "Ultimate";
  if (tierId === "Tier2") return "Rare";
  return "Normal";
}

/** Per-level capacity from module_stat (levels 0–10). */
function capacitiesFromStats(moduleStat: Array<{ level?: number; module_capacity?: number }> | undefined): number[] {
  const caps = new Array(11).fill(0);
  if (!Array.isArray(moduleStat)) return caps;
  for (const row of moduleStat) {
    const lv = row.level;
    if (typeof lv === "number" && lv >= 0 && lv <= 10) {
      caps[lv] = Number(row.module_capacity) || 0;
    }
  }
  return caps;
}

function previewFromStats(
  moduleStat: Array<{ level?: number; value?: string }> | undefined,
  isTranscendent = false,
): string {
  const row = Array.isArray(moduleStat) ? moduleStat.find((r) => r.level === 0) : null;
  const v = row?.value;
  if (typeof v !== "string") return "";
  if (isTranscendent) return v;
  const firstLine = v.split("\n")[0]?.trim() ?? "";
  /** Many modules (e.g. Trigger) use first line "Basic Info" then full roll layout — keep the rest. */
  if (firstLine === "Basic Info" && v.includes("\n")) {
    const rest = v.slice(v.indexOf("\n") + 1).trim();
    return rest.length > 2200 ? `${rest.slice(0, 2197)}…` : rest;
  }
  const line = v.split("\n")[0] ?? v;
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

/** Compact row for descendants.json / client catalog merge */
export type DescendantCatalogRow = {
  id: string;
  name: string;
  groupId: string;
  element: string;
  skillTypes: string[];
  image: string;
  skills: Array<{
    name: string;
    type: string;
    element: string;
    image: string;
    arche: string | null;
  }>;
};

export function transformDescendantsFromNexon(descRaw: unknown): DescendantCatalogRow[] {
  if (!Array.isArray(descRaw)) return [];
  return descRaw.map((d: Record<string, unknown>) => {
    const skills = (d.descendant_skill as Array<Record<string, unknown>>) ?? [];
    return {
      id: String(d.descendant_id ?? ""),
      name: String(d.descendant_name ?? ""),
      groupId: String(d.descendant_group_id ?? ""),
      element: inferElement(skills as { element_type?: string }[]),
      skillTypes: inferSkillTypes(skills as { skill_type?: string; arche_type?: string | null }[]),
      image: localImage(d.descendant_image_url as string | undefined, "descendants"),
      skills: skills.map((s) => ({
        name: String(s.skill_name ?? ""),
        type: String(s.skill_type ?? ""),
        element: String(s.element_type ?? ""),
        image: localImage(s.skill_image_url as string | undefined, "skills"),
        arche: (s.arche_type as string | null | undefined) ?? null,
      })),
    };
  });
}

export type WeaponCatalogRow = {
  id: string;
  name: string;
  image: string;
  type: string;
  rarity: string;
  roundsType: string;
};

export function transformWeaponsFromNexon(weapRaw: unknown): WeaponCatalogRow[] {
  if (!Array.isArray(weapRaw)) return [];
  return weapRaw.map((w: Record<string, unknown>) => ({
    id: String(w.weapon_id ?? ""),
    name: String(w.weapon_name ?? ""),
    image: localImage(w.image_url as string | undefined, "weapons"),
    type: String(w.weapon_type ?? ""),
    rarity: tierFromId(w.weapon_tier_id as string | undefined),
    roundsType: String(w.weapon_rounds_type ?? ""),
  }));
}

export type ModuleCatalogRow = {
  id: string;
  name: string;
  image: string;
  type: string;
  tier: string;
  socket: string;
  moduleClass: string;
  weaponTypes: string[];
  descendantIds: string[];
  /** Nexon `available_module_slot_type`: Skill, Sub, Main, Trigger (descendant body grid uses Main + fixed Skill/Sub cells). */
  slotTypes: string[];
  capacities: number[];
  preview: string;
};

export function transformModulesFromNexon(modRaw: unknown): ModuleCatalogRow[] {
  if (!Array.isArray(modRaw)) return [];
  return modRaw.map((m: Record<string, unknown>) => {
    const isTranscendent = m.module_tier_id === "Tier4";
    const moduleStat = m.module_stat as Array<{ level?: number; module_capacity?: number; value?: string }> | undefined;
    const slotTypes = Array.isArray(m.available_module_slot_type)
      ? (m.available_module_slot_type as string[]).map((s) => String(s))
      : [];
    return {
      id: String(m.module_id ?? ""),
      name: String(m.module_name ?? ""),
      image: localImage(m.image_url as string | undefined, "modules"),
      type: String(m.module_type ?? ""),
      tier: tierFromId(m.module_tier_id as string | undefined),
      socket: String(m.module_socket_type ?? ""),
      moduleClass: String(m.module_class ?? ""),
      weaponTypes: (m.available_weapon_type as string[]) ?? [],
      descendantIds: (m.available_descendant_id as string[]) ?? [],
      slotTypes,
      capacities: capacitiesFromStats(moduleStat),
      preview: previewFromStats(moduleStat, isTranscendent),
    };
  });
}

function tierFromExternalComponentTierId(tierId: string | undefined): string {
  if (tierId === "Tier4") return "Transcendent";
  if (tierId === "Tier3") return "Ultimate";
  if (tierId === "Tier2") return "Rare";
  return "Normal";
}

export type ExternalComponentSetOption = {
  setName: string;
  setCount: number;
  effect: string;
};

/** Nexon external-component.json row (for Player Lookup icons + set names). */
export type ExternalComponentCatalogRow = {
  id: string;
  name: string;
  /** Nexon CDN image URL. */
  image: string;
  equipmentType: string;
  tier: string;
  setOptionDetail: ExternalComponentSetOption[];
};

export function transformExternalComponentsFromNexon(raw: unknown): ExternalComponentCatalogRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => {
    const detail = (r.set_option_detail as Array<Record<string, unknown>>) ?? [];
    const setOptionDetail: ExternalComponentSetOption[] = detail.map((d) => ({
      setName: String(d.set_option ?? ""),
      setCount: Number(d.set_count ?? 0),
      effect: String(d.set_option_effect ?? "").replace(/\\n/g, "\n"),
    }));
    return {
      id: String(r.external_component_id ?? ""),
      name: String(r.external_component_name ?? ""),
      image: typeof r.image_url === "string" ? r.image_url : "",
      equipmentType: String(r.external_component_equipment_type ?? ""),
      tier: tierFromExternalComponentTierId(r.external_component_tier_id as string | undefined),
      setOptionDetail,
    };
  });
}

/** Nexon reactor_name prefixes → in-game element label (library naming). */
const REACTOR_NAME_ELEMENT: Record<string, string> = {
  Tingling: "Electric",
  Burning: "Fire",
  Frozen: "Chill",
  Toxic: "Toxic",
  Materialized: "Non-Attribute",
};

function reactorNameParts(name: string): { element: string; attribute: string } {
  const m = name.trim().match(/^(\S+)\s+(\S+)\s+Reactor$/i);
  if (!m) return { element: "", attribute: "" };
  const prefix = m[1] ?? "";
  const attr = m[2] ?? "";
  return {
    element: REACTOR_NAME_ELEMENT[prefix] ?? prefix,
    attribute: attr,
  };
}

/** Compact reactor row for Player Lookup (matches Nexon reactor.json). */
export type ReactorCatalogRow = {
  id: string;
  name: string;
  image: string;
  tier: string;
  element: string;
  attribute: string;
};

export function transformReactorsFromNexon(raw: unknown): ReactorCatalogRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => {
    const name = String(r.reactor_name ?? "");
    const { element, attribute } = reactorNameParts(name);
    return {
      id: String(r.reactor_id ?? ""),
      name,
      image: typeof r.image_url === "string" ? r.image_url : "",
      tier: tierFromId(r.reactor_tier_id as string | undefined),
      element,
      attribute,
    };
  });
}
