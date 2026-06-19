import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';

/**
 * HTTP surface for managing webhooks. WebhooksService comes from the global core
 * WebhooksModule.
 */
@Module({
  controllers: [WebhooksController],
})
export class WebhooksModule {}
