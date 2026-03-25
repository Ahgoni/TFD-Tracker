/**
 * Public profile + share API: inventory sharing vs builds sharing are independent.
 * - sharePrivacy: "open" | "link_only" — reactors, weapons, descendants, goals on /u/:username
 * - buildsSharePrivacy: "public" | "private" — builds on profile, tier hub index, /u/:user/b/:id
 */

export type BuildsSharePrivacy = "public" | "private";

export function isInventorySharingOpen(stateData: Record<string, unknown> | null | undefined): boolean {
  return (stateData?.sharePrivacy ?? "open") !== "link_only";
}

/** When false, no public builds in API, no tier hub listings, shared build pages unavailable to others. */
export function isBuildsSharingPublic(stateData: Record<string, unknown> | null | undefined): boolean {
  return stateData?.buildsSharePrivacy !== "private";
}

export function filterCommunityPublicBuilds(builds: unknown): unknown[] {
  if (!Array.isArray(builds)) return [];
  return builds.filter(
    (b) => b && typeof b === "object" && (b as { communityPublic?: boolean }).communityPublic === true,
  );
}

export type PublicProfileShareResult =
  | { ok: false; status: 403 }
  | { ok: true; state: Record<string, unknown> };

/**
 * Build the state object returned from public share routes (by username or user id).
 * Caller merges with { owner } for JSON response.
 */
export function publicProfileStateFromSaved(fullState: Record<string, unknown> | null | undefined): PublicProfileShareResult {
  const data = fullState ?? {};
  const inv = isInventorySharingOpen(data);
  const buildsPub = isBuildsSharingPublic(data);

  if (!inv && !buildsPub) {
    return { ok: false, status: 403 };
  }

  if (!inv && buildsPub) {
    return {
      ok: true,
      state: { builds: filterCommunityPublicBuilds(data.builds) },
    };
  }

  if (inv && !buildsPub) {
    return {
      ok: true,
      state: { ...data, builds: [] },
    };
  }

  return { ok: true, state: { ...data } };
}
