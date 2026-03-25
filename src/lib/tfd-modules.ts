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
  /** From Nexon `available_module_slot_type`; empty for legacy/weapon rows. */
  slotTypes?: string[];
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

/** Highest level index with positive capacity in Nexon `module_stat` (0–10). Falls back to 10. */
export function maxModuleLevel(mod: ModuleRecord): number {
  const caps = mod.capacities;
  if (!caps?.length) return 10;
  let max = 0;
  for (let L = 0; L <= 10 && L < caps.length; L++) {
    const c = caps[L];
    if (typeof c === "number" && c > 0) max = L;
  }
  return max;
}

export function capacityAtLevel(mod: ModuleRecord, level: number): number {
  const capMax = maxModuleLevel(mod);
  const lv = Math.min(capMax, Math.max(0, level));
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
  const capMax = maxModuleLevel(mod);
  const lv = Math.min(capMax, Math.max(0, level));
  const c = mod.capacities?.[lv];
  if (typeof c === "number" && c > 0) return c;
  return lv;
}

/** Polarity labels (Nexon `module_socket_type`) for resolution / manual socket. */
export const MODULE_POLARITY_OPTIONS = ["Almandine", "Cerulean", "Malachite", "Rutile", "Xantic"] as const;

/** One module per non-empty `module_type` on descendant builds; skip Ancestors (resolution rules apply separately). */
export function descendantModuleTypeExclusionKey(mod: ModuleRecord): string | null {
  const t = (mod.type ?? "").trim();
  if (!t || t === "Ancestors") return null;
  return t;
}

export function isTriggerOnlyOnBoard(mod: ModuleRecord): boolean {
  const st = mod.slotTypes ?? [];
  return st.includes("Trigger") && !st.includes("Main") && !st.includes("Skill") && !st.includes("Sub");
}

/**
 * Descendant body grid (12 slots): index 0 = Skill (red), 6 = Sub, rest = Main.
 * Trigger-only library mods are excluded from this grid.
 */
export function descendantSlotAcceptsModule(slotIndex: number, mod: ModuleRecord): boolean {
  const st = mod.slotTypes ?? [];
  if (st.length === 0) return true;
  if (isTriggerOnlyOnBoard(mod)) return false;
  if (slotIndex === 0) return st.includes("Skill");
  if (slotIndex === 6) return st.includes("Sub");
  return st.includes("Main");
}

/** Resolution-style descendant mods (Ancestors type or blank-preview Transcendent) — user picks polarity. */
export function isResolutionStyleModule(mod: ModuleRecord): boolean {
  if (mod.moduleClass !== "Descendant") return false;
  if (mod.type === "Ancestors") return true;
  return mod.tier === "Transcendent" && !(mod.preview?.trim());
}

export function defaultPlacedSocket(mod: ModuleRecord): string {
  const s = mod.socket?.trim();
  if (s && (MODULE_POLARITY_OPTIONS as readonly string[]).includes(s)) return s;
  if (isResolutionStyleModule(mod)) return "Malachite";
  return s;
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
