import { Global, Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';

/**
 * Core webhooks: CRUD + the event→delivery dispatcher and the delivery worker.
 * Global so the HTTP module can inject WebhooksService. Depends on the global
 * PrismaModule and the Telegram event bus (exported by the core TelegramModule).
 */
@Global()
@Module({
  providers: [WebhooksService, WebhookDispatcherService, WebhookDeliveryWorker],
  exports: [WebhooksService],
})
export class WebhooksModule {}
