/** Redis key for the membership set of all Telegram instance ids. */
export const INSTANCES_SET = 'telegram:instances';

/** Redis key for an instance's metadata hash. */
export const instanceKey = (id: string): string => `telegram:instance:${id}`;

/** Redis key for an instance's saved GramJS session string. */
export const sessionKey = (id: string): string => `telegram:session:${id}`;

/** Lifecycle status of a Telegram instance. */
export type InstanceStatus =
  | 'new'
  | 'connecting'
  | 'awaiting_qr'
  | 'password_required'
  | 'authorized'
  | 'disconnected'
  | 'error';

/** Metadata persisted in Redis for each Telegram instance. */
export interface TelegramInstance {
  id: string;
  label: string;
  status: InstanceStatus;
  username?: string;
  createdAt: string;
}
