"use client";

import { signIn } from "next-auth/react";

type Props = {
  /** Where to send the user after Discord returns (defaults to current page when clicked). */
  callbackUrl?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Starts Discord OAuth without visiting NextAuth’s generic GET `/api/auth/signin` page
 * (that page only exists for provider selection). Uses the same POST flow as `signIn()`.
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
        void signIn("discord", { callbackUrl: target });
      }}
    >
      {children}
    </a>
  );
}
