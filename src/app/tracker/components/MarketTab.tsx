"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { fetchDescendantsCatalogRows, fetchModulesCatalog } from "@/lib/fetch-game-catalog";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";
import type { ModuleRecord } from "@/lib/tfd-modules";
import { MODULE_POLARITY_OPTIONS, tierTextClass, socketColorClass, socketDotClass } from "@/lib/tfd-modules";
import type { MarketListing, MarketOption } from "@/lib/market-scraper";

const NEXON_MARKET_URL = "https://tfd.nexon.com/en/market";
const GL_ANCESTOR_URL = "https://tfd.gameslantern.com/market?order_by=listed_at&tab_id=ancestor";
const GL_TRIGGER_URL = "https://tfd.gameslantern.com/market?order_by=listed_at&tab_id=trigger";

type MarketTabType = "ancestor" | "trigger";
type SortMode = "newest" | "price_low" | "price_high";

function buildWhisperMessage(listing: MarketListing): string {
  const rolls = listing.options.map((o) => `${o.name} ${o.value}`).join(", ");
  return `Hello! I am interested in "${listing.moduleName}" with rolls [${rolls}] for ${listing.price} ${listing.priceUnit} (tfdmarket.gg)`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return dateStr;
  }
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

function OptionPill({ opt }: { opt: MarketOption }) {
  return (
    <div className={`mkt-opt-pill${opt.isPenalty ? " mkt-opt-penalty" : " mkt-opt-boost"}`}>
      <span className="mkt-opt-arrow">{opt.isPenalty ? "▼" : "▲"}</span>
      <span className="mkt-opt-name">{opt.name}</span>
      <span className="mkt-opt-val">{opt.value}</span>
      {opt.minMax && <span className="mkt-opt-range">[{opt.minMax}]</span>}
    </div>
  );
}

function CopyWhisperButton({ listing }: { listing: MarketListing }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopy = useCallback(() => {
    const msg = buildWhisperMessage(listing);
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [listing]);

  return (
    <button className={`mkt-whisper-btn${copied ? " copied" : ""}`} onClick={handleCopy} title="Copy whisper message to clipboard">
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3 3 7-7" /></svg>
          Copied!
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5.5 3H3a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1v-2M7 9l7-7M10 2h4v4" /></svg>
          Whisper Seller
        </>
      )}
    </button>
  );
}

const ANCESTOR_STAT_NAMES = [
  "Chill Skill Power Boost Ratio", "DEF", "Dimension Skill Modifier",
  "Dimension Skill Power Boost Ratio", "Electric Skill Power Boost Ratio",
  "Fire Skill Power Boost Ratio", "Fusion Skill Modifier",
  "Fusion Skill Power Boost Ratio", "Max HP", "Max MP", "Max Shield",
  "Non-Attribute Skill Power Boost Ratio", "Toxic Skill Power Boost Ratio",
];

