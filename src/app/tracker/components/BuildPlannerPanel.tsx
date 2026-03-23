"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
import type { PlacedModule, BuildReactor, ReactorSubstat } from "../tracker-client";
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

// ── DnD helpers ──────────────────────────────────────────────────────────────

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
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// ── Public interfaces ────────────────────────────────────────────────────────

export interface PlannerHeroProps {
  imageUrl: string;
  title: string;
  subtitle: string;
  badges: { label: string; tone?: "default" | "accent" | "warn" }[];
  metaLine?: string;
  skills?: { name: string; image: string; type?: string }[];
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
  savedReactors?: { id: string; name: string; element: string; skillType: string; level: number; enhancement: string; substats: ReactorSubstat[] }[];
}

// ── Child: Module library card ───────────────────────────────────────────────

function ModuleLibraryCard({ mod, disabled, expanded }: { mod: ModuleRecord; disabled?: boolean; expanded?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draggableLibId(mod.id), disabled });
  const tierClass = mod.tier === "Ultimate" ? "tier-ultimate" : mod.tier === "Rare" ? "tier-rare" : "tier-norm";

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
        <div className="mod-lib-name">{mod.name}</div>
        <div className="mod-lib-meta-row">
          <span className="mod-lib-tier">{mod.tier}</span>
          {mod.moduleClass && <span className="mod-lib-class">{mod.moduleClass}</span>}
        </div>
        {expanded && mod.preview && <p className="mod-lib-preview-full">{mod.preview}</p>}
      </div>
    </div>
  );
}

// ── Child: Slot ──────────────────────────────────────────────────────────────

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
          <button type="button" className="builder-slot-x" onClick={onClear} aria-label="Remove module">×</button>
          {isAncestor && onEditAncestor && (
            <button type="button" className="builder-slot-edit" onClick={onEditAncestor} aria-label="Edit values" title="Edit ancestor values">✎</button>
          )}
          <div className="builder-slot-body">
            {mod?.image || placed.image
              ? <img src={mod?.image || placed.image} alt="" className="builder-slot-icon" />
              : <div className="builder-slot-icon builder-slot-icon-ph" />}
            <div className="builder-slot-title" title={placed.name}>{placed.name}</div>
            <div className="builder-slot-meta">
              <span className="builder-slot-socket">{placed.socket}</span>
              <span className="builder-slot-cap">{placed.capacity} cap</span>
            </div>
            {mod?.preview && (() => {
              const text = placed.customPreview ?? scalePreviewPercentagesForLevel(mod, placed.level);
              const hasNeg = /-\d+(?:\.\d+)?%/.test(text);
              return (
                <p className={`builder-slot-preview${hasNeg ? " slot-has-neg" : ""}`} title={text}>
                  {truncate(text, 96)}
                </p>
              );
            })()}
          </div>
          <div className="builder-slot-lvl" role="group" aria-label="Module level">
            <button type="button" className="builder-lvl-btn" onClick={() => onLevel(-1)} disabled={placed.level <= 0}>−</button>
            <span className="builder-lvl-num">Lv {placed.level}</span>
            <button type="button" className="builder-lvl-btn" onClick={() => onLevel(1)} disabled={placed.level >= 10}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Child: Ancestor module editor ────────────────────────────────────────────

