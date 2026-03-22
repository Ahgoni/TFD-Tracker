"use client";

import { useRef } from "react";
import type { TrackerState, MaterialEntry } from "../tracker-client";
import { uuid } from "@/lib/uuid";

interface Props {
  state: TrackerState;
  setState: React.Dispatch<React.SetStateAction<TrackerState>>;
}

function pushActivity(state: TrackerState, text: string): TrackerState {
  const activities = [
    { id: uuid(), text, at: new Date().toISOString() },
    ...(state.activities ?? []),
  ].slice(0, 30);
  return { ...state, activities };
}

export function MaterialsTab({ state, setState }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    const name = nameRef.current?.value.trim() ?? "";
    if (!name) return;
    const qty = Math.max(0, Number(qtyRef.current?.value ?? 0));
    const newItem: MaterialEntry = { id: uuid(), name, qty };
    setState((prev) => {
      const next = pushActivity({ ...prev, materials: [...prev.materials, newItem] }, `Added material: ${name}`);
      return next;
    });
    if (nameRef.current) nameRef.current.value = "";
    if (qtyRef.current) qtyRef.current.value = "0";
  }

  function adjustQty(id: string, delta: number) {
    setState((prev) => {
      const materials = prev.materials.map((m) => {
        if (m.id !== id) return m;
        const qty = Math.max(0, m.qty + delta);
        return { ...m, qty };
      });
      const item = prev.materials.find((m) => m.id === id);
      const newQty = Math.max(0, (item?.qty ?? 0) + delta);
      const label = delta > 0 ? "Increased" : "Decreased";
      return pushActivity({ ...prev, materials }, `${label} material: ${item?.name} (${newQty})`);
    });
  }

  function removeMaterial(id: string) {
    setState((prev) => {
      const item = prev.materials.find((m) => m.id === id);
      const materials = prev.materials.filter((m) => m.id !== id);
      return pushActivity({ ...prev, materials }, `Removed material: ${item?.name}`);
    });
  }

  return (
    <section className="panel">
      <h2>Materials Inventory</h2>
      <p className="muted">Track material counts with quick +/- controls.</p>

      <form className="inline-form" onSubmit={addMaterial}>
        <input ref={nameRef} maxLength={80} placeholder="Material name..." required />
        <input ref={qtyRef} type="number" min={0} defaultValue={0} style={{ width: 80 }} />
        <button type="submit">Add</button>
      </form>

      <div className="card-grid">
        {state.materials.map((item) => (
          <article className="card" key={item.id}>
            <div className="row">
              <strong style={{ fontSize: "0.88rem", wordBreak: "break-word" }}>{item.name}</strong>
              <button
                className="danger"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.76rem" }}
                onClick={() => removeMaterial(item.id)}
              >
                Remove
              </button>
            </div>
            <div className="row">
              <button className="mini-btn" onClick={() => adjustQty(item.id, -1)}>−</button>
              <span className="qty">{item.qty}</span>
              <button className="mini-btn" onClick={() => adjustQty(item.id, 1)}>+</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
