-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "handle" TEXT,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSnapshot" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "subscriberCount" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelSnapshot_channelId_capturedAt_idx" ON "ChannelSnapshot"("channelId", "capturedAt");

-- AddForeignKey
ALTER TABLE "ChannelSnapshot" ADD CONSTRAINT "ChannelSnapshot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
