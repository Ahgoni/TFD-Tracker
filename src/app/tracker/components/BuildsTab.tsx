"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { TrackerState, BuildEntry, PlacedModule, BuildReactor, ExternalComponent } from "../tracker-client";
import { uuid } from "@/lib/uuid";
import { BuildPlannerPanel, type PlannerFormSlice, type PlannerHeroProps } from "./BuildPlannerPanel";
import { WEAPON_TYPE_TO_NEXON, type ModuleRecord, slotCountForTarget } from "@/lib/tfd-modules";

interface Props {
  state: TrackerState;
  setState: React.Dispatch<React.SetStateAction<TrackerState>>;
}

function pushActivity(state: TrackerState, text: string): TrackerState {
  return {
    ...state,
    activities: [{ id: uuid(), text, at: new Date().toISOString() }, ...(state.activities ?? [])].slice(0, 30),
  };
}

function emptyPlannerSlots(targetType: "descendant" | "weapon"): (PlacedModule | null)[] {
  return Array.from({ length: slotCountForTarget(targetType) }, () => null);
}

function plannerToLegacyLines(slots: (PlacedModule | null)[]): string[] {
  const lines = slots.map((s) => (s ? s.name : ""));
  while (lines.length < 12) lines.push("");
  return lines.slice(0, 12);
}

