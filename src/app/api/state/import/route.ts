import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

const importSchema = z.object({
  state: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json();
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid import payload" }, { status: 400 });

  await prisma.appState.upsert({
    where: { userId },
    update: { data: parsed.data.state as Prisma.InputJsonValue },
    create: { userId, data: parsed.data.state as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}
