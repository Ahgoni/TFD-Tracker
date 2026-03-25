import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { syncPublicBuildListings } from "@/lib/sync-public-build-listings";

const importSchema = z.object({
  state: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json();
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid import payload" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateData = parsed.data.state as any;
  await prisma.appState.upsert({
    where: { userId },
    update: { data: stateData },
    create: { userId, data: stateData },
  });

  await syncPublicBuildListings(userId, stateData as Record<string, unknown>).catch((err) => {
    console.error("[syncPublicBuildListings]", err);
  });

  return NextResponse.json({ ok: true });
}
