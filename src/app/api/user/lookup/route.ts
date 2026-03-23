import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase().replace(/^@/, "");

  if (!q || q.length < 3) {
    return NextResponse.json({ error: "Query must be at least 3 characters." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { username: q },
    select: { username: true, name: true, image: true },
  });

  if (!user) {
    return NextResponse.json({ error: "No user found with that username." }, { status: 404 });
  }

  return NextResponse.json({ user: { username: user.username, name: user.name, image: user.image } });
}
