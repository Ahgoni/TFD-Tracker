"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DescendantCatalogRow,
  ExternalComponentCatalogRow,
  WeaponCatalogRow,
} from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { capacityCostAtLevel } from "@/lib/tfd-modules";
import { inferTierFromValue, tierColors } from "@/lib/tracker-data";
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
  extractReactorList,
  extractWeaponBuilds,
  type DescendantBuildParsed,
  type WeaponBuildParsed,
} from "./nexonPlayerPayload";
import { ExternalSetBonusesBanner, type ExternalSetBonusSet } from "../ExternalSetBonusesBanner";
import styles from "./PlayerLookupProfile.module.css";

export type PlayerLookupCatalogs = {
  modules: Map<string, ModuleRecord>;
  descendants: Map<string, DescendantCatalogRow>;
  weapons: Map<string, WeaponCatalogRow>;
  externalComponents: Map<string, ExternalComponentCatalogRow>;
};

const EXTERNAL_SLOT_LABELS = ["Auxiliary Power", "Sensor", "Memory", "Processor"];

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

function TieredStatValue({ statName, raw }: { statName: string; raw: unknown }) {
  const display = formatGearStatValue(statName, raw);
  const tier = inferTierFromValue(statName, String(raw ?? ""));
  return (
    <span className={styles.subValue} style={{ color: tierColors[tier] }}>
      {display}
    </span>
  );
}

