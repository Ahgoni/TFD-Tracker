import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function resolveFriendUserId(token: string): Promise<string | null> {
  if (token.startsWith("username:")) {
    const user = await prisma.user.findFirst({
      where: { username: token.slice(9) },
      select: { id: true },
    });
    return user?.id ?? null;
  }
  if (token.startsWith("user:")) {
    return token.slice(5);
  }
  const st = await prisma.shareToken.findUnique({ where: { token } });
  return st?.userId ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friends = await prisma.savedFriend.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const enriched = await Promise.all(
    friends.map(async (f: { id: string; token: string; nickname: string; createdAt: Date }) => {
      const safe = {
        id: f.id,
        token: f.token,
        nickname: f.nickname,
        createdAt: f.createdAt.toISOString(),
      };
      try {
        const friendUserId = await resolveFriendUserId(f.token);
        if (!friendUserId) return { ...safe, lastSeen: null, friendName: null, friendImage: null, friendUsername: null };

        const user = await prisma.user.findUnique({
          where: { id: friendUserId },
          select: { lastSeen: true, name: true, image: true, username: true },
        });
        return {
          ...safe,
          lastSeen: user?.lastSeen?.toISOString() ?? null,
          friendName: user?.name ?? null,
          friendImage: user?.image ?? null,
          friendUsername: user?.username ?? null,
        };
      } catch {
        return { ...safe, lastSeen: null, friendName: null, friendImage: null, friendUsername: null };
      }
    })
  );

  return NextResponse.json({ friends: enriched });
}

function sanitizeFriend(f: { id: string; token: string; nickname: string; createdAt: Date }) {
  return { id: f.id, token: f.token, nickname: f.nickname, createdAt: f.createdAt.toISOString() };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, nickname } = await req.json();
  if (!token || typeof token !== "string") return NextResponse.json({ error: "token required" }, { status: 400 });
  if (!nickname || typeof nickname !== "string") return NextResponse.json({ error: "nickname required" }, { status: 400 });

  if (token.startsWith("username:")) {
    const friendUsername = token.slice(9);
    const friendUser = await prisma.user.findFirst({ where: { username: friendUsername }, select: { id: true } });
    if (!friendUser) return NextResponse.json({ error: `No user found with username @${friendUsername}` }, { status: 404 });
    if (friendUser.id === session.user.id) return NextResponse.json({ error: "That's your own username." }, { status: 400 });

    const friendState = await prisma.appState.findUnique({ where: { userId: friendUser.id } });
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

    return NextResponse.json({ friend: sanitizeFriend(friend) });
  }

  if (token.startsWith("user:")) {
    const friendUserId = token.slice(5);
    if (!friendUserId) return NextResponse.json({ error: "Invalid profile link." }, { status: 400 });
    if (friendUserId === session.user.id) return NextResponse.json({ error: "That's your own profile link." }, { status: 400 });

    const friendUser = await prisma.user.findUnique({ where: { id: friendUserId }, select: { id: true } });
    if (!friendUser) return NextResponse.json({ error: "User not found. The profile link may be invalid." }, { status: 404 });

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

    return NextResponse.json({ friend: sanitizeFriend(friend) });
  }

  const shareToken = await prisma.shareToken.findUnique({ where: { token } });
  if (!shareToken) return NextResponse.json({ error: "Share token not found. Ask your friend to share their inventory link." }, { status: 404 });
  if (shareToken.userId === session.user.id) return NextResponse.json({ error: "That's your own share link." }, { status: 400 });

  const friend = await prisma.savedFriend.upsert({
    where: { userId_token: { userId: session.user.id, token } },
    create: { userId: session.user.id, token, nickname: nickname.trim().slice(0, 40) },
    update: { nickname: nickname.trim().slice(0, 40) },
  });

  return NextResponse.json({ friend: sanitizeFriend(friend) });
}
