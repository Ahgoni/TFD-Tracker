import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";
import { requireUserId } from "@/lib/require-user";
import { isTierListMod } from "@/lib/tier-list-mod";
import { getTierListDescendants, getTierListWeapons } from "@/lib/tier-list-catalog";
import {
  distributionFromVoteTiers,
  mergeDistributionWithOverlay,
  statsFromDistribution,
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
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isTierListMod(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  const uniqueVotersByEntity = new Map<string, Set<string>>();
  for (const v of votes) {
    if (!entityKeys.has(v.entityKey)) continue;
    const list = votesByEntity.get(v.entityKey) ?? [];
    list.push(v.tier);
    votesByEntity.set(v.entityKey, list);
    let set = uniqueVotersByEntity.get(v.entityKey);
    if (!set) {
      set = new Set();
      uniqueVotersByEntity.set(v.entityKey, set);
    }
    set.add(v.userId);
  }

  const overlayRows = await prisma.tierListModOverlay.findMany({ where: { category } });
  const overlayMap = new Map<string, VoteDistribution>();
  for (const row of overlayRows) {
    if (!entityKeys.has(row.entityKey)) continue;
    overlayMap.set(row.entityKey, overlayRowToDist(row));
  }

  const sorted = [...entities].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const payload = sorted.map((e) => {
    const raw = distributionFromVoteTiers(votesByEntity.get(e.entityKey) ?? []);
    const overlay = overlayMap.get(e.entityKey);
    const effective = mergeDistributionWithOverlay(raw, overlay);
    const rawStats = statsFromDistribution(raw);
    const effStats = statsFromDistribution(effective);
    return {
      entityKey: e.entityKey,
      displayName: e.displayName,
      image: e.image,
      rawByTier: raw,
      overlayByTier: overlay ?? { S: 0, A: 0, B: 0, C: 0, D: 0 },
      effectiveByTier: effective,
      uniqueVoters: uniqueVotersByEntity.get(e.entityKey)?.size ?? 0,
      rawScorePercent: rawStats.scorePercent,
      effectiveScorePercent: effStats.scorePercent,
    };
  });

  return NextResponse.json({ tab, entities: payload });
}
