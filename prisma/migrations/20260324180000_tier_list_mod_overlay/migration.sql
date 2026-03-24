-- CreateTable
CREATE TABLE "TierListModOverlay" (
    "id" TEXT NOT NULL,
    "category" "TierListCategory" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "deltaS" INTEGER NOT NULL DEFAULT 0,
    "deltaA" INTEGER NOT NULL DEFAULT 0,
    "deltaB" INTEGER NOT NULL DEFAULT 0,
    "deltaC" INTEGER NOT NULL DEFAULT 0,
    "deltaD" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierListModOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TierListModOverlay_category_idx" ON "TierListModOverlay"("category");

-- CreateIndex
CREATE UNIQUE INDEX "TierListModOverlay_category_entityKey_key" ON "TierListModOverlay"("category", "entityKey");
