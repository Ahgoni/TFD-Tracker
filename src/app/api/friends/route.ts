import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/friends — list saved friends with online presence
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friends = await prisma.savedFriend.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const enriched = await Promise.all(
    friends.map(async (f) => {
      try {
        let friendUserId: string | null = null;
        if (f.token.startsWith("user:")) {
          friendUserId = f.token.slice(5);
        } else {
          const st = await prisma.shareToken.findUnique({ where: { token: f.token } });
          friendUserId = st?.userId ?? null;
        }
        if (!friendUserId) return { ...f, lastSeen: null, friendName: null, friendImage: null };

        const user = await prisma.user.findUnique({
          where: { id: friendUserId },
          select: { lastSeen: true, name: true, image: true },
        });
        return {
          ...f,
          lastSeen: user?.lastSeen?.toISOString() ?? null,
          friendName: user?.name ?? null,
          friendImage: user?.image ?? null,
        };
      } catch {
        return { ...f, lastSeen: null, friendName: null, friendImage: null };
      }
    })
  );

  return NextResponse.json({ friends: enriched });
}

// POST /api/friends — add a friend by share token OR profile URL (user:userId)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, nickname } = await req.json();
  if (!token || typeof token !== "string") return NextResponse.json({ error: "token required" }, { status: 400 });
  if (!nickname || typeof nickname !== "string") return NextResponse.json({ error: "nickname required" }, { status: 400 });

  // Profile-link friend: token = "user:<userId>"
  if (token.startsWith("user:")) {
    const friendUserId = token.slice(5);
    if (!friendUserId) return NextResponse.json({ error: "Invalid profile link." }, { status: 400 });
    if (friendUserId === session.user.id) return NextResponse.json({ error: "That's your own profile link." }, { status: 400 });

    // Verify the friend user exists
    const friendUser = await prisma.user.findUnique({ where: { id: friendUserId }, select: { id: true } });
    if (!friendUser) return NextResponse.json({ error: "User not found. The profile link may be invalid." }, { status: 404 });

    // Check their privacy setting
    const friendState = await prisma.appState.findUnique({ where: { userId: friendUserId } });
    const stateData = friendState?.data as Record<string, unknown> | null;
    const privacy = stateData?.sharePrivacy ?? "open";
    if (privacy === "link_only") {
      return NextResponse.json({ error: "This user has set their inventory to 'Link Only'. Ask them for a share link instead." }, { status: 403 });
    }

    const friend = await prisma.savedFriend.upsert({
      where: { userId_token: { userId: session.user.id, token } },
      create: { userId: session.user.id, token, nickname: nickname.trim().slice(0, 40) },
      update: { nickname: nickname.trim().slice(0, 40) },
    });

    return NextResponse.json({ friend });
  }

  // Share-token friend (legacy / link_only users)
  const shareToken = await prisma.shareToken.findUnique({ where: { token } });
  if (!shareToken) return NextResponse.json({ error: "Share token not found. Ask your friend to share their inventory link from the profile menu." }, { status: 404 });

  if (shareToken.userId === session.user.id) return NextResponse.json({ error: "That's your own share link." }, { status: 400 });

  const friend = await prisma.savedFriend.upsert({
    where: { userId_token: { userId: session.user.id, token } },
    create: { userId: session.user.id, token, nickname: nickname.trim().slice(0, 40) },
    update: { nickname: nickname.trim().slice(0, 40) },
  });

  return NextResponse.json({ friend });
}
