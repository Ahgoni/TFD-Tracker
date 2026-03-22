"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { TrackerState, BuildEntry } from "../tracker-client";
import { uuid } from "@/lib/uuid";

interface Props {
  state: TrackerState;
  setState: React.Dispatch<React.SetStateAction<TrackerState>>;
}

const EMPTY_SLOTS = () => Array.from({ length: 8 }, () => "");

function pushActivity(state: TrackerState, text: string): TrackerState {
  return {
    ...state,
    activities: [{ id: uuid(), text, at: new Date().toISOString() }, ...(state.activities ?? [])].slice(0, 30),
  };
}

export function BuildsTab({ state, setState }: Props) {
  const { data: session } = useSession();
  const username = session?.user && "username" in session.user ? (session.user as { username?: string | null }).username : null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    targetType: "descendant" | "weapon";
    targetKey: string;
    moduleSlots: string[];
    reactorNotes: string;
    notes: string;
  }>({
    name: "",
    targetType: "descendant",
    targetKey: "",
    moduleSlots: EMPTY_SLOTS(),
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
      moduleSlots: EMPTY_SLOTS(),
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
    const moduleSlots = form.moduleSlots.map((s) => s.trim());

    if (editingId) {
      setState((prev) =>
        pushActivity(
          {
            ...prev,
            builds: (prev.builds ?? []).map((b) =>
              b.id === editingId
                ? {
                    ...b,
                    name: form.name.trim(),
                    targetType: form.targetType,
                    targetKey: form.targetKey,
                    displayName: resolved.displayName,
                    imageUrl: resolved.imageUrl,
                    moduleSlots,
                    reactorNotes: form.reactorNotes.trim(),
                    notes: form.notes.trim(),
                    updatedAt: now,
                  }
                : b
            ),
          },
          `Updated build: ${form.name.trim()}`
        )
      );
    } else {
      const entry: BuildEntry = {
        id: uuid(),
        name: form.name.trim(),
        targetType: form.targetType,
        targetKey: form.targetKey,
        displayName: resolved.displayName,
        imageUrl: resolved.imageUrl,
        moduleSlots,
        reactorNotes: form.reactorNotes.trim(),
        notes: form.notes.trim(),
        updatedAt: now,
      };
      setState((prev) => pushActivity({ ...prev, builds: [...(prev.builds ?? []), entry] }, `Created build: ${entry.name}`));
    }
    resetForm();
  }

  function startEdit(b: BuildEntry) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      targetType: b.targetType,
      targetKey: b.targetKey,
      moduleSlots: [...(b.moduleSlots ?? []), ...Array(8)].slice(0, 8).map((x) => (typeof x === "string" ? x : "")),
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

  const slotLabels =
    form.targetType === "weapon"
      ? ["Aftermarket", "Module 1", "Module 2", "Module 3", "Module 4", "Module 5", "Module 6", "Module 7"]
      : ["Module 1", "Module 2", "Module 3", "Module 4", "Module 5", "Module 6", "Module 7", "Module 8"];

  return (
    <div className="builds-page">
      <section className="panel">
        <h2>
          Build planner
          <span className="panel-count">{(state.builds ?? []).length} saved</span>
        </h2>
        <p className="muted">
          Save loadouts for descendants or weapons. Friends can view them on your public profile when sharing is enabled (same as inventory).
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
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetType: e.target.value as "descendant" | "weapon",
                    targetKey: "",
                  }))
                }
              >
                <option value="descendant">Descendant</option>
                <option value="weapon">Weapon</option>
              </select>
            </label>
            <label>
              {form.targetType === "descendant" ? "Descendant" : "Weapon"}
              <select
                value={form.targetKey}
                onChange={(e) => setForm((f) => ({ ...f, targetKey: e.target.value }))}
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

          <p className="builds-slot-heading">Modules &amp; components</p>
          <div className="builds-slots-grid">
            {slotLabels.map((label, i) => (
              <label key={label + i}>
                {label}
                <input
                  value={form.moduleSlots[i] ?? ""}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.moduleSlots];
                      next[i] = e.target.value;
                      return { ...f, moduleSlots: next };
                    })
                  }
                  placeholder="—"
                />
              </label>
            ))}
          </div>

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
                {b.reactorNotes && (
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
