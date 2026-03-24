"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DescendantCatalogRow,
  ExternalComponentCatalogRow,
  ReactorCatalogRow,
  WeaponCatalogRow,
} from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { capacityCostAtLevel } from "@/lib/tfd-modules";
import {
  elementDefs,
  inferTierFromCoreAugment,
  inferTierFromExternalSubstat,
  inferTierFromReactorSubstat,
  inferTierFromValue,
  tierColors,
} from "@/lib/tracker-data";
import {
  buildDescendantModuleGrid,
  filterDescendantBodyMods,
  findTriggerModule,
} from "./descendant-slot-grid";
import type { ComputedStats } from "@/lib/tfd-stat-engine";
import { computeDescendantStats, computeWeaponStats } from "@/lib/tfd-stat-engine";
import {
  extractBasicInfo,
  extractDescendantBuilds,
  extractExternalList,
  extractModuleRollRows,
  extractReactorsMerged,
  extractWeaponBuilds,
  moduleDisplayDescription,
  type DescendantBuildParsed,
  type WeaponBuildParsed,
} from "./nexonPlayerPayload";
import { ExternalSetBonusesBanner, type ExternalSetBonusSet } from "../ExternalSetBonusesBanner";
import styles from "./PlayerLookupProfile.module.css";

function catalogElementToDefId(element: string): string {
  const id = element.trim().toLowerCase();
  if (id === "non-attribute" || id === "nonattribute") return "nonattribute";
  return id;
}

/** One short line for under-trigger preview (full text stays in hover panel). */
function firstMeaningfulLine(text: string, max = 80): string {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

function DescendantSubtitle({
  level,
  archeLevel,
  element,
}: {
  level: number;
  archeLevel: number | null;
  element: string | undefined;
}) {
  const def = element ? elementDefs.find((d) => d.id === catalogElementToDefId(element)) : undefined;
  const isChill = catalogElementToDefId(element ?? "") === "chill";
  return (
    <p className={styles.dgDescSub}>
      <span className={styles.dgDescLevelLine}>
        Level: {level}
        {archeLevel != null ? `, Arche Level: ${archeLevel}` : ""}
      </span>
      {def ? (
        <span className={styles.dgDescElementWrap}>
          {" · "}
          <span className={`${styles.dgDescElement} ${isChill ? styles.dgDescElementChill : ""}`}>
            {def.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={def.icon} alt="" className={styles.dgDescElementIcon} width={14} height={14} />
            ) : null}
            {def.label}
          </span>
        </span>
      ) : element ? (
        <span className={styles.dgDescElementWrap}>
          {" · "}
          <span className={isChill ? styles.dgDescElementChill : undefined}>{element}</span>
        </span>
      ) : null}
    </p>
  );
}

export type PlayerLookupCatalogs = {
  modules: Map<string, ModuleRecord>;
  descendants: Map<string, DescendantCatalogRow>;
  weapons: Map<string, WeaponCatalogRow>;
  externalComponents: Map<string, ExternalComponentCatalogRow>;
  reactors: Map<string, ReactorCatalogRow>;
};

const EXTERNAL_SLOT_LABELS = ["Auxiliary Power", "Sensor", "Memory", "Processor"];

function parseExternalEquipmentStats(row: Record<string, unknown>) {
  const addRaw = row.external_component_additional_stat ?? row.externalComponentAdditionalStat;
  const coresRaw = row.core ?? row.cores ?? row.core_option;
  return {
    addStats: parseJsonRecordArray(addRaw),
    cores: parseJsonRecordArray(coresRaw),
  };
}

function externalSlotNumber(slotId: unknown): number {
  const n = typeof slotId === "number" ? slotId : parseInt(String(slotId ?? ""), 10);
  return Number.isNaN(n) ? -1 : n;
}

/** Fixed 4 slots (Auxiliary → Processor); unslotted / overflow fills first empty cell. */
function externalsBySlotFour(externals: Record<string, unknown>[]): (Record<string, unknown> | null)[] {
  const bySlot = new Map<number, Record<string, unknown>>();
  const unplaced: Record<string, unknown>[] = [];
  for (const r of externals) {
    const n = externalSlotNumber(r.external_component_slot_id ?? r.externalComponentSlotId);
    if (n >= 1 && n <= 4) {
      if (!bySlot.has(n)) bySlot.set(n, r);
      else unplaced.push(r);
    } else {
      unplaced.push(r);
    }
  }
  const grid = [1, 2, 3, 4].map((s) => bySlot.get(s) ?? null);
  let u = 0;
  for (let i = 0; i < 4 && u < unplaced.length; i++) {
    if (grid[i] === null) {
      grid[i] = unplaced[u]!;
      u += 1;
    }
  }
  return grid;
}

type Props = {
  data: Record<string, unknown>;
  catalogs: PlayerLookupCatalogs;
};