function externalSlotLabel(slotId: unknown): string {
  const n = typeof slotId === "number" ? slotId : parseInt(String(slotId ?? ""), 10);
  if (Number.isNaN(n) || n < 1) return "Component";
  const ix = Math.min(Math.max(0, n - 1), EXTERNAL_SLOT_LABELS.length - 1);
  return EXTERNAL_SLOT_LABELS[ix] ?? `Slot ${n}`;
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

function ExternalComponentCard({
  row,
  catalog,
}: {
  row: Record<string, unknown>;
  catalog: ExternalComponentCatalogRow | undefined;
}) {
  const slotId = row.external_component_slot_id ?? row.externalComponentSlotId;
  const level = row.external_component_level ?? row.externalComponentLevel ?? row.level;
  const addRaw = row.external_component_additional_stat ?? row.externalComponentAdditionalStat;
  const coresRaw = row.core ?? row.cores ?? row.core_option;

  const addStats = parseJsonRecordArray(addRaw);
  const cores = parseJsonRecordArray(coresRaw);

  const slotTitle = externalSlotLabel(slotId);
  const setChip = catalog?.setOptionDetail?.[0]?.setName;

  return (
    <div className={`${styles.flexCard} ${catalog ? tierClass(catalog.tier) : ""}`}>
      <div className={styles.extCardRow}>
        {catalog?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.extIcon} src={catalog.image} alt="" />
        ) : (
          <div className={styles.extIconPh}>?</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className={styles.cardTitle} style={{ marginTop: 0 }}>
            {catalog?.name ?? "External component"}
            {setChip ? <span className={styles.setChip}>{setChip}</span> : null}
          </h4>
          <p className="muted" style={{ fontSize: "0.78rem", margin: "0.15rem 0 0" }}>
            {slotTitle}
            {catalog?.equipmentType ? ` · ${catalog.equipmentType}` : null}
            {catalog?.tier ? ` · ${catalog.tier}` : null}
            {level != null ? ` · Lv. ${String(level)}` : null}
          </p>
        </div>
      </div>

      {addStats.length > 0 ? (
        <>
          <div className={styles.subHeading}>Substats</div>
          <ul className={styles.subList}>
            {addStats.map((o, i) => {
              const name = String(
                o.additional_stat_name ?? o.stat_name ?? o.name ?? `Stat ${i + 1}`,
              );
              const val = o.additional_stat_value ?? o.stat_value ?? o.value;
              return (
                <li key={`${name}-${i}`}>
                  <span>{name}</span>
                  <TieredStatValue statName={name} raw={val} />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {cores.length > 0 ? (
        <>
          <div className={styles.subHeading}>Core</div>
          <ul className={styles.subList}>
            {cores.map((o, i) => {
              const name = String(o.core_option_name ?? o.option_name ?? o.name ?? `Core ${i + 1}`);
              const val = o.core_option_value ?? o.option_value ?? o.value;
              return (
                <li key={`${name}-${i}`}>
                  <span>{name}</span>
                  <TieredStatValue statName={name} raw={val} />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {addStats.length === 0 && cores.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.82rem", margin: "0.35rem 0 0" }}>
          No roll details parsed.
        </p>
      ) : null}
    </div>
  );
}

function ReactorProfileCard({ row, index }: { row: Record<string, unknown>; index: number }) {
  const name = String(
    row.reactor_name ?? row.reactorName ?? row.reactor_display_name ?? `Reactor ${index + 1}`,
  );
  const level = row.reactor_level ?? row.reactorLevel ?? row.level;

  const candidates = [
    row.reactor_substat,
    row.reactor_substats,
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

  return (
    <div className={styles.flexCard}>
      <h4 className={styles.cardTitle} style={{ marginTop: 0 }}>
        {name}
        {level != null ? (
          <span className="muted" style={{ fontWeight: 400, fontSize: "0.85rem" }}>
            {" "}
            · Lv. {String(level)}
          </span>
        ) : null}
      </h4>

      {substats.length > 0 ? (
        <ul className={styles.subList}>
          {substats.map((o, i) => {
            const sn = String(o.substat_name ?? o.stat_name ?? o.name ?? `Stat ${i + 1}`);
            const sv = o.substat_value ?? o.stat_value ?? o.value;
            return (
              <li key={`${sn}-${i}`}>
                <span>{sn}</span>
                <TieredStatValue statName={sn} raw={sv} />
              </li>
            );
          })}
        </ul>
      ) : (
        <ReactorFallbackKv row={row} />
      )}
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
          const label = String(p.substat_name ?? p.stat_name ?? p.name ?? "Stat");
          const val = p.substat_value ?? p.stat_value ?? p.value;
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
              <TieredStatValue statName={rowItem.k} raw={rowItem.raw} />
            ) : (
              rowItem.text
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DescendantModuleInventory({
  mods,
  moduleById,
}: {
  mods: DescendantBuildParsed["modules"];
  moduleById: Map<string, ModuleRecord>;
}) {
  if (mods.length === 0) return <p className="muted">No modules reported.</p>;

  const triggerSlot = findTriggerModule(mods, moduleById);
  const bodyMods = filterDescendantBodyMods(mods, moduleById);
  const cells = buildDescendantModuleGrid(bodyMods, moduleById);

  const accentCellClass = (a: string | null) =>
    a === "skill-teal"
      ? styles.slotAccentSkill
      : a === "sub-melee-gold"
        ? styles.slotAccentSubMelee
        : "";

  let triggerBlock: ReactNode;
  if (triggerSlot) {
    const m = triggerSlot;
    const rec = moduleById.get(m.moduleId);
    const cost = rec ? capacityCostAtLevel(rec, m.enchantLevel) : 0;
    const name = rec?.name ?? `Module ${m.moduleId}`;
    const img = rec?.image ?? "";
    triggerBlock = (
      <div
        className={`${styles.moduleCard} ${styles.triggerModuleCard} ${rec ? tierClass(rec.tier) : ""}`}
        title="Trigger module"
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
          Trigger
          <br />
          {rec?.socket ?? "—"} · +{m.enchantLevel}
        </div>
      </div>
    );
  } else {
    triggerBlock = (
      <div className={styles.triggerEmpty} aria-hidden>
        <span className={styles.triggerEmptyHint}>No trigger</span>
      </div>
    );
  }

  return (
    <div className={styles.descendantModuleBoard}>
      <div className={styles.triggerColumn}>
        <span className={styles.boardColumnLabel}>Trigger</span>
        {triggerBlock}
      </div>

      <div className={styles.bodyGridWrap}>
        <div className={styles.descGrid}>
          {cells.map((cell, i) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${i}`}
                  className={`${styles.emptyModCell} ${styles.descGridCell}`}
                  aria-hidden
                />
              );
            }
            const m = cell.moduleSlot;
            const rec = cell.rec;
            const cost = rec ? capacityCostAtLevel(rec, m.enchantLevel) : 0;
            const name = rec?.name ?? `Module ${m.moduleId}`;
            const img = rec?.image ?? "";
            const cap =
              cell.accent === "sub-melee-gold"
                ? "Sub Module"
                : cell.accent === "skill-teal"
                  ? "Skill Modules"
                  : null;
            return (
              <div
                key={`${m.slotId}-${m.moduleId}-${i}`}
                className={`${styles.descGridCell} ${accentCellClass(cell.accent)}`}
              >
                <div
                  className={`${styles.moduleCard} ${styles.descBoardCard} ${rec ? tierClass(rec.tier) : ""}`}
                  title={
                    cell.accent === "sub-melee-gold"
                      ? "Sub Module — Charged Sub Attack (melee)"
                      : cell.accent === "skill-teal"
                        ? "Skill Modules — Sub 1 (skill / red slot)"
                        : undefined
                  }
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
                    {rec?.type?.trim() ? rec.type : "Descendant"}
                    <br />
                    {rec?.socket ?? "—"} · +{m.enchantLevel}
                  </div>
                  {cap ? <div className={styles.slotCaption}>{cap}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className={styles.capacityRow}>
      <div className={styles.capacityBar} title={`${used} / ${max}`}>
        <div className={styles.capacityFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.badge}>
        {used} / {max} capacity
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
  const { modules: moduleById, descendants: descById, weapons: weaponById, externalComponents: extById } =
    catalogs;

  const basicRaw = data.basic;
  const basic = useMemo(() => extractBasicInfo(basicRaw), [basicRaw]);

  const descendantBuilds = useMemo(() => extractDescendantBuilds(data.descendant), [data.descendant]);
  const weaponBuilds = useMemo(() => extractWeaponBuilds(data.weapon), [data.weapon]);
  const reactors = useMemo(() => extractReactorList(data.reactor), [data.reactor]);
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
    if (externals.length > 0) t.push({ id: "components", label: "Components" });
    if (reactors.length > 0) t.push({ id: "reactor", label: "Reactor" });
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
    const mods = formatModifierBlock(descStats[bi]?.modifiers ?? {});
    return (
      <div className={styles.inventoryPane}>
        {reactors.length > 0 ? (
          <button
            type="button"
            className={styles.reactorStrip}
            onClick={() => setActiveTab("reactor")}
          >
            <span>
              <strong>Reactor</strong>:{" "}
              {String(
                reactors[0].reactor_name ??
                  reactors[0].reactorName ??
                  reactors[0].reactor_display_name ??
                  "Equipped reactor",
              )}
            </span>
            <span className="muted">View →</span>
          </button>
        ) : null}
        <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
          Energy activator uses: {build.energyActivatorCount}
        </p>
        <CapacityBar used={build.moduleUsedCapacity} max={Math.max(build.moduleMaxCapacity, 1)} />
        <p className="muted" style={{ fontSize: "0.72rem", margin: "0 0 0.35rem" }}>
          Matches in-game layout: Trigger (left), then 6×2 — top-left teal = Skill Modules, bottom-left gold =
          Sub Module (melee).
        </p>
        <DescendantModuleInventory mods={build.modules} moduleById={moduleById} />
        {mods.length > 0 ? (
          <details className={styles.statsPanel}>
            <summary>Applied module stats (estimated)</summary>
            <ul className={styles.statList}>
              {mods.map((r) => (
                <li key={r.label} className={styles.statRow}>
                  <span>{r.label}</span>
                  <span>{r.value}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    );
  };

  const renderWeaponPanel = (wi: number) => {
    const w = weaponBuilds[wi];
    if (!w) return <p className="muted">No weapon data.</p>;
    const wrow = weaponById.get(w.weaponId);
    const mods = formatModifierBlock(weaponStats[wi]?.modifiers ?? {});
    return (
      <div className={styles.inventoryPane}>
        <div className={styles.weaponHeader}>
          {wrow?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.weaponImg} src={wrow.image} alt={wrow?.name ?? ""} />
          ) : (
            <div className={styles.weaponImg} />
          )}
          <div>
            <h4 className={styles.sectionTitle} style={{ margin: 0 }}>
              {wrow?.name ?? `Weapon ${w.weaponId}`}
            </h4>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {wrow?.type ?? "—"} · Lv. {w.level} · {wrow?.roundsType ?? ""}
            </p>
          </div>
        </div>
        <CapacityBar used={w.moduleUsedCapacity} max={Math.max(w.moduleMaxCapacity, 1)} />
        <ModuleGrid mods={w.modules} moduleById={moduleById} emptyHint="No weapon modules." compact />
        {mods.length > 0 ? (
          <details className={styles.statsPanel}>
            <summary>Applied module stats (estimated)</summary>
            <ul className={styles.statList}>
              {mods.map((r) => (
                <li key={r.label} className={styles.statRow}>
                  <span>{r.label}</span>
                  <span>{r.value}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    );
  };

  const renderComponentsPanel = () => (
    <div className={styles.inventoryPane}>
      <ExternalSetBonusesBanner sets={setProgress} />
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {externals.map((r, i) => {
          const id = String(r.external_component_id ?? r.externalComponentId ?? "");
          const cat = extById.get(id);
          return <ExternalComponentCard key={`ext-${id}-${i}`} row={r} catalog={cat} />;
        })}
      </div>
    </div>
  );

  const renderReactorPanel = () => (
    <div className={styles.inventoryPane}>
      {reactors.map((r, i) => (
        <ReactorProfileCard key={`reactor-${i}`} row={r} index={i} />
      ))}
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
      <header className={`${styles.hero} ${styles.heroCompact}`}>
        {primaryRow?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.portraitSm} src={primaryRow.image} alt={primaryRow.name} />
        ) : (
          <div className={styles.portraitSm} />
        )}
        <div className={styles.heroText}>
          <h3>{displayName}</h3>
          {primaryRow ? (
            <p className={styles.meta}>
              {primaryRow.name} · Lv. {primaryDesc?.level ?? "—"} · {primaryRow.element}
            </p>
          ) : (
            <p className={styles.meta}>Profile</p>
          )}
          {basic.masteryRank != null ? (
            <p className={styles.meta}>
              <strong>Mastery rank:</strong> {basic.masteryRank}
            </p>
          ) : null}
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
