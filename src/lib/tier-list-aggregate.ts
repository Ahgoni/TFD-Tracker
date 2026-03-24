import type { TierListEntity } from "@/lib/tier-list-catalog";

const TIERS = ["S", "A", "B", "C", "D"] as const;
export type TierLetter = (typeof TIERS)[number] | "UNRANKED";

/** S=5 … D=1 — weighted mean drives row placement and score %. */
const TIER_WEIGHT: Record<(typeof TIERS)[number], number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

export type VoteDistribution = Record<(typeof TIERS)[number], number>;

export type EntityVoteStats = {
  distribution: VoteDistribution;
  totalVotes: number;
  /** Mean tier weight 1–5; null if no valid votes. */
  weightedMean: number | null;
  /** 0–100 (D→0, S→100); null if unranked. */
  scorePercent: number | null;
  /** Which tier row the entity appears in (rounded weighted mean). */
  bucketTier: TierLetter;
  /** Plurality tier for “largest segment” label; ties favor S → A → … → D. */
  modeTier: TierLetter;
};

function emptyDistribution(): VoteDistribution {
  return { S: 0, A: 0, B: 0, C: 0, D: 0 };
}

function tierFromRoundedMean(mean: number): (typeof TIERS)[number] {
  const r = Math.round(Math.min(5, Math.max(1, mean)));
  const map: Record<1 | 2 | 3 | 4 | 5, (typeof TIERS)[number]> = {
    1: "D",
    2: "C",
    3: "B",
    4: "A",
    5: "S",
  };
  return map[r as 1 | 2 | 3 | 4 | 5];
}

/** Mode; ties break toward higher tier (S first). */
function modeTierFromCounts(counts: VoteDistribution): TierLetter {
  let best: (typeof TIERS)[number] = "D";
  let bestN = -1;
  for (const t of TIERS) {
    const n = counts[t];
    if (n > bestN) {
      bestN = n;
      best = t;
    }
  }
  if (bestN <= 0) return "UNRANKED";
  return best;
}

export function computeEntityVoteStats(votes: string[]): EntityVoteStats {
  const dist = emptyDistribution();
  for (const raw of votes) {
    if ((TIERS as readonly string[]).includes(raw)) {
      dist[raw as keyof VoteDistribution]++;
    }
  }
  const total = dist.S + dist.A + dist.B + dist.C + dist.D;
  if (total === 0) {
    return {
      distribution: dist,
      totalVotes: 0,
      weightedMean: null,
      scorePercent: null,
      bucketTier: "UNRANKED",
      modeTier: "UNRANKED",
    };
  }
  let sum = 0;
  for (const t of TIERS) {
    sum += TIER_WEIGHT[t] * dist[t];
  }
  const weightedMean = sum / total;
  const scorePercent = Math.round(((weightedMean - 1) / 4) * 100);
  return {
    distribution: dist,
    totalVotes: total,
    weightedMean,
    scorePercent,
    bucketTier: tierFromRoundedMean(weightedMean),
    modeTier: modeTierFromCounts(dist),
  };
}

export function bucketEntitiesByTier(
  entities: TierListEntity[],
  votesByEntity: Map<string, string[]>,
): {
  buckets: Record<TierLetter, TierListEntity[]>;
  statsByEntity: Map<string, EntityVoteStats>;
} {
  const statsByEntity = new Map<string, EntityVoteStats>();
  for (const e of entities) {
    statsByEntity.set(e.entityKey, computeEntityVoteStats(votesByEntity.get(e.entityKey) ?? []));
  }

  const buckets: Record<TierLetter, TierListEntity[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    UNRANKED: [],
  };

  for (const e of entities) {
    const stats = statsByEntity.get(e.entityKey)!;
    buckets[stats.bucketTier].push(e);
  }

  for (const k of Object.keys(buckets) as TierLetter[]) {
    buckets[k].sort((a, b) => {
      const sa = statsByEntity.get(a.entityKey)!;
      const sb = statsByEntity.get(b.entityKey)!;
      const pa = sa.scorePercent ?? -1;
      const pb = sb.scorePercent ?? -1;
      if (pb !== pa) return pb - pa;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  return { buckets, statsByEntity };
}
