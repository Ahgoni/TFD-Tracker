/** Nexon module.json compact shape (see public/data/modules.json). */
export interface ModuleRecord {
  id: string;
  name: string;
  image: string;
  type: string;
  tier: string;
  socket: string;
  moduleClass: string;
  weaponTypes: string[];
  descendantIds: string[];
  capacities: number[];
  preview: string;
}

/** Map tracker weapon `type` (from catalog) → Nexon `available_weapon_type` string. */
export const WEAPON_TYPE_TO_NEXON: Record<string, string> = {
  Handgun: "WeaponHandGun",
  "Assault Rifle": "WeaponAssaultRifle",
  Shotgun: "WeaponShotGun",
  "Sniper Rifle": "WeaponSniperRifle",
  "Beam Rifle": "WeaponBeamRifle",
  Launcher: "WeaponLauncher",
};

export const MAX_WEAPON_CAPACITY = 80;
/** Absolute cap when Charged Sub Attack (melee) module is leveled to max (+10 from base). */
export const MAX_DESCENDANT_CAPACITY = 85;
/**
 * Max module budget without melee sub-slot bonus (in-game pool before unlocking +10 via Malachite melee).
 * With max-level melee sub: 75 + 10 = {@link MAX_DESCENDANT_CAPACITY}.
 */
export const DESCENDANT_BASE_CAPACITY = 75;
export const WEAPON_SLOT_COUNT = 10;
export const DESCENDANT_SLOT_COUNT = 12;

export function slotCountForTarget(targetType: "descendant" | "weapon"): number {
  return targetType === "weapon" ? WEAPON_SLOT_COUNT : DESCENDANT_SLOT_COUNT;
}

export function maxCapacityForTarget(targetType: "descendant" | "weapon"): number {
  return targetType === "weapon" ? MAX_WEAPON_CAPACITY : MAX_DESCENDANT_CAPACITY;
}

export function capacityAtLevel(mod: ModuleRecord, level: number): number {
  const lv = Math.min(10, Math.max(0, level));
  const c = mod.capacities?.[lv];
  return typeof c === "number" ? c : 0;
}

/** Malachite “Charged Sub Attack” style modules — only one may be equipped; they add to max capacity budget when leveled. */
const CHARGED_SUB_ATTACK_PREVIEW = "Modifies the Charged Sub Attack.";

export function isChargedSubAttackModule(mod: ModuleRecord | undefined): boolean {
  if (!mod?.preview) return false;
  return mod.preview.trim() === CHARGED_SUB_ATTACK_PREVIEW;
}

/**
 * In-game bottom-left “Sub Module” cell: true Charged Sub Attack mods **or** Malachite
 * sub-slot exclusives (e.g. Mid-Air Maneuvering) that share that board position — not the top-left skill slot.
 */
export function isSubModuleBoardSlot(mod: ModuleRecord | undefined): boolean {
  if (!mod) return false;
  if (isChargedSubAttackModule(mod)) return true;
  if (mod.moduleClass === "Descendant" && mod.socket === "Malachite") {
    const p = mod.preview?.trim().toLowerCase() ?? "";
    if (p.includes("grappling")) return true;
    if (mod.name === "Mid-Air Maneuvering") return true;
  }
  return false;
}

/** Descendant-only: Trigger modules sit in the tall slot left of the 6×2 board (not in the 12 body cells). */
export function isTriggerModule(mod: ModuleRecord | undefined): boolean {
  return mod?.type === "Trigger";
}

/** Capacity consumed from the module budget (sub-attack mods cost 0 — they expand the budget instead). */
export function capacityCostAtLevel(mod: ModuleRecord, level: number): number {
  if (isChargedSubAttackModule(mod)) return 0;
  return capacityAtLevel(mod, level);
}

/**
 * Bonus added to max descendant module capacity from a leveled sub-attack module.
 * Uses `capacities[level]` when &gt; 0 (see modules.json); otherwise +1 per level.
 */
