import { prisma } from "@/lib/prisma";
import { TierListCategory, type TierListCategoryValue } from "@/lib/tier-list-category";
import { descendantNameToGroupId, weaponSlugSet } from "@/lib/tier-list-catalog";

type RawBuild = {
  id?: string;
  name?: string;
  targetType?: string;
  targetKey?: string;
  /** Same as roster display name for descendants — fallback if targetKey mismatches catalog keys. */
  displayName?: string;
  communityPublic?: boolean;
};

/** Match build target to Nexon roster name + group id (case-insensitive; prefers canonical map key spelling). */
function matchDescendantToGroup(
  nameToGroup: Map<string, string>,
  targetKey: string | undefined,
  displayName: string | undefined,
): { groupId: string; rosterName: string } | null {
  const tryNames = [targetKey, displayName]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
  for (const name of tryNames) {
    const g = nameToGroup.get(name);
    if (g) return { groupId: g, rosterName: name };
  }
  for (const name of tryNames) {
    const lower = name.toLowerCase();
    for (const [k, g] of nameToGroup) {
      if (k.toLowerCase() === lower) return { groupId: g, rosterName: k };
    }
  }
  return null;
}

/**
 * Keeps `PublicBuildListing` in sync with saved builds. Only listings where
 * `communityPublic` is true and profile is `sharePrivacy === "open"` are kept.
 */
export async function syncPublicBuildListings(userId: string, state: Record<string, unknown>): Promise<void> {
  const sharePrivacy = (state.sharePrivacy as string) ?? "open";
  await prisma.publicBuildListing.deleteMany({ where: { userId } });

  if (sharePrivacy !== "open") return;

  const builds = (state.builds as RawBuild[]) ?? [];
  const nameToGroup = await descendantNameToGroupId();
  const weapons = await weaponSlugSet();
  const rows: Array<{
    userId: string;
    buildId: string;
    category: TierListCategoryValue;
    entityKey: string;
    targetKey: string | null;
    buildName: string;
  }> = [];

  for (const b of builds) {
    if (!b?.id || !b.name?.trim() || !b.communityPublic) continue;
    if (b.targetType === "descendant") {
      const matched = matchDescendantToGroup(nameToGroup, b.targetKey, b.displayName);
      if (!matched) continue;
      rows.push({
        userId,
        buildId: b.id,
        category: TierListCategory.DESCENDANT,
        entityKey: matched.groupId,
        targetKey: matched.rosterName,
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
        targetKey: slug,
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
      targetKey: r.targetKey,
      buildName: r.buildName,
    })),
  });
}
