import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { deriveKey, decryptSecret, encryptSecret } from '../crypto.util';
import type { EngineConfig } from '../engines/engine.types';

const API_ID_KEY = 'telegram.apiId';
const API_HASH_KEY = 'telegram.apiHash';

/** Non-secret view of the global Telegram credentials for the dashboard. */
export interface TelegramSettingsView {
  apiId?: string;
  hasApiHash: boolean;
}

/**
 * Global, user-editable app settings persisted in Postgres. Currently holds the
 * default Telegram api_id/api_hash used by instances; api_hash is encrypted at
 * rest and never returned to the client.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly key: Buffer | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.key = deriveKey(config.get<string>('TELEGRAM_SESSION_SECRET'));
    if (!this.key) {
      this.logger.warn(
        'TELEGRAM_SESSION_SECRET not set — settings api_hash stored in plaintext',
      );
    }
  }

  /** Decrypted credentials for connecting (used as the instance default). */
  async getTelegramCredentials(): Promise<EngineConfig> {
    const map = await this.read();
    const config: EngineConfig = {};
    const apiId = map.get(API_ID_KEY);
    if (apiId) {
      config.apiId = apiId;
    }
    const apiHash = map.get(API_HASH_KEY);
    if (apiHash) {
      config.apiHash = decryptSecret(apiHash, this.key);
    }
    return config;
  }

  /** Secret-free view for the dashboard. */
  async getTelegramView(): Promise<TelegramSettingsView> {
    const map = await this.read();
    return {
      apiId: map.get(API_ID_KEY) || undefined,
      hasApiHash: Boolean(map.get(API_HASH_KEY)),
    };
  }

  async setTelegram(creds: {
    apiId?: string;
    apiHash?: string;
  }): Promise<TelegramSettingsView> {
    if (creds.apiId !== undefined) {
      await this.upsert(API_ID_KEY, creds.apiId);
    }
    if (creds.apiHash) {
      await this.upsert(API_HASH_KEY, encryptSecret(creds.apiHash, this.key));
    }
    return this.getTelegramView();
  }

  private async read(): Promise<Map<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [API_ID_KEY, API_HASH_KEY] } },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  private async upsert(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
