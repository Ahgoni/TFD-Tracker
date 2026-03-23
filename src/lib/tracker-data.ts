import extCompRollData from "../../public/data/external-components.json";

// ── Element / Skill / Ammo definitions ──────────────────────────────────────

export interface IconDef {
  id: string;
  label: string;
  icon: string | null;
}

/**
 * All-lowercase URL paths under `public/` — reliable on Linux (case-sensitive FS/URLs).
 * Avoids `/Images/...` which can break when symlinks or nginx paths differ.
 */
export const elementDefs: IconDef[] = [
  { id: "all", label: "All", icon: null },
  { id: "chill", label: "Chill", icon: "/game-icons/chill.png" },
  { id: "electric", label: "Electric", icon: "/game-icons/electric.png" },
  { id: "fire", label: "Fire", icon: "/game-icons/fire.png" },
  { id: "nonattribute", label: "Non-Attribute", icon: "/game-icons/nonattribute.png" },
  { id: "toxic", label: "Toxic", icon: "/game-icons/toxic.png" },
];

export const skillDefs: IconDef[] = [
  { id: "all", label: "All", icon: null },
  { id: "dimension", label: "Dimension", icon: "/game-icons/dimension.png" },
  { id: "fusion", label: "Fusion", icon: "/game-icons/fusion.png" },
  { id: "singular", label: "Singular", icon: "/game-icons/singular.png" },
  { id: "tech", label: "Tech", icon: "/game-icons/tech.png" },
];

export const ammoDefs: IconDef[] = [
  { id: "all", label: "All Rounds", icon: null },
  { id: "General Rounds", label: "Primary", icon: "/game-ammo/general-rounds.png" },
  { id: "Impact Rounds", label: "Impact", icon: "/game-ammo/impact-rounds.png" },
  { id: "Special Rounds", label: "Special", icon: "/game-ammo/special-rounds.png" },
  { id: "High-Power Rounds", label: "Heavy", icon: "/game-ammo/heavy-rounds.png" },
];

// ── Substat options ──────────────────────────────────────────────────────────

export const substatOptions = [
  "Skill Cost",
  "Skill Cooldown",
  "Skill Duration UP",
  "Skill Effect Range",
  "Skill Critical Hit Rate",
  "Skill Critical Hit Damage",
  "Non-Attribute Skill Power Boost Ratio",
  "Fire Skill Power Boost Ratio",
  "Chill Skill Power Boost Ratio",
  "Electric Skill Power Boost Ratio",
  "Toxic Skill Power Boost Ratio",
  "Fusion Skill Power Boost Ratio",
  "Singular Skill Power Boost Ratio",
  "Dimension Skill Power Boost Ratio",
  "Tech Skill Power Boost Ratio",
  "HP Heal Modifier",
  "Sub Attack Power",
  "Additional Skill ATK When Attacking Colossus",
  "Additional Skill ATK When Attacking Legion of Darkness",
  "Additional Skill ATK When Attacking Order of Truth",
  "Additional Skill ATK When Attacking Legion of Immortality",
];

export const reactorSubstatRanges: Record<string, { min: number; max: number; invert?: boolean }> = {
  "Skill Cost": { min: 0.027, max: 0.041, invert: true },
  "Skill Cooldown": { min: 0.053, max: 0.074, invert: true },
  "Skill Duration UP": { min: 0.076, max: 0.106 },
  "Skill Effect Range": { min: 0.174, max: 0.258 },
  "Skill Critical Hit Rate": { min: 22.8, max: 33.0 },
  "Skill Critical Hit Damage": { min: 22.8, max: 33.0 },
  "Non-Attribute Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Fire Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Chill Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Electric Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Toxic Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Fusion Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Singular Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Dimension Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "Tech Skill Power Boost Ratio": { min: 0.054, max: 0.085 },
  "HP Heal Modifier": { min: 0.057, max: 0.085 },
  "Sub Attack Power": { min: 12.5, max: 19.1 },
  "Additional Skill ATK When Attacking Colossus": { min: 1778.309, max: 2633.561 },
  "Additional Skill ATK When Attacking Legion of Darkness": { min: 1778.309, max: 2633.561 },
  "Additional Skill ATK When Attacking Order of Truth": { min: 1778.309, max: 2633.561 },
  "Additional Skill ATK When Attacking Legion of Immortality": { min: 1778.309, max: 2633.561 },
};

/** External component + core rolls — merged under reactor ranges where keys overlap. */
const externalRollRanges: Record<string, { min: number; max: number; invert?: boolean }> = {};
const sr = extCompRollData.substatRanges as Record<string, { min: number; max: number }>;
for (const [k, v] of Object.entries(sr)) {
  externalRollRanges[k] = { min: v.min, max: v.max };
}
const br = extCompRollData.baseStatRanges as Record<string, { min: number; max: number }>;
for (const [k, v] of Object.entries(br)) {
  externalRollRanges[k] = { min: v.min, max: v.max };
}

/** Reactor + external component substats/core — used for rarity color tiers (same thresholds as reactor UI). */
export const allSubstatTierRanges: Record<string, { min: number; max: number; invert?: boolean }> = {
  ...externalRollRanges,
  ...reactorSubstatRanges,
};

// ── Descendant metadata ──────────────────────────────────────────────────────

export const descendantOptions = [
  "Ajax / Ultimate Ajax",
  "Blair / Ultimate Blair",
  "Bunny / Ultimate Bunny",
  "Dia",
  "Enzo",
  "Esiemo",
  "Freyna / Ultimate Freyna",
  "Gley / Ultimate Gley",
  "Hailey",
  "Harris",
  "Ines",
  "Jayber",
  "Keelan",
  "Kyle",
  "Lepic / Ultimate Lepic",
  "Luna / Ultimate Luna",
  "Nell",
  "Serena",
  "Sharen / Ultimate Sharen",
  "Valby / Ultimate Valby",
  "Viessa / Ultimate Viessa",
  "Yujin / Ultimate Yujin",
];

