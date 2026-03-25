"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDescendantsCatalogRows, fetchModulesCatalog } from "@/lib/fetch-game-catalog";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { MODULE_POLARITY_OPTIONS, tierTextClass, socketColorClass, socketDotClass } from "@/lib/tfd-modules";

const NEXON_MARKET_URL = "https://tfd.nexon.com/en/market";
const GL_ANCESTOR_URL = "https://tfd.gameslantern.com/market?order_by=listed_at&tab_id=ancestor";
const GL_TRIGGER_URL = "https://tfd.gameslantern.com/market?order_by=listed_at&tab_id=trigger";

type MarketTab = "ancestor" | "trigger";

const ANCESTOR_STAT_NAMES = [
  "Chill Skill Power Boost Ratio",
  "DEF",
  "Dimension Skill Modifier",
  "Dimension Skill Power Boost Ratio",
  "Electric Skill Power Boost Ratio",
  "Fire Skill Power Boost Ratio",
  "Fusion Skill Modifier",
  "Fusion Skill Power Boost Ratio",
  "Max HP",
  "Max MP",
  "Max Shield",
  "Non-Attribute Skill Power Boost Ratio",
  "Toxic Skill Power Boost Ratio",
] as const;

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
      if (currentStats.length > 0) groups.push({ section: currentSection, stats: currentStats });
      currentSection = line.trim();
      currentStats = [];
    } else {
      const name = line.slice(0, tabIdx).trim();
      const range = line.slice(tabIdx + 1).trim();
      if (name && range) currentStats.push({ name, range });
    }
  }
  if (currentStats.length > 0) groups.push({ section: currentSection, stats: currentStats });
  return groups;
}

function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="mkt-collapse">
      <button className="mkt-collapse-head" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" className={open ? "mkt-chev-open" : ""}>
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && <div className="mkt-collapse-body">{children}</div>}
    </div>
  );
}

