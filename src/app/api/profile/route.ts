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
    select: { username: true, nexonIngameName: true, name: true, image: true },
  });

  return NextResponse.json({
    username: user?.username ?? null,
    nexonIngameName: user?.nexonIngameName ?? null,
    name: user?.name,
    image: user?.image,
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const data: { username?: string; nexonIngameName?: string | null } = {};

  if ("username" in record) {
    const username = record.username;
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
    const existing = await prisma.user.findFirst({ where: { username: clean } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    data.username = clean;
  }

  if ("nexonIngameName" in record) {
    const raw = record.nexonIngameName;
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid in-game name." }, { status: 400 });
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v.length > 32) {
      return NextResponse.json({ error: "In-game name must be 32 characters or fewer." }, { status: 400 });
    }
    data.nexonIngameName = v || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  const out = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, nexonIngameName: true },
  });

  return NextResponse.json({
    username: out?.username ?? null,
    nexonIngameName: out?.nexonIngameName ?? null,
  });
}
