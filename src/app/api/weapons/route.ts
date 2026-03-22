import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

const weaponSchema = z.object({
  slug: z.string(),
  name: z.string(),
  rarity: z.string().default("Rare"),
  roundsType: z.string().default("General Rounds"),
  icon: z.string().optional(),
  acquired: z.boolean().default(false),
  level: z.number().int().min(1).max(100).default(1),
  catalysts: z.number().int().min(0).max(20).default(0),
  enhancement: z.number().int().min(0).max(5).default(0),
  weaponCore: z.string().default("No"),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.weaponEntry.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = z.array(weaponSchema).safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.$transaction([
    prisma.weaponEntry.deleteMany({ where: { userId } }),
    prisma.weaponEntry.createMany({
      data: parsed.data.map((item) => ({ ...item, userId })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