export function MarketTab() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [descendants, setDescendants] = useState<DescendantCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<MarketTab>("ancestor");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedDescendant, setSelectedDescendant] = useState("");
  const [selectedSocket, setSelectedSocket] = useState("");
  const [search, setSearch] = useState("");

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

  const ancestorModules = useMemo(() =>
    modules.filter((m) => m.type === "Ancestors").sort((a, b) => a.name.localeCompare(b.name)),
    [modules],
  );

  const triggerModules = useMemo(() =>
    modules.filter((m) => m.type === "Trigger").sort((a, b) => a.name.localeCompare(b.name)),
    [modules],
  );

  const currentPool = activeTab === "ancestor" ? ancestorModules : triggerModules;

  const compatDescendants = useMemo(() => {
    const ids = new Set<string>();
    currentPool.forEach((m) => m.descendantIds.forEach((id) => ids.add(id)));
    return Array.from(ids)
      .map((id) => descMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as DescendantCatalogRow[];
  }, [currentPool, descMap]);

  const filtered = useMemo(() => {
    let list = currentPool;
    if (selectedModule) list = list.filter((m) => m.id === selectedModule);
    if (selectedDescendant) list = list.filter((m) => m.descendantIds.includes(selectedDescendant));
    if (selectedSocket) list = list.filter((m) => m.socket === selectedSocket);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.preview.toLowerCase().includes(q));
    }
    return list;
  }, [currentPool, selectedModule, selectedDescendant, selectedSocket, search]);

  const resetFilters = useCallback(() => {
    setSelectedModule("");
    setSelectedDescendant("");
    setSelectedSocket("");
    setSearch("");
  }, []);

  const hasActiveFilters = !!(selectedModule || selectedDescendant || selectedSocket || search.trim());

  const glUrl = activeTab === "ancestor" ? GL_ANCESTOR_URL : GL_TRIGGER_URL;

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
      <div className="mkt-header">
        <div className="mkt-header-left">
          <h3 className="mkt-title">TFD Marketplace Search</h3>
          <p className="mkt-subtitle">
            Ancestor & Trigger Marketplace Search Tool for The First Descendant with advanced filter tools.
          </p>
        </div>
        <div className="mkt-header-links">
          <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer" className="mkt-ext-btn mkt-ext-official">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 2h5v5M14 2L7 9M11 9v4.5a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5H7" /></svg>
            Nexon Market
          </a>
          <a href={glUrl} target="_blank" rel="noopener noreferrer" className="mkt-ext-btn mkt-ext-gl">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 2h5v5M14 2L7 9M11 9v4.5a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5H7" /></svg>
            Gameslantern Market
          </a>
        </div>
      </div>

      {/* Info banner */}
      <div className="mkt-info">
        To list items, visit the{" "}
        <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer"><strong>official Nexon TFD Market</strong></a>.
        {" "}This page is a module reference catalog. For live listings with prices, use{" "}
        <a href={glUrl} target="_blank" rel="noopener noreferrer">Gameslantern&apos;s Marketplace</a>.
        {" "}Whisper the seller in-game or send a friend request to trade.
      </div>

      {/* Tab toggle */}
      <div className="mkt-tabs">
        <button className={`mkt-tab-btn${activeTab === "ancestor" ? " active" : ""}`} onClick={() => { setActiveTab("ancestor"); resetFilters(); }}>
          Ancestor ({ancestorModules.length})
        </button>
        <button className={`mkt-tab-btn${activeTab === "trigger" ? " active" : ""}`} onClick={() => { setActiveTab("trigger"); resetFilters(); }}>
          Trigger ({triggerModules.length})
        </button>
      </div>

      {/* Main layout: sidebar + listings */}
      <div className="mkt-layout">
        {/* Sidebar filters */}
        <aside className="mkt-sidebar">
          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Select a Module</label>
            <select className="mkt-select" value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}>
              <option value="">All {activeTab === "ancestor" ? "Ancestor" : "Trigger"} Modules</option>
              {currentPool.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {compatDescendants.length > 0 && (
            <div className="mkt-filter-block">
              <label className="mkt-filter-label">Select a Descendant</label>
              <select className="mkt-select" value={selectedDescendant} onChange={(e) => setSelectedDescendant(e.target.value)}>
                <option value="">All Descendants</option>
                {compatDescendants.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Socket Type</label>
            <select className="mkt-select" value={selectedSocket} onChange={(e) => setSelectedSocket(e.target.value)}>
              <option value="">Any Socket</option>
              {MODULE_POLARITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Search</label>
            <input
              type="text"
              className="mkt-input"
              placeholder="Module name or keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {activeTab === "ancestor" && (
            <CollapsibleSection title="Possible Ancestor Stats" defaultOpen>
              <ul className="mkt-stat-list">
                {ANCESTOR_STAT_NAMES.map((s) => (
                  <li key={s} className="mkt-stat-item">{s}</li>
                ))}
              </ul>
              <p className="mkt-stat-note">
                Ancestor modules roll 4 random stats (some positive, some negative).
                Stat tiers are color-coded on the official market.
              </p>
            </CollapsibleSection>
          )}

          {hasActiveFilters && (
            <button className="mkt-reset-btn" onClick={resetFilters}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M1 2h14l-5 6v5l-4 2V8L1 2z" />
              </svg>
              Reset Filters
            </button>
          )}

          <div className="mkt-sidebar-links">
            <a href={glUrl} target="_blank" rel="noopener noreferrer" className="mkt-sidebar-live-link">
              View live listings on Gameslantern →
            </a>
            <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer" className="mkt-sidebar-live-link mkt-sidebar-nexon-link">
              Trade on official Nexon Market →
            </a>
          </div>
        </aside>

        {/* Listings */}
        <div className="mkt-listings">
          <div className="mkt-listings-head">
            <span className="mkt-count">{filtered.length} module{filtered.length !== 1 ? "s" : ""}</span>
            <a href={glUrl} target="_blank" rel="noopener noreferrer" className="mkt-live-btn">
              <span className="mkt-live-dot" />
              View live market listings
            </a>
          </div>

          {filtered.length === 0 ? (
            <div className="mkt-empty">No modules match your filters.</div>
          ) : (
            <div className="mkt-cards">
              {filtered.map((mod) => {
                const compatDescs = mod.descendantIds
                  .map((id) => descMap.get(id))
                  .filter(Boolean) as DescendantCatalogRow[];
                const statGroups = groupStatsBySection(mod.preview);
                const tierCls = tierTextClass(mod.tier);
                const isAncestor = mod.type === "Ancestors";
                const sockCls = socketColorClass(mod.socket);

                return (
                  <div key={mod.id} className={`mkt-card${isAncestor ? " mkt-card-anc" : " mkt-card-trig"}`}>
                    <div className="mkt-card-top">
                      <div className="mkt-card-img-wrap">
                        {mod.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mod.image} alt="" className="mkt-card-img" />
                        ) : (
                          <div className="mkt-card-img-ph" />
                        )}
                      </div>
                      <div className="mkt-card-info">
                        <div className="mkt-card-name">
                          {mod.name}
                          <span className="mkt-card-id">#{mod.id}</span>
                        </div>
                        <div className="mkt-card-meta-row">
                          {compatDescs.length > 0 && (
                            <span className="mkt-card-desc-names">
                              {compatDescs.map((d, i) => (
                                <span key={d.id}>
                                  {d.image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={d.image} alt="" className="mkt-card-desc-icon" />
                                  )}
                                  {d.name}{i < compatDescs.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </span>
                          )}
                          {mod.socket && (
                            <span className={`mkt-card-socket ${sockCls}`}>
                              <span className={socketDotClass(mod.socket)} />
                              {mod.socket}
                            </span>
                          )}
                          {mod.capacities[0] > 0 && (
                            <span className="mkt-card-cap">Cap {mod.capacities[0]}</span>
                          )}
                        </div>
                      </div>
                      <div className="mkt-card-tier-badge">
                        <span className={`mkt-tier-label ${tierCls}`}>{mod.tier}</span>
                        <span className="mkt-type-label">{isAncestor ? "Ancestor" : "Trigger"}</span>
                      </div>
                    </div>

                    {/* Stat boxes for trigger modules */}
                    {statGroups.length > 0 && (
                      <div className="mkt-card-stats">
                        {statGroups.map((g, gi) => (
                          <div key={gi} className="mkt-stat-block">
                            <div className="mkt-stat-block-title">{g.section}</div>
                            {g.stats.map((s, si) => (
                              <div key={si} className="mkt-stat-pair">
                                <span className="mkt-stat-label">{s.name}</span>
                                <span className="mkt-stat-val">{s.range}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {isAncestor && (
                      <div className="mkt-card-anc-note">
                        Random stat rolls — 4 stats per module (mix of positive & negative).
                        Check live market for actual rolled values and prices.
                      </div>
                    )}

                    <div className="mkt-card-actions">
                      <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer" className="mkt-action-btn mkt-action-nexon">
                        Search Nexon Market
                      </a>
                      <a href={glUrl} target="_blank" rel="noopener noreferrer" className="mkt-action-btn mkt-action-gl">
                        Search Gameslantern
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
