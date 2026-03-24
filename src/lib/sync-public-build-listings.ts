import { TierListCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { descendantNameToGroupId, weaponSlugSet } from "@/lib/tier-list-catalog";

type RawBuild = {
  id?: string;
  name?: string;
  targetType?: string;
  targetKey?: string;
  communityPublic?: boolean;
};

/**
 * Keeps `PublicBuildListing` in sync with saved builds. Only listings where
 * `communityPublic` is true and profile is `sharePrivacy === "open"` are kept.
 */
export async function syncPublicBuildListings(userId: string, state: Record<string, unknown>): Promise<void> {
  const sharePrivacy = (state.sharePrivacy as string) ?? "open";
  await prisma.publicBuildListing.deleteMany({ where: { userId } });

  if (sharePrivacy !== "open") return;

  const builds = (state.builds as RawBuild[]) ?? [];
  const nameToGroup = descendantNameToGroupId();
  const weapons = weaponSlugSet();
  const rows: Array<{
    userId: string;
    buildId: string;
    category: TierListCategory;
    entityKey: string;
    buildName: string;
  }> = [];

  for (const b of builds) {
    if (!b?.id || !b.name?.trim() || !b.communityPublic) continue;
    if (b.targetType === "descendant" && typeof b.targetKey === "string") {
      const g = nameToGroup.get(b.targetKey.trim());
      if (!g) continue;
      rows.push({
        userId,
        buildId: b.id,
        category: TierListCategory.DESCENDANT,
        entityKey: g,
        buildName: b.name.trim(),
      });
    } else if (b.targetType === "weapon" && typeof b.targetKey === "string") {
      const slug = b.targetKey.trim();
      if (!weapons.has(slug)) continue;
      rows.push({
        userId,
        buildId: b.id,
        category: TierListCategory.WEAPON,
        entityKey: slug,
        buildName: b.name.trim(),
      });
    }
  }

  if (rows.length === 0) return;

  await prisma.publicBuildListing.createMany({
    data: rows.map((r) => ({
      userId: r.userId,
      buildId: r.buildId,
      category: r.category,
      entityKey: r.entityKey,
      buildName: r.buildName,
    })),
  });
}
