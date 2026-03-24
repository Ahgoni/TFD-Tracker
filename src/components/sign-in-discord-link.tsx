"use client";

import { redirectToDiscordOAuth } from "@/lib/discord-oauth-redirect";

type Props = {
  /** Where to send the user after Discord returns (defaults to current page when clicked). */
  callbackUrl?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Starts Discord OAuth via POST `/api/auth/signin/discord` (skips `getProviders()`, which can
 * fall back to GET `/api/auth/signin` and show NextAuth’s built-in page).
 */
export function SignInWithDiscordLink({ callbackUrl, className, children }: Props) {
  return (
    <a
      href="#"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const target =
          callbackUrl ?? (typeof window !== "undefined" ? window.location.href : "/tracker");
        void redirectToDiscordOAuth(target).catch((err) => {
          window.alert(err instanceof Error ? err.message : "Sign-in failed.");
        });
      }}
    >
      {children}
    </a>
  );
}
