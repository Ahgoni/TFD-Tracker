/**
 * Values must match `prisma/schema.prisma` `enum TierListCategory`.
 * Defined here so API routes do not import enums from `@prisma/client` before `prisma generate` runs on deploy.
 */
export const TierListCategory = {
  DESCENDANT: "DESCENDANT",
  WEAPON: "WEAPON",
} as const;

export type TierListCategoryValue = (typeof TierListCategory)[keyof typeof TierListCategory];
