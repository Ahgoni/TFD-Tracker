/**
 * Normalize Nexon /tfd/v1/user/* JSON into stable shapes for the Player Lookup UI.
 * Nexon may change nesting; we try several common paths.
 */

export type ModuleSlotParsed = {
  slotId: string;
  moduleId: string;
  enchantLevel: number;
};

export type DescendantBuildParsed = {
  descendantId: string;
  slotId: string;
  level: number;
  userName: string;
  moduleMaxCapacity: number;
  moduleUsedCapacity: number;
  energyActivatorCount: number;
  modules: ModuleSlotParsed[];
};

export type WeaponBuildParsed = {
  weaponId: string;
  slotId: string;
  level: number;
  moduleMaxCapacity: number;
  moduleUsedCapacity: number;
  modules: ModuleSlotParsed[];
};

function asRecord(x: unknown): Record<string, unknown> | null {
  if (x && typeof x === "object" && !Array.isArray(x)) return x as Record<string, unknown>;
  return null;
}

function num(x: unknown, fallback = 0): number {
  if (typeof x === "number" && !Number.isNaN(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function parseModuleSlot(m: unknown): ModuleSlotParsed | null {
  const r = asRecord(m);
  if (!r) return null;
  const moduleId = r.module_id ?? r.moduleId;
  if (typeof moduleId !== "string" || !moduleId) return null;
  const slotId = String(r.module_slot_id ?? r.moduleSlotId ?? r.slot_id ?? "");
  const enchantLevel = Math.min(10, Math.max(0, Math.round(num(r.module_enchant_level ?? r.moduleEnchantLevel, 0))));
  return { slotId, moduleId, enchantLevel };
}

function parseModuleList(raw: unknown): ModuleSlotParsed[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(parseModuleSlot).filter((x): x is ModuleSlotParsed => x !== null);
}

/** Unwrap common Nexon envelope: { id: { ...payload } } or { id: [...] } */
function unwrapPayload(json: unknown): unknown {
  const r = asRecord(json);
  if (!r) return json;
  const keys = Object.keys(r);
  if (keys.length === 1 && keys[0] === "id") {
    return r.id;
  }
  return json;
}

function parseDescendantOne(o: unknown): DescendantBuildParsed | null {
  const r = asRecord(o);
  if (!r) return null;
  const descendantId = String(r.descendant_id ?? r.descendantId ?? "");
  if (!descendantId) return null;
  const modulesRaw = r.module ?? r.modules ?? r.equipped_module ?? r.descendant_module;
  return {
    descendantId,
    slotId: String(r.descendant_slot_id ?? r.descendantSlotId ?? ""),
    level: Math.round(num(r.descendant_level ?? r.descendantLevel, 1)),
    userName: String(r.user_name ?? r.userName ?? ""),
    moduleMaxCapacity: Math.round(num(r.module_max_capacity ?? r.moduleMaxCapacity, 0)),
    moduleUsedCapacity: Math.round(num(r.module_capacity ?? r.moduleCapacity, 0)),
    energyActivatorCount: Math.round(num(r.energy_activator_use_count ?? r.energyActivatorUseCount, 0)),
    modules: parseModuleList(modulesRaw),
  };
}

export function extractDescendantBuilds(descendantJson: unknown): DescendantBuildParsed[] {
  const unwrapped = unwrapPayload(descendantJson);
  if (Array.isArray(unwrapped)) {
    return unwrapped.map(parseDescendantOne).filter((x): x is DescendantBuildParsed => x !== null);
  }
  const root = asRecord(unwrapped);
  if (!root) return [];

  const tryArrays = [
    root.descendant,
    root.user_descendant,
    root.descendants,
    root.user_descendant_list,
    root.descendant_list,
  ];
  for (const t of tryArrays) {
    if (Array.isArray(t)) {
      return t.map(parseDescendantOne).filter((x): x is DescendantBuildParsed => x !== null);
    }
  }

  const single =
    tryArrays.find((t) => t && typeof t === "object" && !Array.isArray(t)) ??
    (root.descendant_id || root.module || root.modules ? root : null);

  if (single && typeof single === "object" && !Array.isArray(single)) {
    const one = parseDescendantOne(single);
    if (one) return [one];
  }

  const one = parseDescendantOne(root);
  return one ? [one] : [];
}

function parseWeaponOne(o: unknown): WeaponBuildParsed | null {
  const r = asRecord(o);
  if (!r) return null;
  const weaponId = String(r.weapon_id ?? r.weaponId ?? "");
  if (!weaponId) return null;
  const modulesRaw = r.module ?? r.modules ?? r.weapon_module;
  return {
    weaponId,
    slotId: String(r.weapon_slot_id ?? r.weaponSlotId ?? ""),
    level: Math.round(num(r.weapon_level ?? r.weaponLevel, 1)),
    moduleMaxCapacity: Math.round(num(r.module_max_capacity ?? r.moduleMaxCapacity, 0)),
    moduleUsedCapacity: Math.round(num(r.module_capacity ?? r.moduleCapacity, 0)),
    modules: parseModuleList(modulesRaw),
  };
}

export function extractWeaponBuilds(weaponJson: unknown): WeaponBuildParsed[] {
  const unwrapped = unwrapPayload(weaponJson);
  if (Array.isArray(unwrapped)) {
    return unwrapped.map(parseWeaponOne).filter((x): x is WeaponBuildParsed => x !== null);
  }
  const root = asRecord(unwrapped);
  if (!root) return [];

  const tryArrays = [root.weapon, root.weapons, root.user_weapon, root.user_weapon_list, root.weapon_list];
  for (const t of tryArrays) {
    if (Array.isArray(t)) {
      return t.map(parseWeaponOne).filter((x): x is WeaponBuildParsed => x !== null);
    }
  }

  const one = parseWeaponOne(root);
  return one ? [one] : [];
}

function deepFindNumber(obj: unknown, candidateKeys: string[], depth = 0): number | null {
  if (depth > 6 || !obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  for (const k of candidateKeys) {
    if (r[k] !== undefined && r[k] !== null) {
      const n = num(r[k], NaN);
      if (!Number.isNaN(n)) return n;
    }
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === "object") {
      const n = deepFindNumber(v, candidateKeys, depth + 1);
      if (n !== null) return n;
    }
  }
  return null;
}

function deepFindString(obj: unknown, candidateKeys: string[], depth = 0): string {
  if (depth > 6 || !obj || typeof obj !== "object") return "";
  const r = obj as Record<string, unknown>;
  for (const k of candidateKeys) {
    const v = r[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === "object") {
      const s = deepFindString(v, candidateKeys, depth + 1);
      if (s) return s;
    }
  }
  return "";
}

/** Pull user_name, mastery_rank, ouid from /user/basic or nested objects */
export function extractBasicInfo(basicJson: unknown): {
  userName: string;
  masteryRank: number | null;
  ouid: string;
} {
  const root = unwrapPayload(basicJson);
  const r = asRecord(root);
  if (!r) return { userName: "", masteryRank: null, ouid: "" };

  const userName =
    String(r.user_name ?? r.userName ?? r.nickname ?? r.account_name ?? r.accountName ?? "") ||
    deepFindString(root, ["user_name", "userName", "nickname"]);

  const masteryDeep = deepFindNumber(root, [
    "mastery_rank",
    "masteryRank",
    "mastery_level",
    "masteryLevel",
  ]);
  const masteryRaw = r.mastery_rank ?? r.masteryRank ?? r.mastery_level ?? r.masteryLevel;
  const masteryRank =
    masteryDeep !== null
      ? Math.round(masteryDeep)
      : masteryRaw !== undefined && masteryRaw !== null && String(masteryRaw) !== ""
        ? Math.round(num(masteryRaw, NaN))
        : null;

  const ouid = String(r.ouid ?? r.OUID ?? deepFindString(root, ["ouid"]) ?? "");

  return {
    userName,
    masteryRank: masteryRank !== null && !Number.isNaN(masteryRank) ? masteryRank : null,
    ouid,
  };
}

/** True when JSON is the flat `/user/reactor` row (Nexon UserReactor — not wrapped in `reactor`). */
function looksLikeUserReactorRoot(r: Record<string, unknown>): boolean {
  if (r.descendant_id != null || r.descendantId != null) return false;
  const id = r.reactor_id ?? r.reactorId;
  if (typeof id === "string" && id.length > 0) return true;
  if (r.reactor_level != null || r.reactorLevel != null) {
    if (r.reactor_slot_id != null || r.reactorSlotId != null) return true;
  }
  return false;
}

/** Reactor entries — keep flexible for rendering */
export function extractReactorList(reactorJson: unknown): Record<string, unknown>[] {
  const unwrapped = unwrapPayload(reactorJson);
  if (Array.isArray(unwrapped)) {
    return unwrapped.filter((x) => asRecord(x)) as Record<string, unknown>[];
  }
  const root = asRecord(unwrapped);
  if (!root) return [];
  const keys = [
    "reactor",
    "reactors",
    "user_reactor",
    "userReactor",
    "user_reactor_list",
    "reactor_list",
    "descendant_reactor",
    "equipped_reactor",
    "equippedReactor",
    "data",
  ];
  for (const k of keys) {
    const v = root[k];
    if (Array.isArray(v)) return v.filter((x) => asRecord(x)) as Record<string, unknown>[];
    if (v && typeof v === "object" && !Array.isArray(v)) return [v as Record<string, unknown>];
  }
  /** Nexon returns UserReactor fields at the root: reactor_id, reactor_level, reactor_additional_stat, … */
  if (looksLikeUserReactorRoot(root)) return [root];
  return [];
}

/** Some Nexon payloads nest equipped reactor under each descendant row instead of `reactor` root. */
function extractReactorsFromDescendantJson(descendantJson: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const unwrapped = unwrapPayload(descendantJson);
  const collectRow = (row: Record<string, unknown>) => {
    const r = row.reactor ?? row.user_reactor ?? row.userReactor ?? row.equipped_reactor;
    if (r && typeof r === "object" && !Array.isArray(r)) out.push(r as Record<string, unknown>);
  };
  if (Array.isArray(unwrapped)) {
    unwrapped.forEach((x) => {
      const row = asRecord(x);
      if (row) collectRow(row);
    });
    return out;
  }
  const root = asRecord(unwrapped);
  if (!root) return [];
  for (const k of ["descendant", "user_descendant", "descendants", "user_descendant_list", "descendant_list"]) {
    const t = root[k];
    if (Array.isArray(t)) {
      t.forEach((x) => {
        const row = asRecord(x);
        if (row) collectRow(row);
      });
    } else if (t && typeof t === "object" && !Array.isArray(t)) collectRow(t as Record<string, unknown>);
  }
  return out;
}

function dedupeReactors(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const id = String(r.reactor_id ?? r.reactorId ?? r.id ?? "").trim();
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(r);
  }
  return out;
}

/** Merge `/user/reactor` and per-descendant reactor blocks (deduped by reactor id). */
export function extractReactorsMerged(profile: Record<string, unknown>): Record<string, unknown>[] {
  const fromApi = extractReactorList(profile.reactor);
  const fromDesc = extractReactorsFromDescendantJson(profile.descendant);
  return dedupeReactors([...fromApi, ...fromDesc]);
}

export function extractExternalList(extJson: unknown): Record<string, unknown>[] {
  const unwrapped = unwrapPayload(extJson);
  if (Array.isArray(unwrapped)) {
    return unwrapped.filter((x) => asRecord(x)) as Record<string, unknown>[];
  }
  const root = asRecord(unwrapped);
  if (!root) return [];
  const keys = [
    "external_component",
    "external_components",
    "externalComponent",
    "component",
    "components",
    "user_external_component",
    "user_external_component_list",
  ];
  for (const k of keys) {
    const v = root[k];
    if (Array.isArray(v)) return v.filter((x) => asRecord(x)) as Record<string, unknown>[];
    if (v && typeof v === "object" && !Array.isArray(v)) return [v as Record<string, unknown>];
  }
  return [];
}
