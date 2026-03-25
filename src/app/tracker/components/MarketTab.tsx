"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDescendantsCatalogRows, fetchModulesCatalog } from "@/lib/fetch-game-catalog";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { tierTextClass } from "@/lib/tfd-modules";

const NEXON_MARKET_URL = "https://tfd.nexon.com/en/market";
const ALCAST_MARKET_URL = "https://tfd.alcasthq.com/market";

type ModuleCategory = "all" | "ancestor" | "trigger";

interface ParsedStat {
  name: string;
  range: string;
}

function groupStatsBySection(preview: string): { section: string; stats: ParsedStat[] }[] {
  if (!preview?.trim()) return [];
  const lines = preview.split("\n").filter(Boolean);
  const groups: { section: string; stats: ParsedStat[] }[] = [];
  let currentSection = "Basic Info";
  let currentStats: ParsedStat[] = [];

  for (const line of lines) {
    const tabIdx = line.indexOf("\t");
    if (tabIdx < 0) {
      if (currentStats.length > 0) {
        groups.push({ section: currentSection, stats: currentStats });
      }
      currentSection = line.trim();
      currentStats = [];
    } else {
      const name = line.slice(0, tabIdx).trim();
      const range = line.slice(tabIdx + 1).trim();
      if (name && range) currentStats.push({ name, range });
    }
  }
  if (currentStats.length > 0) {
    groups.push({ section: currentSection, stats: currentStats });
  }
  return groups;
}

