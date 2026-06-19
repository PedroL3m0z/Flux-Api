import { Module } from '@nestjs/common';
import { InstanceAccessGuard } from '../../common/authz/instance-access.guard';
import { MessagingService } from './messaging.service';
import { TelegramController } from './telegram.controller';

/**
 * HTTP surface for managing Telegram instances, QR login, chats and messages.
 * The core services (manager, persistence, sync, access) come from the global
 * core TelegramModule.
 */
@Module({
  controllers: [TelegramController],
  providers: [MessagingService, InstanceAccessGuard],
})
export class TelegramModule {}
