"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Old links used `/u/name#build-id` (full profile + scroll). Tier hub and copy-link now use `/u/name/b/build-id`.
 * Redirect hash URLs to the spotlight page so viewers only see the build.
 */
export function BuildHashRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash?.startsWith("#build-")) return;
    const buildId = hash.slice("#build-".length);
    if (!buildId) return;
    const seg = pathname.split("/").filter(Boolean);
    if (seg[0] !== "u" || !seg[1]) return;
    const username = seg[1];
    router.replace(`/u/${encodeURIComponent(username)}/b/${encodeURIComponent(buildId)}`);
  }, [pathname, router]);

  return null;
}
