import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { TelegramController } from './telegram.controller';

/**
 * HTTP surface for managing Telegram instances, QR login, chats and messages.
 * The core services (manager, persistence, sync) come from the global
 * core TelegramModule. Permission checks use the global AuthzModule.
 */
@Module({
  controllers: [TelegramController],
  providers: [MessagingService],
})
export class TelegramModule {}
