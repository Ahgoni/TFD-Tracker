"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";

class BuildPlannerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "1rem", background: "#1e1e2e", border: "1px solid #f87171", borderRadius: 8, color: "#f87171" }}>
          <h4>Build Planner Error</h4>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", color: "#fbbf24" }}>
            {this.state.error.message}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: "0.5rem", padding: "0.25rem 0.75rem", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { PlacedModule, BuildReactor, ReactorSubstat, ExternalComponent, AncestorStat } from "../tracker-client";
import {
  type ModuleRecord,
  capacityAtLevel,
  filterModuleLibrary,
  matchesModuleFilters,
  maxCapacityForTarget,
  slotCountForTarget,
  totalPlacedCapacity,
} from "@/lib/tfd-modules";
import {
  computePlannerMetrics,
  effectSummaryLine,
  scalePreviewPercentagesForLevel,
  splitEffectSpans,
} from "@/lib/build-planner-stats";
import {
  computeDescendantStats,
  computeWeaponStats,
  loadDescStats,
  type ComputedStats,
  type DescStatsEntry,
} from "@/lib/tfd-stat-engine";
import {
  DESCENDANT_STAT_GROUPS,
  WEAPON_STAT_GROUPS,
  shortStatName,
  type StatGroup,
} from "@/lib/tfd-stat-map";
import {
  elementDefs,
  skillDefs,
  substatOptions,
  getReactorName,
  inferTierFromValue,
} from "@/lib/tracker-data";

const ultimateToBase: Record<string, string> = {
  "101000004": "101000001", "101000007": "101000002", "101000010": "101000003",
  "101000019": "101000006", "101000020": "101000009", "101000022": "101000013",
  "101000023": "101000008", "101000025": "101000011", "101000028": "101000012",
  "101000030": "101000018", "101000032": "101000017",
};

// DnD helpers

const LIB_PREFIX = "lib:";
const SLOT_PREFIX = "slot:";
function draggableLibId(id: string) { return `${LIB_PREFIX}${id}`; }
function droppableSlotId(i: number) { return `${SLOT_PREFIX}${i}`; }
function parseDragId(id: string | number) {
  const s = String(id);
  if (s.startsWith(LIB_PREFIX)) return { kind: "lib" as const, moduleId: s.slice(LIB_PREFIX.length) };
  if (s.startsWith(SLOT_PREFIX)) return { kind: "slot" as const, index: parseInt(s.slice(SLOT_PREFIX.length), 10) };
  return null;
}

