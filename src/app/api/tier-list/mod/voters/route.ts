import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";
import { requireUserId } from "@/lib/require-user";
import { isTierListMod } from "@/lib/tier-list-mod";
import { getTierListDescendants, weaponSlugSet } from "@/lib/tier-list-catalog";

async function validEntityKey(tab: "descendants" | "weapons", entityKey: string): Promise<boolean> {
  if (tab === "weapons") return (await weaponSlugSet()).has(entityKey);
  const groups = new Set((await getTierListDescendants()).map((e) => e.entityKey));
  return groups.has(entityKey);
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isTierListMod(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "weapons" ? "weapons" : "descendants";
  const entityKey = searchParams.get("entityKey")?.trim() ?? "";
  if (!entityKey || !(await validEntityKey(tab, entityKey))) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }
  const category = tab === "weapons" ? TierListCategory.WEAPON : TierListCategory.DESCENDANT;

  const rows = await prisma.tierVote.findMany({
    where: { category, entityKey },
    select: {
      id: true,
      userId: true,
      tier: true,
      createdAt: true,
      user: { select: { username: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    votes: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username,
      name: r.user.name,
      tier: r.tier,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
