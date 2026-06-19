import { Global, Module, type Provider } from '@nestjs/common';
import { EngineRegistry } from './engines/engine.registry';
import { GramJsEngine } from './engines/gramjs.engine';
import { TELEGRAM_ENGINES, type InstanceEngine } from './engines/engine.types';
import { ChatsService } from './services/chats.service';
import { ContactsService } from './services/contacts.service';
import { InstancesService } from './services/instances.service';
import { MessagesService } from './services/messages.service';
import { SettingsService } from './services/settings.service';
import { TelegramManager } from './telegram.manager';
import { TelegramSessionStore } from './telegram-session.store';
import { TelegramSyncService } from './services/telegram-sync.service';
import { TelegramEventBus } from './services/telegram-events.service';
import { InstanceAccessService } from './services/instance-access.service';

// Collects every registered engine into the array the registry consumes.
// Add new engine providers here (e.g. TelegrafEngine) and to the inject list.
const enginesProvider: Provider = {
  provide: TELEGRAM_ENGINES,
  useFactory: (...engines: InstanceEngine[]): InstanceEngine[] => engines,
  inject: [GramJsEngine],
};

/**
 * Core Telegram integration. Global so the HTTP modules and health indicator
 * can inject the manager without re-importing. Engines are pluggable: each
 * instance picks one (default GramJS) and the manager delegates to it. Sessions
 * are persisted in Redis by TelegramSessionStore (RedisModule is already global).
 */
@Global()
@Module({
  providers: [
    GramJsEngine,
    enginesProvider,
    EngineRegistry,
    InstancesService,
    SettingsService,
    ChatsService,
    ContactsService,
    MessagesService,
    TelegramSyncService,
    TelegramEventBus,
    TelegramSessionStore,
    TelegramManager,
    InstanceAccessService,
  ],
  exports: [
    InstancesService,
    SettingsService,
    ChatsService,
    ContactsService,
    MessagesService,
    TelegramSyncService,
    TelegramEventBus,
    TelegramSessionStore,
    TelegramManager,
    InstanceAccessService,
  ],
})
export class TelegramModule {}
