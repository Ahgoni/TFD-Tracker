import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

const goalSchema = z.object({
  title: z.string(),
  done: z.boolean().default(false),
  active: z.boolean().default(false),
  notes: z.string().optional(),
  targetValue: z.number().int().optional(),
  current: z.number().int().optional(),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.goalEntry.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = z.array(goalSchema).safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.$transaction([
    prisma.goalEntry.deleteMany({ where: { userId } }),
    prisma.goalEntry.createMany({ data: parsed.data.map((item) => ({ ...item, userId })) }),
  ]);
  return NextResponse.json({ ok: true });
}
