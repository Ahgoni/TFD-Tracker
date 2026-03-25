import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierListCategory } from "@/lib/tier-list-category";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "weapons" ? "weapons" : "descendants";
  const entityKey = searchParams.get("entityKey")?.trim() ?? "";
  if (!entityKey) {
    return NextResponse.json({ error: "entityKey required" }, { status: 400 });
  }

  const category = tab === "weapons" ? TierListCategory.WEAPON : TierListCategory.DESCENDANT;

  const rows = await prisma.publicBuildListing.findMany({
    where: { category, entityKey },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { username: true, name: true } },
    },
  });

  const builds = rows
    .filter((r) => r.user.username)
    .map((r) => ({
      buildId: r.buildId,
      buildName: r.buildName,
      targetKey: r.targetKey,
      username: r.user.username as string,
      authorName: r.user.name,
      href: `/u/${encodeURIComponent(r.user.username as string)}/b/${encodeURIComponent(r.buildId)}`,
    }));

  return NextResponse.json({ builds });
}
