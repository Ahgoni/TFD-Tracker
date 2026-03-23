import type { ExternalComponent } from "@/app/tracker/tracker-client";

/** Human-readable external component set summary, e.g. "Slayer 2/4, Supernova 4/4". */
export function formatExternalComponentSetsSummary(ext: ExternalComponent[] | undefined | null): string | null {
  if (!ext?.length) return null;
  const counts: Record<string, number> = {};
  for (const c of ext) {
    if (c.set) counts[c.set] = (counts[c.set] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries
    .map(([name, n]) => {
      const tier = n >= 4 ? "4/4" : `${n}/4`;
      return `${name} ${tier}`;
    })
    .join(", ");
}
