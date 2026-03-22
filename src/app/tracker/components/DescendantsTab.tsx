"use client";

import { useState } from "react";
import type { TrackerState, DescendantEntry } from "../tracker-client";
import {
  elementDefs,
  skillDefs,
  descendantMeta,
  descendantNamesForDropdown,
  portraitPath,
} from "@/lib/tracker-data";
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

const allNames = descendantNamesForDropdown();

export function DescendantsTab({ state, setState }: Props) {
  const [selectedName, setSelectedName] = useState("");
  const [level, setLevel] = useState(40);
  const [archeLevel, setArcheLevel] = useState(40);
  const [catalysts, setCatalysts] = useState(0);

  const meta = descendantMeta[selectedName];
  const elementLabel = meta ? (elementDefs.find((d) => d.id === meta.element)?.label ?? meta.element) : "";
  const skillLabel = meta ? meta.skills.map((s) => skillDefs.find((d) => d.id === s)?.label ?? s).join(" / ") : "";

  function addDescendant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedName || !descendantMeta[selectedName]) {
      alert("Select a valid descendant.");
      return;
    }
    const m = descendantMeta[selectedName];
    const entry: DescendantEntry = {
      id: uuid(),
      name: selectedName,
      element: m.element,
      skills: m.skills,
      level: Math.min(40, Math.max(1, level)),
      archeLevel: Math.min(40, Math.max(1, archeLevel)),
      catalysts: Math.min(20, Math.max(0, catalysts)),
      portrait: portraitPath(selectedName),
    };
    setState((prev) => pushActivity(
      { ...prev, descendants: [...prev.descendants, entry] },
      `Added descendant: ${selectedName}`
    ));
    setSelectedName(""); setLevel(40); setArcheLevel(40); setCatalysts(0);
  }

  function updateDescendant(id: string, field: "level" | "archeLevel" | "catalysts", value: number) {
    setState((prev) => {
      const descendants = prev.descendants.map((d) => {
        if (d.id !== id) return d;
        const clamped =
          field === "level" || field === "archeLevel"
            ? Math.min(40, Math.max(1, value))
            : Math.min(20, Math.max(0, value));
        return { ...d, [field]: clamped };
      });
      const d = prev.descendants.find((x) => x.id === id);
      return pushActivity({ ...prev, descendants }, `Updated descendant: ${d?.name} (${field})`);
    });
  }

  function removeDescendant(id: string) {
    setState((prev) => {
      const d = prev.descendants.find((x) => x.id === id);
      return pushActivity(
        { ...prev, descendants: prev.descendants.filter((x) => x.id !== id) },
        `Removed descendant: ${d?.name}`
      );
    });
  }

  function setDescFilter(id: string) {
    setState((prev) => ({ ...prev, descFilter: id }));
  }

  const visible = state.descendants.filter(
    (d) => state.descFilter === "all" || d.element === state.descFilter
  );

  return (
    <section className="panel">
      <h2>Descendant Progress</h2>
      <p className="muted">Track descendant build investment and progression.</p>

      <form className="form-grid" onSubmit={addDescendant}>
        <label>
          Descendant Name
          <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)} required>
            <option value="" disabled hidden>Select descendant</option>
            {allNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Element
          <input value={elementLabel} readOnly placeholder="Auto-filled" />
        </label>
        <label>
          Skill Types
          <input value={skillLabel} readOnly placeholder="Auto-filled" />
        </label>
        <label>
          Level
          <input type="number" min={1} max={40} value={level} onChange={(e) => setLevel(Number(e.target.value))} required />
        </label>
        <label>
          Arche Level
          <input type="number" min={1} max={40} value={archeLevel} onChange={(e) => setArcheLevel(Number(e.target.value))} required />
        </label>
        <label>
          # of Catalysts
          <input type="number" min={0} max={20} value={catalysts} onChange={(e) => setCatalysts(Number(e.target.value))} required />
        </label>
        <button type="submit" style={{ alignSelf: "end" }}>Add Descendant</button>
      </form>

      <div className="filter-group" style={{ marginBottom: "0.75rem" }}>
        {elementDefs.map((def) => (
          <button
            key={def.id}
            className={`filter-chip${state.descFilter === def.id ? " active" : ""}`}
            onClick={() => setDescFilter(def.id)}
          >
            {def.icon && <img src={def.icon} alt={def.label} />}
            {def.label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Descendant</th>
              <th>Element</th>
              <th>Skill Types</th>
              <th>Level</th>
              <th>Arche</th>
              <th>Catalysts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => {
              const elemDef = elementDefs.find((x) => x.id === d.element);
              const initials = d.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
              return (
                <tr key={d.id}>
                  <td>
                    <span className="desc-cell">
                      <img
                        src={d.portrait}
                        alt={d.name}
                        className="portrait"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = "none";
                          const fallback = img.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "";
                        }}
                      />
                      <span className="portrait portrait-initials" style={{ display: "none" }}>{initials}</span>
                      {d.name}
                    </span>
                  </td>
                  <td>
                    <span className="badge">
                      {elemDef?.icon && <img src={elemDef.icon} alt={elemDef.label} />}
                      {elemDef?.label ?? d.element}
                    </span>
                  </td>
                  <td>
                    <span className="skill-badges">
                      {(Array.isArray(d.skills) ? d.skills : []).map((s) => {
                        const sd = skillDefs.find((x) => x.id === s);
                        return (
                          <span key={s} className="skill-chip">
                            {sd?.icon && <img src={sd.icon} alt={sd.label} />}
                            {sd?.label ?? s}
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  <td>
                    <input
                      className="inline-edit"
                      type="number" min={1} max={40} value={d.level}
                      onChange={(e) => updateDescendant(d.id, "level", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-edit"
                      type="number" min={1} max={40} value={d.archeLevel}
                      onChange={(e) => updateDescendant(d.id, "archeLevel", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      className="inline-edit"
                      type="number" min={0} max={20} value={d.catalysts}
                      onChange={(e) => updateDescendant(d.id, "catalysts", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <button
                      className="danger"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                      onClick={() => removeDescendant(d.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "1rem" }}>No descendants added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
