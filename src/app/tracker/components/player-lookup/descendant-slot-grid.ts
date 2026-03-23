/**
 * In-game–style 6×2 descendant module board: top-left = Sub 1 (green / “red” mod),
 * bottom-left = Charged Sub Attack melee (gold). Matches common TFD inventory layout.
 */

import type { ModuleRecord } from "@/lib/tfd-modules";
import { isChargedSubAttackModule } from "@/lib/tfd-modules";
import type { DescendantBuildParsed } from "./nexonPlayerPayload";

export type SlotAccent = "melee-gold" | "sub-green" | null;

export type DescendantGridCell = {
  index: number;
  moduleSlot: DescendantBuildParsed["modules"][0];
  rec: ModuleRecord | undefined;
  accent: SlotAccent;
};

function sortSlotId(a: string, b: string): number {
  const key = (s: string): [number, number, string] => {
    const m = s.match(/^(Main|Sub)\s*(\d+)/i);
    if (m) {
      const order = m[1].toLowerCase() === "main" ? 0 : 1;
      return [order, parseInt(m[2], 10), s];
    }
    const n = parseInt(s, 10);
    if (!Number.isNaN(n)) return [2, n, s];
    return [99, 0, s];
  };
  const ka = key(a);
  const kb = key(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return ka[2].localeCompare(kb[2]);
}

/** Normalize API slot labels (e.g. "3" → "Main 3"). */
export function normalizeSlotId(raw: string): string {
  const s = raw.trim();
  const sub = s.match(/^sub\s*(\d+)$/i);
  if (sub) return `Sub ${sub[1]}`;
  const main = s.match(/^main\s*(\d+)$/i);
  if (main) return `Main ${main[1]}`;
  if (/^\d+$/.test(s)) return `Main ${s}`;
  return s;
}

function modKey(m: { slotId: string; moduleId: string }): string {
  return `${m.slotId}::${m.moduleId}`;
}

/**
 * Fixed 12 cells: indices 0–5 top row, 6–11 bottom row (6 cols × 2 rows).
 * - [0] top-left: Sub 1 when it is not the melee module (green accent).
 * - [6] bottom-left: Charged Sub Attack / melee module (gold accent).
 * - [1]–[5]: Main 1–5 when present.
 * - Remaining modules fill empty slots in slot order.
 */
export function buildDescendantModuleGrid(
  mods: DescendantBuildParsed["modules"],
  moduleById: Map<string, ModuleRecord>,
): (DescendantGridCell | null)[] {
  const cells: (DescendantGridCell | null)[] = Array(12).fill(null);
  const placed = new Set<string>();

  function placeAt(index: number, m: DescendantBuildParsed["modules"][0], accent: SlotAccent) {
    if (index < 0 || index > 11 || cells[index]) return;
    const rec = moduleById.get(m.moduleId);
    cells[index] = { index, moduleSlot: m, rec, accent };
    placed.add(modKey(m));
  }

  const meleeMod = mods.find((m) => isChargedSubAttackModule(moduleById.get(m.moduleId)));
  if (meleeMod) placeAt(6, meleeMod, "melee-gold");

  const sub1 = mods.find((m) => {
    if (placed.has(modKey(m))) return false;
    return normalizeSlotId(m.slotId) === "Sub 1";
  });
  if (sub1 && !isChargedSubAttackModule(moduleById.get(sub1.moduleId))) {
    placeAt(0, sub1, "sub-green");
  }

  for (let n = 1; n <= 5; n++) {
    const main = mods.find(
      (m) => !placed.has(modKey(m)) && normalizeSlotId(m.slotId) === `Main ${n}`,
    );
    if (main) placeAt(n, main, null);
  }

  const remaining = mods.filter((m) => !placed.has(modKey(m))).sort((a, b) => sortSlotId(a.slotId, b.slotId));
  for (let i = 0; i < 12; i++) {
    if (cells[i] !== null) continue;
    const m = remaining.shift();
    if (!m) break;
    const rec = moduleById.get(m.moduleId);
    let accent: SlotAccent = null;
    if (isChargedSubAttackModule(rec)) accent = "melee-gold";
    else if (normalizeSlotId(m.slotId) === "Sub 1") accent = "sub-green";
    cells[i] = { index: i, moduleSlot: m, rec, accent };
    placed.add(modKey(m));
  }

  return cells;
}
