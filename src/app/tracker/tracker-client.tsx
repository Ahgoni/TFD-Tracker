"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { WelcomeTab } from "./components/WelcomeTab";
import { DescendantsTab } from "./components/DescendantsTab";
import { WeaponsTab } from "./components/WeaponsTab";
import { ReactorsTab } from "./components/ReactorsTab";
import { MaterialsTab } from "./components/MaterialsTab";
import { FarmingTab } from "./components/FarmingTab";
import { ProfileMenu } from "./components/ProfileMenu";
import { FriendsTab } from "./components/FriendsTab";
import { normalizeWeaponName } from "@/lib/tracker-data";
import { ThemeToggle } from "../theme-toggle";
import { BrandLogo } from "../brand-logo";

// ── Types exported for child components ──────────────────────────────────────

export interface WeaponEntry {
  id?: string;
  slug: string;
  name: string;
  rarity: string;
  roundsType: string;
  icon: string;
  acquired: boolean;
  level: number;
  catalysts: number;
  enhancement: number;
  weaponCore: string;
}

export interface ReactorSubstat {
  stat: string;
  value: string;
  tier: "common" | "rare" | "ultimate";
}

export interface ReactorEntry {
  id: string;
  name: string;
  element: string;
  skillType: string;
  descendant: string;
  level: number;
  enhancement: string;
  substats: ReactorSubstat[];
  notes: string;
}

export interface DescendantEntry {
  id: string;
  name: string;
  element: string;
  skills: string[];
  level: number;
  archeLevel: number;
  catalysts: number;
  portrait: string;
}

export interface MaterialEntry {
  id: string;
  name: string;
  qty: number;
}

export interface GoalEntry {
  id: string;
  text: string;
  completed: boolean;
  active: boolean;
}

export interface ActivityEntry {
  id: string;
  text: string;
  at: string;
}

export interface TrackerState {
  tabs: string[];
  activeTab: string;
  activities: ActivityEntry[];
  weapons: WeaponEntry[];
  reactors: ReactorEntry[];
  materials: MaterialEntry[];
  descendants: DescendantEntry[];
  goals: GoalEntry[];
  goalsFilters: { hideCompleted: boolean; onlyActive: boolean };
  weaponFilters: { search: string; rarity: string; rounds: string; sort: string; ownership: string };
  filters: { element: string; skill: string };
  descFilter: string;
  notesTabs: Record<string, Array<{ id: string; text: string; done?: boolean }>>;
  sharePrivacy: "open" | "link_only";
}

const DEFAULT_STATE: TrackerState = {
  tabs: ["Welcome", "Descendants", "Weapons", "Reactors", "Materials", "Farming", "Friends"],
  activeTab: "Welcome",
  activities: [],
  weapons: [],
  reactors: [],
  materials: [],
  descendants: [],
  goals: [],
  goalsFilters: { hideCompleted: false, onlyActive: false },
  weaponFilters: { search: "", rarity: "all", rounds: "all", sort: "name-asc", ownership: "all" },
  filters: { element: "all", skill: "all" },
  descFilter: "all",
  notesTabs: { Weapons: [], Progression: [] },
  sharePrivacy: "open",
};

const STORAGE_KEY = "tfd-tracker-v2";

// ── Weapons catalog helpers ───────────────────────────────────────────────────

async function fetchAndMergeWeaponsCatalog(currentWeapons: WeaponEntry[]): Promise<WeaponEntry[]> {
  try {
    const res = await fetch("/weapons-catalog.json");
    if (!res.ok) return currentWeapons;
    const catalog: WeaponEntry[] = await res.json();
    if (!Array.isArray(catalog) || catalog.length === 0) return currentWeapons;

    if (currentWeapons.length === 0) {
      return catalog.map((w) => ({ ...w, icon: w.icon?.replace("./Images", "/Images") ?? w.icon }));
    }

    const bySlug = new Map(currentWeapons.map((w) => [w.slug, w]));
    catalog.forEach((c) => {
      const icon = c.icon?.replace("./Images", "/Images") ?? c.icon;
      if (!bySlug.has(c.slug)) {
        bySlug.set(c.slug, { ...c, name: normalizeWeaponName(c.slug, c.name), icon });
      } else {
        const w = bySlug.get(c.slug)!;
        w.name = normalizeWeaponName(w.slug, w.name || c.name);
        if (!w.icon) w.icon = icon;
        if (!w.rarity || w.rarity === "Unknown") w.rarity = c.rarity || "Rare";
        if (!w.roundsType || w.roundsType === "Unknown") w.roundsType = c.roundsType || "General Rounds";
      }
    });

    const result = [...bySlug.values()];
    result.forEach((w) => {
      w.name = normalizeWeaponName(w.slug, w.name);
      if (!w.rarity || w.rarity === "Unknown") w.rarity = "Rare";
      if (!w.roundsType || w.roundsType === "Unknown") w.roundsType = "General Rounds";
      if (w.icon) w.icon = w.icon.replace("./Images", "/Images");
    });
    return result;
  } catch {
    return currentWeapons;
  }
}

// ── Share helpers ─────────────────────────────────────────────────────────────

