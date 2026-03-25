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
  deltas: z
    .object({
      S: z.number().int().optional(),
      A: z.number().int().optional(),
      B: z.number().int().optional(),
      C: z.number().int().optional(),
      D: z.number().int().optional(),
    })
    .refine((d) => d.S !== undefined || d.A !== undefined || d.B !== undefined || d.C !== undefined || d.D !== undefined, {
      message: "Provide at least one tier delta",
    }),
});

async function validEntityKey(tab: "descendants" | "weapons", entityKey: string): Promise<boolean> {
  if (tab === "weapons") return (await weaponSlugSet()).has(entityKey);
  const groups = new Set((await getTierListDescendants()).map((e) => e.entityKey));
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

  const { tab, entityKey, deltas } = parsed.data;
  if (!(await validEntityKey(tab, entityKey))) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  const category = tab === "weapons" ? TierListCategory.WEAPON : TierListCategory.DESCENDANT;

  await prisma.tierListModOverlay.upsert({
    where: { category_entityKey: { category, entityKey } },
    create: {
      category,
      entityKey,
      deltaS: deltas.S ?? 0,
      deltaA: deltas.A ?? 0,
      deltaB: deltas.B ?? 0,
      deltaC: deltas.C ?? 0,
      deltaD: deltas.D ?? 0,
    },
    update: {
      ...(deltas.S !== undefined ? { deltaS: { increment: deltas.S } } : {}),
      ...(deltas.A !== undefined ? { deltaA: { increment: deltas.A } } : {}),
      ...(deltas.B !== undefined ? { deltaB: { increment: deltas.B } } : {}),
      ...(deltas.C !== undefined ? { deltaC: { increment: deltas.C } } : {}),
      ...(deltas.D !== undefined ? { deltaD: { increment: deltas.D } } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
