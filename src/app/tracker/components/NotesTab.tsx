"use client";

import { useRef } from "react";
import type { TrackerState } from "../tracker-client";
import { uuid } from "@/lib/uuid";

interface Props {
  tabName: string;
  state: TrackerState;
  setState: React.Dispatch<React.SetStateAction<TrackerState>>;
}

export function NotesTab({ tabName, state, setState }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const items = state.notesTabs[tabName] ?? [];

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    const text = inputRef.current?.value.trim() ?? "";
    if (!text) return;
    setState((prev) => ({
      ...prev,
      notesTabs: {
        ...prev.notesTabs,
        [tabName]: [...(prev.notesTabs[tabName] ?? []), { id: uuid(), text }],
      },
    }));
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeNote(id: string) {
    setState((prev) => ({
      ...prev,
      notesTabs: {
        ...prev.notesTabs,
        [tabName]: (prev.notesTabs[tabName] ?? []).filter((n) => n.id !== id),
      },
    }));
  }

  return (
    <section className="panel">
      <h2>{tabName}</h2>
      <p className="muted">Simple notes/checklist for this section.</p>

      <form className="inline-form" onSubmit={addNote}>
        <input ref={inputRef} maxLength={140} placeholder="Add an item..." required />
        <button type="submit">Add</button>
      </form>

      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id}>
            <span style={{ fontSize: "0.88rem" }}>{item.text}</span>
            <button
              className="danger"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.76rem" }}
              onClick={() => removeNote(item.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li>
            <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>No items yet.</span>
          </li>
        )}
      </ul>
    </section>
  );
}
