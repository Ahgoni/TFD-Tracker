import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";
import { requireUserId } from "@/lib/require-user";
import { getTierListDescendants, getTierListWeapons } from "@/lib/tier-list-catalog";
import { bucketEntitiesByTier, type TierLetter } from "@/lib/tier-list-aggregate";

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

  const buckets = bucketEntitiesByTier(entities, votesByEntity);

  const userId = await requireUserId();
  let myVotes: Record<string, string> = {};
  if (userId) {
    const mine = await prisma.tierVote.findMany({
      where: { userId, category },
      select: { entityKey: true, tier: true },
    });
    myVotes = Object.fromEntries(mine.map((m) => [m.entityKey, m.tier]));
  }

  const tierOrder: TierLetter[] = ["S", "A", "B", "C", "D", "UNRANKED"];
  const response = {
    tab,
    tiers: tierOrder.map((tier) => ({
      tier,
      items: buckets[tier].map((e) => ({
        entityKey: e.entityKey,
        displayName: e.displayName,
        image: e.image,
        voteCount: votesByEntity.get(e.entityKey)?.length ?? 0,
      })),
    })),
    myVotes,
  };

  return NextResponse.json(response);
}
