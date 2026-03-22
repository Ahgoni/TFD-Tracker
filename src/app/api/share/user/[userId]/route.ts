import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

  // Check privacy setting — default to "open" if not set
  const stateData = record.data as Record<string, unknown> | null;
  const privacy = stateData?.sharePrivacy ?? "open";

  if (privacy === "link_only") {
    return NextResponse.json({ error: "This user's inventory is private. Ask them for a share link." }, { status: 403 });
  }

  // Get display name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });

  return NextResponse.json({ state: stateData, owner: { name: user?.name ?? "Unknown", image: user?.image } });
}
