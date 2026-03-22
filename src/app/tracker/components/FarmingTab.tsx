"use client";

import { useRef } from "react";
import type { TrackerState, GoalEntry } from "../tracker-client";
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

export function FarmingTab({ state, setState }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const text = inputRef.current?.value.trim() ?? "";
    if (!text) return;
    const newGoal: GoalEntry = { id: uuid(), text, completed: false, active: true };
    setState((prev) => pushActivity({ ...prev, goals: [...prev.goals, newGoal] }, `Added farming goal: ${text}`));
    if (inputRef.current) inputRef.current.value = "";
  }

  function toggleFilter(key: "hideCompleted" | "onlyActive") {
    setState((prev) => ({
      ...prev,
      goalsFilters: { ...prev.goalsFilters, [key]: !prev.goalsFilters[key] },
    }));
  }

  function setGoalField(id: string, field: "active" | "completed", value: boolean) {
    setState((prev) => {
      const goals = prev.goals.map((g) => (g.id === id ? { ...g, [field]: value } : g));
      const goal = prev.goals.find((g) => g.id === id);
      const label = field === "active" ? `Set goal active: ${goal?.text}` : `Set goal complete: ${goal?.text}`;
      return pushActivity({ ...prev, goals }, label);
    });
  }

  function removeGoal(id: string) {
    setState((prev) => {
      const goal = prev.goals.find((g) => g.id === id);
      return pushActivity(
        { ...prev, goals: prev.goals.filter((g) => g.id !== id) },
        `Removed farming goal: ${goal?.text}`
      );
    });
  }

  const { hideCompleted, onlyActive } = state.goalsFilters;
  const visible = state.goals.filter((g) => {
    if (hideCompleted && g.completed) return false;
    if (onlyActive && !g.active) return false;
    return true;
  });

  return (
    <section className="panel">
      <h2>Farming Goals</h2>
      <p className="muted">Use toggles to focus your active grind and hide completed goals.</p>

      <form className="inline-form" onSubmit={addGoal}>
        <input ref={inputRef} maxLength={140} placeholder="Add farming goal..." required />
        <button type="submit">Add Goal</button>
      </form>

      <div className="filter-group" style={{ marginBottom: "0.75rem" }}>
        <button
          className={`filter-chip${hideCompleted ? " active" : ""}`}
          onClick={() => toggleFilter("hideCompleted")}
        >
          Hide Completed
        </button>
        <button
          className={`filter-chip${onlyActive ? " active" : ""}`}
          onClick={() => toggleFilter("onlyActive")}
        >
          Currently Farming Only
        </button>
      </div>

      <ul className="item-list">
        {visible.map((g) => (
          <li key={g.id} style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
            <span
              style={{
                fontSize: "0.9rem",
                textDecoration: g.completed ? "line-through" : "none",
                opacity: g.completed ? 0.55 : 1,
              }}
            >
              {g.text}
            </span>
            <div className="row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={g.active}
                  onChange={(e) => setGoalField(g.id, "active", e.target.checked)}
                />
                Farming
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={g.completed}
                  onChange={(e) => setGoalField(g.id, "completed", e.target.checked)}
                />
                Done
              </label>
              <button
                className="danger"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.76rem" }}
                onClick={() => removeGoal(g.id)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li>
            <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>No goals to show.</span>
          </li>
        )}
      </ul>
    </section>
  );
}
