import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
const RESERVED = new Set(["admin", "api", "share", "auth", "profile", "settings", "system", "mod", "help", "support"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, image: true },
  });

  return NextResponse.json({ username: user?.username ?? null, name: user?.name, image: user?.image });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await req.json();
  if (typeof username !== "string") {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const clean = username.trim().toLowerCase();

  if (!USERNAME_RE.test(clean)) {
    return NextResponse.json({
      error: "Username must be 3–20 characters, start with a letter, and contain only lowercase letters, numbers, or underscores.",
    }, { status: 400 });
  }

  if (RESERVED.has(clean)) {
    return NextResponse.json({ error: "That username is reserved." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: clean } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { username: clean },
  });

  return NextResponse.json({ username: clean });
}