function tierClass(tier: string): string {
  const t = tier.toLowerCase();
  if (t.includes("transcendent")) return styles.tierTranscendent;
  if (t.includes("ultimate")) return styles.tierUltimate;
  if (t.includes("rare")) return styles.tierRare;
  return styles.tierNormal;
}

/** Reactor element pill — matches in-game element colors (catalog uses Fire, Electric, …). */
function reactorElementChipClass(element: string): string {
  const e = element.trim().toLowerCase();
  if (e === "fire") return styles.dgReactorChipFire;
  if (e === "toxic") return styles.dgReactorChipToxic;
  if (e === "electric") return styles.dgReactorChipElectric;
  if (e === "chill") return styles.dgReactorChipChill;
  if (e === "non-attribute" || e === "nonattribute") return styles.dgReactorChipNeutral;
  return styles.dgReactorChipNeutral;
}

function reactorTierChipClass(tier: string): string {
  const t = tier.trim().toLowerCase();
  if (t.includes("ultimate")) return styles.dgReactorChipUltimate;
  if (t.includes("transcendent")) return styles.dgReactorChipTierTranscendent;
  if (t.includes("rare")) return styles.dgReactorChipTierRare;
  return styles.dgReactorChipTier;
}

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

function formatModifierBlock(modifiers: Record<string, number>): { label: string; value: string }[] {
  const rows = Object.entries(modifiers)
    .filter(([, v]) => typeof v === "number" && Math.abs(v) > 0.01)
    .map(([k, v]) => {
      let v2 = v;
      if (Math.abs(v2) > 250) v2 = Math.sign(v2) * Math.min(250, Math.abs(v2));
      return { label: k, raw: v2 };
    })
    .sort((a, b) => Math.abs(b.raw) - Math.abs(a.raw))
    .map(({ label, raw }) => ({ label, value: `${Math.round(raw * 100) / 100}%` }));
  return rows.slice(0, 24);
}

function parseJsonRecordArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) {
    return v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
  }
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      if (Array.isArray(p)) {
        return p.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
      }
    } catch {
      return [];
    }
  }
  return [];
}

function formatGearStatValue(name: string, val: unknown): string {
  if (val == null) return "—";
  const s = String(val).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return s;
  if (n > 0 && n < 1 && /0\.\d+/.test(s)) {
    return `${Math.round(n * 1000) / 10}%`;
  }
  return s;
}

function TieredStatValue({
  statName,
  raw,
  tierSource = "merged",
}: {
  statName: string;
  raw: unknown;
  tierSource?: "merged" | "reactor" | "external" | "core";
}) {
  const display = formatGearStatValue(statName, raw);
  const s = String(raw ?? "");
  const tier =
    tierSource === "reactor"
      ? inferTierFromReactorSubstat(statName, s)
      : tierSource === "external"
        ? inferTierFromExternalSubstat(statName, s)
        : tierSource === "core"
          ? inferTierFromCoreAugment(statName, s)
          : inferTierFromValue(statName, s);
  return (
    <span className={styles.subValue} style={{ color: tierColors[tier] }}>
      {display}
    </span>
  );
}

