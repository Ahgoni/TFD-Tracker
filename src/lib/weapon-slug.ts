/** Matches `scripts/fetch-game-stats.js` / tracker weapon `slug` convention (no Node `fs`). */
export function weaponNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