function AncestorEditor({
  placed, mod, onSave, onClose,
}: {
  placed: PlacedModule;
  mod: ModuleRecord;
  onSave: (customPreview: string) => void;
  onClose: () => void;
}) {
  const base = placed.customPreview ?? mod.preview ?? "";
  const pctRe = /([+-]?\d+(?:\.\d+)?)%/g;
  const parts: { before: string; value: string; after: string }[] = [];
  let last = 0;
  for (const m of base.matchAll(pctRe)) {
    const idx = m.index ?? 0;
    parts.push({ before: base.slice(last, idx), value: m[1], after: "" });
    last = idx + m[0].length;
  }
  const trailing = base.slice(last);

  const [values, setValues] = useState(parts.map((p) => p.value));

  function save() {
    let result = "";
    parts.forEach((p, i) => {
      result += p.before + (values[i] ?? p.value) + "%";
    });
    result += trailing;
    onSave(result);
    onClose();
  }

  if (parts.length === 0) {
    return (
      <div className="builder-ancestor-editor">
        <p className="muted">No % values to edit in this module.</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="builder-ancestor-editor">
      <h4>Edit Ancestor Values — {mod.name}</h4>
      <p className="muted" style={{ fontSize: "0.75rem", margin: "0.3rem 0" }}>
        Adjust the % values to match your in-game rolls.
      </p>
      {parts.map((p, i) => {
        const ctx = p.before.slice(-60).trim();
        return (
          <div key={i} className="builder-ancestor-row">
            <span className="builder-ancestor-label">{ctx || `Value ${i + 1}`}</span>
            <input
              type="number"
              step="0.1"
              value={values[i]}
              onChange={(e) => { const v = [...values]; v[i] = e.target.value; setValues(v); }}
              className="builder-ancestor-input"
            />
            <span>%</span>
          </div>
        );
      })}
      <div className="builder-ancestor-actions">
        <button type="button" onClick={save}>Apply</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Child: Inline reactor form ───────────────────────────────────────────────

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
              <option value="">Import from inventory…</option>
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

// ── Child: Stat sheet ────────────────────────────────────────────────────────

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

// ── Main panel ───────────────────────────────────────────────────────────────

export function BuildPlannerPanel({
  form, setForm, moduleCatalog, moduleById, weaponNexonType, descendantGameId,
  hero = null, reactor = null, onReactorChange, targetLevel, onTargetLevelChange, savedReactors,
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
  const libraryFiltered = useMemo(
    () => libraryBase.filter((m) => matchesModuleFilters(m, libSearch, libTier, libSocket)),
    [libraryBase, libSearch, libTier, libSocket],
  );
  const socketOptions = useMemo(() => {
    const s = new Set<string>();
    libraryBase.forEach((m) => { if (m.socket) s.add(m.socket); });
    return [...s].sort();
  }, [libraryBase]);

  // ── Stat computation (async) ─────────────────────────────────────────────

  const recomputeStats = useCallback(async () => {
    if (!form.targetKey) { setComputedStats(null); return; }
    try {
      if (form.targetType === "descendant" && descendantGameId) {
        const s = await computeDescendantStats(descendantGameId, level, slots, moduleById, reactor);
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
  }, [form.targetKey, form.targetType, descendantGameId, level, slots, moduleById, reactor]);

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

  // ── DnD handlers ─────────────────────────────────────────────────────────

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

  // ── Stat groups ──────────────────────────────────────────────────────────

  const statGroups = form.targetType === "weapon" ? WEAPON_STAT_GROUPS : DESCENDANT_STAT_GROUPS;

  // ── Render ───────────────────────────────────────────────────────────────

  if (!form.targetKey) {
    return <p className="muted builder-pick-first">Select a {form.targetType} above to open the build planner.</p>;
  }

  const heroSkills = hero?.skills ?? descSkills;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="builder-stage">
        {/* ── Hero with portrait background ──────────────────────────── */}
        <header className="builder-hero builder-hero-portrait">
          {hero?.imageUrl && (
            <img src={hero.imageUrl} alt="" className="builder-portrait-bg" aria-hidden="true" />
          )}
          <div className="builder-hero-content">
            <div className="builder-hero-text">
              <span className="builder-hero-kicker">
                {form.targetType === "weapon" ? "Weapon Build" : "Descendant Build"}
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
              <div className="builder-skills-row">
                {heroSkills.map((sk) => {
                  const full = descSkills.find((s) => s.name === sk.name);
                  const elementIcon = elementDefs.find((d) => d.label === (full?.element ?? ""))?.icon;
                  const archeIcon = skillDefs.find((d) => d.label === (full?.arche ?? ""))?.icon;
                  return (
                    <div
                      key={sk.name}
                      className={`builder-skill-icon${hoveredSkill === sk.name ? " skill-active" : ""}`}
                      onMouseEnter={() => setHoveredSkill(sk.name)}
                      onMouseLeave={() => setHoveredSkill(null)}
                    >
                      <img src={sk.image} alt={sk.name} />
                      {hoveredSkill === sk.name && full && (
                        <div className="skill-tooltip">
                          <div className="skill-tooltip-head">
                            <strong>{full.name}</strong>
                            <span className="skill-tooltip-type">{full.type}</span>
                          </div>
                          <div className="skill-tooltip-tags">
                            {elementIcon && <span className="skill-tooltip-tag"><img src={elementIcon} alt="" />{full.element}</span>}
                            {archeIcon && <span className="skill-tooltip-tag"><img src={archeIcon} alt="" />{full.arche}</span>}
                          </div>
                          {full.description && <p className="skill-tooltip-desc">{full.description}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* ── Three-column layout ────────────────────────────────────── */}
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
              </div>
              <StatSheet stats={computedStats} groups={statGroups} />
            </div>

            <div className="builder-stats-section">
              <h4 className="builder-stats-h">Estimated Modifiers</h4>
              {metrics.modifierRollup.length === 0 ? (
                <p className="muted">No % modifiers yet.</p>
              ) : (
                <table className="builder-mod-table">
                  <thead><tr><th>Category</th><th>Net Δ%</th></tr></thead>
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
                        <strong>{p.name} · Lv {p.level}</strong>
                        {spans.length > 0 && (
                          <div className="builder-effect-txt">
                            {spans.map((sp, si) => (
                              <span key={si} className={sp.negative ? "effect-neg" : "effect-pos"}>
                                {sp.text}{si < spans.length - 1 ? " " : ""}
                              </span>
                            ))}
                            <span className="effect-cap"> · {cap} cap</span>
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
                onSave={(cp) => saveAncestorPreview(editingSlot, cp)}
                onClose={() => setEditingSlot(null)}
              />
            )}

            <ReactorSection reactor={reactor} onChange={onReactorChange ?? (() => {})} savedReactors={savedReactors} />
          </section>

          {/* RIGHT: Module library */}
          <aside className="builder-col-right" aria-label="Module library">
            <div className="builder-lib-header">Module Library</div>
            <div className="builder-lib-filters">
              <input
                className="builder-lib-search"
                placeholder="Search name or effect…"
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
            <p className="muted builder-lib-foot">{libraryFiltered.length} shown · {libraryBase.length} available</p>
          </aside>
        </div>
      </div>

      {/* ── Drag overlay (no modifiers = follows grab point correctly) ── */}
      <DragOverlay dropAnimation={null} zIndex={10000}>
        {activeDrag ? (
          <div className={`mod-lib-card mod-lib-card-overlay ${activeDrag.tier === "Ultimate" ? "tier-ultimate" : activeDrag.tier === "Rare" ? "tier-rare" : "tier-norm"}`}>
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
