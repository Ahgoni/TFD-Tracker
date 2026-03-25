import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { publicProfileStateFromSaved } from "@/lib/public-profile-share";

// GET /api/share/user/[userId]
// Returns a read-only snapshot of a user's tracker state if their privacy is "open".
// This allows friends to view inventory without needing a share link.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const record = await prisma.appState.findUnique({ where: { userId } });
  if (!record) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stateData = record.data as Record<string, unknown> | null;
  const shared = publicProfileStateFromSaved(stateData);
  if (!shared.ok) {
    return NextResponse.json(
      { error: "This profile is not shared publicly. Ask them for a share link or to open inventory or builds sharing." },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });

  return NextResponse.json({ state: shared.state, owner: { name: user?.name ?? "Unknown", image: user?.image } });
}
