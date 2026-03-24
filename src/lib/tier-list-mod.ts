import { prisma } from "@/lib/prisma";

/**
 * Comma- or whitespace-separated Discord snowflakes allowed to call tier-list mod APIs
 * and see the mod panel (after sign-in). Empty = no one (endpoints return 403).
 */
export function getTierListModDiscordIdSet(): Set<string> {
  const raw =
    process.env.TIER_LIST_MOD_DISCORD_IDS?.trim() ||
    process.env.TIER_LIST_MOD_DISCORD_ID?.trim() ||
    "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function discordSnowflakeForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  if (user?.discordId) return user.discordId;
  const acc = await prisma.account.findFirst({
    where: { userId, provider: "discord" },
    select: { providerAccountId: true },
  });
  return acc?.providerAccountId ?? null;
}

export async function isTierListMod(userId: string): Promise<boolean> {
  const allowed = getTierListModDiscordIdSet();
  if (allowed.size === 0) return false;
  const discordId = await discordSnowflakeForUser(userId);
  if (!discordId) return false;
  return allowed.has(discordId);
}
