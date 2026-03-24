"use client";

import { useSession } from "next-auth/react";
import type { TrackerState } from "../tracker-client";

interface Props {
  state: TrackerState;
  setTab: (tab: string) => void;
}

const SECTION_CARDS = [
  {
    tab: "Descendants",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a7 7 0 0 1 13 0" />
      </svg>
    ),
    title: "Descendants",
    desc: "Track every descendant — level, arche level, and catalyst investment.",
    accent: "#00c8f0",
  },
  {
    tab: "Weapons",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h2l1-3h10l1 3h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1l-1 5H7l-1-5H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
        <path d="M8 8V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      </svg>
    ),
    title: "Weapons",
    desc: "All 140+ weapons pre-loaded. Mark acquired, set level, enhancements and cores.",
    accent: "#a855f7",
  },
  {
    tab: "Reactors",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12" />
      </svg>
    ),
    title: "Reactors",
    desc: "Log every reactor with element, skill type, substats, and tier color.",
    accent: "#f59e0b",
  },
  {
    tab: "Farming",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    title: "Farming Goals",
    desc: "Set active farming targets, check them off, and filter to your active grind.",
    accent: "#ef4444",
  },
  {
    tab: "Mastery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: "Mastery Rank",
    desc: "Track your mastery progress from descendants owned, weapons acquired, and more.",
    accent: "#f59e0b",
  },
  {
    tab: "Player Lookup",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
    title: "Player Lookup",
    desc: "Search any player by in-game name — visual loadout with modules, weapons, reactor & components (Nexon Open API).",
    accent: "#38bdf8",
  },
  {
    tab: "Builds",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Builds",
    desc: "Save descendant & weapon loadouts — modules, reactor notes, and share with friends on your profile.",
    accent: "#22d3ee",
  },
];

function activityToTab(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("weapon") || t.includes("acquired")) return "Weapons";
  if (t.includes("reactor")) return "Reactors";
  if (t.includes("descendant")) return "Descendants";
  if (t.includes("goal") || t.includes("farming")) return "Farming";
  if (t.includes("build")) return "Builds";
  return null;
}

export function WelcomeTab({ state, setTab }: Props) {
  const { data: session } = useSession();

  const totalReactors = state.reactors.length;
  const ownedWeapons = state.weapons.filter((w) => w.acquired).length;
  const totalWeapons = state.weapons.length;
  const activeGoals = state.goals.filter((g) => g.active && !g.completed).length;
  const ownedDescendants = state.descendants.filter((d) => d.owned).length;
  const totalDescendants = state.descendants.length;

  const recent = (state.activities ?? []).slice(0, 6);

  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.name ?? "Descendant";

  return (
    <div className="welcome-page">

      {/* ── Hero greeting ─────────────────────────────────────────── */}
      <section className="welcome-hero">
        <div className="welcome-hero-inner">
          {session?.user?.image && (
            <img src={session.user.image} alt="" className="welcome-avatar" />
          )}
          <div className="welcome-greeting">
            <p className="welcome-sub">Welcome back,</p>
            <h2 className="welcome-name">{firstName}</h2>
            <p className="welcome-tagline">Your inventory is saved and ready. What are you tracking today?</p>
          </div>
        </div>
      </section>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <section className="welcome-stats">
        <div className="wstat">
          <span className="wstat-value">
            {ownedDescendants}
            <span className="wstat-of">/{totalDescendants}</span>
          </span>
          <span className="wstat-label">Descendants Owned</span>
        </div>
        <div className="wstat-divider" />
        <div className="wstat">
          <span className="wstat-value">
            {ownedWeapons}
            <span className="wstat-of">/{totalWeapons}</span>
          </span>
          <span className="wstat-label">Weapons Owned</span>
        </div>
        <div className="wstat-divider" />
        <div className="wstat">
          <span className="wstat-value">{totalReactors}</span>
          <span className="wstat-label">Reactors Logged</span>
        </div>
        <div className="wstat-divider" />
        <div className="wstat">
          <span className="wstat-value">{activeGoals}</span>
          <span className="wstat-label">Active Goals</span>
        </div>
      </section>

      {/* ── Section cards ─────────────────────────────────────────── */}
      <section className="welcome-sections">
        <h3 className="welcome-section-heading">Your Tracker</h3>
        <div className="welcome-cards">
          {SECTION_CARDS.map(({ tab, icon, title, desc, accent }) => (
            <button
              key={tab}
              className="welcome-card"
              onClick={() => setTab(tab)}
              style={{ "--card-accent": accent } as React.CSSProperties}
            >
              <div className="welcome-card-icon">{icon}</div>
              <div className="welcome-card-body">
                <span className="welcome-card-title">{title}</span>
                <span className="welcome-card-desc">{desc}</span>
              </div>
              <svg className="welcome-card-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          ))}
        </div>
      </section>

      {/* ── Recent activity ───────────────────────────────────────── */}
      <section className="welcome-activity">
        <h3 className="welcome-section-heading">Recent Activity</h3>
        {recent.length === 0 ? (
          <div className="welcome-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p>Nothing tracked yet. Pick a section above and start logging your build!</p>
          </div>
        ) : (
          <ul className="welcome-activity-list">
            {recent.map((r) => {
              const tab = activityToTab(r.text);
              return (
                <li
                  key={r.id}
                  className={`welcome-activity-item${tab ? " clickable" : ""}`}
                  onClick={tab ? () => setTab(tab) : undefined}
                  onKeyDown={tab ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(tab); } } : undefined}
                  role={tab ? "button" : undefined}
                  tabIndex={tab ? 0 : undefined}
                  aria-label={tab ? `Go to ${tab}` : undefined}
                >
                  <span className="welcome-activity-dot" />
                  <span className="welcome-activity-text">{r.text}</span>
                  <span className="welcome-activity-time">
                    {new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
