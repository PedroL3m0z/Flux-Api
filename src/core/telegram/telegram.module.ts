import { Global, Module } from '@nestjs/common';
import { TelegramManager } from './telegram.manager';
import { TelegramSessionStore } from './telegram-session.store';

/**
 * Core Telegram integration (GramJS). Global so the HTTP modules and health
 * indicator can inject the manager without re-importing. Sessions are persisted
 * in Redis by TelegramSessionStore (RedisModule is already global).
 */
@Global()
@Module({
  providers: [TelegramSessionStore, TelegramManager],
  exports: [TelegramSessionStore, TelegramManager],
})
export class TelegramModule {}
