import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { defaultTrackerState } from "@/lib/tracker-default-state";

const statePayload = z.record(z.string(), z.unknown());

function touchLastSeen(userId: string) {
  prisma.user
    .update({ where: { id: userId }, data: { lastSeen: new Date() } })
    .catch(() => {});
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  touchLastSeen(userId);

  const row = await prisma.appState.findUnique({ where: { userId } });
  if (!row) return NextResponse.json({ state: defaultTrackerState });
  return NextResponse.json({ state: row.data });
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  touchLastSeen(userId);

  const json = await request.json();
  const parsed = statePayload.safeParse(json?.state);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const saved = await prisma.appState.upsert({
    where: { userId },
    update: { data: parsed.data as Prisma.InputJsonValue },
    create: { userId, data: parsed.data as Prisma.InputJsonValue },
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt.toISOString() });
}
