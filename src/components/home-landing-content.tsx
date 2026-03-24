"use client";

import Link from "next/link";
import { DiscordSignInButton } from "@/app/discord-signin-button";
import { SiteTopNav } from "@/components/site-top-nav";
import { useI18n } from "@/contexts/i18n-context";
import { useSession } from "next-auth/react";

const FEATURE_ICONS = [
  (
    <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a10 10 0 0 1 7.39 16.67M12 2a10 10 0 0 0-7.39 16.67M12 22a10 10 0 0 0 7.39-16.67M12 22a10 10 0 0 1-7.39-16.67" />
      <path d="M2 12h4m12 0h4M12 2v4m0 12v4" />
    </svg>
  ),
  (
    <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h2l1-3h10l1 3h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1l-1 5H7l-1-5H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <path d="M8 8V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <line x1="12" y1="12" x2="12" y2="15" />
    </svg>
  ),
  (
    <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a7 7 0 0 1 13 0" />
      <path d="M17 11l2 2-2 2M7 11l-2 2 2 2" />
    </svg>
  ),
  (
    <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  (
    <svg key="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  ),
  (
    <svg key="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
];

export function HomeLandingContent() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && Boolean(session?.user?.id);

  return (
    <div className="landing">
      <SiteTopNav />

      <div style={{ position: "relative" }}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>
        <section className="hero" style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-badge">{t("home.heroBadge")}</div>
          <h1 className="hero-title">
            {t("home.heroTitleLine1")}
            <br />
            {t("home.heroTitleLine2")}
          </h1>
          <p className="hero-sub">{t("home.heroSub")}</p>
          <div className="hero-actions">
            {signedIn ? (
              <Link className="btn btn-primary btn-lg" href="/tracker">
                {t("home.openMyTracker")}
              </Link>
            ) : (
              <DiscordSignInButton label={t("nav.signInDiscord")} />
            )}
            <Link className="btn btn-ghost btn-lg" href="https://tfd.nexon.com/en/market" target="_blank" rel="noopener">
              {t("home.marketLink")}
            </Link>
          </div>
          <p className="hero-note">{t("home.heroNote")}</p>
        </section>
      </div>

      <section className="home-tier-cta-strip" aria-label={t("home.ctaTierList")}>
        <div className="home-tier-cta-inner">
          <div>
            <div className="home-tier-cta-title">{t("home.ctaTierList")}</div>
            <div className="home-tier-cta-sub">{t("home.ctaTierListSub")}</div>
          </div>
          <Link className="btn btn-primary btn-sm" href="/tier-list">
            {t("nav.tierList")} →
          </Link>
        </div>
      </section>

      <section className="features-section">
        <h2 className="features-heading">{t("home.featuresHeading")}</h2>
        <div className="features-grid">
          {FEATURE_ICONS.map((icon, i) => (
            <article className="feature-card" key={i}>
              <div className="feature-icon">{icon}</div>
              <h3>{t(`home.feature.${i + 1}.title`)}</h3>
              <p>{t(`home.feature.${i + 1}.desc`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-stat">
          <span className="landing-stat-num">140+</span>
          <span className="landing-stat-label">{t("home.stats.weapons")}</span>
        </div>
        <div className="landing-stat-div" />
        <div className="landing-stat">
          <span className="landing-stat-num">7</span>
          <span className="landing-stat-label">{t("home.stats.sections")}</span>
        </div>
        <div className="landing-stat-div" />
        <div className="landing-stat">
          <span className="landing-stat-num">{t("home.stats.freeValue")}</span>
          <span className="landing-stat-label">{t("home.stats.freeLabel")}</span>
        </div>
        <div className="landing-stat-div" />
        <div className="landing-stat">
          <span className="landing-stat-num">{t("home.stats.discordValue")}</span>
          <span className="landing-stat-label">{t("home.stats.discordLogin")}</span>
        </div>
      </section>

      <section className="cta-section">
        <h2>{t("home.ctaSectionTitle")}</h2>
        <p>{t("home.ctaSectionSub")}</p>
        {signedIn ? (
          <Link className="btn btn-primary btn-lg" href="/tracker">
            {t("home.openMyTracker")}
          </Link>
        ) : (
          <DiscordSignInButton label={t("home.getStarted")} />
        )}
      </section>

      <footer className="landing-footer">
        <span>{t("home.footer")}</span>
        <a href="https://tfd.nexon.com/en/market" target="_blank" rel="noopener">
          {t("home.marketLink")}
        </a>
      </footer>
    </div>
  );
}
