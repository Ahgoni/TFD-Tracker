-- CreateTable
CREATE TABLE "SavedFriend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFriend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedFriend_userId_idx" ON "SavedFriend"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFriend_userId_token_key" ON "SavedFriend"("userId", "token");

-- AddForeignKey
ALTER TABLE "SavedFriend" ADD CONSTRAINT "SavedFriend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
