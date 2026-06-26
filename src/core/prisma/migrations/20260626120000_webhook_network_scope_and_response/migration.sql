-- AlterTable: opt-in to internal/private delivery targets per webhook
ALTER TABLE "webhooks" ADD COLUMN "allowInternal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: capture the target's response body for delivery diagnostics
ALTER TABLE "webhook_deliveries" ADD COLUMN "responseBody" TEXT;