export function subAttackMaxCapacityBonusAtLevel(mod: ModuleRecord, level: number): number {
  if (!isChargedSubAttackModule(mod)) return 0;
  const lv = Math.min(10, Math.max(0, level));
  const c = mod.capacities?.[lv];
  if (typeof c === "number" && c > 0) return c;
  return lv;
}

export function totalCapacityCost(
  slots: Array<{ moduleId: string; level: number } | null | undefined>,
  byId: Map<string, ModuleRecord>
): number {
  let sum = 0;
  for (const s of slots) {
    if (!s) continue;
    const m = byId.get(s.moduleId);
    if (!m) continue;
    sum += capacityCostAtLevel(m, s.level);
  }
  return sum;
}

export function totalSubAttackCapacityBonus(
  slots: Array<{ moduleId: string; level: number } | null | undefined>,
  byId: Map<string, ModuleRecord>
): number {
  let sum = 0;
  for (const s of slots) {
    if (!s) continue;
    const m = byId.get(s.moduleId);
    if (!m) continue;
    sum += subAttackMaxCapacityBonusAtLevel(m, s.level);
  }
  return sum;
}

/** @deprecated use totalCapacityCost */
export function totalPlacedCapacity(
  slots: Array<{ moduleId: string; level: number } | null | undefined>,
  byId: Map<string, ModuleRecord>
): number {
  return totalCapacityCost(slots, byId);
}

export function effectiveMaxCapacity(
  targetType: "descendant" | "weapon",
  slots: Array<{ moduleId: string; level: number } | null | undefined>,
  byId: Map<string, ModuleRecord>
): number {
  if (targetType === "weapon") return MAX_WEAPON_CAPACITY;
  const bonus = totalSubAttackCapacityBonus(slots, byId);
  /** 75 + 0…10 → up to 85; other Malachite mods (e.g. grappling) do not add this bonus. */
  return Math.min(MAX_DESCENDANT_CAPACITY, DESCENDANT_BASE_CAPACITY + bonus);
}

const WEAPON_MODULE_CLASSES = new Set([
  "General Rounds",
  "High-Power Rounds",
  "Impact Rounds",
  "Special Rounds",
]);

/** Modules usable for the selected weapon or descendant. */
export function filterModuleLibrary(
  all: ModuleRecord[],
  targetType: "descendant" | "weapon",
  opts: {
    weaponNexonType: string | null;
    descendantId: string | null;
    /**
     * All Nexon descendant IDs for this character (same `descendant_group_id`, e.g. base + Ultimate).
     * Required when `module.available_descendant_id` lists another variant (e.g. Transcendent skill for Ultimate Ajax).
     */
    descendantPeerIds?: string[] | null;
  }
): ModuleRecord[] {
  return all.filter((m) => {
    const isWeaponModule = WEAPON_MODULE_CLASSES.has(m.moduleClass);

    if (targetType === "weapon") {
      if (!isWeaponModule) return false;
      const wt = m.weaponTypes ?? [];
      if (wt.length === 0) return true;
      if (!opts.weaponNexonType) return false;
      return wt.includes(opts.weaponNexonType);
    }

    // Descendant: exclude weapon-class modules
    if (isWeaponModule) return false;
    const ds = m.descendantIds ?? [];
    if (ds.length === 0) return true;

    const allowed = new Set<string>();
    if (opts.descendantId) allowed.add(opts.descendantId);
    if (opts.descendantPeerIds?.length) {
      for (const id of opts.descendantPeerIds) allowed.add(id);
    }
    if (allowed.size === 0) return false;
    return ds.some((id) => allowed.has(id));
  });
}

export function matchesModuleFilters(
  m: ModuleRecord,
  search: string,
  tier: string,
  socket: string
): boolean {
  const q = search.trim().toLowerCase();
  if (q) {
    const hay = `${m.name} ${m.preview} ${m.type} ${m.moduleClass}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (tier !== "all" && m.tier !== tier) return false;
  if (socket !== "all" && m.socket !== socket) return false;
  return true;
}
