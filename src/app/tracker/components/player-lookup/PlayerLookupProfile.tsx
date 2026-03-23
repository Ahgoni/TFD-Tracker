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
    .map(([k, v]) => ({ label: k, value: `${Math.round(v * 100) / 100}%` }))
    .sort((a, b) => Math.abs(parseFloat(b.value)) - Math.abs(parseFloat(a.value)));
  return rows.slice(0, 24);
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

function ReactorOrExternalCard({ title, obj }: { title: string; obj: Record<string, unknown> }) {
  const flat: { k: string; v: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "id" && typeof v === "object") continue;
    if (typeof v === "object" && v !== null) {
      flat.push({ k, v: JSON.stringify(v) });
    } else {
      flat.push({ k, v: String(v) });
    }
  }
  return (
    <div className={styles.flexCard}>
      <h4 className={styles.sectionTitle} style={{ marginTop: 0 }}>
        {title}
      </h4>
      <dl className={styles.kv}>
        {flat.slice(0, 32).map(({ k, v }) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
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

  const ouid = typeof data.ouid === "string" ? data.ouid : basic.ouid;

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
          {ouid ? (
            <p className={styles.ouid}>
              <strong>OUID</strong> {ouid}
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
          <h4 className={styles.sectionTitle}>Reactor &amp; reactor details</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {reactors.map((r, i) => (
              <ReactorOrExternalCard
                key={`reactor-${i}`}
                title={String(
                  r.reactor_name ??
                    r.reactorName ??
                    r.reactor_id ??
                    r.reactorId ??
                    `Reactor ${i + 1}`,
                )}
                obj={r}
              />
            ))}
          </div>
        </section>
      ) : null}

      {externals.length > 0 ? (
        <section>
          <h4 className={styles.sectionTitle}>External components</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {externals.map((r, i) => (
              <ReactorOrExternalCard
                key={`ext-${i}`}
                title={String(
                  r.external_component_name ??
                    r.externalComponentName ??
                    r.external_component_id ??
                    r.externalComponentId ??
                    `Component ${i + 1}`,
                )}
                obj={r}
              />
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

      <p className={styles.disclaimer}>
        Live data from Nexon Open API; names/icons from your synced catalog (
        <a href="https://tfd.nexon.com/en/library/descendants" target="_blank" rel="noreferrer">
          Nexon library
        </a>
        ). Stat percentages are estimates from module text — in-game values may differ slightly.
      </p>
    </div>
  );
}
