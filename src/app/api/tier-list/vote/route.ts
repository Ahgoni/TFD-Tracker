import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";
import { requireUserId } from "@/lib/require-user";
import { getTierListDescendants, weaponSlugSet } from "@/lib/tier-list-catalog";

const bodySchema = z.object({
  tab: z.enum(["descendants", "weapons"]),
  entityKey: z.string().min(1).max(120),
  tier: z.enum(["S", "A", "B", "C", "D"]),
});

async function validEntityKey(tab: "descendants" | "weapons", entityKey: string): Promise<boolean> {
  if (tab === "weapons") return (await weaponSlugSet()).has(entityKey);
  const groups = new Set((await getTierListDescendants()).map((e) => e.entityKey));
  return groups.has(entityKey);
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Sign in with Discord to vote." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { tab, entityKey, tier } = parsed.data;
  if (!(await validEntityKey(tab, entityKey))) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  const category = tab === "weapons" ? TierListCategory.WEAPON : TierListCategory.DESCENDANT;

  await prisma.tierVote.upsert({
    where: {
      userId_category_entityKey: { userId, category, entityKey },
    },
    create: { userId, category, entityKey, tier },
    update: { tier },
  });

  return NextResponse.json({ ok: true });
}
