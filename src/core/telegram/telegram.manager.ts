import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { TelegramSessionStore } from './telegram-session.store';
import type { TelegramInstance } from './telegram.constants';

export interface InstancesSummary {
  enabled: boolean;
  total: number;
  connected: number;
}

/**
 * Owns the live GramJS clients (one per instance) and their lifecycle.
 *
 * On boot it rehydrates every instance that has a saved session from Redis and
 * reconnects it, so authorized accounts survive restarts without a new login.
 * Disabled (no-op) when TELEGRAM_API_ID / TELEGRAM_API_HASH are absent, so the
 * app still boots and the rest of the API keeps working.
 */
@Injectable()
export class TelegramManager
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramManager.name);
  private readonly clients = new Map<string, TelegramClient>();

  constructor(
    private readonly config: ConfigService,
    private readonly store: TelegramSessionStore,
  ) {}

  get enabled(): boolean {
    return this.apiId !== undefined && this.apiHash !== undefined;
  }

  private get apiId(): number | undefined {
    return this.config.get<number>('TELEGRAM_API_ID');
  }

  private get apiHash(): string | undefined {
    return this.config.get<string>('TELEGRAM_API_HASH');
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'Telegram disabled: set TELEGRAM_API_ID and TELEGRAM_API_HASH to enable it',
      );
      return;
    }
    const instances = await this.store.list();
    for (const instance of instances) {
      await this.restore(instance);
    }
    this.logger.log(`Telegram restored ${this.clients.size} instance(s)`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map((client) =>
        client.disconnect().catch(() => undefined),
      ),
    );
    this.clients.clear();
  }

  // --- Instance management ---

  createInstance(label: string): Promise<TelegramInstance> {
    return this.store.create(label);
  }

  listInstances(): Promise<TelegramInstance[]> {
    return this.store.list();
  }

  getInstance(id: string): Promise<TelegramInstance | null> {
    return this.store.get(id);
  }

  async removeInstance(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect().catch(() => undefined);
      this.clients.delete(id);
    }
    await this.store.remove(id);
  }

  getClient(id: string): TelegramClient | undefined {
    return this.clients.get(id);
  }

  async instancesSummary(): Promise<InstancesSummary> {
    if (!this.enabled) {
      return { enabled: false, total: 0, connected: 0 };
    }
    const instances = await this.store.list();
    return {
      enabled: true,
      total: instances.length,
      connected: this.clients.size,
    };
  }

  /** Builds a client from a (possibly empty) session string. */
  buildClient(session: string): TelegramClient {
    return new TelegramClient(
      new StringSession(session),
      this.apiId as number,
      this.apiHash as string,
      { connectionRetries: 5 },
    );
  }

  /** Tracks a connected client so the lifecycle hooks can manage it. */
  track(id: string, client: TelegramClient): void {
    this.clients.set(id, client);
  }

  private async restore(instance: TelegramInstance): Promise<void> {
    const session = await this.store.loadSession(instance.id);
    if (!session) {
      return;
    }
    try {
      const client = this.buildClient(session);
      await client.connect();
      const authorized = await client.isUserAuthorized();
      this.clients.set(instance.id, client);
      await this.store.update(instance.id, {
        status: authorized ? 'authorized' : 'disconnected',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to restore instance ${instance.id}: ${message}`,
      );
      await this.store.update(instance.id, { status: 'error' });
    }
  }
}
