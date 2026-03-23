import type { PlacedModule } from "@/app/tracker/tracker-client";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { capacityAtLevel, totalPlacedCapacity } from "@/lib/tfd-modules";

export interface BuildPlannerMetrics {
  equippedCount: number;
  slotsTotal: number;
  fillPercent: number;
  totalCapacity: number;
  maxCapacity: number;
  avgModuleLevel: number;
  tierCounts: Record<string, number>;
  socketsUsed: string[];
  valueTokens: string[];
  /** Parsed % lines grouped — additive estimate for comparison (not in-game DPS). */
  modifierRollup: ModifierRollupRow[];
  /** Capacity ratio Lv0→current for each equipped module (for UI). */
  capacityRatios: { name: string; ratio: number; level: number }[];
}

export interface ModifierRollupRow {
  bucket: string;
  /** Sum of signed % values classified into this bucket */
  netPercent: number;
  /** How many modifier lines contributed */
  hits: number;
}

/** Longest-first keyword → bucket label (context is text before the % number). */
const BUCKET_RULES: { bucket: string; test: (ctx: string) => boolean }[] = [
  { bucket: "Firearm Crit DMG", test: (c) => /Firearm Critical Hit Damage/i.test(c) },
  { bucket: "Firearm Crit Rate", test: (c) => /Firearm Critical Hit Rate/i.test(c) },
  { bucket: "Crit DMG", test: (c) => /\bCritical Hit Damage\b/i.test(c) && !/Rate/i.test(c) },
  { bucket: "Crit Rate", test: (c) => /\bCritical Hit Rate\b/i.test(c) && !/Firearm/i.test(c) },
  { bucket: "Multi-Hit", test: (c) => /Multi-Hit Damage/i.test(c) },
  { bucket: "Weak Point", test: (c) => /Weak Point Damage/i.test(c) },
  { bucket: "Reload", test: (c) => /Reload Time Modifier/i.test(c) },
  { bucket: "Fire Rate", test: (c) => /Fire Rate/i.test(c) },
  { bucket: "Hip Accuracy", test: (c) => /Hip Fire Accuracy/i.test(c) },
  { bucket: "Accuracy", test: (c) => /\bAccuracy\b/i.test(c) },
  { bucket: "DEF", test: (c) => /\bDEF\b/i.test(c) },
  { bucket: "Firearm ATK", test: (c) => /Firearm ATK/i.test(c) },
  { bucket: "Skill Power", test: (c) => /Skill (Power|ATK)/i.test(c) },
  { bucket: "HP", test: (c) => /\b(HP|Health)\b/i.test(c) },
  { bucket: "Shield", test: (c) => /Shield/i.test(c) },
  { bucket: "Move Speed", test: (c) => /(Move Speed|Sprint)/i.test(c) },
  { bucket: "Weapon Swap", test: (c) => /Weapon Change Speed/i.test(c) },
  { bucket: "Resistance", test: (c) => /Resistance/i.test(c) },
  { bucket: "Recoil", test: (c) => /Recoil/i.test(c) },
];

function classifyPercentContext(contextBeforePercent: string): string {
  const c = contextBeforePercent;
  for (const { bucket, test } of BUCKET_RULES) {
    if (test(c)) return bucket;
  }
  return "Other %";
}

const PCT_RE = /([+-]?\d+(?:\.\d+)?)%/g;

/**
 * Sum signed % modifiers from text (uses Lv 0 preview; combine with per-module ratio externally if needed).
 */
export function extractPercentContributions(preview: string): { bucket: string; value: number }[] {
  const text = preview ?? "";
  const out: { bucket: string; value: number }[] = [];
  for (const m of text.matchAll(PCT_RE)) {
    const idx = m.index ?? 0;
    const ctx = text.slice(Math.max(0, idx - 120), idx);
    const value = parseFloat(m[1]);
    if (Number.isNaN(value)) continue;
    out.push({ bucket: classifyPercentContext(ctx), value });
  }
  return out;
}

