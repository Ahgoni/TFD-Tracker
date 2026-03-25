"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { BrandLogo } from "@/app/brand-logo";
import { ThemeToggle } from "@/app/theme-toggle";
import { DiscordSignInButton } from "@/app/discord-signin-button";
import { useI18n } from "@/contexts/i18n-context";
import { LanguageSelect } from "@/components/language-select";

export function SiteTopNav() {
  const pathname = usePathname() ?? "";
  const { data: session, status } = useSession();
  const { t } = useI18n();
  const signedIn = status === "authenticated" && Boolean(session?.user?.id);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = [
    { href: "/", label: t("nav.home"), active: pathname === "/" },
    {
      href: "/tier-list",
      label: t("nav.tierList"),
      active: pathname.startsWith("/tier-list"),
    },
    ...(signedIn
      ? [
          {
            href: "/tracker",
            label: t("nav.tracker"),
            active: pathname.startsWith("/tracker"),
          },
        ]
      : []),
  ] as const;

  const linkNodes = (onNavigate?: () => void) =>
    navLinks.map(({ href, label, active }) => (
      <Link
        key={href}
        href={href}
        className={active ? "site-nav-active" : undefined}
        onClick={onNavigate}
      >
        {label}
      </Link>
    ));

  return (
    <nav className="landing-nav site-top-nav">
      <div className="site-top-nav-bar">
        <div className="site-top-nav-left">
          <Link href="/" className="landing-logo" aria-label="TFD Tracker home">
            <BrandLogo size={30} />
            <span>TFD Tracker</span>
          </Link>
          <div className="site-nav-links site-nav-links-desktop" role="navigation" aria-label="Site">
            {linkNodes()}
          </div>
        </div>
        <div className="landing-nav-actions landing-nav-actions-desktop">
          <LanguageSelect />
          <ThemeToggle compact />
          {signedIn ? (
            <>
              {session?.user?.image && (
                <img className="nav-avatar" src={session.user.image} alt="" />
              )}
              <span className="nav-username">{session?.user?.name}</span>
              <Link className="btn btn-primary btn-sm" href="/tracker">
                {t("nav.openTracker")}
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
                {t("nav.signOut")}
              </button>
            </>
          ) : (
            <DiscordSignInButton label={t("nav.signInDiscord")} size="sm" />
          )}
        </div>
        <button
          type="button"
          className="site-nav-menu-btn"
          aria-expanded={menuOpen}
          aria-controls="site-nav-drawer"
          aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="site-nav-mobile-drawer" id="site-nav-drawer">
          <div className="site-nav-links site-nav-links-mobile" role="navigation" aria-label="Site">
            {linkNodes(closeMenu)}
          </div>
          <div className="site-nav-mobile-actions">
            <LanguageSelect />
            <ThemeToggle compact />
            {signedIn ? (
              <>
                <div className="site-nav-mobile-user">
                  {session?.user?.image && (
                    <img className="nav-avatar" src={session.user.image} alt="" />
                  )}
                  <span className="nav-username">{session?.user?.name}</span>
                </div>
                <Link className="btn btn-primary btn-sm" href="/tracker" onClick={closeMenu}>
                  {t("nav.openTracker")}
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => { closeMenu(); signOut({ callbackUrl: "/" }); }}>
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <DiscordSignInButton label={t("nav.signInDiscord")} size="sm" />
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
