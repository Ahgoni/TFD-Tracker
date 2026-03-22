"use client";

import { useEffect } from "react";

/** Scroll to #build-{id} when present (shared profile links). */
export function BuildHashScroll() {
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash || !hash.startsWith("#build-")) return;
    const id = hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);
  return null;
}
