-- AlterTable
ALTER TABLE "telegram_chats" ADD COLUMN     "hasPhoto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "telegram_contacts" ADD COLUMN     "hasPhoto" BOOLEAN NOT NULL DEFAULT false;
