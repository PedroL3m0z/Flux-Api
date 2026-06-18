import type { EngineKey } from './engines/engine.types';

/** Redis key for an instance's saved GramJS session string. */
export const sessionKey = (id: string): string => `telegram:session:${id}`;

/** Lifecycle status of a Telegram instance (mirrors the Prisma enum). */
export type InstanceStatus =
  | 'new'
  | 'connecting'
  | 'awaiting_qr'
  | 'password_required'
  | 'authorized'
  | 'disconnected'
  | 'error';

/** Public view of an instance (no secrets). Persisted in Postgres. */
export interface TelegramInstance {
  id: string;
  label: string;
  engine: EngineKey;
  status: InstanceStatus;
  username?: string;
  /** Non-secret part of the engine config, safe to expose (e.g. GramJS apiId). */
  apiId?: string;
  createdAt: string;
}
