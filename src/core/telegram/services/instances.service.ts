import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { Instance } from '../../prisma/generated/client';
import { deriveKey, decryptSecret, encryptSecret } from '../crypto.util';
import {
  DEFAULT_ENGINE,
  type EngineConfig,
  type EngineKey,
} from '../engines/engine.types';
import type { InstanceStatus, TelegramInstance } from '../telegram.constants';

interface CreateCreds {
  apiId?: string;
  apiHash?: string;
}

interface InstancePatch {
  status?: InstanceStatus;
  firstName?: string | null;
  username?: string | null;
  tgUserId?: bigint | null;
  phone?: string | null;
}

/**
 * Postgres-backed registry for Telegram instances and their credentials.
 * The api_hash is encrypted at rest; the public view never exposes it.
 */
@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);
  private readonly key: Buffer | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.key = deriveKey(config.get<string>('TELEGRAM_SESSION_SECRET'));
    if (!this.key) {
      this.logger.warn(
        'TELEGRAM_SESSION_SECRET not set — instance api_hash stored in plaintext',
      );
    }
  }

  async create(
    ownerId: string,
    label: string,
    engine: EngineKey = DEFAULT_ENGINE,
    creds: CreateCreds = {},
  ): Promise<TelegramInstance> {
    const row = await this.prisma.instance.create({
      data: {
        ownerId,
        label,
        engine,
        status: 'new',
        apiId: creds.apiId ? Number(creds.apiId) : null,
        apiHashEnc: creds.apiHash
          ? encryptSecret(creds.apiHash, this.key)
          : null,
      },
    });
    return this.toPublic(row);
  }

  async list(): Promise<TelegramInstance[]> {
    const rows = await this.prisma.instance.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async get(id: string): Promise<TelegramInstance | null> {
    const row = await this.prisma.instance.findUnique({ where: { id } });
    return row ? this.toPublic(row) : null;
  }

  async update(id: string, patch: InstancePatch): Promise<void> {
    await this.prisma.instance.update({ where: { id }, data: patch });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.instance.delete({ where: { id } });
  }

  /** Decrypted engine config (api_id/api_hash) for connecting an instance. */
  async getCredentials(id: string): Promise<EngineConfig> {
    const row = await this.prisma.instance.findUnique({
      where: { id },
      select: { apiId: true, apiHashEnc: true },
    });
    const config: EngineConfig = {};
    if (row?.apiId != null) {
      config.apiId = String(row.apiId);
    }
    if (row?.apiHashEnc) {
      config.apiHash = decryptSecret(row.apiHashEnc, this.key);
    }
    return config;
  }

  private toPublic(row: Instance): TelegramInstance {
    return {
      id: row.id,
      label: row.label,
      engine: row.engine as EngineKey,
      status: row.status,
      firstName: row.firstName ?? undefined,
      username: row.username ?? undefined,
      phone: row.phone ?? undefined,
      apiId: row.apiId != null ? String(row.apiId) : undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
