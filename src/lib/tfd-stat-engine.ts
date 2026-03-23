/**
 * Build planner stat engine.
 *
 * Computes final stats for a descendant or weapon loadout by layering:
 *   base stats (from Nexon JSON) → module modifiers → reactor contribution
 */

import type { ModuleRecord } from "@/lib/tfd-modules";
import { capacityAtLevel } from "@/lib/tfd-modules";
import { extractPercentContributions } from "@/lib/build-planner-stats";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BuildReactor {
  id?: string;
  name: string;
  element: string;
  skillType: string;
  level: number;
  enhancement: string;
  substats: { stat: string; value: string; tier: string }[];
}

export interface ComputedStats {
  base: Record<string, number>;
  modifiers: Record<string, number>;
  reactor: Record<string, number>;
  final: Record<string, number>;
}

interface PlacedSlot {
  moduleId: string;
  level: number;
  customPreview?: string;
}

// ── JSON caches ──────────────────────────────────────────────────────────────

let descCache: Record<string, DescStatsEntry> | null = null;
let weapCache: Record<string, WeapStatsEntry> | null = null;

interface DescStatsEntry {
  name: string;
  stats: Record<string, Record<string, number>>;
  skills: { name: string; type: string; element: string; image: string; arche: string | null; description: string | null }[];
}

interface WeapStatsEntry {
  name: string;
  type: string;
  baseStats: Record<string, number>;
  firearmAtk: Record<string, Record<string, number>>;
}

async function loadDescStats(): Promise<Record<string, DescStatsEntry>> {
  if (descCache) return descCache;
  try {
    const res = await fetch("/data/descendant-stats.json");
    descCache = await res.json();
    return descCache!;
  } catch {
    return {};
  }
}

async function loadWeapStats(): Promise<Record<string, WeapStatsEntry>> {
  if (weapCache) return weapCache;
  try {
    const res = await fetch("/data/weapon-stats.json");
    weapCache = await res.json();
    return weapCache!;
  } catch {
    return {};
  }
}

export { loadDescStats, loadWeapStats };
export type { DescStatsEntry, WeapStatsEntry };

// ── Module modifier extraction ───────────────────────────────────────────────

function collectModifiers(
  slots: (PlacedSlot | null)[],
  moduleById: Map<string, ModuleRecord>,
): Record<string, number> {
  const mods: Record<string, number> = {};

  for (const s of slots) {
    if (!s) continue;
    const m = moduleById.get(s.moduleId);
    if (!m) continue;

    const text = s.customPreview ?? m.preview ?? "";
    const c0 = capacityAtLevel(m, 0);
    const cL = capacityAtLevel(m, s.level);
    const ratio = c0 > 0 ? cL / c0 : 1;

    const contribs = extractPercentContributions(text);
    for (const { bucket, value } of contribs) {
      mods[bucket] = (mods[bucket] ?? 0) + value * ratio;
    }
  }

  for (const k of Object.keys(mods)) {
    mods[k] = Math.round(mods[k] * 100) / 100;
  }
  return mods;
}

// ── Reactor contribution ─────────────────────────────────────────────────────

const ENHANCEMENT_MULT: Record<string, number> = {
  "0": 1.0, "1": 1.04, "2": 1.08, "3": 1.12, "4": 1.16, "5": 1.2, "Max": 1.2,
};

/**
 * Parse reactor substats into additive stat modifiers.
 * Values like "+12%" → 12, "0.084x" → 8.4 (treated as % boost).
 */
function parseReactorSubstats(reactor: BuildReactor): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sub of reactor.substats) {
    if (!sub.stat || !sub.value) continue;
    const raw = sub.value.replace(/[+\s]/g, "");
    let num: number;
    if (raw.endsWith("x")) {
      num = parseFloat(raw) * 100;
    } else if (raw.endsWith("%")) {
      num = parseFloat(raw);
    } else {
      num = parseFloat(raw);
    }
    if (!Number.isNaN(num)) {
      out[sub.stat] = (out[sub.stat] ?? 0) + num;
    }
  }
  return out;
}

