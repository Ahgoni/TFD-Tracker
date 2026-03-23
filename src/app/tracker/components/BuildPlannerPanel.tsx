"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
import type { PlacedModule } from "../tracker-client";
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
} from "@/lib/build-planner-stats";

function truncatePreview(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const LIB_PREFIX = "lib:";
const SLOT_PREFIX = "slot:";

function draggableLibId(moduleId: string) {
  return `${LIB_PREFIX}${moduleId}`;
}
function droppableSlotId(index: number) {
  return `${SLOT_PREFIX}${index}`;
}

function parseDragId(id: string | number): { kind: "lib"; moduleId: string } | { kind: "slot"; index: number } | null {
  const s = String(id);
  if (s.startsWith(LIB_PREFIX)) return { kind: "lib", moduleId: s.slice(LIB_PREFIX.length) };
  if (s.startsWith(SLOT_PREFIX)) return { kind: "slot", index: parseInt(s.slice(SLOT_PREFIX.length), 10) };
  return null;
}

export interface PlannerHeroProps {
  imageUrl: string;
  title: string;
  subtitle: string;
  badges: { label: string; tone?: "default" | "accent" | "warn" }[];
  metaLine?: string;
}

function ModuleLibraryCard({ mod, disabled }: { mod: ModuleRecord; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableLibId(mod.id),
    disabled,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const tierClass =
    mod.tier === "Ultimate" ? "tier-ult" : mod.tier === "Rare" ? "tier-rare" : "tier-norm";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`mod-lib-card ${tierClass}${isDragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
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
          <span className="mod-lib-class">{mod.moduleClass}</span>
        </div>
        {mod.preview && <p className="mod-lib-preview">{mod.preview}</p>}
      </div>
    </div>
  );
}

function SlotDrop({
  index,
  placed,
  moduleById,
  onClear,
  onLevel,
}: {
  index: number;
  placed: PlacedModule | null | undefined;
  moduleById: Map<string, ModuleRecord>;
  onClear: () => void;
  onLevel: (delta: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableSlotId(index) });
  const mod = placed ? moduleById.get(placed.moduleId) : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`builder-slot${isOver ? " slot-over" : ""}${placed ? " slot-filled" : ""}`}
    >
      <span className="builder-slot-idx">{index + 1}</span>
      {!placed ? (
        <div className="builder-slot-empty">
          <span className="builder-slot-chip">Drop module</span>
        </div>
      ) : (
        <div className="builder-slot-filled">
          <button type="button" className="builder-slot-x" onClick={onClear} aria-label="Remove module">
            ×
          </button>
          <div className="builder-slot-body">
            {mod?.image || placed.image ? (
              <img src={mod?.image || placed.image} alt="" className="builder-slot-icon" />
            ) : (
              <div className="builder-slot-icon builder-slot-icon-ph" />
            )}
            <div className="builder-slot-title" title={placed.name}>
              {placed.name}
            </div>
            <div className="builder-slot-meta">
              <span className="builder-slot-socket">{placed.socket}</span>
              <span className="builder-slot-cap">{placed.capacity} cap</span>
            </div>
            {mod?.preview && (
              <p
                className="builder-slot-preview"
                title={scalePreviewPercentagesForLevel(mod, placed.level)}
              >
                {truncatePreview(scalePreviewPercentagesForLevel(mod, placed.level), 96)}
              </p>
            )}
          </div>
          <div className="builder-slot-lvl" role="group" aria-label="Module level">
            <button
              type="button"
              className="builder-lvl-btn"
              onClick={() => onLevel(-1)}
              disabled={placed.level <= 0}
            >
              −
            </button>
            <span className="builder-lvl-num">Lv {placed.level}</span>
            <button
              type="button"
              className="builder-lvl-btn"
              onClick={() => onLevel(1)}
              disabled={placed.level >= 10}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
  /** Portrait + badges from tracker (Descendants / Weapons tab). */
  hero?: PlannerHeroProps | null;
}

export function BuildPlannerPanel({
  form,
  setForm,
  moduleCatalog,
  moduleById,
  weaponNexonType,
  descendantGameId,
  hero = null,
}: Props) {
  const [activeDrag, setActiveDrag] = useState<ModuleRecord | null>(null);
  const [libSearch, setLibSearch] = useState("");
  const [libTier, setLibTier] = useState("all");
  const [libSocket, setLibSocket] = useState("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const maxCap = maxCapacityForTarget(form.targetType);
  const nSlots = slotCountForTarget(form.targetType);

  const slots = useMemo(() => {
    const arr = [...(form.plannerSlots ?? [])];
    while (arr.length < nSlots) arr.push(null);
    return arr.slice(0, nSlots);
  }, [form.plannerSlots, nSlots]);

  const metrics = useMemo(
    () => computePlannerMetrics(slots, moduleById, maxCap),
    [slots, moduleById, maxCap]
  );

  const libraryBase = useMemo(
    () =>
      filterModuleLibrary(moduleCatalog, form.targetType, {
        weaponNexonType,
        descendantId: descendantGameId,
      }),
    [moduleCatalog, form.targetType, weaponNexonType, descendantGameId]
  );

  const libraryFiltered = useMemo(
    () => libraryBase.filter((m) => matchesModuleFilters(m, libSearch, libTier, libSocket)),
    [libraryBase, libSearch, libTier, libSocket]
  );

  const sockets = useMemo(() => {
    const s = new Set<string>();
    libraryBase.forEach((m) => {
      if (m.socket) s.add(m.socket);
    });
    return [...s].sort();
  }, [libraryBase]);

  const total = useMemo(
    () =>
      totalPlacedCapacity(
        slots.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)),
        moduleById
      ),
    [slots, moduleById]
  );

  function setSlot(index: number, next: PlacedModule | null) {
    setForm((f) => {
      const row = [...(f.plannerSlots ?? [])];
      while (row.length < nSlots) row.push(null);
      const prev = row[index];
      const prevCost =
        prev && moduleById.get(prev.moduleId)
          ? capacityAtLevel(moduleById.get(prev.moduleId)!, prev.level)
          : 0;
      const nextCost =
        next && moduleById.get(next.moduleId)
          ? capacityAtLevel(moduleById.get(next.moduleId)!, next.level)
          : 0;
      const oldTotal = totalPlacedCapacity(
        row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)),
        moduleById
      );
      const newTotal = oldTotal - prevCost + nextCost;
      if (newTotal > maxCap) {
        return f;
      }
      row[index] = next;
      return { ...f, plannerSlots: row };
    });
  }

  function handleDragStart(e: DragStartEvent) {
    const p = parseDragId(e.active.id);
    if (p?.kind === "lib") {
      setActiveDrag(moduleById.get(p.moduleId) ?? null);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const a = parseDragId(active.id);
    const o = parseDragId(over.id);
    if (!a || !o) return;

    if (a.kind === "lib" && o.kind === "slot") {
      const mod = moduleById.get(a.moduleId);
      if (!mod) return;
      const idx = o.index;
      const level = 0;
      const cap = capacityAtLevel(mod, level);
      const row = [...slots];
      const prev = row[idx];
      const prevCost =
        prev && moduleById.get(prev.moduleId)
          ? capacityAtLevel(moduleById.get(prev.moduleId)!, prev.level)
          : 0;
      const oldTotal = totalPlacedCapacity(
        row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)),
        moduleById
      );
      if (oldTotal - prevCost + cap > maxCap) {
        window.alert(`Over capacity (max ${maxCap}). Remove a module or lower levels.`);
        return;
      }
      const placed: PlacedModule = {
        moduleId: mod.id,
        level,
        name: mod.name,
        image: mod.image,
        capacity: cap,
        socket: mod.socket,
        tier: mod.tier,
      };
      setForm((f) => {
        const next = [...(f.plannerSlots ?? [])];
        while (next.length < nSlots) next.push(null);
        next[idx] = placed;
        return { ...f, plannerSlots: next };
      });
    }
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
      const oldTotal = totalPlacedCapacity(
        row.map((s) => (s ? { moduleId: s.moduleId, level: s.level } : null)),
        moduleById
      );
      if (oldTotal - oldCap + newCap > maxCap) {
        return f;
      }
      row[slotIndex] = {
        ...cur,
        level: nextLv,
        capacity: newCap,
      };
      return { ...f, plannerSlots: row };
    });
  }

  if (!form.targetKey) {
    return (
      <p className="muted builder-pick-first">Select a {form.targetType} above to open the module library and slots.</p>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="builder-stage">
        {hero && (
          <header className="builder-hero">
            <div className="builder-hero-portrait-wrap">
              {hero.imageUrl ? (
                <img src={hero.imageUrl} alt="" className="builder-hero-portrait" />
              ) : (
                <div className="builder-hero-portrait builder-hero-portrait-ph" aria-hidden />
              )}
            </div>
            <div className="builder-hero-text">
              <span className="builder-hero-kicker">{form.targetType === "weapon" ? "Weapon loadout" : "Descendant loadout"}</span>
              <h3 className="builder-hero-title">{hero.title}</h3>
              <p className="builder-hero-sub">{hero.subtitle}</p>
              <div className="builder-hero-badges">
                {hero.badges.map((b) => (
                  <span key={b.label} className={`hero-badge hero-badge-${b.tone ?? "default"}`}>
                    {b.label}
                  </span>
                ))}
              </div>
              {hero.metaLine && <p className="builder-hero-meta muted">{hero.metaLine}</p>}
            </div>
          </header>
        )}

        <div className="builder-main">
          <aside className="builder-stats-panel" aria-label="Build statistics">
            <div className="builder-stats-section">
              <h4 className="builder-stats-h">Capacity</h4>
              <div className="builder-cap-numbers builder-cap-numbers-lg">
                <span className={total > maxCap ? "cap-bad" : "cap-ok"}>{total}</span>
                <span className="cap-sep">/</span>
                <span>{maxCap}</span>
              </div>
              <div className="builder-cap-bar">
                <div className="builder-cap-fill" style={{ width: `${Math.min(100, (total / maxCap) * 100)}%` }} />
              </div>
              <p className="builder-hint muted">Module capacity cost scales with level (official Nexon values).</p>
            </div>

            <div className="builder-stats-section">
              <h4 className="builder-stats-h">Loadout summary</h4>
              <dl className="builder-stat-dl">
                <div>
                  <dt>Modules equipped</dt>
                  <dd>
                    {metrics.equippedCount} / {metrics.slotsTotal}{" "}
                    <span className="muted">({metrics.fillPercent}%)</span>
                  </dd>
                </div>
                <div>
                  <dt>Avg. module level</dt>
                  <dd>{metrics.equippedCount ? metrics.avgModuleLevel : "—"}</dd>
                </div>
                <div>
                  <dt>Power budget</dt>
                  <dd>{metrics.totalCapacity} cap used</dd>
                </div>
                <div>
                  <dt>Tier mix</dt>
                  <dd className="builder-tier-mix">
                    {Object.keys(metrics.tierCounts).length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      Object.entries(metrics.tierCounts).map(([t, n]) => (
                        <span key={t} className="tier-pill">
                          {t} ×{n}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
                {metrics.socketsUsed.length > 0 && (
                  <div>
                    <dt>Sockets</dt>
                    <dd className="builder-socket-line">{metrics.socketsUsed.join(" · ")}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="builder-stats-section">
              <h4 className="builder-stats-h">Estimated stat modifiers</h4>
              <p className="builder-disclaimer muted" style={{ marginTop: 0 }}>
                % values from each module&apos;s official preview, scaled by{" "}
                <strong>capacity ratio</strong> (Lv → Lv0 cost). Same category sums are additive — conditional / proc text is still parsed as static numbers for comparison only.
              </p>
              {metrics.modifierRollup.length === 0 ? (
                <p className="muted">No % modifiers detected in equipped previews.</p>
              ) : (
                <table className="builder-mod-table">
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Net Δ%</th>
                      <th scope="col">Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.modifierRollup.map((row) => (
                      <tr key={row.bucket}>
                        <td>{row.bucket}</td>
                        <td className={row.netPercent > 0 ? "mod-pos" : row.netPercent < 0 ? "mod-neg" : ""}>
                          {row.netPercent > 0 ? "+" : ""}
                          {row.netPercent}%
                        </td>
                        <td className="muted">{row.hits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {metrics.capacityRatios.length > 0 && (
                <details className="builder-details">
                  <summary>Per-module capacity scaling</summary>
                  <ul className="builder-ratio-list">
                    {metrics.capacityRatios.map((r) => (
                      <li key={r.name}>
                        <strong>{r.name}</strong> · Lv {r.level} → ×{r.ratio}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {metrics.valueTokens.length > 0 && (
              <div className="builder-stats-section">
                <h4 className="builder-stats-h">Raw % tokens (preview text)</h4>
                <div className="builder-token-row">
                  {metrics.valueTokens.map((t) => (
                    <span key={t} className="builder-token">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="builder-stats-section builder-effects-section">
              <h4 className="builder-stats-h">Module effects (preview)</h4>
              {slots.filter(Boolean).length === 0 ? (
                <p className="muted">Equip modules to see effect lines.</p>
              ) : (
                <ul className="builder-effect-list">
                  {slots.map((p, i) => {
                    if (!p) return null;
                    const m = moduleById.get(p.moduleId);
                    const line = effectSummaryLine(m, p.level);
                    return (
                      <li key={`${p.moduleId}-${i}`}>
                        <strong>
                          {p.name} · Lv {p.level}
                        </strong>
                        {line && <p className="builder-effect-txt">{line}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="builder-slots-wrap" aria-label="Module slots">
            <div className="builder-slots-head">
              <span>Module grid</span>
              <span className="muted">{form.targetType === "weapon" ? "10 slots" : "12 slots"}</span>
            </div>
            <div className={`builder-slots-grid builder-slots-${form.targetType}`}>
              {slots.map((placed, index) => (
                <SlotDrop
                  key={index}
                  index={index}
                  placed={placed}
                  moduleById={moduleById}
                  onClear={() => setSlot(index, null)}
                  onLevel={(d) => changeLevel(index, d)}
                />
              ))}
            </div>
          </section>

          <aside className="builder-col-right" aria-label="Module library">
            <div className="builder-lib-header">Module library</div>
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
                    {sockets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="builder-lib-scroll">
              {libraryFiltered.length === 0 ? (
                <p className="muted" style={{ padding: "0.5rem" }}>
                  No modules match. Adjust filters — only modules valid for this {form.targetType} are listed.
                </p>
              ) : (
                libraryFiltered.map((m) => <ModuleLibraryCard key={m.id} mod={m} disabled={false} />)
              )}
            </div>
            <p className="muted builder-lib-foot">{libraryFiltered.length} shown · {libraryBase.length} for this loadout type</p>
          </aside>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="mod-lib-card mod-lib-card-overlay tier-ult">
            {activeDrag.image ? <img src={activeDrag.image} alt="" className="mod-lib-img" /> : null}
            <div className="mod-lib-name">{activeDrag.name}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
