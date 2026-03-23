-- AlterTable (idempotent on PostgreSQL if column was added manually or by an old migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP(3);
