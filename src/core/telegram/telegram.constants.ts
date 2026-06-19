import type { EngineKey, TelegramMe } from './engines/engine.types';

/** Redis key for an instance's saved GramJS session string. */
export const sessionKey = (id: string): string => `telegram:session:${id}`;

/** Lifecycle status of a Telegram instance (mirrors the Prisma enum). */
export type InstanceStatus =
  | 'new'
  | 'connecting'
  | 'awaiting_qr'
  | 'awaiting_code'
  | 'password_required'
  | 'authorized'
  | 'disconnected'
  | 'error';

/** Result of a phone-login step after submitting the OTP or 2FA password. */
export type PhoneLoginStepResult =
  | { status: 'password_required' }
  | { status: 'authorized'; me: TelegramMe };

/** Public view of an instance (no secrets). Persisted in Postgres. */
export interface TelegramInstance {
  id: string;
  label: string;
  engine: EngineKey;
  status: InstanceStatus;
  firstName?: string;
  username?: string;
  phone?: string;
  /** Non-secret part of the engine config, safe to expose (e.g. GramJS apiId). */
  apiId?: string;
  createdAt: string;
  /** The requesting user's global dashboard role (same on every instance). */
  myRole?: 'admin' | 'operator' | 'viewer';
}
