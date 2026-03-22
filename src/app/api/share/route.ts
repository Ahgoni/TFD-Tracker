import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

/** POST /api/share — creates (or returns existing) share token for the signed-in user */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return existing token if one already exists, so the same link is reused
  const existing = await prisma.shareToken.findFirst({ where: { userId } });
  if (existing) return NextResponse.json({ token: existing.token });

  const created = await prisma.shareToken.create({ data: { userId } });
  return NextResponse.json({ token: created.token });
}

/** DELETE /api/share — revokes the user's share token */
export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.shareToken.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
