"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageSelect } from "@/components/language-select";
import { WelcomeTab } from "./components/WelcomeTab";
import { DescendantsTab } from "./components/DescendantsTab";
import { WeaponsTab } from "./components/WeaponsTab";
import { ReactorsTab } from "./components/ReactorsTab";
import { FarmingTab } from "./components/FarmingTab";
import { MasteryTab } from "./components/MasteryTab";
import { BuildsTab } from "./components/BuildsTab";
import { ProfileMenu } from "./components/ProfileMenu";
import { FriendsTab } from "./components/FriendsTab";
import { PlayerLookupTab } from "./components/PlayerLookupTab";
import { normalizeWeaponName } from "@/lib/tracker-data";
import { fetchDescendantsCatalogRows } from "@/lib/fetch-game-catalog";
import type { DescendantCatalogRow } from "@/lib/nexon-catalog-transform";
import { ThemeToggle } from "../theme-toggle";
import { BrandLogo } from "../brand-logo";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

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
  level: number;
  enhancement: string;
  substats: ReactorSubstat[];
  notes: string;
}

/** Strip legacy fields and map enhancement `Max` → `5` (max is 5). */
export function normalizeReactorEntry(
  r: Partial<ReactorEntry> & { id: string; descendant?: string },
): ReactorEntry {
  let enh = String(r.enhancement ?? "0").trim();
  if (enh.toLowerCase() === "max") enh = "5";
  return {
    id: r.id,
    name: r.name ?? "",
    element: r.element ?? "",
    skillType: r.skillType ?? "",
    level: typeof r.level === "number" ? r.level : 100,
    enhancement: enh,
    substats: Array.isArray(r.substats) ? r.substats : [],
    notes: r.notes ?? "",
  };
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
  owned: boolean;
  /** Nexon `descendant_group_id` — same group shares Transcendent modules (base ↔ Ultimate). */
  groupId?: string;
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

/** Module placed in the drag-and-drop planner (denormalized for sharing). */
export interface AncestorStat {
  stat: string;
  value: number;
}

export interface PlacedModule {
  moduleId: string;
  level: number;
  name: string;
  image: string;
  capacity: number;
  socket: string;
  tier: string;
  /** For ancestor/resolution modules where the user edits effect values. */
  customPreview?: string;
  /** Structured ancestor module substats. */
  ancestorStats?: {
    positives: AncestorStat[];
    negative?: AncestorStat;
  };
}

export interface ExternalComponent {
  slot: string;
  baseStat: string;
  baseValue: number;
  substats: { stat: string; value: number }[];
  set?: string;
}

/** Reactor attached to a specific build (may or may not be saved in inventory). */
export interface BuildReactor {
  /** Links to a saved reactor ID in state.reactors (optional). */
  id?: string;
  name: string;
  element: string;
  skillType: string;
  level: number;
  enhancement: string;
  substats: ReactorSubstat[];
}

/** Saved loadout for a descendant or weapon (modules + notes). Shared with friends via profile/share. */
export interface BuildEntry {
  id: string;
  name: string;
  targetType: "descendant" | "weapon";
  /** Descendant name or weapon slug */
  targetKey: string;
  displayName: string;
  imageUrl: string;
  /** Legacy text lines (still used as fallback summary). */
  moduleSlots: string[];
  /** Nexon-style planner: 10 slots (weapon) or 12 (descendant). */
  plannerSlots?: (PlacedModule | null)[] | null;
  /** Reactor paired with this build (inline or imported from inventory). */
  reactor?: BuildReactor | null;
  /** Target level for stat calculations (descendant 1-40, weapon 1-100). */
  targetLevel?: number;
  /** Arche level for descendant builds. */
  archeLevel?: number;
  /** 4 external component slots for descendant builds. */
  externalComponents?: ExternalComponent[];
  /** @deprecated Optional legacy field; pairing notes field removed from editor. */
  reactorNotes?: string;
  /** When true, build can appear on the public community tier hub (requires open profile sharing). */
  communityPublic?: boolean;
  notes: string;
  updatedAt: string;
}

export interface TrackerState {
  tabs: string[];
  activeTab: string;
  activities: ActivityEntry[];
  weapons: WeaponEntry[];
  reactors: ReactorEntry[];
  descendants: DescendantEntry[];
  builds: BuildEntry[];
  goals: GoalEntry[];
  goalsFilters: { hideCompleted: boolean; onlyActive: boolean };
  weaponFilters: { search: string; rarity: string; rounds: string; sort: string; ownership: string };
  descFilters: { search: string; element: string; ownership: string };
  buildFilters: { search: string; type: string };
  filters: { element: string; skill: string };
  notesTabs: Record<string, Array<{ id: string; text: string; done?: boolean }>>;
  sharePrivacy: "open" | "link_only";
}

const DEFAULT_STATE: TrackerState = {
  tabs: [
    "Welcome",
    "Descendants",
    "Weapons",
    "Reactors",
    "Farming",
    "Mastery",
    "Player Lookup",
    "Builds",
    "Friends",
  ],
  activeTab: "Welcome",
  activities: [],
  weapons: [],
  reactors: [],
  descendants: [],
  builds: [],
  goals: [],
  goalsFilters: { hideCompleted: false, onlyActive: false },
  weaponFilters: { search: "", rarity: "all", rounds: "all", sort: "name-asc", ownership: "all" },
  descFilters: { search: "", element: "all", ownership: "all" },
  buildFilters: { search: "", type: "all" },
  filters: { element: "all", skill: "all" },
  notesTabs: { Weapons: [] },
  sharePrivacy: "open",
};

const STORAGE_KEY = "tfd-tracker-v2";

/** Strip legacy materials feature from persisted JSON (tab removed from app). */
function migrateStateNoMaterials(raw: Record<string, unknown>): void {
  delete raw.materials;
  if (Array.isArray(raw.tabs)) {
    raw.tabs = (raw.tabs as string[]).filter((t) => t !== "Materials");
  }
  if (raw.activeTab === "Materials") raw.activeTab = "Welcome";
}

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
        w.icon = icon || w.icon;
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

// ── Descendants catalog helpers ───────────────────────────────────────────────

async function fetchAndMergeDescendantsCatalog(current: DescendantEntry[]): Promise<DescendantEntry[]> {
  try {
    const catalog = await fetchDescendantsCatalogRows();
    if (!catalog || catalog.length === 0) return current;

    const byName = new Map(current.map((d) => [d.name, d]));

    return catalog.map((c: DescendantCatalogRow) => {
      const existing = byName.get(c.name);
      if (existing) {
        return {
          ...existing,
          id: c.id,
          groupId: c.groupId ?? existing.groupId,
          element: c.element,
          skills: c.skillTypes,
          portrait: c.image,
          owned: existing.owned ?? true,
        };
      }
      return {
        id: c.id,
        name: c.name,
        groupId: c.groupId,
        element: c.element,
        skills: c.skillTypes,
        level: 1,
        archeLevel: 1,
        catalysts: 0,
        portrait: c.image,
        owned: false,
      };
    });
  } catch {
    return current;
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
        const rawState = { ...(data.state ?? {}) } as Record<string, unknown>;
        migrateStateNoMaterials(rawState);

        let loaded: TrackerState = {
          ...DEFAULT_STATE,
          ...(rawState as Partial<TrackerState>),
          weaponFilters: {
            ...DEFAULT_STATE.weaponFilters,
            ...(data.state?.weaponFilters ?? {}),
          },
          descFilters: { ...DEFAULT_STATE.descFilters, ...(data.state?.descFilters ?? {}) },
          buildFilters: { ...DEFAULT_STATE.buildFilters, ...(data.state?.buildFilters ?? {}) },
          goalsFilters: { ...DEFAULT_STATE.goalsFilters, ...(data.state?.goalsFilters ?? {}) },
          filters: { ...DEFAULT_STATE.filters, ...(data.state?.filters ?? {}) },
          notesTabs: { ...DEFAULT_STATE.notesTabs, ...(data.state?.notesTabs ?? {}) },
        };

        if (!loaded.tabs.includes("Friends")) {
          loaded.tabs = [...loaded.tabs, "Friends"];
        }
        if (!loaded.tabs.includes("Mastery")) {
          loaded.tabs = [...loaded.tabs.filter((t) => t !== "Friends"), "Mastery", "Friends"];
        }
        if (!loaded.tabs.includes("Builds")) {
          const fi = loaded.tabs.indexOf("Friends");
          if (fi >= 0) loaded.tabs.splice(fi, 0, "Builds");
          else loaded.tabs = [...loaded.tabs, "Builds"];
        }
        if (!loaded.tabs.includes("Player Lookup")) {
          const bi = loaded.tabs.indexOf("Builds");
          if (bi >= 0) loaded.tabs.splice(bi, 0, "Player Lookup");
          else {
            const fi = loaded.tabs.indexOf("Friends");
            if (fi >= 0) loaded.tabs.splice(fi, 0, "Player Lookup");
            else loaded.tabs.push("Player Lookup");
          }
        }
        loaded.tabs = loaded.tabs.filter((t) => t !== "Progression");
        if (!Array.isArray(loaded.builds)) loaded.builds = [];
        loaded.builds = loaded.builds.map((b) => ({
          ...b,
          communityPublic: b.communityPublic === true,
        }));

        if (Array.isArray(loaded.reactors)) {
          loaded.reactors = loaded.reactors.map((x) =>
            normalizeReactorEntry(x as Parameters<typeof normalizeReactorEntry>[0]),
          );
        }

        if (Array.isArray(loaded.weapons)) {
          loaded.weapons = loaded.weapons.map((w) => ({
            ...w,
            icon: (w.icon ?? "").replace("./Images", "/Images"),
          }));
        }

        loaded.weapons = await fetchAndMergeWeaponsCatalog(loaded.weapons);

        // Migrate old descendants: mark as owned, merge with full catalog
        if (Array.isArray(loaded.descendants)) {
          loaded.descendants = loaded.descendants.map((d) => ({
            ...d,
            owned: d.owned ?? true,
          }));
        }
        loaded.descendants = await fetchAndMergeDescendantsCatalog(loaded.descendants);

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
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      migrateStateNoMaterials(parsed);
      await fetch("/api/state/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: parsed }),
      });
      const merged: TrackerState = { ...DEFAULT_STATE, ...(parsed as Partial<TrackerState>) };
      if (!Array.isArray(merged.builds)) merged.builds = [];
      merged.builds = merged.builds.map((b) => ({
        ...b,
        communityPublic: b.communityPublic === true,
      }));
      merged.buildFilters = { ...DEFAULT_STATE.buildFilters, ...merged.buildFilters };
      if (Array.isArray(merged.reactors)) {
        merged.reactors = merged.reactors.map((x) =>
          normalizeReactorEntry(x as Parameters<typeof normalizeReactorEntry>[0]),
        );
      }
      merged.weapons = await fetchAndMergeWeaponsCatalog(merged.weapons ?? []);
      merged.descendants = await fetchAndMergeDescendantsCatalog(merged.descendants ?? []);
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
    if (token) {
      setShareToken(token);
      setShowShare(true);
    } else {
      window.alert("Could not create a share link. Check your connection and that you are signed in, then try again.");
    }
  }

  async function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } else {
      window.prompt("Copy this link:", url);
    }
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
  const { t } = useI18n();
  const pathname = usePathname() ?? "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <div className="topbar-left-cluster">
            <div className="brand">
              <h1>
                <BrandLogo size={26} />
                <span className="brand-tfd">TFD</span> Tracker
              </h1>
              <p>Cloud inventory · Discord login · private per-user data</p>
            </div>
            <nav className="topbar-site-links" aria-label="Site">
              <Link href="/" className={pathname === "/" ? "active" : undefined}>
                {t("nav.home")}
              </Link>
              <Link href="/tier-list" className={pathname.startsWith("/tier-list") ? "active" : undefined}>
                {t("nav.tierList")}
              </Link>
            </nav>
          </div>
          <div className="topbar-right">
            <span className={`save-status ${statusClass}`}>
              {saveStatus === "saving" && <span className="save-pulse" />}
              {statusText}
            </span>
            <LanguageSelect />
            <ThemeToggle compact />
            <ProfileMenu
              onShare={handleShare}
              shareActive={showShare}
              sharePrivacy={state.sharePrivacy}
              onPrivacyChange={(p) => setState((prev) => ({ ...prev, sharePrivacy: p }))}
              onImportFromBrowser={importFromLocalStorage}
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
        {activeTab === "Farming" && (
          <FarmingTab state={state} setState={setState} />
        )}
        {activeTab === "Mastery" && (
          <MasteryTab state={state} />
        )}
        {activeTab === "Player Lookup" && <PlayerLookupTab />}
        {activeTab === "Builds" && (
          <BuildsTab state={state} setState={setState} />
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