async function createShareToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/share", { method: "POST" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function TrackerClient() {
  useSession();
  const [state, setState] = useState<TrackerState>(DEFAULT_STATE);
  const [saveStatus, setSaveStatus] = useState<"loading" | "loaded" | "saving" | "saved" | "error">("loading");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  // Load state from server on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) { setSaveStatus("error"); return; }
        const data = await res.json();

        let loaded: TrackerState = {
          ...DEFAULT_STATE,
          ...(data.state ?? {}),
          weaponFilters: { ...DEFAULT_STATE.weaponFilters, ...(data.state?.weaponFilters ?? {}) },
          goalsFilters: { ...DEFAULT_STATE.goalsFilters, ...(data.state?.goalsFilters ?? {}) },
          filters: { ...DEFAULT_STATE.filters, ...(data.state?.filters ?? {}) },
          notesTabs: { ...DEFAULT_STATE.notesTabs, ...(data.state?.notesTabs ?? {}) },
        };

        if (!loaded.tabs.includes("Friends")) {
          loaded.tabs = [...loaded.tabs, "Friends"];
        }
        loaded.tabs = loaded.tabs.filter((t) => t !== "Progression");

        if (Array.isArray(loaded.weapons)) {
          loaded.weapons = loaded.weapons.map((w) => ({
            ...w,
            icon: (w.icon ?? "").replace("./Images", "/Images"),
          }));
        }

        loaded.weapons = await fetchAndMergeWeaponsCatalog(loaded.weapons);
        setState(loaded);
        setSaveStatus("loaded");
        initialized.current = true;
      } catch {
        setSaveStatus("error");
      }
    })();
  }, []);

  // Debounce-save to server whenever state changes (after initial load)
  const save = useCallback(async (s: TrackerState) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: s }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(state), 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, save]);

  // Import from localStorage (migration bridge)
  async function importFromLocalStorage() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) { setSaveStatus("error"); return; }
    try {
      const parsed = JSON.parse(raw);
      await fetch("/api/state/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: parsed }),
      });
      const merged: TrackerState = { ...DEFAULT_STATE, ...parsed };
      merged.weapons = await fetchAndMergeWeaponsCatalog(merged.weapons ?? []);
      setState(merged);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  function setActiveTab(tab: string) {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }

  async function handleShare() {
    if (shareToken) {
      setShowShare((v) => !v);
      return;
    }
    const token = await createShareToken();
    if (token) { setShareToken(token); setShowShare(true); }
  }

  function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  }

  const statusText =
    saveStatus === "loading" ? "Loading…"
    : saveStatus === "saving" ? "Saving…"
    : saveStatus === "saved" || saveStatus === "loaded" ? "Saved"
    : "Save error";

  const statusClass =
    saveStatus === "saved" || saveStatus === "loaded" ? "ok"
    : saveStatus === "error" ? "err"
    : "";

  const activeTab = state.tabs.includes(state.activeTab) ? state.activeTab : "Welcome";
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <h1>
              <BrandLogo size={26} />
              <span className="brand-tfd">TFD</span> Tracker
            </h1>
            <p>Cloud inventory · Discord login · private per-user data</p>
          </div>
          <div className="topbar-right">
            <span className={`save-status ${statusClass}`}>
              {saveStatus === "saving" && <span className="save-pulse" />}
              {statusText}
            </span>
            <ThemeToggle compact />
            <ProfileMenu
              onShare={handleShare}
              shareActive={showShare}
              sharePrivacy={state.sharePrivacy}
              onPrivacyChange={(p) => setState((prev) => ({ ...prev, sharePrivacy: p }))}
            />
          </div>
        </div>

        <nav className="tab-nav" aria-label="Tracker sections">
          {state.tabs.map((tab) => (
            <button
              key={tab}
              className={tab === activeTab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {showShare && shareToken && (
          <div className="share-link-row">
            <input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}`}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              className="filter-chip"
              style={{ fontSize: "0.76rem" }}
              onClick={copyShareLink}
            >
              {shareCopied ? "✓ Copied!" : "Copy link"}
            </button>
            <button
              className="filter-chip"
              style={{ fontSize: "0.76rem" }}
              onClick={() => setShowShare(false)}
            >
              ✕
            </button>
          </div>
        )}
      </header>

      <div className="tab-content" key={activeTab}>
        {activeTab === "Welcome" && (
          <WelcomeTab state={state} setTab={setActiveTab} />
        )}
        {activeTab === "Descendants" && (
          <DescendantsTab state={state} setState={setState} />
        )}
        {activeTab === "Weapons" && (
          <WeaponsTab state={state} setState={setState} />
        )}
        {activeTab === "Reactors" && (
          <ReactorsTab state={state} setState={setState} />
        )}
        {activeTab === "Materials" && (
          <MaterialsTab state={state} setState={setState} />
        )}
        {activeTab === "Farming" && (
          <FarmingTab state={state} setState={setState} />
        )}
        {activeTab === "Friends" && (
          <FriendsTab
            sharePrivacy={state.sharePrivacy}
            onPrivacyChange={(p) => setState((prev) => ({ ...prev, sharePrivacy: p }))}
            shareToken={shareToken}
            onGenerateShare={handleShare}
          />
        )}
      </div>
    </div>
  );
}
