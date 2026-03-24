import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DiscordSignInButton } from "./discord-signin-button";
import { ThemeToggle } from "./theme-toggle";
import { BrandLogo } from "./brand-logo";
import { CommunityTierList } from "@/components/community-tier-list";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2a10 10 0 0 1 7.39 16.67M12 2a10 10 0 0 0-7.39 16.67M12 22a10 10 0 0 0 7.39-16.67M12 22a10 10 0 0 1-7.39-16.67"/>
        <path d="M2 12h4m12 0h4M12 2v4m0 12v4"/>
      </svg>
    ),
    title: "Reactor Inventory",
    desc: "Log every reactor with element, skill type, substats, and tier coloring. Instantly see which are Ultimate-tier.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h2l1-3h10l1 3h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1l-1 5H7l-1-5H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
        <path d="M8 8V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
        <line x1="12" y1="12" x2="12" y2="15"/>
      </svg>
    ),
    title: "Weapons Catalog",
    desc: "All 140+ weapons pre-loaded. Track acquired status, level, catalysts, enhancement, and weapon core per weapon.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4"/>
        <path d="M5.5 21a7 7 0 0 1 13 0"/>
        <path d="M17 11l2 2-2 2M7 11l-2 2 2 2"/>
      </svg>
    ),
    title: "Descendant Progress",
    desc: "Track every descendant you've built — level, arche level, and catalyst investment across your whole roster.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    title: "Saved Builds",
    desc: "Plan module loadouts per weapon or descendant, save named builds, and share them with your squad.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
        <line x1="12" y1="2" x2="12" y2="4"/>
        <line x1="12" y1="20" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="4" y2="12"/>
        <line x1="20" y1="12" x2="22" y2="12"/>
      </svg>
    ),
    title: "Farming Goals",
    desc: "Set active farming targets, toggle them done, and filter down to only what you're currently grinding.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Friend Inventories",
    desc: "Add friends by share link and browse their full read-only inventory. See exactly what gear your squad has.",
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className="landing">

      {/* ── Nav bar ─────────────────────────────────────────── */}
      <nav className="landing-nav">
        <Link href="/" className="landing-logo" aria-label="TFD Tracker home">
          <BrandLogo size={30} />
          <span>TFD Tracker</span>
        </Link>
        <div className="landing-nav-actions">
          <ThemeToggle compact />
          {signedIn ? (
            <>
              {session?.user?.image && <img className="nav-avatar" src={session.user.image} alt="" />}
              <span className="nav-username">{session?.user?.name}</span>
              <Link className="btn btn-primary btn-sm" href="/tracker">Open Tracker</Link>
              <Link className="btn btn-ghost btn-sm" href="/api/auth/signout">Sign out</Link>
            </>
          ) : (
            <DiscordSignInButton label="Sign in with Discord" size="sm" />
          )}
        </div>
      </nav>

      <CommunityTierList />

      {/* ── Hero ────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>
        <section className="hero" style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-badge">The First Descendant</div>
          <h1 className="hero-title">Your Personal<br />Inventory Tracker</h1>
          <p className="hero-sub">
            Keep track of every reactor, weapon, and descendant — saved to your account,
            accessible anywhere, shareable with your squad.
          </p>
          <div className="hero-actions">
            {signedIn ? (
              <Link className="btn btn-primary btn-lg" href="/tracker">Open My Tracker</Link>
            ) : (
              <DiscordSignInButton />
            )}
            <Link className="btn btn-ghost btn-lg" href="https://tfd.nexon.com/en/market" target="_blank" rel="noopener">
              TFD Market ↗
            </Link>
          </div>
          <p className="hero-note">No account needed beyond Discord · Your data stays private · Share when you want to</p>
        </section>
      </div>

      {/* ── Feature grid ────────────────────────────────────── */}
      <section className="features-section">
        <h2 className="features-heading">Everything you need to track your build</h2>
        <div className="features-grid">
          {features.map((f) => (
            <article className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <section className="landing-stats">
        <div className="landing-stat">
          <span className="landing-stat-num">140+</span>
          <span className="landing-stat-label">Weapons tracked</span>
        </div>
        <div className="landing-stat-div" />
        <div className="landing-stat">
          <span className="landing-stat-num">7</span>
          <span className="landing-stat-label">Tracker sections</span>
        </div>
        <div className="landing-stat-div" />
        <div className="landing-stat">
          <span className="landing-stat-num">Free</span>
          <span className="landing-stat-label">Always, forever</span>
        </div>
        <div className="landing-stat-div" />
        <div className="landing-stat">
          <span className="landing-stat-num">Discord</span>
          <span className="landing-stat-label">Login in one click</span>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="cta-section">
        <h2>Ready to organize your grind?</h2>
        <p>Sign in with Discord and your tracker is ready instantly — no setup required.</p>
        {signedIn ? (
          <Link className="btn btn-primary btn-lg" href="/tracker">Open My Tracker</Link>
        ) : (
          <DiscordSignInButton label="Get Started Free" />
        )}
      </section>

      <footer className="landing-footer">
        <span>TFD Tracker — not affiliated with NEXON Games Co., Ltd.</span>
        <a href="https://tfd.nexon.com/en/market" target="_blank" rel="noopener">TFD Market ↗</a>
      </footer>
    </div>
  );
}
