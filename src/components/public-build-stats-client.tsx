"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicBuild } from "@/lib/public-build-types";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { effectiveMaxCapacity } from "@/lib/tfd-modules";
import { computePlannerMetrics } from "@/lib/build-planner-stats";

export function PublicBuildStatRollup({ build }: { build: PublicBuild }) {
  const slots = build.plannerSlots?.filter(Boolean) ?? [];
  const [catalog, setCatalog] = useState<ModuleRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/modules.json")
      .then((r) => r.json())
      .then((data: ModuleRecord[]) => {
        if (!cancelled && Array.isArray(data)) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!catalog?.length || slots.length === 0) return null;
    const moduleById = new Map(catalog.map((m) => [m.id, m]));
    const tt = build.targetType === "weapon" ? "weapon" : "descendant";
    const row = [...(build.plannerSlots ?? [])];
    const payload = row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null));
    const maxCap = effectiveMaxCapacity(tt, payload, moduleById);
    return computePlannerMetrics(row, moduleById, maxCap);
  }, [catalog, build.plannerSlots, build.targetType, slots.length]);

  if (slots.length === 0) return null;

  if (!catalog) {
    return <p className="public-build-rollup muted">Loading modifier breakdown…</p>;
  }

  if (!metrics) {
    return (
      <p className="public-build-rollup muted">
        Could not compute modifiers (module database unavailable).
      </p>
    );
  }

  if (metrics.modifierRollup.length === 0) {
    return (
      <div className="public-build-rollup">
        <p className="muted" style={{ margin: "0.25rem 0" }}>
          No categorized % lines in previews for this loadout — capacity still tracked:{" "}
          <strong>
            {metrics.totalCapacity} / {metrics.maxCapacity}
          </strong>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="public-build-rollup">
      <div className="public-build-rollup-head">Estimated modifiers (capacity-scaled)</div>
      <table className="builder-mod-table public-build-mod-table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Net Δ%</th>
          </tr>
        </thead>
        <tbody>
          {metrics.modifierRollup.slice(0, 12).map((row) => (
            <tr key={row.bucket}>
              <td>{row.bucket}</td>
              <td className={row.netPercent > 0 ? "mod-pos" : row.netPercent < 0 ? "mod-neg" : ""}>
                {row.netPercent > 0 ? "+" : ""}
                {row.netPercent}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted public-build-rollup-note">
        Additive estimate from preview text — not full combat simulation.
      </p>
    </div>
  );
}
