"use client";

import { getCsrfToken } from "next-auth/react";

/** Turn relative paths into absolute URLs so NextAuth accepts the OAuth callback. */
export function normalizeOAuthCallbackUrl(callbackUrl: string): string {
  if (typeof window === "undefined") return callbackUrl;
  if (callbackUrl.startsWith("http://") || callbackUrl.startsWith("https://")) return callbackUrl;
  const path = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`;
  return `${window.location.origin}${path}`;
}

/**
 * Starts Discord OAuth with a POST to `/api/auth/signin/discord` (same as NextAuth’s `signIn()`),
 * but skips `getProviders()`. When that client fetch fails, NextAuth falls back to GET
 * `/api/auth/signin` — the built-in provider picker / error page users want to avoid.
 */
export async function redirectToDiscordOAuth(callbackUrl: string = "/tracker"): Promise<void> {
  const csrf = await getCsrfToken();
  if (!csrf) {
    throw new Error("Could not start sign-in (CSRF). Refresh and try again.");
  }
  const target = normalizeOAuthCallbackUrl(callbackUrl);
  const res = await fetch(`${window.location.origin}/api/auth/signin/discord`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf,
      callbackUrl: target,
      json: "true",
    }),
  });
  let data: { url?: string };
  try {
    data = (await res.json()) as { url?: string };
  } catch {
    throw new Error("Invalid response from sign-in.");
  }
  const url = data?.url;
  if (!res.ok || !url) {
    throw new Error("Discord sign-in could not start. Check the network tab or try again.");
  }
  window.location.assign(url);
}
