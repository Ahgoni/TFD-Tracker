"use client";

import { useMemo, useState } from "react";
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
  WEAPON_TYPE_TO_NEXON,
  capacityAtLevel,
  filterModuleLibrary,
  matchesModuleFilters,
  maxCapacityForTarget,
  slotCountForTarget,
  totalPlacedCapacity,
} from "@/lib/tfd-modules";

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

function ModuleLibraryCard({ mod, disabled }: { mod: ModuleRecord; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableLibId(mod.id),
    disabled,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`mod-lib-card${isDragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
    >
      {mod.image ? <img src={mod.image} alt="" className="mod-lib-img" /> : <div className="mod-lib-img mod-lib-img-ph" />}
      <div className="mod-lib-body">
        <div className="mod-lib-card-top">
          <span className="mod-lib-cap">{capacityAtLevel(mod, 0)}</span>
          {mod.socket && <span className="mod-lib-socket" title={mod.socket}>{mod.socket}</span>}
        </div>
        <div className="mod-lib-name">{mod.name}</div>
        <div className="mod-lib-tier">{mod.tier}</div>
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
          {mod?.image || placed.image ? (
            <img src={mod?.image || placed.image} alt="" className="builder-slot-icon" />
          ) : (
            <div className="builder-slot-icon builder-slot-icon-ph" />
          )}
          <div className="builder-slot-title">{placed.name}</div>
          <div className="builder-slot-meta">
            <span>{placed.socket}</span>
            <span className="builder-slot-cap">{placed.capacity} cap</span>
          </div>
          <div className="builder-slot-lvl">
            <button type="button" onClick={() => onLevel(-1)} disabled={placed.level <= 0}>
              −
            </button>
            <span>Lv {placed.level}</span>
            <button type="button" onClick={() => onLevel(1)} disabled={placed.level >= 10}>
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
  setForm: React.Dispatch<React.SetStateAction<PlannerFormSlice>>;
  moduleCatalog: ModuleRecord[];
  moduleById: Map<string, ModuleRecord>;
  weaponNexonType: string | null;
  descendantGameId: string | null;
}

export function BuildPlannerPanel({
  form,
  setForm,
  moduleCatalog,
  moduleById,
  weaponNexonType,
  descendantGameId,
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
      <div className="builder-shell">
        <aside className="builder-col builder-col-left">
          <div className="builder-capacity-block">
            <div className="builder-cap-label">Capacity</div>
            <div className="builder-cap-numbers">
              <span className={total > maxCap ? "cap-bad" : "cap-ok"}>{total}</span>
              <span className="cap-sep">/</span>
              <span>{maxCap}</span>
            </div>
            <div className="builder-cap-bar">
              <div className="builder-cap-fill" style={{ width: `${Math.min(100, (total / maxCap) * 100)}%` }} />
            </div>
            <p className="builder-hint muted">
              Drag modules from the right into slots. Levels change capacity cost (Nexon data).
            </p>
          </div>
        </aside>

        <section className="builder-col builder-col-center" aria-label="Module slots">
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

        <aside className="builder-col builder-col-right">
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
              libraryFiltered.map((m) => (
                <ModuleLibraryCard key={m.id} mod={m} disabled={false} />
              ))
            )}
          </div>
          <p className="muted builder-lib-foot">{libraryFiltered.length} shown · {libraryBase.length} for this loadout type</p>
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="mod-lib-card mod-lib-card-overlay">
            {activeDrag.image ? <img src={activeDrag.image} alt="" className="mod-lib-img" /> : null}
            <div className="mod-lib-name">{activeDrag.name}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
