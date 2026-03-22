import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/share/[token] — public endpoint, no auth required */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = await prisma.shareToken.findUnique({
    where: { token },
    include: { user: { select: { name: true, image: true, appState: true } } },
  });

  if (!row) return NextResponse.json({ error: "Share link not found" }, { status: 404 });

  const state = (row.user.appState?.data ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    owner: { name: row.user.name, image: row.user.image },
    state,
  });
}
