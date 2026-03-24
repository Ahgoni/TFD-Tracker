import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";
import { requireUserId } from "@/lib/require-user";
import { isTierListMod } from "@/lib/tier-list-mod";
import { getTierListDescendants, weaponSlugSet } from "@/lib/tier-list-catalog";

const bodySchema = z.object({
  tab: z.enum(["descendants", "weapons"]),
  entityKey: z.string().min(1).max(120),
});

function validEntityKey(tab: "descendants" | "weapons", entityKey: string): boolean {
  if (tab === "weapons") return weaponSlugSet().has(entityKey);
  const groups = new Set(getTierListDescendants().map((e) => e.entityKey));
  return groups.has(entityKey);
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isTierListMod(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { tab, entityKey } = parsed.data;
  if (!validEntityKey(tab, entityKey)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  const category = tab === "weapons" ? TierListCategory.WEAPON : TierListCategory.DESCENDANT;

  await prisma.tierListModOverlay.deleteMany({
    where: { category, entityKey },
  });

  return NextResponse.json({ ok: true });
}
