-- Add lastSeen column for online presence tracking
ALTER TABLE "User" ADD COLUMN "lastSeen" TIMESTAMP(3);
