"use client";

import { useRef } from "react";
import type { TrackerState, WeaponEntry } from "../tracker-client";
import { ammoDefs, roundsLabel } from "@/lib/tracker-data";
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

export function WeaponsTab({ state, setState }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  function setFilter(key: string, value: string) {
    setState((prev) => ({
      ...prev,
      weaponFilters: { ...prev.weaponFilters, [key]: value },
    }));
  }

  function resetFilters() {
    setState((prev) => ({
      ...prev,
      weaponFilters: { search: "", rarity: "all", rounds: "all", sort: "name-asc", ownership: "all" },
    }));
  }

  function toggleOwnership(mode: "acquired" | "unacquired") {
    setState((prev) => ({
      ...prev,
      weaponFilters: {
        ...prev.weaponFilters,
        ownership: prev.weaponFilters.ownership === mode ? "all" : mode,
      },
    }));
  }

  function updateWeapon(slug: string, field: keyof WeaponEntry, value: unknown) {
    setState((prev) => {
      const weapons = prev.weapons.map((w) => {
        if (w.slug !== slug) return w;
        return { ...w, [field]: value };
      });
      // Only log activity for major changes, not every numeric keystroke
      if (field === "acquired") {
        const w = prev.weapons.find((x) => x.slug === slug);
        return pushActivity({ ...prev, weapons }, `${value ? "Acquired" : "Unacquired"} weapon: ${w?.name}`);
      }
      return { ...prev, weapons };
    });
  }

  const { search, rarity, rounds, sort, ownership } = state.weaponFilters;

  const filtered = (state.weapons ?? [])
    .filter((w) => {
      const q = (search ?? "").trim().toLowerCase();
      if (q && !(w.name ?? "").toLowerCase().includes(q)) return false;
      if (rarity !== "all" && (w.rarity ?? "Rare") !== rarity) return false;
      if (rounds !== "all" && (w.roundsType ?? "General Rounds") !== rounds) return false;
      if (ownership === "acquired" && !w.acquired) return false;
      if (ownership === "unacquired" && w.acquired) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "name-desc") return (b.name ?? "").localeCompare(a.name ?? "");
      if (sort === "rarity") {
        const rank: Record<string, number> = { Normal: 1, Rare: 2, Ultimate: 3 };
        return (rank[a.rarity ?? "Rare"] ?? 2) - (rank[b.rarity ?? "Rare"] ?? 2);
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

  return (
    <section className="panel">
      <h2>Weapons</h2>
      <p className="muted">Track all weapons with editable progression values.</p>

      <div className="weapon-filters">
        <span className="filter-row-title">Filters</span>
        <div className="filter-group">
          <input
            defaultValue={search}
            placeholder="Search weapon..."
            style={{ width: 180 }}
            onInput={(e) => setFilter("search", (e.target as HTMLInputElement).value)}
          />
          <select value={rarity} onChange={(e) => setFilter("rarity", e.target.value)}>
            <option value="all">All Rarity</option>
            <option value="Normal">Normal</option>
            <option value="Rare">Rare</option>
            <option value="Ultimate">Ultimate</option>
          </select>
          <select value={sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="rarity">Rarity (Normal → Ultimate)</option>
          </select>
          <button className="filter-chip" onClick={resetFilters}>Reset Filters</button>
        </div>

        <span className="filter-row-title">Round Types</span>
        <div className="filter-group">
          {ammoDefs.map((def) => (
            <button
              key={def.id}
              className={`filter-chip${rounds === def.id ? " active" : ""}`}
              onClick={() => setFilter("rounds", def.id)}
            >
              {def.icon && <img src={def.icon} alt={def.label} />}
              {def.label}
            </button>
          ))}
        </div>

        <span className="filter-row-title">Owned Status</span>
        <div className="filter-group ownership-filter-group">
          <button
            className={`filter-chip${ownership === "acquired" ? " active" : ""}`}
            onClick={() => toggleOwnership("acquired")}
          >
            Acquired
          </button>
          <button
            className={`filter-chip${ownership === "unacquired" ? " active" : ""}`}
            onClick={() => toggleOwnership("unacquired")}
          >
            Unacquired
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="weapons-table">
          <thead>
            <tr>
              <th>Acquired</th>
              <th>Icon</th>
              <th>Weapon Name</th>
              <th>Rarity</th>
              <th>Rounds</th>
              <th>Level</th>
              <th>Catalysts</th>
              <th>Enhancement</th>
              <th>Weapon Core</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const rarityClass =
                w.rarity === "Ultimate" ? "rarity-chip-ultimate"
                : w.rarity === "Rare" ? "rarity-chip-rare"
                : "rarity-chip-normal";
              const roundsDef = ammoDefs.find((a) => a.id === (w.roundsType ?? "General Rounds")) ?? ammoDefs[1];
              return (
                <tr key={w.slug}>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(w.acquired)}
                      onChange={(e) => updateWeapon(w.slug, "acquired", e.target.checked)}
                    />
                  </td>
                  <td>
                    <img className="weapon-icon" src={w.icon} alt={w.name ?? w.slug} />
                  </td>
                  <td>{w.name ?? w.slug}</td>
                  <td>
                    <span className={`skill-chip ${rarityClass}`}>
                      <strong>{w.rarity ?? "Rare"}</strong>
                    </span>
                  </td>
                  <td>
                    <span className="skill-chip">
                      {roundsDef.icon && <img src={roundsDef.icon} alt={roundsDef.label} />}
                      <strong>{roundsLabel(w.roundsType ?? "General Rounds")}</strong>
                    </span>
                  </td>
                  <td>
                    <input
                      className="inline-edit"
                      type="number" min={1} max={100}
                      defaultValue={Number(w.level ?? 1)}
                      onBlur={(e) =>
                        updateWeapon(w.slug, "level", Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="inline-edit"
                      type="number" min={0} max={20}
                      defaultValue={Number(w.catalysts ?? 0)}
                      onBlur={(e) =>
                        updateWeapon(w.slug, "catalysts", Math.min(20, Math.max(0, Number(e.target.value) || 0)))
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={String(w.enhancement ?? 0)}
                      onChange={(e) => updateWeapon(w.slug, "enhancement", Number(e.target.value))}
                    >
                      {[0,1,2,3,4,5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={w.weaponCore ?? "No"}
                      onChange={(e) => updateWeapon(w.slug, "weaponCore", e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>
                  No weapons match current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