export function MarketTab() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [descendants, setDescendants] = useState<DescendantCatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<MarketTabType>("ancestor");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedDescendant, setSelectedDescendant] = useState("");
  const [selectedSocket, setSelectedSocket] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [cacheAge, setCacheAge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchModulesCatalog(), fetchDescendantsCatalogRows()]).then(
      ([mods, descs]) => {
        if (cancelled) return;
        setModules(mods ?? []);
        setDescendants(Array.isArray(descs) ? descs : []);
        setCatalogLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, []);

  const fetchListings = useCallback(async (tab: MarketTabType) => {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch(`/api/market?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setListings(data.listings ?? []);
      setCacheAge(data.age ?? 0);
      if (data.scraping) setLiveError("Market data is being fetched. Refresh in a few seconds.");
    } catch (err) {
      setLiveError("Failed to load live listings. The market scraper may need to warm up.");
      console.error(err);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings(activeTab);
  }, [activeTab, fetchListings]);

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

  const filteredListings = useMemo(() => {
    let list = [...listings];
    if (selectedModule) {
      list = list.filter((l) => l.moduleName === selectedModule || l.moduleId === selectedModule);
    }
    if (selectedDescendant) {
      const desc = descMap.get(selectedDescendant);
      if (desc) list = list.filter((l) => l.descendantName.includes(desc.name));
    }
    if (selectedSocket) {
      list = list.filter((l) => l.socketType.toLowerCase().includes(selectedSocket.toLowerCase()));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.moduleName.toLowerCase().includes(q) ||
        l.sellerName.toLowerCase().includes(q) ||
        l.options.some((o) => o.name.toLowerCase().includes(q)),
      );
    }
    if (priceMin) {
      const min = Number(priceMin);
      if (!isNaN(min)) list = list.filter((l) => l.price >= min);
    }
    if (priceMax) {
      const max = Number(priceMax);
      if (!isNaN(max)) list = list.filter((l) => l.price <= max);
    }

    if (sort === "price_low") list.sort((a, b) => a.price - b.price);
    else if (sort === "price_high") list.sort((a, b) => b.price - a.price);

    return list;
  }, [listings, selectedModule, selectedDescendant, selectedSocket, search, priceMin, priceMax, sort, descMap]);

  const hasNoLive = listings.length === 0 && !liveLoading;

  const catalogFiltered = useMemo(() => {
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
    setPriceMin("");
    setPriceMax("");
    setSort("newest");
  }, []);

  const hasActiveFilters = !!(selectedModule || selectedDescendant || selectedSocket || search.trim() || priceMin || priceMax);
  const glUrl = activeTab === "ancestor" ? GL_ANCESTOR_URL : GL_TRIGGER_URL;

  const moduleNames = useMemo(() => {
    const names = new Set<string>();
    listings.forEach((l) => names.add(l.moduleName));
    currentPool.forEach((m) => names.add(m.name));
    return Array.from(names).sort();
  }, [listings, currentPool]);

  if (catalogLoading) {
    return <div className="market-tab"><div className="market-loading">Loading module catalog…</div></div>;
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
            Gameslantern
          </a>
        </div>
      </div>

      {/* Info banner */}
      <div className="mkt-info">
        To list items, visit the{" "}
        <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer"><strong>official Nexon TFD Market</strong></a>.
        {" "}This page pulls live listings from the trade market. If you find an item you want,
        click <strong>Whisper Seller</strong> to copy a ready-made in-game whisper message.
        Data is refreshed every few minutes. Listings older than 24 hours may be outdated.
      </div>

      {/* Tabs */}
      <div className="mkt-tabs">
        <button className={`mkt-tab-btn${activeTab === "ancestor" ? " active" : ""}`} onClick={() => { setActiveTab("ancestor"); resetFilters(); }}>
          Ancestor
        </button>
        <button className={`mkt-tab-btn${activeTab === "trigger" ? " active" : ""}`} onClick={() => { setActiveTab("trigger"); resetFilters(); }}>
          Trigger
        </button>
      </div>

      {/* Main layout */}
      <div className="mkt-layout">
        {/* Sidebar */}
        <aside className="mkt-sidebar">
          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Select a Module</label>
            <select className="mkt-select" value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}>
              <option value="">All Modules</option>
              {moduleNames.map((n) => <option key={n} value={n}>{n}</option>)}
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
            <label className="mkt-filter-label">Sort By</label>
            <select className="mkt-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>

          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Price</label>
            <div className="mkt-price-row">
              <input type="number" className="mkt-input mkt-input-half" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
              <input type="number" className="mkt-input mkt-input-half" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
          </div>

          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Socket Type</label>
            <select className="mkt-select" value={selectedSocket} onChange={(e) => setSelectedSocket(e.target.value)}>
              <option value="">Any Socket</option>
              {MODULE_POLARITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="mkt-filter-block">
            <label className="mkt-filter-label">Search</label>
            <input type="text" className="mkt-input" placeholder="Module, seller, stat…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {activeTab === "ancestor" && (
            <CollapsibleSection title="Possible Ancestor Stats" defaultOpen={false}>
              <ul className="mkt-stat-list">
                {ANCESTOR_STAT_NAMES.map((s) => <li key={s} className="mkt-stat-item">{s}</li>)}
              </ul>
              <p className="mkt-stat-note">Ancestor modules roll 4 random stats (mix of positive & negative).</p>
            </CollapsibleSection>
          )}

          {hasActiveFilters && (
            <button className="mkt-reset-btn" onClick={resetFilters}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 2h14l-5 6v5l-4 2V8L1 2z" /></svg>
              Reset Filters
            </button>
          )}

          <div className="mkt-sidebar-links">
            <a href={glUrl} target="_blank" rel="noopener noreferrer" className="mkt-sidebar-live-link">
              View on Gameslantern →
            </a>
            <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer" className="mkt-sidebar-live-link mkt-sidebar-nexon-link">
              Trade on official market →
            </a>
          </div>
        </aside>

        {/* Listings area */}
        <div className="mkt-listings">
          <div className="mkt-listings-head">
            <span className="mkt-count">
              {liveLoading ? "Loading live listings…" : `${filteredListings.length} listing${filteredListings.length !== 1 ? "s" : ""}`}
              {cacheAge > 0 && !liveLoading && <span className="mkt-cache-age"> (cached {cacheAge}s ago)</span>}
            </span>
            <button className="mkt-refresh-btn" onClick={() => fetchListings(activeTab)} disabled={liveLoading}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" className={liveLoading ? "mkt-spin" : ""}>
                <path d="M14 8A6 6 0 112 8" /><path d="M2 8A6 6 0 0114 8" /><path d="M14 3v5h-5" />
              </svg>
              {liveLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {liveError && <div className="mkt-error">{liveError}</div>}

          {/* Live listings */}
          {filteredListings.length > 0 ? (
            <div className="mkt-cards">
              {filteredListings.map((listing, idx) => (
                <div key={`${listing.moduleId}-${listing.sellerName}-${idx}`} className={`mkt-card${listing.tabType === "ancestor" ? " mkt-card-anc" : " mkt-card-trig"}`}>
                  <div className="mkt-card-top">
                    <div className="mkt-card-img-wrap">
                      {listing.moduleImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.moduleImage} alt="" className="mkt-card-img" />
                      ) : (
                        <div className="mkt-card-img-ph" />
                      )}
                    </div>
                    <div className="mkt-card-info">
                      <div className="mkt-card-name">
                        {listing.moduleName}
                        {listing.moduleId && <span className="mkt-card-id">#{listing.moduleId}</span>}
                      </div>
                      <div className="mkt-card-meta-row">
                        {listing.descendantName && (
                          <span className="mkt-card-desc-names">{listing.descendantName}</span>
                        )}
                        {listing.socketType && (
                          <span className="mkt-card-socket">
                            <span className={socketDotClass(listing.socketType)} />
                            {listing.socketType}
                          </span>
                        )}
                        <span className="mkt-card-meta-sep">•</span>
                        <span className="mkt-card-meta-txt">Req. MR {listing.requiredMasteryRank}</span>
                        <span className="mkt-card-meta-sep">•</span>
                        <span className="mkt-card-meta-txt">Seller MR {listing.sellerMasteryRank}</span>
                        <span className="mkt-card-meta-sep">•</span>
                        <span className="mkt-card-meta-txt">Rerolls {listing.rerollCount}</span>
                      </div>
                      <div className="mkt-card-seller">
                        <span className="mkt-seller-name">{listing.sellerName}</span>
                      </div>
                    </div>
                    <div className="mkt-card-price-col">
                      <span className="mkt-price-value">{listing.price}</span>
                      <span className="mkt-price-unit">{listing.priceUnit}</span>
                      <span className="mkt-listed-at">{timeAgo(listing.listedAt)}</span>
                    </div>
                  </div>

                  {listing.options.length > 0 && (
                    <div className="mkt-card-options">
                      {listing.options.map((opt, oi) => <OptionPill key={oi} opt={opt} />)}
                    </div>
                  )}

                  <div className="mkt-card-actions">
                    <CopyWhisperButton listing={listing} />
                    <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer" className="mkt-action-btn mkt-action-nexon">
                      Nexon Market
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : !liveLoading && hasNoLive ? (
            /* Fallback to catalog view */
            <div className="mkt-fallback">
              <div className="mkt-fallback-msg">
                <strong>Live listings unavailable.</strong> The market scraper is warming up or Nexon&apos;s market is temporarily unreachable.
                Below is the module catalog for reference. Click <strong>Refresh</strong> or visit{" "}
                <a href={glUrl} target="_blank" rel="noopener noreferrer">Gameslantern</a> for live listings.
              </div>
              <div className="mkt-cards">
                {catalogFiltered.map((mod) => {
                  const compatDescs = mod.descendantIds.map((id) => descMap.get(id)).filter(Boolean) as DescendantCatalogRow[];
                  const tierCls = tierTextClass(mod.tier);
                  const sockCls = socketColorClass(mod.socket);
                  const isAncestor = mod.type === "Ancestors";
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
                          <div className="mkt-card-name">{mod.name}</div>
                          <div className="mkt-card-meta-row">
                            {compatDescs.length > 0 && (
                              <span className="mkt-card-desc-names">
                                {compatDescs.map((d) => d.name).join(", ")}
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
                      <div className="mkt-card-actions">
                        <a href={NEXON_MARKET_URL} target="_blank" rel="noopener noreferrer" className="mkt-action-btn mkt-action-nexon">Search Nexon Market</a>
                        <a href={glUrl} target="_blank" rel="noopener noreferrer" className="mkt-action-btn mkt-action-gl">Search Gameslantern</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !liveLoading ? (
            <div className="mkt-empty">No listings match your filters.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
