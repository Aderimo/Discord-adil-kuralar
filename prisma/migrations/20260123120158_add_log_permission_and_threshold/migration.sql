-- CreateTable
CREATE TABLE "log_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "log_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_thresholds" (
    "id" TEXT NOT NULL,
    "lastNotificationAt" TIMESTAMP(3),
    "lastNotificationCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadAt" TIMESTAMP(3),
    "lastDeleteAt" TIMESTAMP(3),

    CONSTRAINT "log_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "log_permissions_userId_key" ON "log_permissions"("userId");

-- AddForeignKey
ALTER TABLE "log_permissions" ADD CONSTRAINT "log_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