function computeReactorContribution(reactor: BuildReactor | null): Record<string, number> {
  if (!reactor) return {};
  const base = parseReactorSubstats(reactor);
  const enhMult = ENHANCEMENT_MULT[reactor.enhancement] ?? 1;
  const scaled: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) {
    scaled[k] = Math.round(v * enhMult * 100) / 100;
  }
  return scaled;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function computeDescendantStats(
  descendantId: string,
  level: number,
  slots: (PlacedSlot | null)[],
  moduleById: Map<string, ModuleRecord>,
  reactor: BuildReactor | null,
): Promise<ComputedStats> {
  const db = await loadDescStats();
  const entry = db[descendantId];
  const base: Record<string, number> = {};

  if (entry) {
    for (const [statName, byLevel] of Object.entries(entry.stats)) {
      const val = byLevel[String(level)] ?? byLevel[String(Math.min(level, 40))];
      if (val != null) base[statName] = val;
    }
  }

  const modifiers = collectModifiers(slots, moduleById);
  const reactorMods = computeReactorContribution(reactor);

  const final: Record<string, number> = { ...base };
  const allModKeys = new Set([...Object.keys(modifiers), ...Object.keys(reactorMods)]);

  for (const key of allModKeys) {
    const modPct = modifiers[key] ?? 0;
    const reactPct = reactorMods[key] ?? 0;
    const totalPct = modPct + reactPct;

    const matchedBase = findMatchingBaseStat(key, base);
    if (matchedBase !== null) {
      final[matchedBase.name] = matchedBase.value * (1 + totalPct / 100);
    }
  }

  for (const k of Object.keys(final)) {
    final[k] = Math.round(final[k] * 100) / 100;
  }

  return { base, modifiers, reactor: reactorMods, final };
}

export async function computeWeaponStats(
  weaponId: string,
  level: number,
  slots: (PlacedSlot | null)[],
  moduleById: Map<string, ModuleRecord>,
): Promise<ComputedStats> {
  const db = await loadWeapStats();
  const entry = db[weaponId];
  const base: Record<string, number> = {};

  if (entry) {
    for (const [k, v] of Object.entries(entry.baseStats)) {
      base[k] = v;
    }
    for (const [atkName, byLevel] of Object.entries(entry.firearmAtk)) {
      const val = byLevel[String(level)] ?? byLevel[String(Math.min(level, 100))];
      if (val != null) base[atkName] = val;
    }
  }

  const modifiers = collectModifiers(slots, moduleById);
  const final: Record<string, number> = { ...base };

  for (const [key, pct] of Object.entries(modifiers)) {
    const matchedBase = findMatchingBaseStat(key, base);
    if (matchedBase !== null) {
      final[matchedBase.name] = matchedBase.value * (1 + pct / 100);
    }
  }

  for (const k of Object.keys(final)) {
    final[k] = Math.round(final[k] * 100) / 100;
  }

  return { base, modifiers, reactor: {}, final };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BUCKET_TO_STAT: Record<string, string> = {
  "HP": "Max HP",
  "Shield": "Max Shield",
  "DEF": "DEF",
  "Firearm ATK": "Firearm ATK",
  "Skill Power": "Skill Power",
  "Crit Rate": "Firearm Critical Hit Rate",
  "Firearm Crit Rate": "Firearm Critical Hit Rate",
  "Crit DMG": "Firearm Critical Hit Damage",
  "Firearm Crit DMG": "Firearm Critical Hit Damage",
  "Fire Rate": "Fire Rate",
  "Reload": "Reload Time",
  "Weak Point": "Weak Point Damage",
  "Accuracy": "Hip Fire Accuracy",
  "Hip Accuracy": "Hip Fire Accuracy",
  "Move Speed": "Movement Speed",
  "Recoil": "Recoil",
  "Resistance": "Fire Resistance",
  "Multi-Hit": "Multi-Hit Chance",
  "Weapon Swap": "Weapon Change Speed",
};

function findMatchingBaseStat(
  bucketKey: string,
  base: Record<string, number>,
): { name: string; value: number } | null {
  const directName = BUCKET_TO_STAT[bucketKey];
  if (directName && base[directName] != null) {
    return { name: directName, value: base[directName] };
  }
  if (base[bucketKey] != null) {
    return { name: bucketKey, value: base[bucketKey] };
  }
  const lower = bucketKey.toLowerCase();
  for (const [k, v] of Object.entries(base)) {
    if (k.toLowerCase().includes(lower)) return { name: k, value: v };
  }
  return null;
}
