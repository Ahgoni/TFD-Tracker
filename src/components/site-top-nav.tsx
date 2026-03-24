"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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

  return (
    <nav className="landing-nav site-top-nav">
      <div className="site-top-nav-left">
        <Link href="/" className="landing-logo" aria-label="TFD Tracker home">
          <BrandLogo size={30} />
          <span>TFD Tracker</span>
        </Link>
        <div className="site-nav-links" role="navigation" aria-label="Site">
          <Link href="/" className={pathname === "/" ? "site-nav-active" : undefined}>
            {t("nav.home")}
          </Link>
          <Link href="/tier-list" className={pathname.startsWith("/tier-list") ? "site-nav-active" : undefined}>
            {t("nav.tierList")}
          </Link>
          {signedIn && (
            <Link href="/tracker" className={pathname.startsWith("/tracker") ? "site-nav-active" : undefined}>
              {t("nav.tracker")}
            </Link>
          )}
        </div>
      </div>
      <div className="landing-nav-actions">
        <LanguageSelect />
        <ThemeToggle compact />
        {signedIn ? (
          <>
            {session?.user?.image && <img className="nav-avatar" src={session.user.image} alt="" />}
            <span className="nav-username">{session?.user?.name}</span>
            <Link className="btn btn-primary btn-sm" href="/tracker">
              {t("nav.openTracker")}
            </Link>
            <Link className="btn btn-ghost btn-sm" href="/api/auth/signout">
              {t("nav.signOut")}
            </Link>
          </>
        ) : (
          <DiscordSignInButton label={t("nav.signInDiscord")} size="sm" />
        )}
      </div>
    </nav>
  );
}
