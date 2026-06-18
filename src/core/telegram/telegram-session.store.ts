import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { deriveKey, decryptSecret, encryptSecret } from './crypto.util';
import { sessionKey } from './telegram.constants';

/**
 * Persists GramJS session strings in Redis — and only those. Instance metadata
 * and relations live in Postgres (see InstancesService). The session string is
 * a full account credential, so it is encrypted at rest with AES-256-GCM when
 * TELEGRAM_SESSION_SECRET is set; plaintext otherwise (a warning is logged).
 */
@Injectable()
export class TelegramSessionStore {
  private readonly logger = new Logger(TelegramSessionStore.name);
  private readonly key: Buffer | null;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.key = deriveKey(config.get<string>('TELEGRAM_SESSION_SECRET'));
    if (!this.key) {
      this.logger.warn(
        'TELEGRAM_SESSION_SECRET not set — sessions stored in plaintext',
      );
    }
  }

  async saveSession(id: string, session: string): Promise<void> {
    await this.redis.set(sessionKey(id), encryptSecret(session, this.key));
  }

  async loadSession(id: string): Promise<string | null> {
    const stored = await this.redis.get(sessionKey(id));
    return stored === null ? null : decryptSecret(stored, this.key);
  }

  async deleteSession(id: string): Promise<void> {
    await this.redis.del(sessionKey(id));
  }
}
