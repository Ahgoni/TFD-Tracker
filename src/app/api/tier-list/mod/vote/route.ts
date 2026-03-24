import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { isTierListMod } from "@/lib/tier-list-mod";

const bodySchema = z.object({
  voteId: z.string().min(1).max(80),
});

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isTierListMod(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { voteId } = parsed.data;
  const row = await prisma.tierVote.findUnique({
    where: { id: voteId },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Vote not found" }, { status: 404 });

  await prisma.tierVote.delete({ where: { id: voteId } });
  return NextResponse.json({ ok: true });
}
