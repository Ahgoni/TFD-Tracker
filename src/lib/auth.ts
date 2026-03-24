import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import { createPrismaAuthAdapter } from "@/lib/prisma-auth-adapter";

export const authOptions: NextAuthOptions = {
  adapter: createPrismaAuthAdapter(),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      /**
       * If a `User` row already exists with the same Discord email (e.g. orphaned `Account` row,
       * DB restore, or prior provider), link this Discord account instead of failing sign-in.
       * Safe here because Discord is the only OAuth provider.
       */
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    /** Required for App Router / relative `callbackUrl` values (avoids OAuth "Callback" errors). */
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return baseUrl;
    },
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
   * For Discord, use `redirectToDiscordOAuth` / `SignInWithDiscordLink` / `DiscordSignInButton` (POST `/api/auth/signin/discord`). Avoid `signIn()` if `/api/auth/providers` fails (it falls back to GET `/api/auth/signin`). Do not link users to GET `/api/auth/signin` alone.
   * Nexon does not ship a public “Sign in with Nexon” OAuth for arbitrary third-party sites; optional in-game name is stored on `User.nexonIngameName` (self-attested).
   */
};