export interface DescendantMetaEntry {
  element: string;
  skills: string[];
}

export const descendantMeta: Record<string, DescendantMetaEntry> = {
  Ajax: { element: "nonattribute", skills: ["dimension", "tech"] },
  "Ultimate Ajax": { element: "nonattribute", skills: ["dimension", "tech"] },
  Blair: { element: "fire", skills: ["fusion", "tech"] },
  "Ultimate Blair": { element: "fire", skills: ["fusion", "tech"] },
  Bunny: { element: "electric", skills: ["singular", "fusion"] },
  "Ultimate Bunny": { element: "electric", skills: ["singular", "fusion"] },
  Dia: { element: "chill", skills: ["singular", "fusion"] },
  Enzo: { element: "nonattribute", skills: ["tech", "dimension"] },
  Esiemo: { element: "fire", skills: ["tech", "fusion"] },
  Freyna: { element: "toxic", skills: ["tech", "dimension"] },
  "Ultimate Freyna": { element: "toxic", skills: ["tech", "dimension"] },
  Gley: { element: "nonattribute", skills: ["singular", "tech"] },
  "Ultimate Gley": { element: "nonattribute", skills: ["singular", "tech"] },
  Hailey: { element: "chill", skills: ["dimension", "singular"] },
  Harris: { element: "nonattribute", skills: ["tech", "fusion"] },
  Ines: { element: "electric", skills: ["singular", "tech"] },
  Jayber: { element: "nonattribute", skills: ["tech", "dimension"] },
  Keelan: { element: "toxic", skills: ["fusion", "tech"] },
  Kyle: { element: "nonattribute", skills: ["dimension", "tech"] },
  Lepic: { element: "fire", skills: ["tech", "fusion"] },
  "Ultimate Lepic": { element: "fire", skills: ["tech", "fusion"] },
  Luna: { element: "nonattribute", skills: ["singular", "dimension"] },
  "Ultimate Luna": { element: "nonattribute", skills: ["singular", "dimension"] },
  Nell: { element: "nonattribute", skills: ["dimension", "singular"] },
  Serena: { element: "nonattribute", skills: ["fusion", "tech"] },
  Sharen: { element: "electric", skills: ["singular", "dimension"] },
  "Ultimate Sharen": { element: "electric", skills: ["singular", "dimension"] },
  Valby: { element: "nonattribute", skills: ["fusion", "dimension"] },
  "Ultimate Valby": { element: "nonattribute", skills: ["fusion", "dimension"] },
  Viessa: { element: "chill", skills: ["singular", "dimension"] },
  "Ultimate Viessa": { element: "chill", skills: ["singular", "dimension"] },
  Yujin: { element: "nonattribute", skills: ["tech", "dimension"] },
  "Ultimate Yujin": { element: "nonattribute", skills: ["tech", "dimension"] },
};

export function descendantNamesForDropdown(): string[] {
  const set = new Set<string>();
  descendantOptions.forEach((opt) => {
    opt.split("/").map((n) => n.trim()).forEach((n) => set.add(n));
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ── Reactor helpers ──────────────────────────────────────────────────────────

const reactorPrefixes: Record<string, string> = {
  fire: "Burning",
  chill: "Frozen",
  electric: "Electric",
  toxic: "Toxic",
  nonattribute: "Null",
};
const reactorSuffixes: Record<string, string> = {
  singular: "Singularity",
  fusion: "Mixture",
  dimension: "Dimension",
  tech: "Mechanics",
};

export function getReactorName(elementId: string, skillTypeId: string): string {
  return `${reactorPrefixes[elementId] ?? "Unknown"} ${reactorSuffixes[skillTypeId] ?? "Reactor"}`;
}

export function inferTierFromValue(statName: string, rawValue: string): "common" | "rare" | "ultimate" {
  const match = String(rawValue).match(/-?\d+(\.\d+)?/);
  if (!match) return "common";
  const numeric = Number(match[0]);
  const range = allSubstatTierRanges[statName];
  if (!range || range.max <= range.min) return "common";
  const rawNorm = (numeric - range.min) / (range.max - range.min);
  const normalized = Math.max(0, Math.min(1, range.invert ? 1 - rawNorm : rawNorm));
  if (normalized >= 0.75) return "ultimate";
  if (normalized >= 0.4) return "rare";
  return "common";
}

export const tierColors = { common: "#52a7ff", rare: "#b27bff", ultimate: "#ffc857" };

// ── Ammo label helper ────────────────────────────────────────────────────────

export function roundsLabel(roundsType: string): string {
  const map: Record<string, string> = {
    "General Rounds": "Primary",
    "Impact Rounds": "Impact",
    "High-Power Rounds": "Heavy",
    "Special Rounds": "Special",
  };
  return map[roundsType] ?? "Primary";
}

// ── Weapon name overrides ────────────────────────────────────────────────────

export const weaponNameOverrides: Record<string, string> = {
  "a-tams": "A-TAMS",
  "e-buster": "E-Buster",
  "gregs-reversed-fate": "Greg's Reversed Fate",
  "nazeistras-devotion": "Nazeistra's Devotion",
  "assassins-edge": "Assassin's Edge",
  "devils-call": "Devil's Call",
  "kings-guard-lance": "King's Guard Lance",
  "heros-scar": "Hero's Scar",
};

export function normalizeWeaponName(slug: string, fallbackName?: string): string {
  return weaponNameOverrides[slug] ?? fallbackName ?? slug;
}
