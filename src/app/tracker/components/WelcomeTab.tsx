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
    tab: "Materials",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
    title: "Materials",
    desc: "Quick +/- counters for every crafting material. Always know what you have.",
    accent: "#10b981",
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
    tab: "Progression",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Progression Notes",
    desc: "Track goals, notes, and personal milestones across weapons, reactors, and builds.",
    accent: "#6366f1",
  },
];

export function WelcomeTab({ state, setTab }: Props) {
  const { data: session } = useSession();

  const totalReactors = state.reactors.length;
  const ownedWeapons = state.weapons.filter((w) => w.acquired).length;
  const totalWeapons = state.weapons.length;
  const activeGoals = state.goals.filter((g) => g.active && !g.completed).length;
  const totalMaterials = state.materials.reduce((s, m) => s + Number(m.qty ?? 0), 0);
  const descendants = state.descendants.length;

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
          <span className="wstat-value">{descendants}</span>
          <span className="wstat-label">Descendants</span>
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
        <div className="wstat-divider" />
        <div className="wstat">
          <span className="wstat-value">{totalMaterials}</span>
          <span className="wstat-label">Total Materials</span>
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
            {recent.map((r) => (
              <li key={r.id} className="welcome-activity-item">
                <span className="welcome-activity-dot" />
                <span className="welcome-activity-text">{r.text}</span>
                <span className="welcome-activity-time">
                  {new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
