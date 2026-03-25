import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { publicProfileStateFromSaved } from "@/lib/public-profile-share";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const clean = username.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { username: clean },
    select: { id: true, name: true, image: true, username: true, nexonIngameName: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const record = await prisma.appState.findUnique({ where: { userId: user.id } });
  if (!record) return NextResponse.json({ error: "User has no inventory data" }, { status: 404 });

  const stateData = record.data as Record<string, unknown> | null;
  const shared = publicProfileStateFromSaved(stateData);
  if (!shared.ok) {
    return NextResponse.json(
      { error: "This profile is not shared publicly. Ask them for a share link or to open inventory or builds sharing." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    state: shared.state,
    owner: {
      name: user.name,
      image: user.image,
      username: user.username,
      nexonIngameName: user.nexonIngameName,
    },
  });
}
