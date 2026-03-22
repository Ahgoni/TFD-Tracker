import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

const descendantSchema = z.object({
  name: z.string(),
  level: z.number().int().min(1).max(40),
  archeLevel: z.number().int().min(1).max(40),
  catalysts: z.number().int().min(0).max(20),
  element: z.string().optional(),
  skills: z.string().optional(),
  portrait: z.string().optional(),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.descendantEntry.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = z.array(descendantSchema).safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.$transaction([
    prisma.descendantEntry.deleteMany({ where: { userId } }),
    prisma.descendantEntry.createMany({ data: parsed.data.map((item) => ({ ...item, userId })) }),
  ]);
  return NextResponse.json({ ok: true });
}
