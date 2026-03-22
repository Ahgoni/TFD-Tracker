import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

const materialSchema = z.object({
  name: z.string(),
  qty: z.number().int().min(0),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.materialEntry.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = z.array(materialSchema).safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.$transaction([
    prisma.materialEntry.deleteMany({ where: { userId } }),
    prisma.materialEntry.createMany({ data: parsed.data.map((item) => ({ ...item, userId })) }),
  ]);
  return NextResponse.json({ ok: true });
}