function aggregateEquippedSets(
  equipped: Record<string, unknown>[],
  byId: Map<string, ExternalComponentCatalogRow>,
): ExternalSetBonusSet[] {
  const counts = new Map<string, number>();
  const sample = new Map<string, ExternalComponentCatalogRow>();
  for (const eq of equipped) {
    const id = String(eq.external_component_id ?? eq.externalComponentId ?? "");
    const cat = byId.get(id);
    const setName = cat?.setOptionDetail?.[0]?.setName;
    if (!setName || !cat) continue;
    counts.set(setName, (counts.get(setName) ?? 0) + 1);
    if (!sample.has(setName)) sample.set(setName, cat);
  }
  const out: ExternalSetBonusSet[] = [];
  for (const [setName, count] of counts) {
    const c = sample.get(setName)!;
    const two = c.setOptionDetail.find((d) => d.setCount === 2);
    const four = c.setOptionDetail.find((d) => d.setCount === 4);
    out.push({
      setName,
      count,
      twoEffect: two?.effect ?? "",
      fourEffect: four?.effect ?? "",
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** descendant.gg–style compact card: icon on top, level diamond + name, primary stat, 2 footer lines (sub gold / core blue). */
function ExternalComponentDgCard({
  row,
  catalog,
  slotIndex,
}: {
  row: Record<string, unknown> | null;
  catalog: ExternalComponentCatalogRow | undefined;
  slotIndex: number;
}) {
  const slotTitle = EXTERNAL_SLOT_LABELS[slotIndex - 1] ?? `Slot ${slotIndex}`;

  if (!row) {
    return (
      <div className={`${styles.dgExtCard} ${styles.dgExtCardEmpty}`}>
        <div className={styles.dgExtGlow} aria-hidden />
        <div className={styles.dgExtIconZone}>
          <div className={styles.dgExtIconFrame}>
            <div className={styles.dgExtIconPhLg} aria-hidden />
          </div>
        </div>
        <div className={styles.dgExtCardBody}>
          <p className={styles.dgExtSlotLabel}>{slotTitle}</p>
          <p className={styles.dgExtEmptyHint}>Empty slot</p>
        </div>
      </div>
    );
  }

  const level = row.external_component_level ?? row.externalComponentLevel ?? row.level;
  const { addStats, cores } = parseExternalEquipmentStats(row);
  const tierFrame = catalog ? tierClass(catalog.tier) : styles.tierNormal;
  const displayName = catalog?.name ?? "External component";
  const hasAnyStats = cores.length > 0 || addStats.length > 0;

  return (
    <div className={`${styles.dgExtCard} ${tierFrame}`}>
      <div className={styles.dgExtGlow} aria-hidden />
      <div className={styles.dgExtIconZone}>
        <div className={styles.dgExtIconFrame}>
          {catalog?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.dgExtIconLg} src={catalog.image} alt="" />
          ) : (
            <div className={styles.dgExtIconPhLg} aria-hidden />
          )}
        </div>
      </div>
      <div className={styles.dgExtCardBody}>
        <div className={styles.dgExtNameRow}>
          {level != null ? (
            <div className={styles.dgExtLvDiamond} title={`Lv. ${String(level)}`}>
              <span>{String(level)}</span>
            </div>
          ) : null}
          <span className={styles.dgExtItemName}>{displayName}</span>
        </div>
        <div className={styles.dgExtTagRow}>
          {catalog?.setOptionDetail?.[0]?.setName ? (
            <span className={`${styles.setChip} ${styles.dgExtSetChipInline}`}>{catalog.setOptionDetail[0].setName}</span>
          ) : null}
          {catalog?.tier ? (
            <span className={`${styles.dgReactorChip} ${reactorTierChipClass(catalog.tier)}`} title="Item rarity">
              {catalog.tier}
            </span>
          ) : null}
        </div>
        {hasAnyStats ? (
          <div className={styles.dgExtStatsWrap}>
            {cores.length > 0 ? (
              <div className={`${styles.dgExtStatSection} ${styles.dgExtStatSectionCore}`}>
                <div className={styles.dgExtStatHeadingRow}>
                  <span className={styles.dgExtStatBlockHeading}>Core</span>
                </div>
                <div className={styles.dgExtStatBlock}>
                  {cores.map((o, i) => {
                    const name = String(o.core_option_name ?? o.option_name ?? o.name ?? `Core ${i + 1}`);
                    const raw = o.core_option_value ?? o.option_value ?? o.value;
                    return (
                      <p key={`core-${name}-${i}`} className={styles.dgExtStatRow}>
                        <span className={styles.dgExtFooterLab}>{name}: </span>
                        <TieredStatValue statName={name} raw={raw} tierSource="core" />
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {addStats.length > 0 ? (
              <div className={`${styles.dgExtStatSection} ${styles.dgExtStatSectionSub}`}>
                <div className={styles.dgExtStatHeadingRow}>
                  <span className={styles.dgExtStatBlockHeading}>Substats</span>
                </div>
                <div className={styles.dgExtStatBlock}>
                  {addStats.map((o, i) => {
                    const name = String(
                      o.additional_stat_name ?? o.stat_name ?? o.name ?? `Stat ${i + 1}`,
                    );
                    const raw = o.additional_stat_value ?? o.stat_value ?? o.value;
                    return (
                      <p key={`sub-${name}-${i}`} className={styles.dgExtStatRow}>
                        <span className={styles.dgExtFooterLab}>{name}: </span>
                        <TieredStatValue statName={name} raw={raw} tierSource="external" />
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className={styles.dgExtPrimaryLineMuted}>No roll details</p>
        )}
      </div>
    </div>
  );
}

const REACTOR_ENH_MAX = 5;

function parseReactorEnchantLevel(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (Number.isNaN(n)) return null;
  return Math.min(REACTOR_ENH_MAX, Math.max(0, Math.round(n)));
}

/** Vertical stack of 5 segments; bottom fills first. At max (5) filled segments use burnt orange. */
function ReactorEnhancementBar({ level }: { level: number }) {
  const n = Math.min(REACTOR_ENH_MAX, Math.max(0, level));
  const maxed = n >= REACTOR_ENH_MAX;
  return (
    <div
      className={styles.dgReactorEnhBar}
      role="img"
      aria-label={`Reactor enhancement ${n} of ${REACTOR_ENH_MAX}`}
    >
      {Array.from({ length: REACTOR_ENH_MAX }, (_, i) => {
        const filled = n > i;
        const segClass = filled
          ? maxed
            ? styles.dgReactorEnhSegMax
            : styles.dgReactorEnhSegFill
          : styles.dgReactorEnhSegEmpty;
        return <div key={i} className={`${styles.dgReactorEnhSeg} ${segClass}`} />;
      })}
    </div>
  );
}

function ReactorProfileCard({
  row,
  index,
  catalog,
}: {
  row: Record<string, unknown>;
  index: number;
  catalog: ReactorCatalogRow | undefined;
}) {
  const rid = String(row.reactor_id ?? row.reactorId ?? "").trim();
  const nameFromApi = String(row.reactor_name ?? row.reactorName ?? row.reactor_display_name ?? "").trim();
  const displayName =
    catalog?.name || nameFromApi || (rid ? `Reactor (${rid})` : `Reactor ${index + 1}`);
  const level = row.reactor_level ?? row.reactorLevel ?? row.level;
  const enchantRaw = row.reactor_enchant_level ?? row.reactorEnchantLevel;
  const enchantLevel = parseReactorEnchantLevel(enchantRaw);

  const candidates = [
    row.reactor_substat,
    row.reactor_substats,
    row.reactor_additional_stat,
    row.reactorAdditionalStat,
    row.substat,
    row.substats,
    row.reactor_option,
    row.reactor_stat,
  ];

  let substats: Record<string, unknown>[] = [];
  for (const c of candidates) {
    const parsed = parseJsonRecordArray(c);
    if (parsed.length > 0) {
      substats = parsed;
      break;
    }
  }

  const tierFrame = catalog ? tierClass(catalog.tier) : styles.tierNormal;

  return (
    <div className={`${styles.dgReactorCard} ${tierFrame}`}>
      <div className={styles.dgReactorGlow} aria-hidden />
      <div className={styles.dgReactorMain}>
        <div className={styles.dgReactorIconWrap}>
          {catalog?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.dgReactorIcon} src={catalog.image} alt="" />
          ) : (
            <div className={styles.dgReactorIconPh} aria-hidden />
          )}
          {level != null ? (
            <div className={styles.dgReactorLvBadge} title="Reactor level">
              {String(level)}
            </div>
          ) : null}
        </div>

        <div className={styles.dgReactorIdentity}>
          <div className={styles.dgReactorTitleRow}>
            <span className={styles.dgReactorName}>{displayName}</span>
            {enchantLevel !== null ? <ReactorEnhancementBar level={enchantLevel} /> : null}
          </div>
          <div className={styles.dgReactorMeta}>
            {catalog?.element ? (
              <span className={`${styles.dgReactorChip} ${reactorElementChipClass(catalog.element)}`}>
                {catalog.element}
              </span>
            ) : null}
            {catalog?.attribute ? (
              <span className={`${styles.dgReactorChip} ${styles.dgReactorChipAttr}`}>{catalog.attribute}</span>
            ) : null}
            {catalog?.tier ? (
              <span className={`${styles.dgReactorChip} ${reactorTierChipClass(catalog.tier)}`}>
                {catalog.tier}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.dgReactorRolls}>
          {substats.length > 0 ? (
            substats.map((o, i) => {
              const sn = String(
                o.substat_name ??
                  o.stat_name ??
                  o.additional_stat_name ??
                  o.name ??
                  `Stat ${i + 1}`,
              );
              const sv = o.substat_value ?? o.stat_value ?? o.additional_stat_value ?? o.value;
              return (
                <div key={`${sn}-${i}`} className={styles.dgReactorRollLine}>
                  <span className={styles.dgReactorRollLabel}>{sn}: </span>
                  <TieredStatValue statName={sn} raw={sv} tierSource="reactor" />
                </div>
              );
            })
          ) : (
            <div className={styles.dgReactorRollsFallback}>
              <ReactorFallbackKv row={row} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReactorFallbackKv({ row }: { row: Record<string, unknown> }) {
  const skip = new Set([
    "reactor_id",
    "reactorId",
    "ouid",
    "id",
    "reactor_name",
    "reactorName",
    "reactor_display_name",
  ]);
  const rows: ({ k: string; raw: unknown; tiered: true } | { k: string; text: string; tiered: false })[] =
    [];
  for (const [k, v] of Object.entries(row)) {
    if (skip.has(k)) continue;
    if (/_id$/i.test(k)) continue;
    if (v == null) continue;
    if (typeof v === "string" && (v.startsWith("[") || v.startsWith("{"))) {
      const parsed = parseJsonRecordArray(v);
      if (parsed.length > 0) {
        for (const p of parsed) {
          const label = String(
            p.substat_name ?? p.stat_name ?? p.additional_stat_name ?? p.name ?? "Stat",
          );
          const val = p.substat_value ?? p.stat_value ?? p.additional_stat_value ?? p.value;
          rows.push({ k: label, raw: val, tiered: true });
        }
        continue;
      }
    }
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      rows.push({ k, text: JSON.stringify(v), tiered: false });
    } else {
      rows.push({ k, raw: v, tiered: true });
    }
  }
  if (rows.length === 0) return <p className="muted">No reactor details.</p>;
  return (
    <dl className={styles.kv}>
      {rows.slice(0, 20).map((rowItem, i) => (
        <div key={`${rowItem.k}-${i}`}>
          <dt>{rowItem.k}</dt>
          <dd>
            {rowItem.tiered ? (
              <TieredStatValue statName={rowItem.k} raw={rowItem.raw} tierSource="reactor" />
            ) : (
              rowItem.text
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** descendant.gg–style: Trigger column + numbered 1–12 rows (6×2 order). */
function DescendantDgModules({
  mods,
  moduleById,
  sectionTitle,
}: {
  mods: DescendantBuildParsed["modules"];
  moduleById: Map<string, ModuleRecord>;
  sectionTitle: string;
}) {
  if (mods.length === 0) return <p className="muted">No modules reported.</p>;

  const triggerSlot = findTriggerModule(mods, moduleById);
  const bodyMods = filterDescendantBodyMods(mods, moduleById);
  const cells = buildDescendantModuleGrid(bodyMods, moduleById);

  const rowAccent = (a: string | null) =>
    a === "skill-teal"
      ? styles.dgModRowSkill
      : a === "sub-melee-gold"
        ? styles.dgModRowMelee
        : "";

  let triggerBlock: ReactNode;
  if (triggerSlot) {
    const m = triggerSlot;
    const rec = moduleById.get(m.moduleId);
    const cost = rec ? capacityCostAtLevel(rec, m.enchantLevel) : 0;
    const name = rec?.name ?? `Module ${m.moduleId}`;
    const img = rec?.image ?? "";
    const rolls = extractModuleRollRows(m.raw);
    const blurb = moduleDisplayDescription(rec?.preview, m.raw);
    const hasDetail = rolls.length > 0 || Boolean(blurb);
    const hoverTitle = blurb ? firstMeaningfulLine(blurb, 140) : undefined;
    triggerBlock = (
      <div className={styles.dgTriggerWrap}>
        <div
          className={styles.dgTriggerHoverHost}
          tabIndex={0}
          title={hoverTitle}
          aria-describedby={hasDetail ? `trigger-module-${m.moduleId}` : undefined}
        >
          <div className={`${styles.moduleCard} ${styles.dgTriggerCard} ${rec ? tierClass(rec.tier) : ""}`}>
            <span className={styles.cost}>{cost}</span>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.dgTriggerImg} src={img} alt="" />
            ) : (
              <div className={styles.dgTriggerImg} />
            )}
            <p className={styles.dgTriggerName}>{name}</p>
            <span className={styles.dgTriggerTag}>Trigger</span>
          </div>
          {rolls.length > 0 ? (
            <ul className={styles.dgTriggerRollsInline} aria-label="Trigger module rolls">
              {rolls.slice(0, 4).map((r, i) => (
                <li key={`${r.label}-${i}`} className={styles.dgTriggerRollLine}>
                  <span className={styles.dgTriggerRollLab}>{r.label}</span>
                  <span className={styles.dgTriggerRollVal}>{r.value}</span>
                </li>
              ))}
            </ul>
          ) : blurb ? (
            <p className={styles.dgTriggerInlinePreview}>{firstMeaningfulLine(blurb)}</p>
          ) : null}
          {hasDetail ? (
            <div
              className={styles.dgTriggerHoverPanel}
              id={`trigger-module-${m.moduleId}`}
              role="tooltip"
            >
              {blurb ? <p className={styles.dgTriggerPanelDesc}>{blurb}</p> : null}
              {rolls.length > 0 ? (
                <dl className={styles.dgTriggerRollDl}>
                  {rolls.map((r, i) => (
                    <div key={`tip-${r.label}-${i}`} className={styles.dgTriggerRollDlRow}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <p className={styles.dgTriggerPanelMeta}>Enchant +{m.enchantLevel}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  } else {
    triggerBlock = (
      <div className={styles.dgTriggerWrap}>
        <div className={styles.dgTriggerEmpty}>
          <span className="muted">No trigger</span>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.dgModulesBlock} aria-label="Descendant modules">
      <h3 className={styles.dgSectionTitle}>{sectionTitle}</h3>
      <div className={styles.dgModulesSection}>
        {triggerBlock}
        <div className={styles.dgModList}>
          {cells.map((cell, i) => {
            const n = i + 1;
            if (!cell) {
              return (
                <div key={`empty-${i}`} className={styles.dgModRow}>
                  <span className={styles.dgModIdx}>{n}</span>
                  <div className={styles.dgModIconPh} aria-hidden />
                  <span className={styles.dgModCap}>—</span>
                  <span className={styles.dgModNameMuted}>Empty module</span>
                  <span className={styles.dgModSock}>—</span>
                </div>
              );
            }
            const m = cell.moduleSlot;
            const rec = cell.rec;
            const cost = rec ? capacityCostAtLevel(rec, m.enchantLevel) : 0;
            const name = rec?.name ?? `Module ${m.moduleId}`;
            const img = rec?.image ?? "";
            const typeLine = rec?.type?.trim() ? rec.type : "Descendant";
            return (
              <div
                key={`${m.slotId}-${m.moduleId}-${i}`}
                className={`${styles.dgModRow} ${rowAccent(cell.accent)}`}
              >
                <span className={styles.dgModIdx}>{n}</span>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.dgModIcon} src={img} alt="" />
                ) : (
                  <div className={`${styles.dgModIcon} ${styles.dgModIconPh}`} />
                )}
                <span className={styles.dgModCap}>{cost}</span>
                <div className={styles.dgModNameCol}>
                  <span className={styles.dgModName}>{name}</span>
                  <span className={styles.dgModType}>{typeLine}</span>
                </div>
                <span className={styles.dgModSock}>{rec?.socket ?? "—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CapacityBar({
  used,
  max,
  layout = "default",
  showCapacityLabel = true,
}: {
  used: number;
  max: number;
  layout?: "default" | "dg";
  /** When layout is dg, hide the inline "Capacity" label (e.g. weapon row already has a label). */
  showCapacityLabel?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const rowClass = layout === "dg" ? styles.dgCapacityRow : styles.capacityRow;
  return (
    <div className={rowClass}>
      {layout === "dg" && showCapacityLabel ? <span className={styles.dgCapacityLabel}>Capacity</span> : null}
      <div className={styles.capacityBar} title={`${used} / ${max}`}>
        <div className={styles.capacityFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={layout === "dg" ? styles.dgCapacityBadge : styles.badge}>
        {used} / {max}
      </span>
    </div>
  );
}

function ModuleGrid({
  mods,
  moduleById,
  emptyHint,
  compact,
}: {
  mods: DescendantBuildParsed["modules"];
  moduleById: Map<string, ModuleRecord>;
  emptyHint: string;
  compact?: boolean;
}) {
  const sorted = [...mods].sort((a, b) => sortSlotId(a.slotId, b.slotId));
  if (sorted.length === 0) {
    return <p className="muted">{emptyHint}</p>;
  }
  return (
    <div className={`${styles.grid} ${compact ? styles.gridCompact : ""}`}>
      {sorted.map((m, idx) => {
        const rec = moduleById.get(m.moduleId);
        const cost = rec ? capacityCostAtLevel(rec, m.enchantLevel) : 0;
        const name = rec?.name ?? `Module ${m.moduleId}`;
        const img = rec?.image ?? "";
        return (
          <div
            key={`${m.slotId}-${m.moduleId}-${idx}`}
            className={`${styles.moduleCard} ${rec ? tierClass(rec.tier) : ""}`}
          >
            <span className={styles.cost}>{cost}</span>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.modImg} src={img} alt="" />
            ) : (
              <div className={styles.modImg} />
            )}
            <p className={styles.modName}>{name}</p>
            <div className={styles.modMeta}>
              {rec?.type ?? "—"}
              <br />
              {rec?.socket ?? "—"} · +{m.enchantLevel}
            </div>
            {m.slotId ? <div className={styles.modMeta}>Slot {m.slotId}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

type TabDef = { id: string; label: string };

export function PlayerLookupProfile({ data, catalogs }: Props) {
  const {
    modules: moduleById,
    descendants: descById,
    weapons: weaponById,
    externalComponents: extById,
    reactors: reactorById,
  } = catalogs;

  const basicRaw = data.basic;
  const basic = useMemo(() => extractBasicInfo(basicRaw), [basicRaw]);

  const descendantBuilds = useMemo(() => extractDescendantBuilds(data.descendant), [data.descendant]);
  const weaponBuilds = useMemo(() => extractWeaponBuilds(data.weapon), [data.weapon]);
  const reactors = useMemo(
    () => extractReactorsMerged(data as Record<string, unknown>),
    [data],
  );
  const externals = useMemo(() => extractExternalList(data.externalComponent), [data.externalComponent]);

  const displayName =
    basic.userName ||
    (typeof data.query === "object" && data.query !== null
      ? String((data.query as Record<string, unknown>).user_name ?? "")
      : "") ||
    descendantBuilds[0]?.userName ||
    "Player";

  const primaryDesc = descendantBuilds[0];
  const primaryRow = primaryDesc ? descById.get(primaryDesc.descendantId) : undefined;

  const setProgress = useMemo(() => aggregateEquippedSets(externals, extById), [externals, extById]);

  const tabs = useMemo((): TabDef[] => {
    const t: TabDef[] = [];
    descendantBuilds.forEach((b, bi) => {
      const row = descById.get(b.descendantId);
      t.push({ id: `desc-${bi}`, label: row?.name ?? `Descendant ${bi + 1}` });
    });
    weaponBuilds.forEach((w, wi) => {
      const wrow = weaponById.get(w.weaponId);
      t.push({ id: `weapon-${wi}`, label: wrow?.name ?? `Weapon ${wi + 1}` });
    });
    const mergedGearIntoDesc = descendantBuilds.length > 0;
    if (!mergedGearIntoDesc && externals.length > 0) t.push({ id: "components", label: "Components" });
    if (!mergedGearIntoDesc && reactors.length > 0) t.push({ id: "reactor", label: "Reactor" });
    if (t.length === 0) t.push({ id: "empty", label: "Overview" });
    return t;
  }, [descendantBuilds, descById, weaponBuilds, weaponById, externals.length, reactors.length]);

  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    if (tabs.length === 0) return;
    if (!activeTab || !tabs.some((x) => x.id === activeTab)) {
      setActiveTab(tabs[0]!.id);
    }
  }, [tabs, activeTab]);

  const [descStats, setDescStats] = useState<ComputedStats[]>([]);
  const [weaponStats, setWeaponStats] = useState<ComputedStats[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dOut: ComputedStats[] = [];
      for (const b of descendantBuilds) {
        const slots = b.modules.map((m) => ({ moduleId: m.moduleId, level: m.enchantLevel }));
        const cs = await computeDescendantStats(b.descendantId, b.level, slots, moduleById, null);
        if (!cancelled) dOut.push(cs);
      }
      if (!cancelled) setDescStats(dOut);
    })();
    return () => {
      cancelled = true;
    };
  }, [descendantBuilds, moduleById]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wOut: ComputedStats[] = [];
      for (const w of weaponBuilds) {
        const slots = w.modules.map((m) => ({ moduleId: m.moduleId, level: m.enchantLevel }));
        const cs = await computeWeaponStats(w.weaponId, w.level, slots, moduleById);
        if (!cancelled) wOut.push(cs);
      }
      if (!cancelled) setWeaponStats(wOut);
    })();
    return () => {
      cancelled = true;
    };
  }, [weaponBuilds, moduleById]);

  const renderDescendantPanel = (bi: number) => {
    const build = descendantBuilds[bi];
    if (!build) return <p className="muted">No descendant data.</p>;
    const row = descById.get(build.descendantId);
    const mods = formatModifierBlock(descStats[bi]?.modifiers ?? {});
    const modTitle = `${row?.name ?? "Descendant"} Modules`;
    return (
      <div className={styles.dgSheet}>
        <div className={styles.dgDescHeader}>
          {row?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.dgDescPortrait} src={row.image} alt="" />
          ) : (
            <div className={styles.dgDescPortraitPh} aria-hidden />
          )}
          <div>
            <h2 className={styles.dgDescTitle}>{row?.name ?? "Descendant"}</h2>
            <DescendantSubtitle level={build.level} archeLevel={build.archeLevel} element={row?.element} />
          </div>
        </div>

        <div className={styles.dgEnergyRow}>
          <span className={styles.dgEnergyLabel}>Energy Activator</span>
          <span className={styles.dgEnergyValue}>{build.energyActivatorCount}</span>
          <CapacityBar used={build.moduleUsedCapacity} max={Math.max(build.moduleMaxCapacity, 1)} layout="dg" />
        </div>

        <DescendantDgModules mods={build.modules} moduleById={moduleById} sectionTitle={modTitle} />

        {mods.length > 0 ? (
          <section className={styles.dgAppliedSection}>
            <h3 className={styles.dgSectionTitle}>Applied Module Stats</h3>
            <ul className={styles.dgStatList}>
              {mods.map((r) => (
                <li key={r.label} className={styles.dgStatRow}>
                  <span>{r.label}</span>
                  <span>{r.value}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {reactors.length > 0 || externals.length > 0 ? (
          <section className={styles.dgGearSection}>
            <h3 className={styles.dgSectionTitle}>Reactor & Components</h3>
            {reactors.map((r, i) => {
              const rid = String(r.reactor_id ?? r.reactorId ?? "").trim();
              return (
                <ReactorProfileCard
                  key={`dg-reactor-${i}`}
                  row={r}
                  index={i}
                  catalog={reactorById.get(rid)}
                />
              );
            })}
            {externals.length > 0 ? (
              <>
                <div className={styles.dgExtQuadGrid}>
                  {externalsBySlotFour(externals).map((slotRow, i) => {
                    const ix = i + 1;
                    const id = slotRow
                      ? String(slotRow.external_component_id ?? slotRow.externalComponentId ?? "")
                      : "";
                    const cat = id ? extById.get(id) : undefined;
                    return (
                      <ExternalComponentDgCard
                        key={`dg-ext-slot-${ix}`}
                        row={slotRow}
                        catalog={cat}
                        slotIndex={ix}
                      />
                    );
                  })}
                </div>
                <div className={styles.dgExtSetBonusesBelow}>
                  <ExternalSetBonusesBanner sets={setProgress} />
                </div>
              </>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  };

  const renderWeaponPanel = (wi: number) => {
    const w = weaponBuilds[wi];
    if (!w) return <p className="muted">No weapon data.</p>;
    const wrow = weaponById.get(w.weaponId);
    const mods = formatModifierBlock(weaponStats[wi]?.modifiers ?? {});
    const wTitle = `${wrow?.name ?? "Weapon"} Modules`;
    return (
      <div className={styles.dgSheet}>
        <h3 className={styles.dgSectionTitle}>Weapons & Modules</h3>
        <div className={styles.dgDescHeader}>
          {wrow?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.dgDescPortrait} src={wrow.image} alt="" />
          ) : (
            <div className={styles.dgDescPortraitPh} aria-hidden />
          )}
          <div>
            <h2 className={styles.dgDescTitle}>{wrow?.name ?? `Weapon ${w.weaponId}`}</h2>
            <p className={styles.dgDescSub}>
              {wrow?.type ?? "—"} · Lv. {w.level}
              {wrow?.roundsType ? ` · ${wrow.roundsType}` : ""}
            </p>
          </div>
        </div>
        <div className={styles.dgEnergyRow}>
          <span className={styles.dgEnergyLabel}>Capacity</span>
          <span className={styles.dgEnergySpacer} />
          <CapacityBar
            used={w.moduleUsedCapacity}
            max={Math.max(w.moduleMaxCapacity, 1)}
            layout="dg"
            showCapacityLabel={false}
          />
        </div>
        <h4 className={styles.dgSubSectionTitle}>{wTitle}</h4>
        <div className={styles.dgWeaponModWrap}>
          <ModuleGrid mods={w.modules} moduleById={moduleById} emptyHint="No weapon modules." compact />
        </div>
        {mods.length > 0 ? (
          <section className={styles.dgAppliedSection}>
            <h3 className={styles.dgSectionTitle}>Applied Module Stats</h3>
            <ul className={styles.dgStatList}>
              {mods.map((r) => (
                <li key={r.label} className={styles.dgStatRow}>
                  <span>{r.label}</span>
                  <span>{r.value}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  };

  const renderComponentsPanel = () => (
    <div className={styles.inventoryPane}>
      <div className={styles.dgExtQuadGrid}>
        {externalsBySlotFour(externals).map((slotRow, i) => {
          const ix = i + 1;
          const id = slotRow
            ? String(slotRow.external_component_id ?? slotRow.externalComponentId ?? "")
            : "";
          const cat = id ? extById.get(id) : undefined;
          return (
            <ExternalComponentDgCard key={`ext-slot-${ix}`} row={slotRow} catalog={cat} slotIndex={ix} />
          );
        })}
      </div>
      <div className={styles.dgExtSetBonusesBelow}>
        <ExternalSetBonusesBanner sets={setProgress} />
      </div>
    </div>
  );

  const renderReactorPanel = () => (
    <div className={styles.inventoryPane}>
      {reactors.map((r, i) => {
        const rid = String(r.reactor_id ?? r.reactorId ?? "").trim();
        return (
          <ReactorProfileCard key={`reactor-${i}`} row={r} index={i} catalog={reactorById.get(rid)} />
        );
      })}
    </div>
  );

  const renderActivePanel = () => {
    if (!activeTab) return null;
    if (activeTab === "empty") {
      return <p className="muted">No loadout blocks in this response.</p>;
    }
    if (activeTab === "components") return renderComponentsPanel();
    if (activeTab === "reactor") return renderReactorPanel();
    if (activeTab.startsWith("desc-")) {
      const bi = parseInt(activeTab.replace("desc-", ""), 10);
      return renderDescendantPanel(Number.isNaN(bi) ? 0 : bi);
    }
    if (activeTab.startsWith("weapon-")) {
      const wi = parseInt(activeTab.replace("weapon-", ""), 10);
      return renderWeaponPanel(Number.isNaN(wi) ? 0 : wi);
    }
    return null;
  };

  return (
    <div className={styles.profile}>
      <header className={styles.dgPageHero}>
        {primaryRow?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.dgPagePortrait} src={primaryRow.image} alt={primaryRow.name} />
        ) : (
          <div className={styles.dgPagePortraitPh} aria-hidden />
        )}
        <div className={styles.dgPageHeroText}>
          <h1 className={styles.dgPageCharName}>{primaryRow?.name ?? "Loadout"}</h1>
          <p className={styles.dgPageUser}>{displayName}</p>
          <div className={styles.dgPageMeta}>
            <span>Lv. {primaryDesc?.level ?? "—"}</span>
            {basic.masteryRank != null ? <span>Mastery Rank: {basic.masteryRank}</span> : null}
            {primaryRow?.element ? <span>{primaryRow.element}</span> : null}
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.tabBar} role="tablist" aria-label="Loadout sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.tabBody} role="tabpanel">
          {renderActivePanel()}
        </div>
      </div>
    </div>
  );
}
