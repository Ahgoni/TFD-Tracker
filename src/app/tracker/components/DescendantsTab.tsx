"use client";

import type { TrackerState, DescendantEntry } from "../tracker-client";
import { elementDefs, skillDefs } from "@/lib/tracker-data";
import { uuid } from "@/lib/uuid";

const ELEMENT_COLOR_CLASS: Record<string, string> = {
  fire: "element-fire",
  chill: "element-chill",
  electric: "element-electric",
  toxic: "element-toxic",
  nonattribute: "element-nonattr",
};

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

export function DescendantsTab({ state, setState }: Props) {
  const filters = state.descFilters ?? { search: "", element: "all", ownership: "all" };

  function setFilter(key: string, value: string) {
    setState((prev) => ({
      ...prev,
      descFilters: { ...prev.descFilters, [key]: value },
    }));
  }

  function resetFilters() {
    setState((prev) => ({
      ...prev,
      descFilters: { search: "", element: "all", ownership: "all" },
    }));
  }

  function toggleOwnership(mode: "owned" | "unowned") {
    setState((prev) => ({
      ...prev,
      descFilters: {
        ...prev.descFilters,
        ownership: prev.descFilters.ownership === mode ? "all" : mode,
      },
    }));
  }

  function toggleOwned(name: string) {
    setState((prev) => {
      const descendants = prev.descendants.map((d) => {
        if (d.name !== name) return d;
        return { ...d, owned: !d.owned };
      });
      const d = prev.descendants.find((x) => x.name === name);
      const wasOwned = d?.owned ?? false;
      return pushActivity({ ...prev, descendants }, `${wasOwned ? "Removed" : "Added"} descendant: ${name}`);
    });
  }

  function updateField(name: string, field: "level" | "archeLevel" | "catalysts", value: number) {
    setState((prev) => {
      const descendants = prev.descendants.map((d) => {
        if (d.name !== name) return d;
        const clamped = field === "catalysts"
          ? Math.min(20, Math.max(0, value))
          : Math.min(40, Math.max(1, value));
        return { ...d, [field]: clamped };
      });
      return { ...prev, descendants };
    });
  }

  const { search, element, ownership } = filters;

  const filtered = (state.descendants ?? [])
    .filter((d) => {
      const q = (search ?? "").trim().toLowerCase();
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (element !== "all" && d.element !== element) return false;
      if (ownership === "owned" && !d.owned) return false;
      if (ownership === "unowned" && d.owned) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.owned !== b.owned) return a.owned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const ownedCount = (state.descendants ?? []).filter((d) => d.owned).length;
  const totalCount = (state.descendants ?? []).length;

  return (
    <section className="panel">
      <h2>
        Descendants
        <span className="panel-count">{ownedCount}/{totalCount} owned</span>
      </h2>
      <p className="muted">Toggle owned, track level, arche level, and catalyst investment.</p>

      <div className="tracker-filters">
        <span className="filter-row-title">Filters</span>
        <div className="filter-group">
          <input
            value={search ?? ""}
            placeholder="Search descendant..."
            style={{ width: 180 }}
            onChange={(e) => setFilter("search", e.target.value)}
            aria-label="Search descendants"
          />
          <button className="filter-chip" onClick={resetFilters}>Reset Filters</button>
        </div>

        <span className="filter-row-title">Elements</span>
        <div className="filter-group">
          {elementDefs.map((def) => (
            <button
              key={def.id}
              className={`filter-chip${element === def.id ? " active" : ""}`}
              onClick={() => setFilter("element", def.id === element ? "all" : def.id)}
            >
              {def.icon && <img src={def.icon} alt={def.label} />}
              {def.label}
            </button>
          ))}
        </div>

        <span className="filter-row-title">Owned Status</span>
        <div className="filter-group ownership-filter-group">
          <button
            className={`filter-chip${ownership === "owned" ? " active" : ""}`}
            onClick={() => toggleOwnership("owned")}
          >
            Owned ({ownedCount})
          </button>
          <button
            className={`filter-chip${ownership === "unowned" ? " active" : ""}`}
            onClick={() => toggleOwnership("unowned")}
          >
            Unowned ({totalCount - ownedCount})
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="descendants-table">
          <thead>
            <tr>
              <th>Owned</th>
              <th>Descendant</th>
              <th>Element</th>
              <th>Skill Types</th>
              <th>Level</th>
              <th>Arche</th>
              <th>Catalysts</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const elemDef = elementDefs.find((x) => x.id === d.element);
              return (
                <tr key={d.name} className={`${d.owned ? "" : "row-unowned"} ${ELEMENT_COLOR_CLASS[d.element] ?? ""}`}>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={d.owned}
                      onChange={() => toggleOwned(d.name)}
                    />
                  </td>
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
                      <span className="portrait portrait-initials" style={{ display: "none" }}>
                        {d.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <strong>{d.name}</strong>
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ELEMENT_COLOR_CLASS[d.element] ?? ""}`}>
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
                    {d.owned ? (
                      <input
                        className="inline-edit"
                        type="number" min={1} max={40}
                        defaultValue={d.level}
                        onBlur={(e) => updateField(d.name, "level", Number(e.target.value) || 1)}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {d.owned ? (
                      <input
                        className="inline-edit"
                        type="number" min={1} max={40}
                        defaultValue={d.archeLevel}
                        onBlur={(e) => updateField(d.name, "archeLevel", Number(e.target.value) || 1)}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {d.owned ? (
                      <input
                        className="inline-edit"
                        type="number" min={0} max={20}
                        defaultValue={d.catalysts}
                        onBlur={(e) => updateField(d.name, "catalysts", Number(e.target.value) || 0)}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>
                  No descendants match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
