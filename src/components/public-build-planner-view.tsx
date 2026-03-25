"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BuildPlannerPanel,
  type PlannerFormSlice,
  type PlannerHeroProps,
} from "@/app/tracker/components/BuildPlannerPanel";
import type { PublicBuild } from "@/lib/public-build-types";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { WEAPON_TYPE_TO_NEXON, normalizePlannerSlotCatalysts, slotCountForTarget } from "@/lib/tfd-modules";
import { weaponNameToSlug } from "@/lib/weapon-slug";
import { fetchDescendantsCatalogRows, fetchModulesCatalog, fetchWeaponsCatalogRows } from "@/lib/fetch-game-catalog";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";
import type { PlacedModule, BuildReactor, ExternalComponent } from "@/app/tracker/tracker-client";

type WeaponRow = { name: string; type?: string; rarity?: string; roundsType?: string };

function normalizePortraitUrl(raw: string): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  if (t.startsWith("http") || t.startsWith("/")) return t;
  return t.replace(/^\.\//, "/").replace(/^Images\//, "/Images/");
}

export function PublicBuildPlannerView({ build }: { build: PublicBuild }) {
  const [moduleCatalog, setModuleCatalog] = useState<ModuleRecord[]>([]);
  const [weaponRows, setWeaponRows] = useState<WeaponRow[]>([]);
  const [descRows, setDescRows] = useState<DescendantCatalogRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mods, weapons, desc] = await Promise.all([
        fetchModulesCatalog().then((m) => (Array.isArray(m) ? m : [])),
        fetchWeaponsCatalogRows().then((w) => {
          if (!w?.length) return fetch("/data/weapons.json").then((r) => (r.ok ? r.json() : []));
          return w;
        }),
        fetchDescendantsCatalogRows().catch(() => []),
      ]);
      if (cancelled) return;
      if (Array.isArray(mods) && mods.length) setModuleCatalog(mods);
      const wr: WeaponRow[] = Array.isArray(weapons) ? weapons : [];
      if (wr.length) setWeaponRows(wr);
      setDescRows(Array.isArray(desc) ? desc : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const moduleById = useMemo(() => new Map(moduleCatalog.map((m) => [m.id, m])), [moduleCatalog]);

  const targetType: "descendant" | "weapon" = build.targetType === "weapon" ? "weapon" : "descendant";

  const targetKey = useMemo(() => {
    const k = build.targetKey?.trim();
    if (k) return k;
    if (targetType === "descendant") return build.displayName?.trim() ?? "";
    return weaponNameToSlug(build.displayName || "") || build.displayName?.trim().toLowerCase().replace(/\s+/g, "-") || "";
  }, [build.targetKey, build.displayName, targetType]);

  const descendantGameId = useMemo(() => {
    if (targetType !== "descendant") return null;
    const d = descRows.find((x) => x.name === targetKey);
    return d?.id?.trim() ?? null;
  }, [descRows, targetKey, targetType]);

  const descendantPeerIds = useMemo(() => {
    if (targetType !== "descendant") return undefined;
    const d = descRows.find((x) => x.name === targetKey);
    const gid = d?.groupId?.trim();
    if (!gid) return undefined;
    return descRows.filter((x) => x.groupId?.trim() === gid).map((x) => x.id);
  }, [descRows, targetKey, targetType]);

  const weaponNexonType = useMemo(() => {
    if (targetType !== "weapon") return null;
    const w = weaponRows.find((r) => weaponNameToSlug(r.name) === targetKey.toLowerCase());
    const t = w?.type;
    if (!t) return null;
    return WEAPON_TYPE_TO_NEXON[t] ?? null;
  }, [weaponRows, targetKey, targetType]);

  const targetLevel = build.targetLevel ?? (targetType === "weapon" ? 100 : 40);
  const archeLevel = build.archeLevel ?? 0;

  const plannerSlice = useMemo<PlannerFormSlice>(() => {
    const n = slotCountForTarget(targetType);
    const raw = [...(build.plannerSlots ?? [])] as (PlacedModule | null)[];
    while (raw.length < n) raw.push(null);
    return {
      targetType,
      targetKey,
      plannerSlots: raw.slice(0, n),
      plannerSlotCatalysts:
        targetType === "descendant"
          ? normalizePlannerSlotCatalysts(build.plannerSlotCatalysts, n)
          : undefined,
    };
  }, [build.plannerSlots, build.plannerSlotCatalysts, targetType, targetKey]);

  const noopSetPlanner = useCallback<React.Dispatch<React.SetStateAction<PlannerFormSlice>>>(() => {}, []);

  const reactor: BuildReactor | null = useMemo(() => {
    if (!build.reactor?.name) return null;
    const r = build.reactor;
    return {
      id: r.id,
      name: r.name,
      element: r.element,
      skillType: r.skillType,
      level: r.level,
      enhancement: r.enhancement,
      substats: (r.substats ?? []).map((s) => ({
        stat: s.stat,
        value: s.value,
        tier: (s.tier === "common" || s.tier === "rare" || s.tier === "ultimate" ? s.tier : "rare") as "common" | "rare" | "ultimate",
      })),
    };
  }, [build.reactor]);

  const externalComponents: ExternalComponent[] = useMemo(
    () =>
      (build.externalComponents ?? []).map((c) => ({
        slot: c.slot,
        baseStat: c.baseStat,
        baseValue: c.baseValue,
        substats: c.substats ?? [],
        set: c.set,
      })),
    [build.externalComponents],
  );

  const hero: PlannerHeroProps | null = useMemo(() => {
    if (!targetKey) return null;
    if (targetType === "descendant") {
      const imageUrl = normalizePortraitUrl(build.imageUrl);
      return {
        imageUrl,
        title: build.displayName || targetKey,
        subtitle: "Descendant & Trigger module loadout · shared view",
        badges: [
          { label: `Lv ${targetLevel}`, tone: "default" },
          { label: `Arche ${archeLevel}`, tone: "default" },
          { label: "Shared", tone: "accent" },
        ],
        archeLevel,
      };
    }
    const w = weaponRows.find((r) => weaponNameToSlug(r.name) === targetKey.toLowerCase());
    const imageUrl = normalizePortraitUrl(build.imageUrl);
    return {
      imageUrl,
      title: build.displayName || w?.name || targetKey,
      subtitle: [w?.rarity, w?.roundsType, w?.type].filter(Boolean).join(" · ") || "Weapon loadout · shared view",
      badges: [
        { label: `Lv ${targetLevel}`, tone: "default" },
        { label: "Shared", tone: "accent" },
      ],
    };
  }, [build.displayName, build.imageUrl, targetKey, targetType, targetLevel, archeLevel, weaponRows]);

  if (!targetKey) {
    return <p className="muted">This build is missing a target (descendant or weapon).</p>;
  }

  if (moduleCatalog.length === 0) {
    return <p className="muted public-build-planner-loading">Loading full build view…</p>;
  }

  return (
    <BuildPlannerPanel
      readOnly
      form={plannerSlice}
      setForm={noopSetPlanner}
      moduleCatalog={moduleCatalog}
      moduleById={moduleById}
      weaponNexonType={weaponNexonType}
      descendantGameId={descendantGameId}
      descendantPeerIds={descendantPeerIds}
      hero={hero}
      reactor={reactor}
      targetLevel={targetLevel}
      archeLevel={archeLevel}
      externalComponents={externalComponents.length > 0 ? externalComponents : undefined}
    />
  );
}
