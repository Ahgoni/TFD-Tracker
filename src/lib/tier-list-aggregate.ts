import type { TierListEntity } from "@/lib/tier-list-catalog";

const TIERS = ["S", "A", "B", "C", "D"] as const;
export type TierLetter = (typeof TIERS)[number] | "UNRANKED";

export type VoteRow = { entityKey: string; tier: string };

/** Plurality winner; ties break toward S → A → B → C → D. */
export function winningTierForEntity(votes: string[]): TierLetter {
  const tiers = votes.filter((t): t is (typeof TIERS)[number] => (TIERS as readonly string[]).includes(t));
  if (tiers.length === 0) return "UNRANKED";
  const counts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const t of tiers) {
    if (counts[t] !== undefined) counts[t]++;
  }
  let best: TierLetter = "D";
  let bestN = -1;
  for (const t of TIERS) {
    const n = counts[t];
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

export function bucketEntitiesByTier(
  entities: TierListEntity[],
  votesByEntity: Map<string, string[]>,
): Record<TierLetter, TierListEntity[]> {
  const buckets: Record<TierLetter, TierListEntity[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    UNRANKED: [],
  };
  for (const e of entities) {
    const w = winningTierForEntity(votesByEntity.get(e.entityKey) ?? []);
    buckets[w].push(e);
  }
  for (const k of Object.keys(buckets) as TierLetter[]) {
    buckets[k].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return buckets;
}
