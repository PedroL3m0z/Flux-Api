-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "InstanceRole" AS ENUM ('owner', 'operator', 'viewer');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "instance_members" (
    "instanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InstanceRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_members_pkey" PRIMARY KEY ("instanceId","userId")
);

-- CreateIndex
CREATE INDEX "instance_members_userId_idx" ON "instance_members"("userId");

-- AddForeignKey
ALTER TABLE "instance_members" ADD CONSTRAINT "instance_members_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "telegram_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_members" ADD CONSTRAINT "instance_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: each instance's creator becomes its owner member.
INSERT INTO "instance_members" ("instanceId", "userId", "role", "createdAt", "updatedAt")
SELECT "id", "ownerId", 'owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "telegram_instances"
ON CONFLICT ("instanceId", "userId") DO NOTHING;

-- Backfill: promote the oldest user to global admin (founder).
UPDATE "users"
SET "role" = 'admin'
WHERE "id" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1);
