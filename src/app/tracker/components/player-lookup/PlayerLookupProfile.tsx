"use client";

import { useEffect, useMemo, useState } from "react";
import type { DescendantCatalogRow, WeaponCatalogRow } from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { capacityCostAtLevel } from "@/lib/tfd-modules";
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
import styles from "./PlayerLookupProfile.module.css";

export type PlayerLookupCatalogs = {
  modules: Map<string, ModuleRecord>;
  descendants: Map<string, DescendantCatalogRow>;
  weapons: Map<string, WeaponCatalogRow>;
};

/** Nexon external component slot order (library). */
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

/** Format rollup for UI: hide absurd totals from mis-parsed previews. */
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

/** Display numeric API values: small decimals often mean ratios → %. */
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

function externalSlotLabel(slotId: unknown): string {
  const n = typeof slotId === "number" ? slotId : parseInt(String(slotId ?? ""), 10);
  if (Number.isNaN(n) || n < 1) return "Component";
  const ix = Math.min(Math.max(0, n - 1), EXTERNAL_SLOT_LABELS.length - 1);
  return EXTERNAL_SLOT_LABELS[ix] ?? `Slot ${n}`;
}

function ExternalComponentCard({ row }: { row: Record<string, unknown> }) {
  const slotId = row.external_component_slot_id ?? row.externalComponentSlotId;
  const level = row.external_component_level ?? row.externalComponentLevel ?? row.level;
  const addRaw = row.external_component_additional_stat ?? row.externalComponentAdditionalStat;
  const coresRaw = row.core ?? row.cores ?? row.core_option;

  const addStats = parseJsonRecordArray(addRaw);
  const cores = parseJsonRecordArray(coresRaw);

  const title = externalSlotLabel(slotId);

  return (
    <div className={styles.flexCard}>
      <h4 className={styles.cardTitle}>
        {title}
        {level != null ? (
          <span className="muted" style={{ fontWeight: 400, fontSize: "0.85rem" }}>
            {" "}
            · Lv. {String(level)}
          </span>
        ) : null}
      </h4>

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
                  <span>{formatGearStatValue(name, val)}</span>
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
                  <span>{formatGearStatValue(name, val)}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {addStats.length === 0 && cores.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
          No substats parsed for this component.
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
      <h4 className={styles.cardTitle}>
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
                <span>{formatGearStatValue(sn, sv)}</span>
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

/** Last resort: show non-id fields without dumping raw JSON strings. */
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
  const rows: { k: string; v: string }[] = [];
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
          rows.push({ k: label, v: formatGearStatValue(label, val) });
        }
        continue;
      }
    }
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      rows.push({ k: k, v: JSON.stringify(v) });
    } else {
      rows.push({ k: k, v: String(v) });
    }
  }
  if (rows.length === 0) return <p className="muted">No reactor details.</p>;
  return (
    <dl className={styles.kv}>
      {rows.slice(0, 20).map(({ k, v }, i) => (
        <div key={`${k}-${i}`}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
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
}: {
  mods: DescendantBuildParsed["modules"];
  moduleById: Map<string, ModuleRecord>;
  emptyHint: string;
}) {
  const sorted = [...mods].sort((a, b) => sortSlotId(a.slotId, b.slotId));
  if (sorted.length === 0) {
    return <p className="muted">{emptyHint}</p>;
  }
  return (
    <div className={styles.grid}>
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

export function PlayerLookupProfile({ data, catalogs }: Props) {
  const { modules: moduleById, descendants: descById, weapons: weaponById } = catalogs;

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

  return (
    <div className={styles.profile}>
      <header className={styles.hero}>
        {primaryRow?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.portrait} src={primaryRow.image} alt={primaryRow.name} />
        ) : (
          <div className={styles.portrait} />
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

      {descendantBuilds.map((build, bi) => {
        const row = descById.get(build.descendantId);
        const mods = formatModifierBlock(descStats[bi]?.modifiers ?? {});
        return (
          <section key={`desc-${build.descendantId}-${build.slotId}-${bi}`} className={styles.subsection}>
            <h4 className={styles.sectionTitle}>
              {row?.name ?? "Descendant"} modules
              {build.slotId ? <span className="muted"> · slot {build.slotId}</span> : null}
            </h4>
            <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 0.5rem" }}>
              Energy activator uses: {build.energyActivatorCount}
            </p>
            <CapacityBar used={build.moduleUsedCapacity} max={Math.max(build.moduleMaxCapacity, 1)} />
            <ModuleGrid mods={build.modules} moduleById={moduleById} emptyHint="No modules reported for this build." />
            {mods.length > 0 ? (
              <details className={styles.statsPanel} open>
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
          </section>
        );
      })}

      {reactors.length > 0 ? (
        <section>
          <h4 className={styles.sectionTitle}>Reactor</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {reactors.map((r, i) => (
              <ReactorProfileCard key={`reactor-${i}`} row={r} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {externals.length > 0 ? (
        <section>
          <h4 className={styles.sectionTitle}>External components</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {externals.map((r, i) => (
              <ExternalComponentCard key={`ext-${i}`} row={r} />
            ))}
          </div>
        </section>
      ) : null}

      {weaponBuilds.map((w, wi) => {
        const wrow = weaponById.get(w.weaponId);
        const mods = formatModifierBlock(weaponStats[wi]?.modifiers ?? {});
        return (
          <section key={`w-${w.weaponId}-${w.slotId}-${wi}`}>
            <div className={styles.weaponHeader}>
              {wrow?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.weaponImg} src={wrow.image} alt={wrow.name} />
              ) : (
                <div className={styles.weaponImg} />
              )}
              <div>
                <h4 className={styles.sectionTitle} style={{ margin: 0 }}>
                  {wrow?.name ?? `Weapon ${w.weaponId}`}
                </h4>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                  {wrow?.type ?? "—"} · Lv. {w.level} · {wrow?.roundsType ?? ""}
                </p>
              </div>
            </div>
            <CapacityBar used={w.moduleUsedCapacity} max={Math.max(w.moduleMaxCapacity, 1)} />
            <ModuleGrid mods={w.modules} moduleById={moduleById} emptyHint="No weapon modules." />
            {mods.length > 0 ? (
              <details className={styles.statsPanel} open>
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
          </section>
        );
      })}
    </div>
  );
}
