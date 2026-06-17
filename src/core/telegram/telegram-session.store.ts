import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import {
  INSTANCES_SET,
  instanceKey,
  sessionKey,
  type InstanceStatus,
  type TelegramInstance,
} from './telegram.constants';

const ENC_PREFIX = 'enc:v1:';

/**
 * Persists Telegram instances and their GramJS session strings in Redis.
 *
 * The session string is a full account credential, so it is encrypted at rest
 * with AES-256-GCM when TELEGRAM_SESSION_SECRET is set. Without the secret it is
 * stored in plaintext (a warning is logged once) — acceptable only for local dev
 * on a password-protected Redis.
 */
@Injectable()
export class TelegramSessionStore {
  private readonly logger = new Logger(TelegramSessionStore.name);
  private readonly key: Buffer | null;
  private warnedPlaintext = false;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('TELEGRAM_SESSION_SECRET');
    this.key = secret ? createHash('sha256').update(secret).digest() : null;
  }

  // --- Session string ---

  async saveSession(id: string, session: string): Promise<void> {
    await this.redis.set(sessionKey(id), this.encrypt(session));
  }

  async loadSession(id: string): Promise<string | null> {
    const stored = await this.redis.get(sessionKey(id));
    return stored === null ? null : this.decrypt(stored);
  }

  async deleteSession(id: string): Promise<void> {
    await this.redis.del(sessionKey(id));
  }

  // --- Instance registry ---

  async create(label: string): Promise<TelegramInstance> {
    const instance: TelegramInstance = {
      id: randomUUID(),
      label,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    await this.redis.client.hset(
      instanceKey(instance.id),
      this.serialize(instance),
    );
    await this.redis.client.sadd(INSTANCES_SET, instance.id);
    return instance;
  }

  async list(): Promise<TelegramInstance[]> {
    const ids = await this.redis.client.smembers(INSTANCES_SET);
    const instances = await Promise.all(ids.map((id) => this.get(id)));
    return instances
      .filter((i): i is TelegramInstance => i !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async get(id: string): Promise<TelegramInstance | null> {
    const hash = await this.redis.client.hgetall(instanceKey(id));
    if (!hash || Object.keys(hash).length === 0) {
      return null;
    }
    return {
      id: hash.id,
      label: hash.label,
      status: hash.status as InstanceStatus,
      username: hash.username || undefined,
      createdAt: hash.createdAt,
    };
  }

  async update(
    id: string,
    patch: Partial<Pick<TelegramInstance, 'label' | 'status' | 'username'>>,
  ): Promise<void> {
    const fields = this.serialize(patch);
    if (Object.keys(fields).length > 0) {
      await this.redis.client.hset(instanceKey(id), fields);
    }
  }

  async remove(id: string): Promise<void> {
    await this.redis.client.srem(INSTANCES_SET, id);
    await this.redis.client.del(instanceKey(id));
    await this.deleteSession(id);
  }

  // --- Helpers ---

  /** Flattens an object to a string record, dropping undefined values. */
  private serialize(obj: object): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null) {
        out[k] = String(v);
      }
    }
    return out;
  }

  private encrypt(plain: string): string {
    if (!this.key) {
      if (!this.warnedPlaintext) {
        this.logger.warn(
          'TELEGRAM_SESSION_SECRET not set — storing session in plaintext',
        );
        this.warnedPlaintext = true;
      }
      return plain;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  private decrypt(stored: string): string {
    if (!stored.startsWith(ENC_PREFIX)) {
      return stored; // plaintext (no secret was configured when saved)
    }
    if (!this.key) {
      throw new Error(
        'Encrypted Telegram session found but TELEGRAM_SESSION_SECRET is not set',
      );
    }
    const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  }
}
