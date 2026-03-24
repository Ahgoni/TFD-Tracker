-- CreateEnum
CREATE TYPE "TierListCategory" AS ENUM ('DESCENDANT', 'WEAPON');

-- CreateTable
CREATE TABLE "TierVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "TierListCategory" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicBuildListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "category" "TierListCategory" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "buildName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicBuildListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TierVote_userId_category_entityKey_key" ON "TierVote"("userId", "category", "entityKey");

-- CreateIndex
CREATE INDEX "TierVote_category_entityKey_idx" ON "TierVote"("category", "entityKey");

-- CreateIndex
CREATE UNIQUE INDEX "PublicBuildListing_userId_buildId_key" ON "PublicBuildListing"("userId", "buildId");

-- CreateIndex
CREATE INDEX "PublicBuildListing_category_entityKey_idx" ON "PublicBuildListing"("category", "entityKey");

-- AddForeignKey
ALTER TABLE "TierVote" ADD CONSTRAINT "TierVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicBuildListing" ADD CONSTRAINT "PublicBuildListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
