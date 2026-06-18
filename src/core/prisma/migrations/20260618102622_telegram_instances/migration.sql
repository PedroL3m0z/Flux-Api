-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('new', 'connecting', 'awaiting_qr', 'password_required', 'authorized', 'disconnected', 'error');

-- CreateTable
CREATE TABLE "telegram_instances" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'gramjs',
    "status" "InstanceStatus" NOT NULL DEFAULT 'new',
    "apiId" INTEGER,
    "apiHashEnc" TEXT,
    "tgUserId" BIGINT,
    "username" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_instances_ownerId_idx" ON "telegram_instances"("ownerId");

-- AddForeignKey
ALTER TABLE "telegram_instances" ADD CONSTRAINT "telegram_instances_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