export function MarketTab() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [descendants, setDescendants] = useState<DescendantCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ModuleCategory>("all");
  const [search, setSearch] = useState("");
  const [selectedDescendant, setSelectedDescendant] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchModulesCatalog(), fetchDescendantsCatalogRows()]).then(
      ([mods, descs]) => {
        if (cancelled) return;
        setModules(mods ?? []);
        setDescendants(Array.isArray(descs) ? descs : []);
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, []);

  const descMap = useMemo(() => {
    const m = new Map<string, DescendantCatalogRow>();
    descendants.forEach((d) => m.set(d.id, d));
    return m;
  }, [descendants]);

  const marketModules = useMemo(() => {
    return modules.filter(
      (m) => m.type === "Ancestors" || m.type === "Trigger",
    );
  }, [modules]);

  const filtered = useMemo(() => {
    let list = marketModules;
    if (category === "ancestor") list = list.filter((m) => m.type === "Ancestors");
    if (category === "trigger") list = list.filter((m) => m.type === "Trigger");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (selectedDescendant) {
      list = list.filter((m) => m.descendantIds.includes(selectedDescendant));
    }
    return list.sort((a, b) => {
      if (a.type !== b.type) return a.type === "Ancestors" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [marketModules, category, search, selectedDescendant]);

  const compatDescendants = useMemo(() => {
    const ids = new Set<string>();
    marketModules.forEach((m) => m.descendantIds.forEach((id) => ids.add(id)));
    return Array.from(ids)
      .map((id) => descMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as DescendantCatalogRow[];
  }, [marketModules, descMap]);

  const ancestorCount = marketModules.filter((m) => m.type === "Ancestors").length;
  const triggerCount = marketModules.filter((m) => m.type === "Trigger").length;

  const toggleExpand = useCallback((id: string) => {
    setExpandedModule((prev) => (prev === id ? null : id));
  }, []);

  if (loading) {
    return (
      <div className="market-tab">
        <div className="market-loading">Loading module catalog…</div>
      </div>
    );
  }

  return (
    <div className="market-tab">
      {/* Header */}
      <div className="market-header">
        <div className="market-header-text">
          <h3 className="market-title">TFD Module Market</h3>
          <p className="market-subtitle">
            Browse Ancestor & Trigger modules, view stat ranges, and find compatible Descendants.
            Trade on the official market.
          </p>
        </div>
        <div className="market-external-links">
          <a
            href={NEXON_MARKET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="market-link-btn market-link-official"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M11 3h6v6M17 3L9 11M14 11v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h6" />
            </svg>
            Nexon Market
          </a>
          <a
            href={ALCAST_MARKET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="market-link-btn market-link-alcast"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M11 3h6v6M17 3L9 11M14 11v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h6" />
            </svg>
            Alcast Market Tool
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="market-filters">
        <div className="market-filter-group">
          <label className="market-filter-label">Type</label>
          <div className="market-filter-chips">
            <button
              className={`filter-chip${category === "all" ? " active" : ""}`}
              onClick={() => setCategory("all")}
            >
              All ({ancestorCount + triggerCount})
            </button>
            <button
              className={`filter-chip${category === "ancestor" ? " active" : ""}`}
              onClick={() => setCategory("ancestor")}
            >
              Ancestor ({ancestorCount})
            </button>
            <button
              className={`filter-chip${category === "trigger" ? " active" : ""}`}
              onClick={() => setCategory("trigger")}
            >
              Trigger ({triggerCount})
            </button>
          </div>
        </div>

        <div className="market-filter-group">
          <label className="market-filter-label">Search</label>
          <input
            type="text"
            className="market-search-input"
            placeholder="Module name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="market-filter-group">
          <label className="market-filter-label">Compatible Descendant</label>
          <select
            className="market-desc-select"
            value={selectedDescendant}
            onChange={(e) => setSelectedDescendant(e.target.value)}
          >
            <option value="">All Descendants</option>
            {compatDescendants.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Info banner */}
      <div className="market-info-banner">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="8" />
          <path d="M10 7v0M10 10v4" />
        </svg>
        <span>
          Ancestor modules have random stat rolls when obtained. Trigger modules provide unique activated abilities.
          To buy/sell, use the <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer">official Nexon Market</a> and
          whisper sellers in-game.
        </span>
      </div>

      {/* Module grid */}
      <div className="market-results-count">{filtered.length} module{filtered.length !== 1 ? "s" : ""}</div>
      <div className="market-module-grid">
        {filtered.map((mod) => {
          const isExpanded = expandedModule === mod.id;
          const compatDescs = mod.descendantIds
            .map((id) => descMap.get(id))
            .filter(Boolean) as DescendantCatalogRow[];
          const statGroups = groupStatsBySection(mod.preview);
          const tierCls = tierTextClass(mod.tier);
          const isAncestor = mod.type === "Ancestors";

          return (
            <div
              key={mod.id}
              className={`market-module-card${isExpanded ? " expanded" : ""}${isAncestor ? " market-card-ancestor" : " market-card-trigger"}`}
            >
              <button className="market-card-main" onClick={() => toggleExpand(mod.id)}>
                <div className="market-card-img-wrap">
                  {mod.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mod.image} alt="" className="market-card-img" />
                  ) : (
                    <div className="market-card-img-ph" />
                  )}
                </div>
                <div className="market-card-info">
                  <div className="market-card-name">{mod.name}</div>
                  <div className="market-card-meta">
                    <span className={`market-card-type ${isAncestor ? "type-ancestor" : "type-trigger"}`}>
                      {isAncestor ? "Ancestor" : "Trigger"}
                    </span>
                    <span className={`market-card-tier ${tierCls}`}>{mod.tier}</span>
                    {mod.capacities[0] > 0 && (
                      <span className="market-card-cap">Cap: {mod.capacities[0]}</span>
                    )}
                  </div>
                  {compatDescs.length > 0 && (
                    <div className="market-card-compat">
                      {compatDescs.map((d) => (
                        <span key={d.id} className="market-compat-chip" title={d.name}>
                          {d.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image} alt="" className="market-compat-icon" />
                          ) : null}
                          <span className="market-compat-name">{d.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <svg
                  className={`market-card-chevron${isExpanded ? " open" : ""}`}
                  viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>

              {isExpanded && (
                <div className="market-card-detail">
                  {statGroups.length > 0 ? (
                    <div className="market-stat-groups">
                      {statGroups.map((g, gi) => (
                        <div key={gi} className="market-stat-group">
                          <div className="market-stat-section-name">{g.section}</div>
                          {g.stats.map((s, si) => (
                            <div key={si} className="market-stat-row">
                              <span className="market-stat-name">{s.name}</span>
                              <span className="market-stat-range">{s.range}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : isAncestor ? (
                    <div className="market-no-stats">
                      Ancestor modules have random stat rolls. Check the market for current listings and stat tiers.
                    </div>
                  ) : (
                    <div className="market-no-stats">No stat preview available.</div>
                  )}

                  <div className="market-card-actions">
                    <a
                      href={`${NEXON_MARKET_URL}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="market-action-btn"
                    >
                      Search on Nexon Market →
                    </a>
                    <a
                      href={`${ALCAST_MARKET_URL}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="market-action-btn market-action-alt"
                    >
                      Search on Alcast →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
