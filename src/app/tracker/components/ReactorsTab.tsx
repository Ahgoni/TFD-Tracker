"use client";

import { useState } from "react";
import type { TrackerState, ReactorEntry } from "../tracker-client";
import {
  elementDefs,
  skillDefs,
  substatOptions,
  descendantOptions,
  getReactorName,
  inferTierFromValue,
  tierColors,
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

const descendantNames = descendantOptions.flatMap((o) =>
  o.split("/").map((n) => n.trim())
).sort((a, b) => a.localeCompare(b));

const ENHANCEMENTS = ["0", "1", "2", "3", "4", "5", "Max"] as const;

export function ReactorsTab({ state, setState }: Props) {
  const [element, setElement] = useState("fire");
  const [skillType, setSkillType] = useState("fusion");
  const [descendant, setDescendant] = useState("");
  const [level, setLevel] = useState(100);
  const [enhancement, setEnhancement] = useState("0");
  const [substat1, setSubstat1] = useState("");
  const [subvalue1, setSubvalue1] = useState("");
  const [substat2, setSubstat2] = useState("");
  const [subvalue2, setSubvalue2] = useState("");
  const [notes, setNotes] = useState("");

  const autoName = getReactorName(element, skillType);

  function addReactor(e: React.FormEvent) {
    e.preventDefault();
    if (!descendant) { alert("Descendant is required."); return; }
    if (!enhancement) { alert("Enhancement is required."); return; }
    if (!substat1 || !subvalue1 || !substat2 || !subvalue2) {
      alert("All reactor fields are required, including both substats and values.");
      return;
    }

    const entry: ReactorEntry = {
      id: uuid(),
      name: autoName,
      element,
      skillType,
      descendant,
      level: Math.min(200, Math.max(1, level)),
      enhancement,
      substats: [
        { stat: substat1, value: subvalue1, tier: inferTierFromValue(substat1, subvalue1) },
        { stat: substat2, value: subvalue2, tier: inferTierFromValue(substat2, subvalue2) },
      ].filter((s) => s.stat),
      notes,
    };

    setState((prev) => pushActivity(
      { ...prev, reactors: [...prev.reactors, entry] },
      `Added reactor: ${autoName}`
    ));

    setDescendant(""); setLevel(100); setEnhancement("0");
    setSubstat1(""); setSubvalue1(""); setSubstat2(""); setSubvalue2(""); setNotes("");
  }

  function removeReactor(id: string) {
    setState((prev) => {
      const r = prev.reactors.find((x) => x.id === id);
      return pushActivity(
        { ...prev, reactors: prev.reactors.filter((x) => x.id !== id) },
        `Removed reactor: ${r?.name}`
      );
    });
  }

  function setElementFilter(id: string) {
    setState((prev) => ({ ...prev, filters: { ...prev.filters, element: id } }));
  }
  function setSkillFilter(id: string) {
    setState((prev) => ({ ...prev, filters: { ...prev.filters, skill: id } }));
  }

  const visible = state.reactors.filter((r) => {
    const ep = state.filters.element === "all" || r.element === state.filters.element;
    const sp = state.filters.skill === "all" || r.skillType === state.filters.skill;
    return ep && sp;
  });

  return (
    <section className="panel">
      <h2>Reactor Inventory</h2>

      <form className="form-grid" onSubmit={addReactor}>
        <label>
          Reactor Name
          <input value={autoName} readOnly className="autofill-display" />
        </label>

        <div className="chip-field">
          <span className="chip-field-label">Element</span>
          <div className="chip-field-row">
            {elementDefs.filter((d) => d.id !== "all").map((d) => (
              <button
                type="button"
                key={d.id}
                className={`filter-chip${element === d.id ? " active" : ""}`}
                onClick={() => setElement(d.id)}
              >
                {d.icon && <img src={d.icon} alt={d.label} />}
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="chip-field chip-field-wide">
          <span className="chip-field-label">Skill Type</span>
          <div className="chip-field-row">
            {skillDefs.filter((d) => d.id !== "all").map((d) => (
              <button
                type="button"
                key={d.id}
                className={`filter-chip${skillType === d.id ? " active" : ""}`}
                onClick={() => setSkillType(d.id)}
              >
                {d.icon && <img src={d.icon} alt={d.label} />}
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label>
          Descendant
          <select value={descendant} onChange={(e) => setDescendant(e.target.value)} required>
            <option value="" disabled hidden>Select descendant</option>
            {descendantNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Level
          <input type="number" min={1} max={200} value={level} onChange={(e) => setLevel(Number(e.target.value))} required />
        </label>
        <label>
          Enhancement
          <select value={enhancement} onChange={(e) => setEnhancement(e.target.value)} required>
            <option value="" disabled hidden>Select enhancement</option>
            {ENHANCEMENTS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          Substat 1
          <select value={substat1} onChange={(e) => setSubstat1(e.target.value)} required>
            <option value="">None</option>
            {substatOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Value 1
          <input value={subvalue1} onChange={(e) => setSubvalue1(e.target.value)} maxLength={20} placeholder="e.g. 0.084x" required />
        </label>
        <label>
          Substat 2
          <select value={substat2} onChange={(e) => setSubstat2(e.target.value)} required>
            <option value="">None</option>
            {substatOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Value 2
          <input value={subvalue2} onChange={(e) => setSubvalue2(e.target.value)} maxLength={20} placeholder="e.g. +12%" required />
        </label>
        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={120} placeholder="Optional note..." />
        </label>
        <button type="submit" style={{ alignSelf: "end" }}>Add Reactor</button>
      </form>

      <div className="filters" style={{ marginBottom: "0.75rem" }}>
        <div className="filter-group">
          {elementDefs.map((def) => (
            <button
              key={def.id}
              className={`filter-chip${state.filters.element === def.id ? " active" : ""}`}
              onClick={() => setElementFilter(def.id)}
            >
              {def.icon && <img src={def.icon} alt={def.label} />}
              {def.label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {skillDefs.map((def) => (
            <button
              key={def.id}
              className={`filter-chip${state.filters.skill === def.id ? " active" : ""}`}
              onClick={() => setSkillFilter(def.id)}
            >
              {def.icon && <img src={def.icon} alt={def.label} />}
              {def.label}
            </button>
          ))}
        </div>
        <div className="tier-key-wrap">
          <span className="tier-key-title">Substat Tier Colors</span>
          <div className="tier-key">
            <span className="tier-pill tier-ultimate">Ultimate</span>
            <span className="tier-pill tier-rare">Rare</span>
            <span className="tier-pill tier-common">Common</span>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Element</th>
              <th>Skill Type</th>
              <th>Descendant</th>
              <th>Level</th>
              <th>Enh.</th>
              <th>Substats</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const elemDef = elementDefs.find((d) => d.id === r.element);
              const skillDef = skillDefs.find((d) => d.id === r.skillType);
              return (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <span className="badge">
                      {elemDef?.icon && <img src={elemDef.icon} alt={elemDef.label} />}
                      {elemDef?.label ?? r.element}
                    </span>
                  </td>
                  <td>
                    <span className="badge">
                      {skillDef?.icon && <img src={skillDef.icon} alt={skillDef.label} />}
                      {skillDef?.label ?? r.skillType}
                    </span>
                  </td>
                  <td>{r.descendant || "-"}</td>
                  <td>{r.level}</td>
                  <td>{r.enhancement}</td>
                  <td>
                    {(r.substats ?? []).map((s, i) => (
                      <div key={i} style={{ color: tierColors[s.tier] ?? tierColors.common, fontSize: "0.82rem" }}>
                        {s.stat} ({s.value})
                      </div>
                    ))}
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{r.notes || "-"}</td>
                  <td>
                    <button
                      className="danger"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                      onClick={() => removeReactor(r.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>
                  No reactors added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
