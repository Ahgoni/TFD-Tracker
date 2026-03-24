import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * PrismaAdapter passes the full profile into `user.create`. Extra keys or shape mismatches can
 * cause Prisma to throw; NextAuth maps that to `error=Callback` and the generic sign-in page.
 * We only persist fields that exist on `User`.
 */
export function createPrismaAuthAdapter() {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    createUser: async (data: {
      name?: string | null;
      email?: string | null;
      emailVerified?: Date | null;
      image?: string | null;
    }) => {
      const email =
        typeof data.email === "string" && data.email.trim() !== "" ? data.email.trim() : null;
      return prisma.user.create({
        data: {
          name: data.name ?? null,
          email,
          emailVerified: data.emailVerified ?? null,
          image: data.image ?? null,
        },
      });
    },
  };
}
