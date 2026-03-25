import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";
import { requireUserId } from "@/lib/require-user";
import { getTierListDescendants, getTierListWeapons } from "@/lib/tier-list-catalog";
import {
  bucketEntitiesByTier,
  type TierLetter,
  type VoteDistribution,
} from "@/lib/tier-list-aggregate";

function overlayRowToDist(row: {
  deltaS: number;
  deltaA: number;
  deltaB: number;
  deltaC: number;
  deltaD: number;
}): VoteDistribution {
  return { S: row.deltaS, A: row.deltaA, B: row.deltaB, C: row.deltaC, D: row.deltaD };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "weapons" ? "weapons" : "descendants";
  const category = tab === "weapons" ? TierListCategory.WEAPON : TierListCategory.DESCENDANT;

  const entities = tab === "weapons" ? getTierListWeapons() : getTierListDescendants();
  const entityKeys = new Set(entities.map((e) => e.entityKey));

  const votes = await prisma.tierVote.findMany({
    where: { category },
    select: { entityKey: true, tier: true, userId: true },
  });

  const votesByEntity = new Map<string, string[]>();
  for (const v of votes) {
    if (!entityKeys.has(v.entityKey)) continue;
    const list = votesByEntity.get(v.entityKey) ?? [];
    list.push(v.tier);
    votesByEntity.set(v.entityKey, list);
  }

  const overlayRows = await prisma.tierListModOverlay.findMany({ where: { category } });
  const overlayByEntity = new Map<string, VoteDistribution>();
  for (const row of overlayRows) {
    if (!entityKeys.has(row.entityKey)) continue;
    overlayByEntity.set(row.entityKey, overlayRowToDist(row));
  }

  const { buckets, statsByEntity } = bucketEntitiesByTier(entities, votesByEntity, overlayByEntity);

  const userId = await requireUserId();
  let myVotes: Record<string, string> = {};
  if (userId) {
    const mine = await prisma.tierVote.findMany({
      where: { userId, category },
      select: { entityKey: true, tier: true },
    });
    myVotes = Object.fromEntries(mine.map((m) => [m.entityKey, m.tier]));
  }

  const mapEntityToItem = (e: (typeof entities)[number]) => {
    const stats = statsByEntity.get(e.entityKey)!;
    return {
      entityKey: e.entityKey,
      displayName: e.displayName,
      image: e.image,
      voteCount: stats.totalVotes,
      votesByTier: stats.distribution,
      scorePercent: stats.scorePercent,
      consensusTier: stats.modeTier === "UNRANKED" ? null : stats.modeTier,
    };
  };

  const tierOrder: TierLetter[] = ["S", "A", "B", "C", "D"];
  const response = {
    tab,
    tiers: tierOrder.map((tier) => ({
      tier,
      items: buckets[tier].map(mapEntityToItem),
    })),
    unranked: buckets.UNRANKED.map(mapEntityToItem),
    myVotes,
  };

  return NextResponse.json(response);
}
