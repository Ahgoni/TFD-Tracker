import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { username: true, nexonIngameName: true },
        });
        (session.user as Record<string, unknown>).username = dbUser?.username ?? null;
        (session.user as Record<string, unknown>).nexonIngameName = dbUser?.nexonIngameName ?? null;
      }
      return session;
    },
  },
  session: {
    strategy: "database",
  },
  /**
   * Do not set `pages.signIn` to a custom marketing page — it breaks the OAuth callback unless that page hosts the real sign-in UI.
   * For Discord, always start OAuth via `signIn("discord", { callbackUrl })` or `SignInWithDiscordLink`, not GET `/api/auth/signin` (that URL only shows NextAuth’s provider picker).
   * Nexon does not ship a public “Sign in with Nexon” OAuth for arbitrary third-party sites; optional in-game name is stored on `User.nexonIngameName` (self-attested).
   */
};
