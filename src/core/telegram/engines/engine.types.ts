/** Registered instance engines. Add new keys here as engines are implemented. */
export const ENGINE_KEYS = ['gramjs', 'telegraf'] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];

export const DEFAULT_ENGINE: EngineKey = 'gramjs';

/** DI token for the array of available InstanceEngine implementations. */
export const TELEGRAM_ENGINES = Symbol('TELEGRAM_ENGINES');

/** Identity of the account/bot behind an instance, normalized across engines. */
export interface TelegramMe {
  id: string;
  username?: string;
  firstName?: string;
  phone?: string;
}

/**
 * Per-instance engine configuration entered by the user (e.g. api_id/api_hash
 * for GramJS, bot token for Telegraf). Engine-specific; each engine reads the
 * keys it needs. Secret values are stored encrypted at rest.
 */
export type EngineConfig = Record<string, string | undefined>;

/** What an engine supports. Drives which login flow the manager may offer. */
export interface EngineCapabilities {
  /** MTProto QR login (e.g. GramJS user accounts). */
  qrLogin: boolean;
  /** MTProto phone + SMS/app code login (e.g. GramJS user accounts). */
  phoneLogin: boolean;
  /** Bot API login via a bot token (e.g. Telegraf). */
  botToken: boolean;
  /** Can list dialogs / read history / send messages / receive updates. */
  messaging: boolean;
}

export type PeerType = 'user' | 'group' | 'channel';

/** Media classification, mirrors the Prisma `MediaType` enum. */
export type MediaType =
  | 'none'
  | 'photo'
  | 'video'
  | 'document'
  | 'audio'
  | 'sticker'
  | 'other';

/** Metadata about a message's attachment; bytes are downloaded lazily. */
export interface NormalizedMedia {
  type: MediaType;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

/** Raw bytes of a downloaded media/avatar, ready to stream to the client. */
export interface MediaBlob {
  data: Buffer;
  mimeType: string;
  fileName?: string;
}

/** An uploaded file to send as a message attachment. */
export interface UploadedMedia {
  data: Buffer;
  fileName: string;
  mimeType?: string;
}

/** Engine-agnostic shapes. int64 ids cross the boundary as strings. */
export interface NormalizedContact {
  tgUserId: string;
  accessHash?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  hasPhoto?: boolean;
}

export interface NormalizedChat {
  tgPeerId: string;
  type: PeerType;
  accessHash?: string;
  title?: string;
  username?: string;
  hasPhoto?: boolean;
}

export interface NormalizedMessage {
  tgMessageId: string;
  chat: NormalizedChat;
  sender?: NormalizedContact;
  outgoing: boolean;
  text?: string;
  date: number; // unix seconds
  replyToTgId?: string;
  media?: NormalizedMedia;
}

export interface DialogSnapshot {
  chat: NormalizedChat;
  contact?: NormalizedContact; // counterpart of a 1:1 chat
  lastMessage?: NormalizedMessage;
}

/** A reaction on a message (emoji or custom emoji id) with its count. */
export interface NormalizedReaction {
  emoji?: string;
  customEmojiId?: string;
  count: number;
}

/**
 * Engine-agnostic realtime event. Discriminated by `type` so the sync layer and
 * webhook dispatcher can react uniformly across engines.
 */
export type NormalizedEvent =
  | { type: 'message.new'; message: NormalizedMessage }
  | { type: 'message.edited'; message: NormalizedMessage }
  | { type: 'message.deleted'; chat?: NormalizedChat; tgMessageIds: string[] }
  | {
      type: 'message.read';
      chat: NormalizedChat;
      maxId: string;
      /** outbound = the recipient read our messages ("seen"); inbound = we read theirs. */
      direction: 'inbound' | 'outbound';
    }
  | {
      type: 'message.reaction';
      chat: NormalizedChat;
      tgMessageId: string;
      reactions: NormalizedReaction[];
    };

/** A peer reference an engine needs to act on a chat. */
export interface PeerRef {
  tgPeerId: string;
  type: PeerType;
  accessHash?: string;
}

/** Callbacks the manager passes into an engine's QR login flow. */
export interface QrCallbacks {
  onQr(url: string, expires: number): void;
  /** Resolves with the 2FA password once the user submits it. */
  onPasswordRequired(): Promise<string>;
}

/** Callbacks the manager passes into an engine's phone login flow. */
export interface PhoneCallbacks {
  /** Called once Telegram has sent the login code to the user's app/SMS. */
  onCodeSent(): void;
  /** Resolves with the OTP the user received. */
  onCodeRequired(): Promise<string>;
  /** Resolves with the 2FA password when the account has it enabled. */
  onPasswordRequired(): Promise<string>;
}

/**
 * A live, connected handle to one instance's underlying client. Engine-specific
 * implementations wrap their native client (GramJS TelegramClient, Telegraf Bot,
 * …) behind this uniform contract.
 */
export interface EngineClient {
  isAuthorized(): Promise<boolean>;
  disconnect(): Promise<void>;
  getMe(): Promise<TelegramMe | null>;
  /** Serializes the session for persistence in Redis. */
  saveSession(): string;
  /** Present only when capabilities.qrLogin is true. */
  qrLogin?(callbacks: QrCallbacks): Promise<TelegramMe>;
  /** Present only when capabilities.phoneLogin is true. */
  phoneLogin?(phone: string, callbacks: PhoneCallbacks): Promise<TelegramMe>;

  // --- Messaging (present only when capabilities.messaging is true) ---
  listDialogs?(limit?: number): Promise<DialogSnapshot[]>;
  getHistory?(
    peer: PeerRef,
    opts?: { limit?: number; beforeId?: string },
  ): Promise<NormalizedMessage[]>;
  sendMessage?(peer: PeerRef, text: string): Promise<NormalizedMessage>;
  /** Sends a file (photo/video/document) with an optional caption. */
  sendMedia?(
    peer: PeerRef,
    file: UploadedMedia,
    caption?: string,
  ): Promise<NormalizedMessage>;
  /**
   * Subscribes to realtime events (new/edited/deleted messages, read receipts,
   * reactions); returns an unsubscribe function.
   */
  onEvent?(handler: (event: NormalizedEvent) => void): () => void;
  /** Downloads a peer's profile/group photo; null when there is none. */
  downloadAvatar?(peer: PeerRef): Promise<MediaBlob | null>;
  /** Downloads a message's attachment bytes; null when absent/unavailable. */
  downloadMessageMedia?(
    peer: PeerRef,
    tgMessageId: string,
  ): Promise<MediaBlob | null>;
}

/**
 * A pluggable engine that runs Telegram instances. The manager stays
 * engine-agnostic and delegates connecting/authenticating to the engine
 * resolved from each instance's `engine` field.
 */
export interface InstanceEngine {
  readonly key: EngineKey;
  readonly capabilities: EngineCapabilities;
  /** True when the engine is implemented and usable (creds come per-instance). */
  isAvailable(): boolean;
  /** Lists the config keys this engine requires (for create-time validation). */
  requiredConfig(): string[];
  /** Builds and connects a client from a session string + per-instance config. */
  connect(session: string, config: EngineConfig): Promise<EngineClient>;
}