export function BuildsTab({ state, setState }: Props) {
  const { data: session } = useSession();
  const username = session?.user && "username" in session.user ? (session.user as { username?: string | null }).username : null;

  const [moduleCatalog, setModuleCatalog] = useState<ModuleRecord[]>([]);
  const moduleById = useMemo(() => new Map(moduleCatalog.map((m) => [m.id, m])), [moduleCatalog]);

  /** Nexon weapon `type` (e.g. Handgun) by weapon name — matches /data/weapons.json */
  const [weaponTypeByName, setWeaponTypeByName] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/data/modules.json")
      .then((r) => r.json())
      .then((data: ModuleRecord[]) => {
        if (!cancelled && Array.isArray(data)) setModuleCatalog(data);
      })
      .catch(() => {});
    fetch("/data/weapons.json")
      .then((r) => r.json())
      .then((rows: Array<{ name: string; type: string }>) => {
        if (cancelled || !Array.isArray(rows)) return;
        const o: Record<string, string> = {};
        rows.forEach((r) => {
          if (r.name && r.type) o[r.name] = r.type;
        });
        setWeaponTypeByName(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    targetType: "descendant" | "weapon";
    targetKey: string;
    moduleSlots: string[];
    plannerSlots: (PlacedModule | null)[];
    reactor: BuildReactor | null;
    targetLevel: number;
    archeLevel: number;
    externalComponents: ExternalComponent[];
    reactorNotes: string;
    notes: string;
  }>({
    name: "",
    targetType: "descendant",
    targetKey: "",
    moduleSlots: Array(12).fill(""),
    plannerSlots: emptyPlannerSlots("descendant"),
    reactor: null,
    targetLevel: 40,
    archeLevel: 0,
    externalComponents: [],
    reactorNotes: "",
    notes: "",
  });

  const bf = state.buildFilters ?? { search: "", type: "all" };

  const descendantOptions = useMemo(
    () => [...(state.descendants ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [state.descendants]
  );

  const weaponOptions = useMemo(
    () => [...(state.weapons ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [state.weapons]
  );

  const weaponNexonType = useMemo(() => {
    const w = weaponOptions.find((x) => x.slug === form.targetKey);
    if (!w) return null;
    const t = weaponTypeByName[w.name];
    if (!t) return null;
    return WEAPON_TYPE_TO_NEXON[t] ?? null;
  }, [weaponOptions, form.targetKey, weaponTypeByName]);

  const descendantGameId = useMemo(() => {
    const d = descendantOptions.find((x) => x.name === form.targetKey);
    return d?.id ?? null;
  }, [descendantOptions, form.targetKey]);

  useEffect(() => {
    if (!form.targetKey) return;
    const n = slotCountForTarget(form.targetType);
    setForm((f) => {
      const cur = [...(f.plannerSlots ?? [])];
      while (cur.length < n) cur.push(null);
      if (cur.length !== n) {
        return { ...f, plannerSlots: cur.slice(0, n) };
      }
      return f;
    });
  }, [form.targetType, form.targetKey]);

  const filtered = (state.builds ?? []).filter((b) => {
    const q = (bf.search ?? "").trim().toLowerCase();
    if (q && !b.name.toLowerCase().includes(q) && !b.displayName.toLowerCase().includes(q)) return false;
    if (bf.type === "descendant" && b.targetType !== "descendant") return false;
    if (bf.type === "weapon" && b.targetType !== "weapon") return false;
    return true;
  });

  function resetForm() {
    setForm({
      name: "",
      targetType: "descendant",
      targetKey: "",
      moduleSlots: Array(12).fill(""),
      plannerSlots: emptyPlannerSlots("descendant"),
      reactor: null,
      targetLevel: 40,
      archeLevel: 0,
      externalComponents: [],
      reactorNotes: "",
      notes: "",
    });
    setEditingId(null);
  }

  function resolveTarget(): { displayName: string; imageUrl: string } | null {
    if (form.targetType === "descendant") {
      const d = descendantOptions.find((x) => x.name === form.targetKey);
      if (!d) return null;
      return { displayName: d.name, imageUrl: d.portrait };
    }
    const w = weaponOptions.find((x) => x.slug === form.targetKey);
    if (!w) return null;
    return { displayName: w.name, imageUrl: w.icon || "" };
  }

  function saveBuild(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveTarget();
    if (!form.name.trim() || !resolved) {
      alert("Choose a build name and a valid descendant or weapon.");
      return;
    }
    const now = new Date().toISOString();
    const legacyLines = plannerToLegacyLines(form.plannerSlots ?? []);

    const entryBase = {
      name: form.name.trim(),
      targetType: form.targetType,
      targetKey: form.targetKey,
      displayName: resolved.displayName,
      imageUrl: resolved.imageUrl,
      moduleSlots: legacyLines,
      plannerSlots: (form.plannerSlots ?? []).some(Boolean) ? [...form.plannerSlots] : null,
      reactor: form.reactor ?? null,
      targetLevel: form.targetLevel,
      archeLevel: form.archeLevel,
      externalComponents: form.externalComponents.length > 0 ? form.externalComponents : undefined,
      reactorNotes: form.reactorNotes.trim(),
      notes: form.notes.trim(),
      updatedAt: now,
    };

    if (editingId) {
      setState((prev) =>
        pushActivity(
          {
            ...prev,
            builds: (prev.builds ?? []).map((b) =>
              b.id === editingId ? { ...b, ...entryBase, id: b.id } : b
            ),
          },
          `Updated build: ${form.name.trim()}`
        )
      );
    } else {
      const entry: BuildEntry = {
        id: uuid(),
        ...entryBase,
      };
      setState((prev) => pushActivity({ ...prev, builds: [...(prev.builds ?? []), entry] }, `Created build: ${entry.name}`));
    }
    resetForm();
  }

  function startEdit(b: BuildEntry) {
    setEditingId(b.id);
    const n = slotCountForTarget(b.targetType);
    let planner = (b.plannerSlots ?? []).length
      ? [...(b.plannerSlots as (PlacedModule | null)[])]
      : emptyPlannerSlots(b.targetType);
    while (planner.length < n) planner.push(null);
    planner = planner.slice(0, n);
    setForm({
      name: b.name,
      targetType: b.targetType,
      targetKey: b.targetKey,
      moduleSlots: [...(b.moduleSlots ?? []), ...Array(12)].slice(0, 12).map((x) => (typeof x === "string" ? x : "")),
      plannerSlots: planner,
      reactor: b.reactor ?? null,
      targetLevel: b.targetLevel ?? (b.targetType === "weapon" ? 100 : 40),
      archeLevel: ((b as unknown as Record<string, unknown>).archeLevel as number) ?? 0,
      externalComponents: b.externalComponents ?? [],
      reactorNotes: b.reactorNotes ?? "",
      notes: b.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeBuild(id: string) {
    const b = (state.builds ?? []).find((x) => x.id === id);
    if (!confirm(`Delete build "${b?.name ?? "this"}"?`)) return;
    setState((prev) => pushActivity({ ...prev, builds: (prev.builds ?? []).filter((x) => x.id !== id) }, `Deleted build: ${b?.name}`));
    if (editingId === id) resetForm();
  }

  function duplicateBuild(b: BuildEntry) {
    const copy: BuildEntry = {
      ...b,
      id: uuid(),
      name: `${b.name} (copy)`,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => pushActivity({ ...prev, builds: [...(prev.builds ?? []), copy] }, `Duplicated build: ${b.name}`));
  }

  function copyProfileLink(anchor?: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const path = username ? `${base}/u/${encodeURIComponent(username)}${anchor ?? ""}` : `${base}/tracker`;
    navigator.clipboard.writeText(path).catch(() => {});
  }

  const plannerSlice: PlannerFormSlice = {
    targetType: form.targetType,
    targetKey: form.targetKey,
    plannerSlots: form.plannerSlots,
  };

  const plannerHero: PlannerHeroProps | null = useMemo(() => {
    if (!form.targetKey) return null;
    if (form.targetType === "descendant") {
      const d = descendantOptions.find((x) => x.name === form.targetKey);
      if (!d) return null;
      const raw = d.portrait?.trim() ?? "";
      const imageUrl =
        raw.startsWith("http") || raw.startsWith("/")
          ? raw
          : raw.replace(/^\.\//, "/");
      return {
        imageUrl,
        title: d.name,
        subtitle: [d.element, ...(d.skills ?? []).slice(0, 2)].filter(Boolean).join(" · ") || "Descendant",
        badges: [
          { label: d.owned ? "In roster" : "Not marked owned", tone: d.owned ? "accent" : "default" },
          { label: `Lv ${d.level}`, tone: "default" },
          { label: `Arch ${form.archeLevel || d.archeLevel || 0}`, tone: "default" },
        ],
        metaLine: `Catalysts: ${d.catalysts} · stats from your Descendants tab`,
        archeLevel: form.archeLevel || d.archeLevel || 0,
      };
    }
    const w = weaponOptions.find((x) => x.slug === form.targetKey);
    if (!w) return null;
    const wt = weaponTypeByName[w.name];
    const rawIcon = w.icon?.trim() ?? "";
    const imageUrl = rawIcon
      ? rawIcon.replace(/^\.\//, "/").replace(/^Images\//, "/Images/")
      : "";
    return {
      imageUrl,
      title: w.name,
      subtitle: [w.rarity, w.roundsType, wt].filter(Boolean).join(" · ") || "Weapon",
      badges: [
        { label: w.acquired ? "Acquired" : "Not acquired", tone: w.acquired ? "accent" : "default" },
        { label: `Lv ${w.level}`, tone: "default" },
        { label: `Enh +${w.enhancement}`, tone: "default" },
      ],
      metaLine: `Core: ${w.weaponCore} · sync from Weapons tab`,
    };
  }, [form.targetKey, form.targetType, form.archeLevel, descendantOptions, weaponOptions, weaponTypeByName]);

  const setPlannerSlice: React.Dispatch<React.SetStateAction<PlannerFormSlice>> = (action) => {
    if (typeof action === "function") {
      setForm((f) => {
        const next = action({
          targetType: f.targetType,
          targetKey: f.targetKey,
          plannerSlots: f.plannerSlots,
        });
        return {
          ...f,
          targetType: next.targetType,
          targetKey: next.targetKey,
          plannerSlots: next.plannerSlots,
        };
      });
    } else {
      setForm((f) => ({
        ...f,
        targetType: action.targetType,
        targetKey: action.targetKey,
        plannerSlots: action.plannerSlots,
      }));
    }
  };

  return (
    <div className="builds-page">
      <section className="panel">
        <h2>
          Build planner
          <span className="panel-count">{(state.builds ?? []).length} saved</span>
        </h2>
        <p className="muted">
          Drag official modules from the Nexon database into slots (Overframe-style). Capacity uses in-game module costs by level.
          Friends see builds on your profile when sharing is enabled.
        </p>

        {username && (
          <p className="builds-share-hint">
            <button type="button" className="filter-chip" onClick={() => copyProfileLink()}>
              Copy profile link
            </button>
            <span className="muted" style={{ fontSize: "0.82rem" }}>
              Builds appear on <code className="inline-code">/u/{username}</code> for friends.
            </span>
          </p>
        )}

        <form className="builds-form" onSubmit={saveBuild}>
          <div className="builds-form-grid">
            <label>
              Build name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Chill DPS / Raid Lepic"
                required
                maxLength={80}
              />
            </label>
            <label>
              Type
              <select
                value={form.targetType}
                onChange={(e) => {
                  const targetType = e.target.value as "descendant" | "weapon";
                  setForm((f) => ({
                    ...f,
                    targetType,
                    targetKey: "",
                    plannerSlots: emptyPlannerSlots(targetType),
                  }));
                }}
              >
                <option value="descendant">Descendant</option>
                <option value="weapon">Weapon</option>
              </select>
            </label>
            <label>
              {form.targetType === "descendant" ? "Descendant" : "Weapon"}
              <select
                value={form.targetKey}
                onChange={(e) => {
                  const key = e.target.value;
                  const d = descendantOptions.find((x) => x.name === key);
                  setForm((f) => ({
                    ...f,
                    targetKey: key,
                    plannerSlots: emptyPlannerSlots(f.targetType),
                    archeLevel: d?.archeLevel ?? f.archeLevel,
                  }));
                }}
                required
              >
                <option value="">Select…</option>
                {form.targetType === "descendant"
                  ? descendantOptions.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))
                  : weaponOptions.map((w) => (
                      <option key={w.slug} value={w.slug}>
                        {w.name}
                      </option>
                    ))}
              </select>
            </label>
          </div>

          {moduleCatalog.length === 0 ? (
            <p className="muted" style={{ margin: "0.75rem 0" }}>
              Loading module database… If this never finishes, run{" "}
              <code className="inline-code">node scripts/fetch-game-data.mjs</code> and redeploy.
            </p>
          ) : (
            <BuildPlannerPanel
              form={plannerSlice}
              setForm={setPlannerSlice}
              moduleCatalog={moduleCatalog}
              moduleById={moduleById}
              weaponNexonType={weaponNexonType}
              descendantGameId={descendantGameId}
              hero={plannerHero}
              reactor={form.reactor}
              onReactorChange={(r) => setForm((f) => ({ ...f, reactor: r }))}
              targetLevel={form.targetLevel}
              onTargetLevelChange={(lv) => setForm((f) => ({ ...f, targetLevel: lv }))}
              archeLevel={form.archeLevel}
              onArcheLevelChange={(lv) => setForm((f) => ({ ...f, archeLevel: lv }))}
              savedReactors={state.reactors?.map((r) => ({
                id: r.id,
                name: r.name,
                element: r.element,
                skillType: r.skillType,
                level: r.level,
                enhancement: r.enhancement,
                substats: r.substats ?? [],
              }))}
              externalComponents={form.externalComponents}
              onExternalComponentsChange={(comps) => setForm((f) => ({ ...f, externalComponents: comps }))}
            />
          )}

          <label>
            Reactor / pairing notes
            <textarea
              rows={2}
              value={form.reactorNotes}
              onChange={(e) => setForm((f) => ({ ...f, reactorNotes: e.target.value }))}
              placeholder="Reactor element, skill type, substat goals…"
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Rotation, augments, team comp…"
            />
          </label>

          <div className="builds-form-actions">
            <button type="submit" className="btn-primary">
              {editingId ? "Save changes" : "Save build"}
            </button>
            {editingId && (
              <button type="button" className="filter-chip" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <h3>Your builds</h3>
        <div className="weapon-filters" style={{ marginBottom: "0.75rem" }}>
          <div className="filter-group">
            <input
              placeholder="Search builds…"
              value={bf.search}
              onChange={(e) => setState((p) => ({ ...p, buildFilters: { ...p.buildFilters, search: e.target.value } }))}
              aria-label="Search builds"
            />
            <button
              type="button"
              className={`filter-chip${bf.type === "all" ? " active" : ""}`}
              onClick={() => setState((p) => ({ ...p, buildFilters: { ...p.buildFilters, type: "all" } }))}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-chip${bf.type === "descendant" ? " active" : ""}`}
              onClick={() => setState((p) => ({ ...p, buildFilters: { ...p.buildFilters, type: "descendant" } }))}
            >
              Descendant
            </button>
            <button
              type="button"
              className={`filter-chip${bf.type === "weapon" ? " active" : ""}`}
              onClick={() => setState((p) => ({ ...p, buildFilters: { ...p.buildFilters, type: "weapon" } }))}
            >
              Weapon
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="muted">No builds yet. Create one above.</p>
        ) : (
          <div className="builds-grid">
            {filtered.map((b) => (
              <article className="build-card" key={b.id} id={`build-${b.id}`}>
                <div className="build-card-head">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt="" className="build-card-img" />
                  ) : (
                    <div className="build-card-img build-card-img-fallback" aria-hidden />
                  )}
                  <div>
                    <h4>{b.name}</h4>
                    <p className="build-card-meta">
                      <span className={`build-type-tag ${b.targetType}`}>{b.targetType}</span>
                      {b.displayName}
                    </p>
                    <p className="build-card-date">Updated {new Date(b.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
                {b.plannerSlots?.some(Boolean) ? (
                  <ul className="build-planner-icons">
                    {b.plannerSlots.map(
                      (s, i) =>
                        s && (
                          <li key={`${s.moduleId}-${i}`} title={s.name}>
                            {s.image ? <img src={s.image} alt="" className="build-planner-ico" /> : <span className="build-planner-dot" />}
                          </li>
                        )
                    )}
                  </ul>
                ) : (
                  <ul className="build-module-list">
                    {(b.moduleSlots ?? []).map((line, i) =>
                      line ? (
                        <li key={i}>
                          <span className="build-mod-label">{i + 1}</span>
                          {line}
                        </li>
                      ) : null
                    )}
                  </ul>
                )}
                {b.reactor && (
                  <p className="build-extra">
                    <strong>Reactor:</strong> {b.reactor.name} (Lv {b.reactor.level}, +{b.reactor.enhancement})
                    {b.reactor.substats?.length > 0 && (
                      <span className="muted"> — {b.reactor.substats.map((s) => `${s.stat}: ${s.value}`).join(", ")}</span>
                    )}
                  </p>
                )}
                {!b.reactor && b.reactorNotes && (
                  <p className="build-extra">
                    <strong>Reactor:</strong> {b.reactorNotes}
                  </p>
                )}
                {b.notes && (
                  <p className="build-extra">
                    <strong>Notes:</strong> {b.notes}
                  </p>
                )}
                <div className="build-card-actions">
                  <button type="button" className="filter-chip" onClick={() => startEdit(b)}>
                    Edit
                  </button>
                  <button type="button" className="filter-chip" onClick={() => duplicateBuild(b)}>
                    Duplicate
                  </button>
                  {username && (
                    <button type="button" className="filter-chip" onClick={() => copyProfileLink(`#build-${b.id}`)}>
                      Copy link
                    </button>
                  )}
                  <button type="button" className="danger" style={{ fontSize: "0.8rem" }} onClick={() => removeBuild(b.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