function truncate(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}\u2026`;
}

type SkillStatEntry = { basicInfo: { label: string; value: string }[]; sections: { name: string; stats: { label: string; value: string }[] }[] };

/** Flatten skill-details.json into readable calculation lines (TFDTools-style reference). */
function formatSkillDetailLines(detail: SkillStatEntry): string[] {
  const lines: string[] = [];
  if (detail.basicInfo?.length) {
    lines.push(detail.basicInfo.map((b) => `${b.label}: ${b.value}`).join(" ? "));
  }
  for (const sec of detail.sections ?? []) {
    for (const st of sec.stats) {
      lines.push(`${sec.name} ? ${st.label}: ${st.value}`);
    }
  }
  return lines;
}

type SkillMapEntry = {
  affectsSkill?: string | null;
  affectsSkills?: string[];
  modName?: string;
  modifiedElement?: string | null;
  modifiedArche?: string | null;
  skillOverrides?: Record<string, { modifiedElement?: string | null; modifiedArche?: string | null }>;
};

function mappingAffectedSkills(mapping: SkillMapEntry | undefined): string[] {
  if (!mapping) return [];
  if (mapping.affectsSkills?.length) return [...mapping.affectsSkills];
  if (mapping.affectsSkill) return [mapping.affectsSkill];
  return [];
}

// Public interfaces

export interface PlannerHeroProps {
  imageUrl: string;
  title: string;
  subtitle: string;
  badges: { label: string; tone?: "default" | "accent" | "warn" }[];
  metaLine?: string;
  skills?: { name: string; image: string; type?: string }[];
  archeLevel?: number;
}

export interface PlannerFormSlice {
  targetType: "descendant" | "weapon";
  targetKey: string;
  plannerSlots: (PlacedModule | null)[];
}

interface Props {
  form: PlannerFormSlice;
  setForm: Dispatch<SetStateAction<PlannerFormSlice>>;
  moduleCatalog: ModuleRecord[];
  moduleById: Map<string, ModuleRecord>;
  weaponNexonType: string | null;
  descendantGameId: string | null;
  hero?: PlannerHeroProps | null;
  reactor?: BuildReactor | null;
  onReactorChange?: (r: BuildReactor | null) => void;
  targetLevel?: number;
  onTargetLevelChange?: (lv: number) => void;
  archeLevel?: number;
  onArcheLevelChange?: (lv: number) => void;
  savedReactors?: { id: string; name: string; element: string; skillType: string; level: number; enhancement: string; substats: ReactorSubstat[] }[];
  externalComponents?: ExternalComponent[];
  onExternalComponentsChange?: (comps: ExternalComponent[]) => void;
}

// Child: Module library card

function ModuleLibraryCard({ mod, disabled, expanded }: { mod: ModuleRecord; disabled?: boolean; expanded?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draggableLibId(mod.id), disabled });
  const tierClass = mod.tier === "Transcendent" ? "tier-transcendent" : mod.tier === "Ultimate" ? "tier-ultimate" : mod.tier === "Rare" ? "tier-rare" : "tier-norm";

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : undefined }}
      {...listeners}
      {...attributes}
      className={`mod-lib-card ${tierClass}${isDragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}${expanded ? " mod-lib-expanded" : ""}`}
    >
      {mod.image ? <img src={mod.image} alt="" className="mod-lib-img" /> : <div className="mod-lib-img mod-lib-img-ph" />}
      <div className="mod-lib-body">
        <div className="mod-lib-card-top">
          <span className="mod-lib-cap">{capacityAtLevel(mod, 0)}</span>
          {mod.socket && <span className="mod-lib-socket" title={mod.socket}>{mod.socket}</span>}
        </div>
        <div className={`mod-lib-name ${tierClass}`}>{mod.name}</div>
        <div className="mod-lib-meta-row">
          <span className={`mod-lib-tier ${tierClass}`}>{mod.tier}</span>
          {mod.moduleClass && <span className="mod-lib-class">{mod.moduleClass}</span>}
        </div>
        {expanded && mod.preview && <p className="mod-lib-preview-full">{mod.preview}</p>}
      </div>
    </div>
  );
}

// Child: Slot

function SlotDrop({
  index, placed, moduleById, onClear, onLevel, onEditAncestor,
}: {
  index: number;
  placed: PlacedModule | null | undefined;
  moduleById: Map<string, ModuleRecord>;
  onClear: () => void;
  onLevel: (delta: number) => void;
  onEditAncestor?: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableSlotId(index) });
  const mod = placed ? moduleById.get(placed.moduleId) : undefined;
  const isAncestor = mod?.type === "Ancestors";

  return (
    <div ref={setNodeRef} className={`builder-slot${isOver ? " slot-over" : ""}${placed ? " slot-filled" : ""}`}>
      <span className="builder-slot-idx">{index + 1}</span>
      {!placed ? (
        <div className="builder-slot-empty"><span className="builder-slot-chip">Drop module</span></div>
      ) : (
        <div className="builder-slot-filled">
          <button type="button" className="builder-slot-x" onClick={onClear} aria-label="Remove module">{"\u00d7"}</button>
          {isAncestor && onEditAncestor && !placed.ancestorStats && (
            <button type="button" className="builder-slot-edit" onClick={onEditAncestor} aria-label="Configure substats" title="Configure substats">{"\u270e"}</button>
          )}
          <div className="builder-slot-body">
            {mod?.image || placed.image
              ? <img src={mod?.image || placed.image} alt="" className="builder-slot-icon" />
              : <div className="builder-slot-icon builder-slot-icon-ph" />}
            <div className={`builder-slot-title ${mod?.tier === "Transcendent" ? "tier-transcendent" : mod?.tier === "Ultimate" ? "tier-ultimate" : mod?.tier === "Rare" ? "tier-rare" : ""}`} title={placed.name}>{placed.name}</div>
            <div className="builder-slot-meta">
              <span className={`builder-slot-socket ${mod?.tier === "Transcendent" ? "tier-transcendent" : ""}`}>{placed.socket}</span>
              <span className="builder-slot-cap">{placed.capacity} cap</span>
            </div>
            {isAncestor && placed.ancestorStats ? (
              <div className="builder-slot-ancestor-stats">
                {placed.ancestorStats.positives.map((p, i) => (
                  <span key={i} className="ancestor-badge ancestor-badge-pos">+{p.value} {p.stat}</span>
                ))}
                {placed.ancestorStats.negative && (
                  <span className="ancestor-badge ancestor-badge-neg">{placed.ancestorStats.negative.value} {placed.ancestorStats.negative.stat}</span>
                )}
              </div>
            ) : mod?.preview ? (() => {
              const text = placed.customPreview ?? scalePreviewPercentagesForLevel(mod, placed.level);
              const hasNeg = /-\d+(?:\.\d+)?%/.test(text);
              return (
                <p className={`builder-slot-preview${hasNeg ? " slot-has-neg" : ""}`} title={text}>
                  {truncate(text, 96)}
                </p>
              );
            })() : null}
          </div>
          <div className="builder-slot-lvl" role="group" aria-label="Module level">
            <button type="button" className="builder-lvl-btn" onClick={() => onLevel(-1)} disabled={placed.level <= 0}>{"\u2212"}</button>
            <span className="builder-lvl-num">Lv {placed.level}</span>
            <button type="button" className="builder-lvl-btn" onClick={() => onLevel(1)} disabled={placed.level >= 10}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Ancestor module data types
type AncestorStatDef = { stat: string; buffRange: [number, number]; penaltyRange: [number, number]; unit: string; invert?: boolean };
type AncestorModuleDef = { name: string; descendantIds: string[]; element: string; arches: string[]; extraStats: AncestorStatDef[] };
type AncestorDb = {
  tierThresholds: Record<string, number>;
  sharedStats: AncestorStatDef[];
  elementStats: Record<string, AncestorStatDef[]>;
  archeStats: Record<string, AncestorStatDef[]>;
  modules: AncestorModuleDef[];
};

function getAncestorStatPool(db: AncestorDb, mod: AncestorModuleDef): AncestorStatDef[] {
  const pool = [...db.sharedStats];
  if (db.elementStats[mod.element]) pool.push(...db.elementStats[mod.element]);
  for (const a of mod.arches) {
    if (db.archeStats[a]) pool.push(...db.archeStats[a]);
  }
  pool.push(...mod.extraStats);
  return pool;
}

function qualityTier(value: number, range: [number, number], thresholds: Record<string, number>): string {
  const span = range[1] - range[0];
  if (span === 0) return "Transcendent";
  const pos = Math.abs(value - range[0]) / Math.abs(span);
  if (pos >= thresholds.Transcendent) return "Transcendent";
  if (pos >= thresholds.Ultimate) return "Ultimate";
  if (pos >= thresholds.Rare) return "Rare";
  return "Common";
}

// Child: Ancestor module editor (structured substats)

function AncestorEditor({
  placed, mod, descendantGameId, onSave, onClose,
}: {
  placed: PlacedModule;
  mod: ModuleRecord;
  descendantGameId: string | null;
  onSave: (stats: { positives: AncestorStat[]; negative?: AncestorStat }) => void;
  onClose: () => void;
}) {
  const [db, setDb] = useState<AncestorDb | null>(null);
  useEffect(() => {
    fetch("/data/ancestor-modules.json")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setDb(d))
      .catch(() => {});
  }, []);

  const ancestorMod = useMemo(() => {
    if (!db || !descendantGameId) return null;
    return db.modules.find((m) => m.descendantIds.includes(descendantGameId)) ?? null;
  }, [db, descendantGameId]);

  const statPool = useMemo(() => {
    if (!db || !ancestorMod) return [];
    return getAncestorStatPool(db, ancestorMod);
  }, [db, ancestorMod]);

  const existing = placed.ancestorStats;
  const [config, setConfig] = useState<"2+1" | "2+0" | "3+1" | "3+0">(
    existing ? `${existing.positives.length}+${existing.negative ? "1" : "0"}` as "2+1" | "2+0" | "3+1" | "3+0" : "2+1"
  );
  const posCount = parseInt(config[0]);
  const hasNeg = config.endsWith("+1");

  const [pos, setPos] = useState<{ stat: string; value: string }[]>(
    existing?.positives.map((p) => ({ stat: p.stat, value: String(p.value) })) ??
    Array.from({ length: posCount }, () => ({ stat: "", value: "" }))
  );
  const [neg, setNeg] = useState<{ stat: string; value: string }>(
    existing?.negative ? { stat: existing.negative.stat, value: String(existing.negative.value) } : { stat: "", value: "" }
  );

  useEffect(() => {
    setPos((prev) => {
      const next = [...prev];
      while (next.length < posCount) next.push({ stat: "", value: "" });
      return next.slice(0, posCount);
    });
  }, [posCount]);

  function save() {
    const positives: AncestorStat[] = pos.filter((p) => p.stat && p.value).map((p) => ({ stat: p.stat, value: parseFloat(p.value) }));
    const negative = hasNeg && neg.stat && neg.value ? { stat: neg.stat, value: parseFloat(neg.value) } : undefined;
    onSave({ positives, negative });
    onClose();
  }

  if (!db || !ancestorMod) {
    return (
      <div className="builder-ancestor-editor">
        <p className="muted">Loading ancestor data{"\u2026"}</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    );
  }

  const usedStats = new Set([...pos.map((p) => p.stat), neg.stat].filter(Boolean));

  return (
    <div className="builder-ancestor-editor">
      <h4>{ancestorMod.name}</h4>
      <div className="ancestor-config-row">
        {(["2+1", "2+0", "3+1", "3+0"] as const).map((c) => (
          <button key={c} type="button" className={`filter-chip${config === c ? " active" : ""}`} onClick={() => setConfig(c)}>
            {c.replace("+", " pos / ") + " neg"}
          </button>
        ))}
      </div>
      <div className="ancestor-stats-form">
        {pos.slice(0, posCount).map((p, i) => {
          const def = statPool.find((d) => d.stat === p.stat);
          const range = def?.buffRange;
          const tier = range && p.value ? qualityTier(parseFloat(p.value), range, db.tierThresholds) : null;
          return (
            <div key={i} className="ancestor-stat-row">
              <span className="ancestor-stat-label">Positive {i + 1}</span>
              <select value={p.stat} onChange={(e) => { const n = [...pos]; n[i] = { ...n[i], stat: e.target.value }; setPos(n); }}>
                <option value="">Select stat{"\u2026"}</option>
                {statPool.map((d) => (
                  <option key={d.stat} value={d.stat} disabled={usedStats.has(d.stat) && d.stat !== p.stat}>{d.stat}</option>
                ))}
              </select>
              <input
                type="number" step="0.01" value={p.value} placeholder={range ? `${range[0]} ~ ${range[1]}` : ""}
                onChange={(e) => { const n = [...pos]; n[i] = { ...n[i], value: e.target.value }; setPos(n); }}
                className="ancestor-value-input"
              />
              {tier && <span className={`ancestor-tier-badge ancestor-tier-${tier.toLowerCase()}`}>{tier}</span>}
            </div>
          );
        })}
        {hasNeg && (
          <div className="ancestor-stat-row ancestor-stat-neg">
            <span className="ancestor-stat-label">Negative</span>
            <select value={neg.stat} onChange={(e) => setNeg({ ...neg, stat: e.target.value })}>
              <option value="">Select stat{"\u2026"}</option>
              {statPool.map((d) => (
                <option key={d.stat} value={d.stat} disabled={usedStats.has(d.stat) && d.stat !== neg.stat}>{d.stat}</option>
              ))}
            </select>
            <input
              type="number" step="0.01" value={neg.value}
              placeholder={(() => { const def = statPool.find((d) => d.stat === neg.stat); return def ? `${def.penaltyRange[0]} ~ ${def.penaltyRange[1]}` : ""; })()}
              onChange={(e) => setNeg({ ...neg, value: e.target.value })}
              className="ancestor-value-input"
            />
          </div>
        )}
      </div>
      <div className="builder-ancestor-actions">
        <button type="button" onClick={save}>Apply</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// External Components data types
type ExtCompSlotDef = { name: string; substats: string[] };
type ExtCompDb = {
  slots: ExtCompSlotDef[];
  baseStats: string[];
  baseStatRanges: Record<string, { min: number; max: number }>;
  substatRanges: Record<string, { min: number; max: number; unit: string }>;
  sets: Record<string, { "2pc": string; "4pc": string }>;
};

// Child: External Components section

function ExternalComponentsSection({
  components, onChange,
}: {
  components: ExternalComponent[];
  onChange: (comps: ExternalComponent[]) => void;
}) {
  const [db, setDb] = useState<ExtCompDb | null>(null);
  useEffect(() => {
    // Cache-bust so updated set names / substats load after deploy (CDN/browser cache).
    fetch("/data/external-components.json?v=2025-03-20-sets2", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setDb(d))
      .catch(() => {});
  }, []);

  const setNames = useMemo(() => db ? Object.keys(db.sets) : [], [db]);

  function updateComp(idx: number, patch: Partial<ExternalComponent>) {
    const next = [...components];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function updateSubstat(compIdx: number, subIdx: number, field: "stat" | "value", val: string | number) {
    const next = [...components];
    const subs = [...next[compIdx].substats];
    subs[subIdx] = { ...subs[subIdx], [field]: field === "value" ? Number(val) : val };
    next[compIdx] = { ...next[compIdx], substats: subs };
    onChange(next);
  }

  if (!db) return null;

  const defaults = db.slots.map((s) => ({
    slot: s.name,
    baseStat: "",
    baseValue: 0,
    substats: [{ stat: "", value: 0 }, { stat: "", value: 0 }],
    set: undefined,
  }));

  while (components.length < 4) {
    components.push(defaults[components.length] ?? defaults[0]);
  }

  return (
    <div className="builder-components-section">
      <h4 className="builder-stats-h">External Components</h4>
      <div className="builder-comp-grid">
        {db.slots.map((slotDef, idx) => {
          const comp = components[idx] ?? defaults[idx];
          return (
            <div key={slotDef.name} className="builder-comp-card">
              <div className="builder-comp-header">{slotDef.name}</div>
              <div className="builder-comp-stat-row">
                <select value={comp.baseStat} onChange={(e) => updateComp(idx, { baseStat: e.target.value })}>
                  <option value="">Base stat{"\u2026"}</option>
                  {db.baseStats.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  type="number" className="comp-val-input" value={comp.baseValue || ""}
                  placeholder={comp.baseStat ? `${db.baseStatRanges[comp.baseStat]?.min ?? 0}` : "0"}
                  onChange={(e) => updateComp(idx, { baseValue: Number(e.target.value) })}
                />
              </div>
              {[0, 1].map((si) => (
                <div key={si} className="builder-comp-stat-row builder-comp-sub">
                  <select
                    value={comp.substats[si]?.stat ?? ""}
                    onChange={(e) => updateSubstat(idx, si, "stat", e.target.value)}
                  >
                    <option value="">Substat{"\u2026"}</option>
                    {slotDef.substats.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="number" className="comp-val-input" value={comp.substats[si]?.value || ""}
                    placeholder={(() => { const r = db.substatRanges[comp.substats[si]?.stat]; return r ? String(r.min) : "0"; })()}
                    onChange={(e) => updateSubstat(idx, si, "value", e.target.value)}
                  />
                </div>
              ))}
              <div className="builder-comp-stat-row">
                <select value={comp.set ?? ""} onChange={(e) => updateComp(idx, { set: e.target.value || undefined })}>
                  <option value="">No set</option>
                  {setNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      {(() => {
        const setCounts: Record<string, number> = {};
        components.forEach((c) => { if (c.set) setCounts[c.set] = (setCounts[c.set] ?? 0) + 1; });
        const activeSets = Object.entries(setCounts).filter(([, count]) => count >= 2);
        if (activeSets.length === 0) return null;
        return (
          <div className="builder-comp-set-bonuses">
            {activeSets.map(([name, count]) => (
              <div key={name} className="builder-comp-set-bonus">
                <span className="comp-set-name">{name}</span>
                <span className="comp-set-effect">{db.sets[name]?.["2pc"]}</span>
                {count >= 4 && <span className="comp-set-effect comp-set-4pc">{db.sets[name]?.["4pc"]}</span>}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// Child: Inline reactor form

const ENHANCEMENTS = ["0", "1", "2", "3", "4", "5"] as const;

function ReactorSection({
  reactor, onChange, savedReactors,
}: {
  reactor: BuildReactor | null;
  onChange: (r: BuildReactor | null) => void;
  savedReactors?: Props["savedReactors"];
}) {
  const [mode, setMode] = useState<"none" | "import" | "create">(reactor ? "create" : "none");
  const [element, setElement] = useState(reactor?.element ?? "fire");
  const [skillType, setSkillType] = useState(reactor?.skillType ?? "fusion");
  const [level, setLevel] = useState(reactor?.level ?? 100);
  const [enhancement, setEnhancement] = useState(reactor?.enhancement ?? "0");
  const [sub1, setSub1] = useState(reactor?.substats?.[0]?.stat ?? "");
  const [val1, setVal1] = useState(reactor?.substats?.[0]?.value ?? "");
  const [sub2, setSub2] = useState(reactor?.substats?.[1]?.stat ?? "");
  const [val2, setVal2] = useState(reactor?.substats?.[1]?.value ?? "");

  function pushReactor() {
    const name = getReactorName(element, skillType);
    const substats: ReactorSubstat[] = [
      { stat: sub1, value: val1, tier: inferTierFromValue(sub1, val1) },
      { stat: sub2, value: val2, tier: inferTierFromValue(sub2, val2) },
    ].filter((s) => s.stat);
    onChange({ name, element, skillType, level: Math.min(200, Math.max(1, level)), enhancement, substats });
  }

  function importReactor(id: string) {
    const r = savedReactors?.find((x) => x.id === id);
    if (!r) return;
    setElement(r.element);
    setSkillType(r.skillType);
    setLevel(r.level);
    setEnhancement(r.enhancement);
    setSub1(r.substats[0]?.stat ?? "");
    setVal1(r.substats[0]?.value ?? "");
    setSub2(r.substats[1]?.stat ?? "");
    setVal2(r.substats[1]?.value ?? "");
    onChange({ id: r.id, name: r.name, element: r.element, skillType: r.skillType, level: r.level, enhancement: r.enhancement, substats: r.substats });
    setMode("create");
  }

  return (
    <div className="builder-reactor-section">
      <div className="builder-reactor-head">
        <h4 className="builder-stats-h">Reactor</h4>
        <div className="builder-reactor-actions">
          {savedReactors && savedReactors.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) { importReactor(e.target.value); } }}
              className="builder-reactor-import"
            >
              <option value="">Import from inventory{"\u2026"}</option>
              {savedReactors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {mode === "none" && <button type="button" className="btn-sm" onClick={() => setMode("create")}>Add Reactor</button>}
          {reactor && <button type="button" className="btn-sm btn-ghost" onClick={() => { onChange(null); setMode("none"); }}>Remove</button>}
        </div>
      </div>

      {(mode === "create" || reactor) && (
        <div className="builder-reactor-form">
          <div className="builder-reactor-chips">
            <span className="builder-reactor-label">Element</span>
            <div className="chip-field-row">
              {elementDefs.filter((d) => d.id !== "all").map((d) => (
                <button type="button" key={d.id} className={`filter-chip${element === d.id ? " active" : ""}`} onClick={() => setElement(d.id)}>
                  {d.icon && <img src={d.icon} alt={d.label} />}{d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="builder-reactor-chips">
            <span className="builder-reactor-label">Skill Type</span>
            <div className="chip-field-row">
              {skillDefs.filter((d) => d.id !== "all").map((d) => (
                <button type="button" key={d.id} className={`filter-chip${skillType === d.id ? " active" : ""}`} onClick={() => setSkillType(d.id)}>
                  {d.icon && <img src={d.icon} alt={d.label} />}{d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="builder-reactor-fields">
            <label>
              <span className="builder-reactor-label">Name</span>
              <input value={getReactorName(element, skillType)} readOnly className="autofill-display" />
            </label>
            <label>
              <span className="builder-reactor-label">Level</span>
              <input type="number" min={1} max={200} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
            </label>
            <label>
              <span className="builder-reactor-label">Enhancement</span>
              <select value={enhancement} onChange={(e) => setEnhancement(e.target.value)}>
                {ENHANCEMENTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="builder-reactor-fields">
            <label>
              <span className="builder-reactor-label">Substat 1</span>
              <select value={sub1} onChange={(e) => setSub1(e.target.value)}>
                <option value="">None</option>
                {substatOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <span className="builder-reactor-label">Value 1</span>
              <input value={val1} onChange={(e) => setVal1(e.target.value)} placeholder="e.g. 0.084x" maxLength={20} />
            </label>
            <label>
              <span className="builder-reactor-label">Substat 2</span>
              <select value={sub2} onChange={(e) => setSub2(e.target.value)}>
                <option value="">None</option>
                {substatOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <span className="builder-reactor-label">Value 2</span>
              <input value={val2} onChange={(e) => setVal2(e.target.value)} placeholder="e.g. +12%" maxLength={20} />
            </label>
          </div>
          <button type="button" className="btn-sm" onClick={pushReactor}>Apply Reactor</button>
        </div>
      )}
    </div>
  );
}

// Child: Stat sheet

function StatSheet({ stats, groups }: { stats: ComputedStats | null; groups: StatGroup[] }) {
  if (!stats) return <p className="muted">Select a target to view stats.</p>;

  return (
    <div className="builder-stat-sheet">
      {groups.map((g) => {
        const rows = g.stats.filter((s) => stats.base[s] != null || stats.final[s] != null);
        if (rows.length === 0) return null;
        return (
          <div key={g.label} className="builder-stat-group">
            <h5 className="builder-stat-group-h">{g.label}</h5>
            {rows.map((s) => {
              const base = stats.base[s] ?? 0;
              const final = stats.final[s] ?? base;
              const delta = final - base;
              const pct = base !== 0 ? ((delta / base) * 100) : 0;
              const isUp = delta > 0.01;
              const isDown = delta < -0.01;
              return (
                <div key={s} className="builder-stat-row">
                  <span className="builder-stat-name">{shortStatName(s)}</span>
                  <span className="builder-stat-base">{fmt(base)}</span>
                  <span className={`builder-stat-final${isUp ? " stat-up" : ""}${isDown ? " stat-down" : ""}`}>
                    {fmt(final)}
                    {(isUp || isDown) && (
                      <span className="builder-stat-delta">
                        {isUp ? "+" : ""}{fmt(delta)} ({pct > 0 ? "+" : ""}{Math.round(pct)}%)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) < 1) return v.toFixed(3);
  return v.toFixed(1);
}

// Main panel

export function BuildPlannerPanel(props: Props) {
  return (
    <BuildPlannerErrorBoundary>
      <BuildPlannerPanelInner {...props} />
    </BuildPlannerErrorBoundary>
  );
}

function BuildPlannerPanelInner({
  form, setForm, moduleCatalog, moduleById, weaponNexonType, descendantGameId,
  hero = null, reactor = null, onReactorChange, targetLevel, onTargetLevelChange,
  archeLevel, onArcheLevelChange, savedReactors,
  externalComponents, onExternalComponentsChange,
}: Props) {
  const [activeDrag, setActiveDrag] = useState<ModuleRecord | null>(null);
  const [libSearch, setLibSearch] = useState("");
  const [libTier, setLibTier] = useState("all");
  const [libSocket, setLibSocket] = useState("all");
  const [expandMods, setExpandMods] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [computedStats, setComputedStats] = useState<ComputedStats | null>(null);
  const [descSkills, setDescSkills] = useState<{ name: string; image: string; type?: string; element?: string; arche?: string | null; description?: string | null }[]>([]);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const skillIconRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const skillTipLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skillTipPos, setSkillTipPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const clearSkillTipLeaveTimer = useCallback(() => {
    if (skillTipLeaveTimer.current) {
      clearTimeout(skillTipLeaveTimer.current);
      skillTipLeaveTimer.current = null;
    }
  }, []);

  const onSkillIconEnter = useCallback((name: string) => {
    clearSkillTipLeaveTimer();
    setHoveredSkill(name);
  }, [clearSkillTipLeaveTimer]);

  const onSkillIconLeave = useCallback(() => {
    clearSkillTipLeaveTimer();
    skillTipLeaveTimer.current = setTimeout(() => {
      setHoveredSkill(null);
      setSkillTipPos(null);
    }, 220);
  }, [clearSkillTipLeaveTimer]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const maxCap = maxCapacityForTarget(form.targetType);
  const nSlots = slotCountForTarget(form.targetType);
  const defaultLevel = form.targetType === "weapon" ? 100 : 40;
  const level = targetLevel ?? defaultLevel;

  const slots = useMemo(() => {
    const arr = [...(form.plannerSlots ?? [])];
    while (arr.length < nSlots) arr.push(null);
    return arr.slice(0, nSlots);
  }, [form.plannerSlots, nSlots]);

  const metrics = useMemo(() => computePlannerMetrics(slots, moduleById, maxCap), [slots, moduleById, maxCap]);

  const total = useMemo(
    () => totalPlacedCapacity(slots.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)), moduleById),
    [slots, moduleById],
  );

  const libraryBase = useMemo(
    () => filterModuleLibrary(moduleCatalog, form.targetType, { weaponNexonType, descendantId: descendantGameId }),
    [moduleCatalog, form.targetType, weaponNexonType, descendantGameId],
  );
  const libraryFiltered = useMemo(() => {
    const TIER_ORDER: Record<string, number> = { Transcendent: 0, Ultimate: 1, Rare: 2, Normal: 3 };
    return libraryBase
      .filter((m) => matchesModuleFilters(m, libSearch, libTier, libSocket))
      .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9));
  }, [libraryBase, libSearch, libTier, libSocket]);
  const socketOptions = useMemo(() => {
    const s = new Set<string>();
    libraryBase.forEach((m) => { if (m.socket) s.add(m.socket); });
    return [...s].sort();
  }, [libraryBase]);

  // Stat computation (async)

  const recomputeStats = useCallback(async () => {
    if (!form.targetKey) { setComputedStats(null); return; }
    try {
      if (form.targetType === "descendant" && descendantGameId) {
        const s = await computeDescendantStats(descendantGameId, level, slots, moduleById, reactor, externalComponents);
        setComputedStats(s);
      } else if (form.targetType === "weapon") {
        const weapDb = await import("@/lib/tfd-stat-engine").then((m) => m.loadWeapStats());
        const weaponId = Object.keys(weapDb).find((id) => {
          const slug = form.targetKey.toLowerCase().replace(/\s+/g, "-");
          return weapDb[id].name.toLowerCase().replace(/\s+/g, "-") === slug || id === form.targetKey;
        });
        if (weaponId) {
          const s = await computeWeaponStats(weaponId, level, slots, moduleById);
          setComputedStats(s);
        }
      }
    } catch { /* stat computation is best-effort */ }
  }, [form.targetKey, form.targetType, descendantGameId, level, slots, moduleById, reactor, externalComponents]);

  useEffect(() => { recomputeStats(); }, [recomputeStats]);

  useEffect(() => {
    if (form.targetType !== "descendant" || !descendantGameId) { setDescSkills([]); return; }
    loadDescStats().then((db) => {
      const entry = db[descendantGameId];
      if (entry?.skills) setDescSkills(entry.skills.map((sk) => ({
        name: sk.name, image: sk.image, type: sk.type,
        element: sk.element, arche: sk.arche, description: sk.description,
      })));
    }).catch(() => {});
  }, [descendantGameId, form.targetType]);

  // DnD handlers

  function handleDragStart(e: DragStartEvent) {
    const p = parseDragId(e.active.id);
    if (p?.kind === "lib") setActiveDrag(moduleById.get(p.moduleId) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const a = parseDragId(active.id);
    const o = parseDragId(over.id);
    if (!a || !o || a.kind !== "lib" || o.kind !== "slot") return;

    const mod = moduleById.get(a.moduleId);
    if (!mod) return;
    const idx = o.index;

    if (mod.tier === "Transcendent" && mod.descendantIds?.length > 0) {
      const isSkillMod = !!mod.preview;
      const isResolution = !mod.preview;
      const existing = slots.some((s, si) => {
        if (!s || si === idx) return false;
        const em = moduleById.get(s.moduleId);
        if (em?.tier !== "Transcendent" || (em.descendantIds?.length ?? 0) === 0) return false;
        if (isSkillMod) return !!em.preview;
        if (isResolution) return !em.preview;
        return false;
      });
      if (existing) {
        window.alert(isSkillMod
          ? "Only one Transcendent skill module can be equipped per build. (Resolution mods are allowed alongside.)"
          : "Only one Resolution module can be equipped per build.");
        return;
      }
    }
    const cap = capacityAtLevel(mod, 0);
    const row = [...slots];
    const prev = row[idx];
    const prevCost = prev && moduleById.get(prev.moduleId) ? capacityAtLevel(moduleById.get(prev.moduleId)!, prev.level) : 0;
    const oldTotal = totalPlacedCapacity(row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)), moduleById);
    if (oldTotal - prevCost + cap > maxCap) {
      window.alert(`Over capacity (max ${maxCap}). Remove a module or lower levels.`);
      return;
    }
    const placed: PlacedModule = { moduleId: mod.id, level: 0, name: mod.name, image: mod.image, capacity: cap, socket: mod.socket, tier: mod.tier };
    setForm((f) => {
      const next = [...(f.plannerSlots ?? [])];
      while (next.length < nSlots) next.push(null);
      next[idx] = placed;
      return { ...f, plannerSlots: next };
    });
  }

  function setSlot(index: number, next: PlacedModule | null) {
    setForm((f) => {
      const row = [...(f.plannerSlots ?? [])];
      while (row.length < nSlots) row.push(null);
      const prev = row[index];
      const prevCost = prev && moduleById.get(prev.moduleId) ? capacityAtLevel(moduleById.get(prev.moduleId)!, prev.level) : 0;
      const nextCost = next && moduleById.get(next.moduleId) ? capacityAtLevel(moduleById.get(next.moduleId)!, next.level) : 0;
      const oldTotal = totalPlacedCapacity(row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)), moduleById);
      if (oldTotal - prevCost + nextCost > maxCap) return f;
      row[index] = next;
      return { ...f, plannerSlots: row };
    });
  }

  function changeLevel(slotIndex: number, delta: number) {
    setForm((f) => {
      const row = [...(f.plannerSlots ?? [])];
      while (row.length < nSlots) row.push(null);
      const cur = row[slotIndex];
      if (!cur) return f;
      const mod = moduleById.get(cur.moduleId);
      if (!mod) return f;
      const nextLv = Math.min(10, Math.max(0, cur.level + delta));
      const oldCap = capacityAtLevel(mod, cur.level);
      const newCap = capacityAtLevel(mod, nextLv);
      const oldTotal = totalPlacedCapacity(row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)), moduleById);
      if (oldTotal - oldCap + newCap > maxCap) return f;
      row[slotIndex] = { ...cur, level: nextLv, capacity: newCap };
      return { ...f, plannerSlots: row };
    });
  }

  function saveAncestorPreview(slotIndex: number, customPreview: string) {
    setForm((f) => {
      const row = [...(f.plannerSlots ?? [])];
      const cur = row[slotIndex];
      if (!cur) return f;
      row[slotIndex] = { ...cur, customPreview };
      return { ...f, plannerSlots: row };
    });
  }

  function saveAncestorStats(slotIndex: number, stats: { positives: AncestorStat[]; negative?: AncestorStat }) {
    setForm((f) => {
      const row = [...(f.plannerSlots ?? [])];
      const cur = row[slotIndex];
      if (!cur) return f;
      const summary = stats.positives.map((p) => `${p.stat}: +${p.value}`).join(", ") +
        (stats.negative ? `, ${stats.negative.stat}: ${stats.negative.value}` : "");
      row[slotIndex] = { ...cur, ancestorStats: stats, customPreview: summary };
      return { ...f, plannerSlots: row };
    });
  }

  // Stat groups

  const statGroups = form.targetType === "weapon" ? WEAPON_STAT_GROUPS : DESCENDANT_STAT_GROUPS;

  const equippedTranscendent = useMemo(() => {
    for (const s of slots) {
      if (!s) continue;
      const m = moduleById.get(s.moduleId);
      if (m?.tier === "Transcendent" && (m.descendantIds?.length ?? 0) > 0 && !!m.preview) return { mod: m, level: s.level };
    }
    return null;
  }, [slots, moduleById]);

  const [skillMap, setSkillMap] = useState<Record<string, SkillMapEntry>>({});
  useEffect(() => {
    fetch("/data/transcendent-skill-map.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSkillMap(d ?? {}))
      .catch(() => {});
  }, []);

  const [skillDetailsDb, setSkillDetailsDb] = useState<Record<string, Record<string, SkillStatEntry>>>({});
  useEffect(() => {
    fetch("/data/skill-details.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSkillDetailsDb(d ?? {}))
      .catch(() => {});
  }, []);

  const { affectedSkillNames, isSpecificMatch } = useMemo(() => {
    if (!equippedTranscendent) return { affectedSkillNames: new Set<string>(), isSpecificMatch: false };
    const mapping = skillMap[equippedTranscendent.mod.id];
    const fromMap = mappingAffectedSkills(mapping);
    if (fromMap.length > 0) return { affectedSkillNames: new Set(fromMap), isSpecificMatch: true };
    const modName = (equippedTranscendent.mod.name ?? "").toLowerCase();
    const preview = (equippedTranscendent.mod.preview ?? "").toLowerCase();
    const searchText = modName + " " + preview;
    const skillNames = descSkills.map((sk) => String(sk.name ?? ""));
    const matched = new Set<string>();
    for (const name of skillNames) {
      if (!name) continue;
      const lc = name.toLowerCase();
      if (searchText.includes(lc) || lc.includes(modName)) matched.add(name);
    }
    if (matched.size > 0) return { affectedSkillNames: matched, isSpecificMatch: true };
    skillNames.forEach((n) => { if (n) matched.add(n); });
    return { affectedSkillNames: matched, isSpecificMatch: false };
  }, [equippedTranscendent, descSkills, skillMap]);

  const hoveredSkillTooltip = useMemo(() => {
    if (!hoveredSkill || !form.targetKey) return null;
    const heroSkills = hero?.skills ?? descSkills;
    const sk = heroSkills.find((h) => h.name === hoveredSkill);
    const full = descSkills.find((s) => s.name === hoveredSkill);
    if (!sk || !full) return null;
    const isAffected = affectedSkillNames.has(String(sk.name ?? ""));
    const modMapping = isAffected && equippedTranscendent ? skillMap[equippedTranscendent.mod.id] : null;
    const skillOv = modMapping?.skillOverrides?.[String(full?.name ?? "")];
    const displayElement = (skillOv?.modifiedElement ?? modMapping?.modifiedElement ?? full?.element) ?? "";
    const displayArche = (skillOv?.modifiedArche ?? modMapping?.modifiedArche ?? full?.arche) ?? "";
    const displayElementIcon = elementDefs.find((d) => d.label === displayElement)?.icon;
    const baseGameId = descendantGameId ? (skillDetailsDb[descendantGameId] ? descendantGameId : ultimateToBase[descendantGameId]) : null;
    const skillDetail = baseGameId ? skillDetailsDb[baseGameId]?.[String(full?.name ?? "")] : undefined;
    const hasStats = !!(skillDetail && ((skillDetail.basicInfo?.length ?? 0) > 0 || (skillDetail.sections?.length ?? 0) > 0));
    const calcLines = skillDetail ? formatSkillDetailLines(skillDetail) : [];
    return {
      sk,
      full,
      isAffected,
      modMapping,
      skillOv,
      displayElement,
      displayArche,
      displayElementIcon,
      skillDetail,
      hasStats,
      calcLines,
    };
  }, [
    hoveredSkill,
    form.targetKey,
    hero?.skills,
    descSkills,
    affectedSkillNames,
    equippedTranscendent,
    skillMap,
    descendantGameId,
    skillDetailsDb,
  ]);

  useLayoutEffect(() => {
    if (!hoveredSkill || !hoveredSkillTooltip) {
      setSkillTipPos(null);
      return;
    }
    const el = skillIconRefs.current.get(hoveredSkill);
    if (!el) {
      setSkillTipPos(null);
      return;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      const pad = 12;
      const wide = hoveredSkillTooltip.hasStats;
      const maxW = Math.min(wide ? 620 : 360, window.innerWidth - pad * 2);
      const center = r.left + r.width / 2;
      let left = center - maxW / 2;
      left = Math.max(pad, Math.min(left, window.innerWidth - maxW - pad));
      const top = r.bottom + 8;
      setSkillTipPos({ top, left, width: maxW });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hoveredSkill, hoveredSkillTooltip]);

  // Render

  if (!form.targetKey) {
    return <p className="muted builder-pick-first">Select a {form.targetType} above to open the build planner.</p>;
  }

  const heroSkills = hero?.skills ?? descSkills;
  const archLv = archeLevel ?? hero?.archeLevel ?? 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="builder-stage">
        {/* Overframe-style hero */}
        <header className="builder-hero builder-hero-overframe">
          {hero?.imageUrl && (
            <div className="builder-hero-bg-clip">
              <img src={hero.imageUrl} alt="" className="builder-portrait-bg" aria-hidden="true" />
            </div>
          )}
          <div className="builder-hero-inner">
            {hero?.imageUrl && (
              <div className="builder-portrait-wrap">
                <img src={hero.imageUrl} alt={hero?.title ?? ""} className="builder-portrait-img" />
              </div>
            )}
            <div className="builder-hero-right">
              <div className="builder-hero-text">
                <span className="builder-hero-kicker">
                  {form.targetType === "weapon" ? "WEAPON BUILD" : "DESCENDANT BUILD"}
                </span>
                <h3 className="builder-hero-title">{hero?.title ?? form.targetKey}</h3>
                {hero?.subtitle && <p className="builder-hero-sub">{hero.subtitle}</p>}
                {hero?.badges && hero.badges.length > 0 && (
                  <div className="builder-hero-badges">
                    {hero.badges.map((b) => (
                      <span key={b.label} className={`builder-hero-badge builder-hero-badge-${b.tone ?? "default"}`}>{b.label}</span>
                    ))}
                  </div>
                )}
              </div>
              {heroSkills.length > 0 && (
                <div className="builder-skills-section">
                  <div className="builder-skills-row">
                    {heroSkills.map((sk, idx) => {
                      const isAffected = affectedSkillNames.has(String(sk.name ?? ""));
                      return (
                        <div
                          key={sk.name}
                          ref={(el) => {
                            if (el) skillIconRefs.current.set(sk.name, el);
                            else skillIconRefs.current.delete(sk.name);
                          }}
                          className={`builder-skill-icon${hoveredSkill === sk.name ? " skill-active" : ""}${isAffected ? " skill-affected" : ""}`}
                          onMouseEnter={() => onSkillIconEnter(sk.name)}
                          onMouseLeave={onSkillIconLeave}
                        >
                          <img src={isAffected && isSpecificMatch && equippedTranscendent ? equippedTranscendent.mod.image : sk.image} alt={sk.name} />
                          <span className="builder-skill-num">{idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {typeof document !== "undefined" &&
          skillTipPos &&
          hoveredSkillTooltip &&
          createPortal(
            <div
              className="skill-tooltip-fixed-wrap"
              style={{
                position: "fixed",
                top: skillTipPos.top,
                left: skillTipPos.left,
                width: skillTipPos.width,
                zIndex: 100000,
              }}
              onMouseEnter={clearSkillTipLeaveTimer}
              onMouseLeave={onSkillIconLeave}
            >
              <div
                className={`skill-tooltip skill-tooltip-portal${hoveredSkillTooltip.hasStats ? " skill-tooltip-wide" : ""}`}
              >
                <div className="skill-tooltip-header">
                  {hoveredSkillTooltip.displayElementIcon && (
                    <img src={hoveredSkillTooltip.displayElementIcon} alt="" className="skill-tooltip-element-icon" />
                  )}
                  <span className="skill-tooltip-attr">
                    {hoveredSkillTooltip.displayElement} Attribute
                    {hoveredSkillTooltip.displayArche ? ` \u00b7 ${hoveredSkillTooltip.displayArche}` : ""}
                  </span>
                </div>
                <h4 className="skill-tooltip-name">
                  {hoveredSkillTooltip.isAffected && isSpecificMatch && equippedTranscendent
                    ? String(equippedTranscendent.mod.name ?? "")
                    : String(hoveredSkillTooltip.full.name ?? "")}
                </h4>
                <span className="skill-tooltip-type">{String(hoveredSkillTooltip.full.type ?? "")}</span>
                {hoveredSkillTooltip.isAffected && equippedTranscendent && (
                  <div className="skill-tooltip-mod-banner">
                    <img src={equippedTranscendent.mod.image} alt="" className="skill-tooltip-mod-icon" />
                    <span className="skill-tooltip-mod-badge">Modified by {String(equippedTranscendent.mod.name ?? "")}</span>
                  </div>
                )}
                <div className="skill-tooltip-content">
                  <div className="skill-tooltip-left">
                    {hoveredSkillTooltip.calcLines.length > 0 && (
                      <div className="skill-tooltip-calculations">
                        <span className="skill-tooltip-section-label">Skill calculations (reference)</span>
                        <ul className="skill-calc-list">
                          {hoveredSkillTooltip.calcLines.map((line, li) => (
                            <li key={li}>{line}</li>
                          ))}
                        </ul>
                        {hoveredSkillTooltip.isAffected && equippedTranscendent?.mod.preview && (
                          <p className="skill-tooltip-calc-note muted">
                            In-game values may differ when this Transcendent mod is equipped; compare with the mod text below.
                          </p>
                        )}
                      </div>
                    )}
                    <span className="skill-tooltip-section-label">Skill Description</span>
                    {hoveredSkillTooltip.isAffected && equippedTranscendent?.mod.preview ? (
                      <>
                        <p className="skill-tooltip-desc skill-tooltip-desc-modded">{String(equippedTranscendent.mod.preview ?? "")}</p>
                        {hoveredSkillTooltip.full.description && (
                          <details className="skill-tooltip-original">
                            <summary>Original Description</summary>
                            <p className="skill-tooltip-desc">{String(hoveredSkillTooltip.full.description ?? "")}</p>
                          </details>
                        )}
                      </>
                    ) : (
                      hoveredSkillTooltip.full.description && (
                        <p className="skill-tooltip-desc">{String(hoveredSkillTooltip.full.description ?? "")}</p>
                      )
                    )}
                  </div>
                  {hoveredSkillTooltip.hasStats && hoveredSkillTooltip.skillDetail && (
                    <div className="skill-tooltip-right">
                      {(hoveredSkillTooltip.skillDetail.basicInfo?.length ?? 0) > 0 && (
                        <div className="stt-section">
                          <div className="stt-section-head stt-head-basic">Basic Info</div>
                          {hoveredSkillTooltip.skillDetail.basicInfo!.map((s, si) => (
                            <div key={si} className="stt-row">
                              <span className="stt-label">{s.label}</span>
                              <span className="stt-value">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hoveredSkillTooltip.skillDetail.sections?.map((sec, si) => (
                        <div key={si} className="stt-section">
                          <div className="stt-section-head stt-head-effect">{sec.name}</div>
                          {sec.stats.map((s, ri) => (
                            <div key={ri} className="stt-row">
                              <span className="stt-label">{s.label}</span>
                              <span className="stt-value">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Three-column layout */}
        <div className="builder-main">
          {/* LEFT: Stats panel */}
          <aside className="builder-stats-panel" aria-label="Build statistics">
            <div className="builder-stats-section">
              <div className="builder-level-row">
                <label className="builder-level-label">
                  Level
                  <input
                    type="number"
                    min={1}
                    max={form.targetType === "weapon" ? 100 : 40}
                    value={level}
                    onChange={(e) => onTargetLevelChange?.(Number(e.target.value))}
                    className="builder-level-input"
                  />
                </label>
                {form.targetType === "descendant" && (
                  <label className="builder-level-label">
                    Arche Lv
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={archLv}
                      onChange={(e) => onArcheLevelChange?.(Number(e.target.value))}
                      className="builder-level-input"
                    />
                  </label>
                )}
              </div>
              <StatSheet stats={computedStats} groups={statGroups} />
            </div>

            <div className="builder-stats-section">
              <h4 className="builder-stats-h">Estimated Modifiers</h4>
              {metrics.modifierRollup.length === 0 ? (
                <p className="muted">No % modifiers yet.</p>
              ) : (
                <table className="builder-mod-table">
                  <thead><tr><th>Category</th><th>Net {"\u0394"}%</th></tr></thead>
                  <tbody>
                    {metrics.modifierRollup.map((row) => (
                      <tr key={row.bucket}>
                        <td>{row.bucket}</td>
                        <td className={row.netPercent > 0 ? "mod-pos" : row.netPercent < 0 ? "mod-neg" : ""}>
                          {row.netPercent > 0 ? "+" : ""}{row.netPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Transcendent / Skill Modification mods */}
            {(() => {
              const skillMods: { modName: string; text: string; image?: string }[] = [];
              const warnings: { modName: string; text: string }[] = [];
              slots.forEach((p) => {
                if (!p) return;
                const m = moduleById.get(p.moduleId);
                if (!m) return;
                if (m.tier === "Transcendent" && m.descendantIds?.length > 0) {
                  skillMods.push({ modName: m.name, text: m.preview, image: m.image });
                }
                const spans = splitEffectSpans(m, p.level);
                spans.filter((s) => s.negative).forEach((s) => {
                  warnings.push({ modName: p.name, text: s.text });
                });
              });
              return (
                <>
                  {skillMods.length > 0 && (
                    <div className="builder-stats-section builder-transcendent-section">
                      <h4 className="builder-stats-h transcendent-h">Skill Modifications</h4>
                      {affectedSkillNames.size > 0 && (
                        <p className="builder-affected-skills-hint muted">
                          Skills highlighted / modified: {[...affectedSkillNames].join(", ")}
                        </p>
                      )}
                      <ul className="builder-transcendent-list">
                        {skillMods.map((sm, i) => (
                          <li key={i} className="builder-transcendent-item">
                            {sm.image && <img src={sm.image} alt="" className="builder-transcendent-icon" />}
                            <div>
                              <span className="builder-transcendent-name">{sm.modName}</span>
                              <p className="builder-transcendent-desc">{sm.text}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="builder-stats-section builder-warnings-section">
                      <h4 className="builder-stats-h effect-neg-h">Negative Effects</h4>
                      <ul className="builder-warning-list">
                        {warnings.map((w, i) => (
                          <li key={i} className="builder-warning-item">
                            <span className="builder-warning-mod">{w.modName}</span>
                            <span className="builder-warning-text">{w.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="builder-stats-section builder-effects-section">
              <h4 className="builder-stats-h">Module Effects</h4>
              {slots.filter(Boolean).length === 0 ? (
                <p className="muted">Equip modules to see effects.</p>
              ) : (
                <ul className="builder-effect-list">
                  {slots.map((p, i) => {
                    if (!p) return null;
                    const m = moduleById.get(p.moduleId);
                    const spans = splitEffectSpans(m, p.level);
                    const cap = m ? capacityAtLevel(m, p.level) : 0;
                    return (
                      <li key={`${p.moduleId}-${i}`}>
                        <strong>{p.name} {"\u00b7"} Lv {p.level}</strong>
                        {spans.length > 0 && (
                          <div className="builder-effect-txt">
                            {spans.map((sp, si) => (
                              <span key={si} className={sp.negative ? "effect-neg" : "effect-pos"}>
                                {sp.text}{si < spans.length - 1 ? " " : ""}
                              </span>
                            ))}
                            <span className="effect-cap"> {"\u00b7"} {cap} cap</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* CENTER: Module grid + Reactor + Capacity */}
          <section className="builder-center-col">
            <div className="builder-capacity-block">
              <span className="builder-cap-label">Capacity</span>
              <div className="builder-cap-numbers">
                <span className={total > maxCap ? "cap-bad" : "cap-ok"}>{total}</span>
                <span className="cap-sep">/</span>
                <span>{maxCap}</span>
              </div>
              <div className="builder-cap-bar">
                <div className="builder-cap-fill" style={{ width: `${Math.min(100, (total / maxCap) * 100)}%` }} />
              </div>
            </div>

            <div className="builder-slots-wrap" aria-label="Module slots">
              <div className={`builder-slots-grid builder-slots-${form.targetType}`}>
                {slots.map((placed, index) => (
                  <SlotDrop
                    key={index}
                    index={index}
                    placed={placed}
                    moduleById={moduleById}
                    onClear={() => setSlot(index, null)}
                    onLevel={(d) => changeLevel(index, d)}
                    onEditAncestor={() => setEditingSlot(index)}
                  />
                ))}
              </div>
            </div>

            {editingSlot !== null && slots[editingSlot] && moduleById.get(slots[editingSlot]!.moduleId) && (
              <AncestorEditor
                placed={slots[editingSlot]!}
                mod={moduleById.get(slots[editingSlot]!.moduleId)!}
                descendantGameId={descendantGameId}
                onSave={(stats) => saveAncestorStats(editingSlot, stats)}
                onClose={() => setEditingSlot(null)}
              />
            )}

            <ReactorSection reactor={reactor} onChange={onReactorChange ?? (() => {})} savedReactors={savedReactors} />

            {form.targetType === "descendant" && onExternalComponentsChange && (
              <ExternalComponentsSection
                components={externalComponents ?? []}
                onChange={onExternalComponentsChange}
              />
            )}
          </section>

          {/* RIGHT: Module library */}
          <aside className="builder-col-right" aria-label="Module library">
            <div className="builder-lib-header">Module Library</div>
            <div className="builder-lib-filters">
              <input
                className="builder-lib-search"
                placeholder="Search name or effect?"
                value={libSearch}
                onChange={(e) => setLibSearch(e.target.value)}
                aria-label="Search modules"
              />
              <div className="builder-lib-row">
                <label>
                  Tier
                  <select value={libTier} onChange={(e) => setLibTier(e.target.value)}>
                    <option value="all">All</option>
                    <option value="Normal">Normal</option>
                    <option value="Rare">Rare</option>
                    <option value="Ultimate">Ultimate</option>
                    <option value="Transcendent">Transcendent</option>
                  </select>
                </label>
                <label>
                  Socket
                  <select value={libSocket} onChange={(e) => setLibSocket(e.target.value)}>
                    <option value="all">All</option>
                    {socketOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="builder-expand-toggle">
                <input type="checkbox" checked={expandMods} onChange={(e) => setExpandMods(e.target.checked)} />
                Expand Mods
              </label>
            </div>
            <div className="builder-lib-scroll">
              {libraryFiltered.length === 0 ? (
                <p className="muted" style={{ padding: "0.5rem" }}>
                  No modules match. Adjust filters.
                </p>
              ) : (
                libraryFiltered.map((m) => <ModuleLibraryCard key={m.id} mod={m} disabled={false} expanded={expandMods} />)
              )}
            </div>
            <p className="muted builder-lib-foot">{libraryFiltered.length} shown {"\u00b7"} {libraryBase.length} available</p>
          </aside>
        </div>
      </div>

      {/* Drag overlay (no modifiers = follows grab point correctly) */}
      <DragOverlay dropAnimation={null} zIndex={10000}>
        {activeDrag ? (
          <div className={`mod-lib-card mod-lib-card-overlay ${activeDrag.tier === "Transcendent" ? "tier-transcendent" : activeDrag.tier === "Ultimate" ? "tier-ultimate" : activeDrag.tier === "Rare" ? "tier-rare" : "tier-norm"}`}>
            {activeDrag.image ? <img src={activeDrag.image} alt="" className="mod-lib-img" /> : null}
            <div className="mod-lib-body">
              <div className="mod-lib-name">{activeDrag.name}</div>
              <div className="mod-lib-meta-row muted" style={{ fontSize: "0.65rem" }}>Drag into a slot</div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