function rollupRows(rows: { bucket: string; value: number }[]): ModifierRollupRow[] {
  const map = new Map<string, { sum: number; hits: number }>();
  for (const { bucket, value } of rows) {
    const cur = map.get(bucket) ?? { sum: 0, hits: 0 };
    cur.sum += value;
    cur.hits += 1;
    map.set(bucket, cur);
  }
  return [...map.entries()]
    .map(([bucket, { sum, hits }]) => ({ bucket, netPercent: Math.round(sum * 10) / 10, hits }))
    .sort((a, b) => Math.abs(b.netPercent) - Math.abs(a.netPercent));
}

/**
 * Scale every % in preview by capacity ratio (Lv vs Lv0). Nexon ties stronger effects to higher cost.
 */
export function scalePreviewPercentagesForLevel(mod: ModuleRecord, level: number): string {
  const text = mod.preview ?? "";
  const c0 = capacityAtLevel(mod, 0);
  const cL = capacityAtLevel(mod, level);
  const denom = c0 > 0 ? c0 : 1;
  const ratio = cL / denom;

  return text.replace(PCT_RE, (full, numStr: string) => {
    const v = parseFloat(numStr) * ratio;
    const rounded = Math.round(v * 100) / 100;
    const abs = Math.abs(rounded);
    const body = abs % 1 < 0.05 ? abs.toFixed(0) : abs.toFixed(1).replace(/\.0$/, "");
    const sign = rounded >= 0 ? "+" : "-";
    return `${sign}${body}%`;
  });
}

export function computePlannerMetrics(
  slots: (PlacedModule | null)[],
  moduleById: Map<string, ModuleRecord>,
  maxCapacity: number
): BuildPlannerMetrics {
  const placed = slots.filter((s): s is PlacedModule => Boolean(s));
  const n = slots.length;
  const totalCapacity = totalPlacedCapacity(
    slots.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)),
    moduleById
  );
  const tierCounts: Record<string, number> = {};
  const socketSet = new Set<string>();
  let levelSum = 0;
  const tokenSet = new Set<string>();

  const allContribs: { bucket: string; value: number }[] = [];
  const capacityRatios: { name: string; ratio: number; level: number }[] = [];

  for (const p of placed) {
    tierCounts[p.tier] = (tierCounts[p.tier] ?? 0) + 1;
    if (p.socket) socketSet.add(p.socket);
    levelSum += p.level;
    const m = moduleById.get(p.moduleId);
    const text = m?.preview ?? "";
    const pct = text.match(/[+-]?\d+(?:\.\d+)?%/g);
    pct?.forEach((t) => {
      if (tokenSet.size < 32) tokenSet.add(t);
    });

    if (m) {
      const c0 = capacityAtLevel(m, 0);
      const cL = capacityAtLevel(m, p.level);
      const ratio = c0 > 0 ? cL / c0 : 1;
      capacityRatios.push({ name: p.name, ratio: Math.round(ratio * 1000) / 1000, level: p.level });
      const contribs = extractPercentContributions(text);
      for (const row of contribs) {
        allContribs.push({ bucket: row.bucket, value: row.value * ratio });
      }
    }
  }

  const avgModuleLevel = placed.length ? levelSum / placed.length : 0;

  return {
    equippedCount: placed.length,
    slotsTotal: n,
    fillPercent: n ? Math.round((placed.length / n) * 100) : 0,
    totalCapacity,
    maxCapacity,
    avgModuleLevel: Math.round(avgModuleLevel * 10) / 10,
    tierCounts,
    socketsUsed: [...socketSet].sort(),
    valueTokens: [...tokenSet],
    modifierRollup: rollupRows(allContribs),
    capacityRatios,
  };
}

/** Effect line: capacity-scaled preview + cap cost. */
export function effectSummaryLine(mod: ModuleRecord | undefined, level: number): string {
  if (!mod?.preview) return "";
  const scaled = scalePreviewPercentagesForLevel(mod, level);
  const cap = capacityAtLevel(mod, level);
  return `${scaled} · ${cap} cap`;
}
