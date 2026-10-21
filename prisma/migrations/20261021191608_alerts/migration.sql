-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('RELEASE', 'STARS', 'ARCHIVED');

-- CreateTable
CREATE TABLE "RepositoryWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "providerRepoId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "notifyRelease" BOOLEAN NOT NULL DEFAULT true,
    "notifyArchived" BOOLEAN NOT NULL DEFAULT true,
    "starThreshold" INTEGER,
    "lastReleaseTag" TEXT,
    "lastStars" INTEGER,
    "lastArchived" BOOLEAN,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "watchId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepositoryWatch_lastCheckedAt_idx" ON "RepositoryWatch"("lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryWatch_userId_provider_providerRepoId_key" ON "RepositoryWatch"("userId", "provider", "providerRepoId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "RepositoryWatch" ADD CONSTRAINT "RepositoryWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "RepositoryWatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
