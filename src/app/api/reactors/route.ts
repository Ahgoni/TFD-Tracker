import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

const reactorSchema = z.object({
  name: z.string(),
  element: z.string(),
  skillType: z.string(),
  descendant: z.string(),
  level: z.number().int().min(1).max(200),
  enhancement: z.string(),
  substat1: z.string(),
  subvalue1: z.string(),
  substat2: z.string(),
  subvalue2: z.string(),
  notes: z.string().optional(),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.reactorEntry.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = z.array(reactorSchema).safeParse(body?.items);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.$transaction([
    prisma.reactorEntry.deleteMany({ where: { userId } }),
    prisma.reactorEntry.createMany({ data: parsed.data.map((item) => ({ ...item, userId })) }),
  ]);
  return NextResponse.json({ ok: true });
}
