-- CreateEnum
CREATE TYPE "PeerType" AS ENUM ('user', 'group', 'channel');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('none', 'photo', 'video', 'document', 'audio', 'sticker', 'other');

-- CreateTable
CREATE TABLE "telegram_contacts" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "tgUserId" BIGINT NOT NULL,
    "accessHash" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "phone" TEXT,
    "isContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_chats" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "tgPeerId" BIGINT NOT NULL,
    "type" "PeerType" NOT NULL,
    "accessHash" BIGINT,
    "title" TEXT,
    "username" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_messages" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "tgMessageId" BIGINT NOT NULL,
    "senderId" TEXT,
    "outgoing" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT,
    "mediaType" "MediaType" NOT NULL DEFAULT 'none',
    "mediaRef" JSONB,
    "replyToTgId" BIGINT,
    "date" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_contacts_instanceId_tgUserId_key" ON "telegram_contacts"("instanceId", "tgUserId");

-- CreateIndex
CREATE INDEX "telegram_chats_instanceId_lastMessageAt_idx" ON "telegram_chats"("instanceId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_chats_instanceId_tgPeerId_key" ON "telegram_chats"("instanceId", "tgPeerId");

-- CreateIndex
CREATE INDEX "telegram_messages_chatId_date_idx" ON "telegram_messages"("chatId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_messages_instanceId_chatId_tgMessageId_key" ON "telegram_messages"("instanceId", "chatId", "tgMessageId");

-- AddForeignKey
ALTER TABLE "telegram_contacts" ADD CONSTRAINT "telegram_contacts_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "telegram_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "telegram_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "telegram_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "telegram_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "telegram_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
